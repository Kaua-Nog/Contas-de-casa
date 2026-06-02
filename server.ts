import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firestore
  let db: any = null;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const firebaseApp = initializeApp(firebaseConfig);
      db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || undefined);
      console.log('Firebase initialized successfully inside server.ts with databaseId: ', firebaseConfig.firestoreDatabaseId);
    } else {
      console.warn('firebase-applet-config.json not found inside server.ts!');
    }
  } catch (fbInitErr) {
    console.error('Error initializing Firebase on server side: ', fbInitErr);
  }

  // Set a generous JSON limit to accommodate base64 image/PDF uploads
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  // API endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.post('/api/analyze-bill', async (req, res): Promise<any> => {
    try {
      const { fileData, mimeType } = req.body;

      if (!fileData || !mimeType) {
        return res.status(400).json({ error: 'Os parâmetros fileData (base64) e mimeType são obrigatórios.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'A chave de API do Gemini (GEMINI_API_KEY) não está configurada nos segredos do projeto.'
        });
      }

      // Initialize GoogleGenAI SDK safely
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Prepare payload parts for the Gemini model
      const inlinePart = {
        inlineData: {
          data: fileData,
          mimeType,
        },
      };

      const promptPart = {
        text: `Analise cuidadosamente esta fatura de conta doméstica ou comprovante de despesa e extraia as informações estruturadas de faturamento.
        Seja preciso ao tentar ler as marcas, nomes de companhias de eletricidade/água, datas de vencimento e valores.
        Retorne os detalhes nos campos específicos:
        - "type": selecione entre as seguintes categorias exatas: "agua" (se for conta de água/saneamento), "energia" (se for eletricidade/luz/força), "racao_gatos" (ração para gatos ou pet shop gatos), "racao_cachorro" (ração para cachorros ou pet shop cães) ou "outros" (quaisquer despesas gerais, compras, serviços de internet, aluguel, cupons fiscais, etc.). Se não houver certeza, use "outros".
        - "customTitle": o nome do provedor, concessionária de serviços ou título descritivo abreviado (ex: "SABESP", "Enel", "PETZ", "Vivo Fibra", "Supermercado Extra"). Máximo 30 caracteres. Se for de outro tipo que não "outros", coloque o nome do fornecedor (ex: "Enel Distribuidora" para energia).
        - "value": o valor numérico total a ser pago ou cobrado, em formato decimal (ex: 145.90). Certifique-se de obter o valor final correto da fatura.
        - "dueDate": a data de vencimento em formato ISO "YYYY-MM-DD". Se for um cupom ou comprovante e não houver data futura de vencimento, use a data de emissão ou compra no mesmo formato. Se não for possível encontrar o ano atual e parecer ser um mês específico, determine o ano correspondente (hoje é 2026-05-29).`
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [inlinePart, promptPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "The type category of this bill: must be one of 'agua', 'energia', 'racao_gatos', 'racao_cachorro', 'outros'."
              },
              customTitle: {
                type: Type.STRING,
                description: "Name of provider, supplier, business or clear label for this expense."
              },
              value: {
                type: Type.NUMBER,
                description: "Total value to be paid/already paid on the receipt, represented as a float number."
              },
              dueDate: {
                type: Type.STRING,
                description: "Due date in YYYY-MM-DD format."
              }
            },
            required: ['type', 'customTitle', 'value', 'dueDate']
          }
        }
      });

      const rawText = response.text || '';
      const cleanedText = rawText.trim();
      
      try {
        const extractedData = JSON.parse(cleanedText);
        return res.json({ success: true, data: extractedData });
      } catch (parseError) {
        console.error('Failed to parse JSON result from Gemini API: ', cleanedText, parseError);
        return res.status(502).json({
          error: 'O modelo inteligente de IA não retornou um formato de dados esperado. Por favor, tente novamente.',
          rawResponse: cleanedText
        });
      }
    } catch (error: any) {
      console.error('Error during bill analysis: ', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha desconhecida no servidor ao analisar a conta com IA.'
      });
    }
  });



  // Core business logic handler for the Chat Assistant
  async function handleChatLogic(reqBody: any, db: any) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY do Gemini não está configurada nos segredos.');
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const incomingText = reqBody.text || '';
    const fileData = reqBody.fileData || '';
    const mimeType = reqBody.mimeType || '';

    console.log(`[Assistant Bot] Informações carregadas para processamento:`, {
      hasIncomingText: !!incomingText,
      hasFileData: !!fileData,
      mimeType
    });

    if (!incomingText && !fileData) {
      console.warn('[Assistant Bot] Erro: Requisição não continha texto e nem arquivo válido.');
      throw new Error('Nenhum texto ou foto foi enviado.');
    }

    let parsedResult: any = {
      intent: 'fallback',
      assistantReplyText: 'Desculpe, não entendi o comando. Tente algo como "adicionar 3 sabonetes e 2 leites" ou "lançar conta Enel 135 vencimento 12/06".'
    };

    if (fileData && mimeType) {
      console.log(`[Assistant Bot] Enviando imagem para o modelo Gemini-3.1-flash-lite...`);
      const inlinePart = {
        inlineData: {
          data: fileData,
          mimeType: mimeType,
        },
      };

      const imagePrompt = {
        text: `Você é o assistente inteligente "Lar em Ordem".
        O usuário enviou uma FOTO de um boleto/conta de consumo OU cupom fiscal de compras realizadas.
        Analise a foto detalhadamente e identifique:
        
        É uma conta residencial futura a pagar (água, energia/eletricidade, ração cães/gatos mensais, internet) ou um cupom de supermercado já pago com produtos comprados?
        
        Se for uma conta/fatura a pagar, use a estrutura:
        - "intent": "bill"
        - "bill": objeto contendo:
            - "type": obrigatoriamente um entre: "agua", "energia", "racao_gatos", "racao_cachorro", "outros"
            - "customTitle": nome do fornecedor/emissor (máximo 30 caracteres, ex: "SABESP", "Enel", "PETZ", "Boleto Internet")
            - "value": valor numérico float da conta (ex: 135.90)
            - "dueDate": data de vencimento no formato "YYYY-MM-DD". Hoje é 2026-06-01 (segunda-feira). Se encontrar somente dia/mês, assuma o ano corrente (2026).
            
        Se for um cupom fiscal de mercado com mercadorias, use a estrutura:
        - "intent": "shopping"
        - "shoppingItems": array de objetos, onde cada um contém:
            - "name": nome descritivo do produto (ex: "Detergente Ypê", "Arroz Tio João 5kg")
            - "quantity": unidade numérica (ex: 1, 3, etc.)
            - "category": obrigatoriamente um entre: "Alimentos", "Bebidas", "Limpeza", "Higiene", "Outros"

        Retorne um JSON contendo a marcação apropriada e a resposta:
        - "assistantReplyText": Mensagem explicativa em português (Brasil) detalhando o que foi reconhecido com sucesso e lançado na Nuvem do Lar em Ordem.`
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [inlinePart, imagePrompt] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING },
              assistantReplyText: { type: Type.STRING },
              bill: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  customTitle: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  dueDate: { type: Type.STRING }
                }
              },
              shoppingItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    category: { type: Type.STRING }
                  },
                  required: ['name', 'quantity', 'category']
                }
              }
            },
            required: ['intent', 'assistantReplyText']
          }
        }
      });

      parsedResult = JSON.parse(response.text || '{}');
      console.log(`[Assistant Bot] Recebemos resposta da IA:`, parsedResult);

    } else {
      console.log(`[Assistant Bot] Enviando texto "${incomingText}" para a IA...`);
      const textPrompt = `Você é o assistente inteligente "Lar em Ordem" que lê um grupo do WhatsApp.
      Sua tarefa central é IDENTIFICAR O QUE É UM COMANDO VÁLIDO E O QUE É CONVERSA NORMAL.
      
      Classifique a intenção do usuário em 3 categorias exatas:
      1) "bill": Comando claro para lançar/adicionar uma conta ou despesa. (Ex: "lançar conta Sabesp 50", "conta de luz Enel 120,50")
      2) "shopping": Comando listando produtos ou pedindo para adicionar itens ao mercado/farmácia. (Ex: "colocar 3 sabonetes na lista", "detergente 1, arroz", "comprar: leite")
      3) "fallback": QUALQUER outra coisa. Mensagens incompletas, chat normal, saudações ("bom dia", "tudo bem?", "me ajuda"), áudios não transcritos, PDFs etc. Você DEVE marcar como "fallback" se não for conta e nem lista de mercado.
      
      Para 'shopping' (lista de compras):
         Extraia:
         "shoppingItems": array de:
            - "name": nome do produto (ex: "Sabonete Dove")
            - "quantity": unidade numérica
            - "category": ("Alimentos", "Bebidas", "Limpeza", "Higiene", "Outros")
            
      Para 'bill' (lançar conta da casa):
         Extraia:
         "bill": objeto contendo:
            - "type": ("agua", "energia", "racao_gatos", "racao_cachorro", "outros")
            - "customTitle": nome do fornecedor ou título
            - "value": float do valor
            - "dueDate": "YYYY-MM-DD" (Hoje: formatado localmente).
            
      Para 'fallback' (Conversa normal):
         Não adicione arrays nem objetos extrínsecos.

      Retorne APENAS um JSON válido contendo:
      - "intent": "bill" | "shopping" | "fallback"
      - "assistantReplyText": Se for 'fallback', escreva exatamente "[Ignorado] Conversa normal.". Se for válido, crie um resumo curto do que foi detectado.
      
      \nMensagem do usuário: "${incomingText}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: textPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING },
              assistantReplyText: { type: Type.STRING },
              bill: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  customTitle: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  dueDate: { type: Type.STRING }
                }
              },
              shoppingItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    category: { type: Type.STRING }
                  },
                  required: ['name', 'quantity', 'category']
                }
              }
            },
            required: ['intent', 'assistantReplyText']
          }
        }
      });

      parsedResult = JSON.parse(response.text || '{}');
      console.log(`[Assistant Bot] Resposta obtida da IA:`, parsedResult);
    }

    if (db) {
      try {
        if (parsedResult.intent === 'shopping' && parsedResult.shoppingItems && parsedResult.shoppingItems.length > 0) {
          console.log(`[Assistant Bot] Salvando ${parsedResult.shoppingItems.length} compras no Firestore...`);
          for (const item of parsedResult.shoppingItems) {
            const itemId = `shop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            
            let cat = item.category || 'Outros';
            if (!['Alimentos', 'Bebidas', 'Limpeza', 'Higiene', 'Outros'].includes(cat)) {
              cat = 'Outros';
            }

            const rawQuant = String(item.quantity).replace(',', '.');
            let q = Number(rawQuant);
            if (isNaN(q) || q < 1) q = 1;

            const newItem = {
              id: itemId,
              name: String(item.name || 'Sem nome').substring(0, 100),
              quantity: q,
              category: String(cat).substring(0, 50),
              checked: false,
              date: new Date().toISOString().split('T')[0],
              concluded: false
            };
            
            await setDoc(doc(db, 'shopping_items', itemId), newItem);
            console.log('[Assistant Bot] Item inserido.');
          }
        } else if (parsedResult.intent === 'bill' && parsedResult.bill) {
          console.log('[Assistant Bot] Salvando conta no Firestore:', parsedResult.bill);
          const b = parsedResult.bill;
          const billId = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          
          let bType = b.type || 'outros';
          if (!['agua', 'energia', 'racao_gatos', 'racao_cachorro', 'outros'].includes(bType)) {
            bType = 'outros';
          }

          let dueDateVal = String(b.dueDate || new Date().toISOString().split('T')[0]).trim();
          if (dueDateVal.length > 10) {
            dueDateVal = dueDateVal.substring(0, 10);
          } else if (dueDateVal.length < 10) {
            dueDateVal = new Date().toISOString().split('T')[0];
          }
          const billMonth = dueDateVal.substring(0, 7);

          const rawVal = String(b.value).replace(',', '.');
          let val = Number(rawVal);
          if (isNaN(val) || val < 0) val = 0;

          const newBill = {
            id: billId,
            type: bType,
            customTitle: String(b.customTitle || '').substring(0, 100),
            value: val,
            dueDate: dueDateVal,
            month: billMonth,
            paid: false
          };

          await setDoc(doc(db, 'bills', billId), newBill);
          console.log('[Assistant Bot] Conta inserida.');
        }
      } catch (fbWriteErr) {
        console.error('[Assistant Bot] Erro grave do Firestore durante a persistência:', fbWriteErr);
      }
    } else {
      console.warn('[Assistant Bot] Banco de dados indisponível (db está nulo).');
    }

    return parsedResult;
  }

  // Assistant Chat endpoint
  app.post('/api/chat', async (req, res): Promise<any> => {
    try {
      const result = await handleChatLogic(req.body, db);
      return res.json({
        success: true,
        replyText: result.assistantReplyText,
        intent: result.intent,
        data: result
      });
    } catch (err: any) {
      console.error('[Assistant Bot Error]:', err);
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Falha ao processar comando.'
      });
    }
  });

  // Evolution/Baileys WhatsApp API Webhook Endpoint
  app.post('/api/webhook/whatsapp', async (req, res): Promise<any> => {
    try {
      const body = req.body;
      
      // Retorna 200 rápido para ack do webhook
      res.status(200).json({ received: true });

      // Se for um array de eventos (lotes), ou se o evento estiver na raiz
      // Evolution API envia { event: 'messages.upsert', data: { ... } }
      const events = Array.isArray(body) ? body : [body];

      for (const payload of events) {
        // Pega data, pode vir encapsulado dependendo da api
        const data = payload.data || payload; 
        
        // Evolution API usa data.message. Se for array de mensagens
        const messages = Array.isArray(data.message) ? data.message : (data.messages || [data]);
        
        for (const msg of messages) {
          if (!msg) continue;
          
          let remoteJid = msg?.key?.remoteJid || data?.key?.remoteJid;
          
          // FILTRO DO GRUPO (o mesmo ID que usava no Make)
          if (remoteJid !== '120363428218497591@g.us') {
            console.log(`[Webhook] Mensagem ignorada do JID: ${remoteJid}`);
            continue;
          }

          // Extrai o texto da mensagem (Baileys/Evolution API)
          const messageContent = msg?.message?.conversation 
                              || msg?.message?.extendedTextMessage?.text 
                              || data?.message?.extendedTextMessage?.text
                              || data?.message?.conversation
                              || '';

          if (!messageContent) continue;

          console.log(`[Webhook] Mensagem capturada do grupo alvo: "${messageContent}"`);

          // Envia para o pipeline da IA que analisa e salva no Firestore
          await handleChatLogic({ text: messageContent }, db);
        }
      }
    } catch (error) {
      console.error('[Webhook Error]:', error);
    }
  });

  // Setup Vite Dev Server / Static Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server starting and listening on http://0.0.0.0:${PORT} in env: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch((err) => {
  console.error('Error starting server: ', err);
});
