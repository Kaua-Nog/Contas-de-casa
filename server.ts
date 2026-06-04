import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

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
      db = initializeFirestore(firebaseApp, {
        experimentalForceLongPolling: true
      }, firebaseConfig.firestoreDatabaseId || undefined);
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
        model: 'gemini-3.1-flash-lite',
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



  async function sendWhatsAppMessage(instance: string, jid: string, text: string) {
    const url = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    if (!url || !apiKey) {
      console.warn('[Assistant Bot] Faltando EVOLUTION_API_URL ou EVOLUTION_API_KEY no .env, ignorando envio de resposta.');
      return;
    }
    try {
      const fetchUrl = `${url.replace(/\/$/, '')}/message/sendText/${instance}`;
      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
           number: jid,
           options: {
             delay: 1200,
             presence: 'composing'
           },
           textMessage: {
             text: text
           }
        })
      });
      const resText = await res.text();
      console.log(`[Assistant Bot] Mensagem enviada via Evolution: ${res.status} - ${resText}`);
    } catch(e) {
      console.error(`[Assistant Bot] Falha ao enviar mensagem resposta via Evolution:`, e);
    }
  }

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
        
        É uma conta residencial futura a pagar (água, energia/eletricidade, ração cães/gatos mensais, internet) ou um comprovante/cupom de supermercado com produtos já comprados?
        
        Se for uma conta/fatura a pagar, use a estrutura:
        - "intent": "bill"
        - "bill": objeto contendo:
            - "type": obrigatoriamente um entre: "agua", "energia", "racao_gatos", "racao_cachorro", "outros"
            - "customTitle": nome do fornecedor/emissor (máximo 30 caracteres, ex: "SABESP", "Enel", "PETZ", "Boleto Internet")
            - "value": valor numérico float da conta (ex: 135.90)
            - "dueDate": data de vencimento no formato "YYYY-MM-DD". Hoje é 2026-06-03. Se encontrar somente dia/mês, assuma o ano corrente (2026).
            
        Se for um comprovante/cupom fiscal de mercado com mercadorias já pagas, use a estrutura:
        - "intent": "shopping_receipt"
        - "shoppingItems": array de objetos, onde cada um contém:
            - "name": nome descritivo do produto (ex: "Detergente Ypê", "Arroz Tio João 5kg")
            - "quantity": unidade numérica independente de medição (ex: para 1 bandeja de queijo pesado, coloque 1, e não o peso em kg).
            - "category": obrigatoriamente um entre: "Alimentos", "Bebidas", "Limpeza", "Higiene", "Outros"
            - "price": o valor PAGO pela unidade deste produto. ***ATENÇÃO A PRODUTOS POR PESO (QUEIJO, CARNE, MORTADELA, UVA ETC)***: O 'price' deve ser o VALOR TOTAL EFETIVAMENTE PAGO POR AQUELE ITEM (MUITAS VEZES É A TERCEIRA OU ÚLTIMA COLUNA DA LINHA) e NUNCA o valor inteiro do Quilo. Por exemplo, se o Queijo custa 42,98/kg e comprou 9,37, a quantity deve ser 1 e o price deve ser 9.37. Nunca coloque o valor total de múltiplos produtos no campo unitário (divida se necessário).

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
                    category: { type: Type.STRING },
                    price: { type: Type.NUMBER }
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
      
      Classifique a intenção do usuário em 4 categorias exatas:
      1) "bill": Comando claro para lançar/adicionar uma conta ou despesa, incluindo ração de animais ("ração", "racao do cachorro", "conta de água"). (Ex: "lançar conta Sabesp 50", "ração do cachorro 100")
      2) "shopping": Comando listando produtos ou pedindo para adicionar itens ao mercado/farmácia. (Ex: "colocar 3 sabonetes na lista", "detergente 1, arroz", "comprar: leite")
      3) "query_list": Usuário perguntando o que tem na lista de compras no momento (ex: "o que tem na lista?", "o que falta comprar?", "manda a lista").
      4) "fallback": QUALQUER outra coisa. Mensagens incompletas, chat normal, saudações ("bom dia", "tudo bem?", "me ajuda"), áudios não transcritos, PDFs etc. Você DEVE marcar como "fallback" se não for conta, nem lista, nem consulta.
      
      Para 'shopping' (lista de compras):
         Extraia:
         "shoppingItems": array de:
            - "name": nome do produto (ex: "Sabonete Dove")
            - "quantity": unidade numérica
            - "category": ("Alimentos", "Bebidas", "Limpeza", "Higiene", "Outros")
            - "price": opcional, o valor caso informado (numérico).
            
      Para 'bill' (lançar conta da casa/despesa):
         Extraia:
         "bill": objeto contendo:
            - "type": Classifique EXATAMENTE em um destes: "agua", "energia", "racao_gatos", "racao_cachorro", "outros".
            - "customTitle": O nome amigável/fornecedor.
            - "value": float do valor (ex: para "100 reais" use 100.0). Se o valor não for especificado, coloque 0.
            - "dueDate": Data no formato "YYYY-MM-DD". Se não for dito o dia, use a data de hoje. Se apenas o mês e dia for dito, use o ano atual. Hoje é ${new Date().toISOString().split('T')[0]}.
            
      Para 'fallback' e 'query_list':
         Não adicione arrays nem objetos extrínsecos.

      Retorne APENAS um JSON válido contendo:
      - "intent": "bill" | "shopping" | "query_list" | "fallback"
      - "assistantReplyText": Se for 'fallback', escreva exatamente "[Ignorado] Conversa normal.". Se for válido, crie um resumo curto do que foi detectado ou uma resposta proativa.
      
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
                    category: { type: Type.STRING },
                    price: { type: Type.NUMBER }
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
        if (parsedResult.intent === 'query_list') {
          console.log(`[Assistant Bot] Consultando lista de compras...`);
          const shopCol = collection(db, 'shopping_items');
          const qFilter = query(shopCol, where('concluded', '==', false));
          const snap = await getDocs(qFilter);
          const items = snap.docs.map(doc => doc.data()).filter(i => !i.checked);
          
          if (items.length === 0) {
            parsedResult.assistantReplyText = "🛒 *Sua lista de compras está vazia no momento (ou todos os itens já estão no carrinho)!*";
          } else {
            let reply = "🛒 *Sua Lista de Compras (Faltando):*\n";
            const byCat: Record<string, any[]> = {};
            let totalEstimado = 0;
            items.forEach(i => {
              if (!byCat[i.category]) byCat[i.category] = [];
              byCat[i.category].push(i);
            });
            for (const cat in byCat) {
              reply += `\n*${cat}*\n`;
              byCat[cat].forEach(i => {
                const itemTotal = (i.price || 0) * (i.quantity || 1);
                totalEstimado += itemTotal;
                if (i.price && i.price > 0) {
                  reply += `• ${i.name} (${i.quantity}x) - R$ ${i.price.toFixed(2).replace('.', ',')}\n`;
                } else {
                  reply += `• ${i.name} (${i.quantity})\n`;
                }
              });
            }
            if (totalEstimado > 0) {
               reply += `\n*Total Estimado: R$ ${totalEstimado.toFixed(2).replace('.', ',')}*\n`;
            }
            parsedResult.assistantReplyText = reply;
          }
        } else if ((parsedResult.intent === 'shopping' || parsedResult.intent === 'shopping_receipt') && parsedResult.shoppingItems && parsedResult.shoppingItems.length > 0) {
          console.log(`[Assistant Bot] Salvando ${parsedResult.shoppingItems.length} compras no Firestore...`);
          const isReceipt = parsedResult.intent === 'shopping_receipt';
          const receiptId = isReceipt ? `receipt-${Date.now()}` : null;
          
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
              price: item.price ? Number(String(item.price).replace(',', '.')) : 0,
              checked: isReceipt,
              source: isReceipt ? 'receipt' : 'manual',
              receiptId: receiptId || null,
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
      console.log(`[Webhook] Recebendo payload bruto. Array? ${Array.isArray(body)}. body:`, JSON.stringify(body).substring(0, 500));

      // Se for um array de eventos (lotes), ou se o evento estiver na raiz
      // Evolution API envia { event: 'messages.upsert', data: { ... } }
      const events = Array.isArray(body) ? body : [body];

      for (const payload of events) {
        // Pega data, pode vir encapsulado dependendo da api
        const data = payload?.data || payload; 
        
        // Evolution API usa data.message. Se for array de mensagens
        const messages = Array.isArray(data?.message) ? data?.message : (data?.messages || [data]);
        
        for (const msg of messages) {
          if (!msg) continue;
          
          let remoteJid = msg?.key?.remoteJid || data?.key?.remoteJid;
          
          if (!remoteJid) {
            continue;
          }

          // Permite comandos de qualquer grupo/chat para o usuário poder testar livremente
          if (remoteJid.endsWith('@g.us')) {
            console.log(`[Webhook] Mensagem de grupo detectada: ${remoteJid}`);
          }

          if (msg?.key?.fromMe || data?.key?.fromMe) {
            console.log('[Webhook] Mensagem enviada pelo próprio número do bot. Ignorando.');
            continue;
          }

          // Extrai o texto da mensagem (Baileys/Evolution API)
          const messageContent = msg?.message?.conversation 
                              || msg?.message?.extendedTextMessage?.text 
                              || data?.message?.extendedTextMessage?.text
                              || data?.message?.conversation
                              || msg?.message?.imageMessage?.caption
                              || data?.message?.imageMessage?.caption
                              || msg?.message?.documentMessage?.caption
                              || data?.message?.documentMessage?.caption
                              || '';

          let base64Raw = msg?.message?.base64 || data?.base64 || msg?.base64 
                       || data?.message?.imageMessage?.base64 || msg?.message?.imageMessage?.base64 
                       || data?.message?.documentMessage?.base64 || msg?.message?.documentMessage?.base64 || '';
          
          let mimeType = msg?.message?.imageMessage?.mimetype || data?.message?.imageMessage?.mimetype 
                      || msg?.message?.documentMessage?.mimetype || data?.message?.documentMessage?.mimetype || '';

          if (typeof base64Raw === 'string' && base64Raw.includes('base64,')) {
             base64Raw = base64Raw.split('base64,')[1];
          }

          if (!messageContent && !base64Raw) {
             console.log(`[Webhook] Mensagem do grupo alvo não continha texto nem mídia. Ignorando.`);
             continue;
          }

          console.log(`[Webhook] Mensagem capturada do grupo. Texto: "${messageContent}", Mime: ${mimeType}, Tem Media? ${!!base64Raw}`);

          // Envia para o pipeline da IA que analisa e salva no Firestore
          try {
            const botResult = await handleChatLogic({ text: messageContent, fileData: base64Raw, mimeType: mimeType }, db);
            console.log(`[Webhook] handleChatLogic finalizado com sucesso para: "${messageContent}"`);
            
            const reply = botResult?.assistantReplyText || '';
            const instanceId = payload?.instance || 'AppCasa';
            
            if (reply && !reply.includes('[Ignorado]') && botResult?.intent !== 'fallback') {
              console.log(`[Webhook] Enviando resposta para Whatsapp via Evolution...`);
              await sendWhatsAppMessage(instanceId, remoteJid, reply);
            } else {
              console.log(`[Webhook] Resposta ignorada de propósito (Fallback/Conversa).`);
            }
          } catch (logicErr: any) {
            console.error(`[Webhook Erro Analítico] Falha ao processar a IA:`, logicErr?.message || logicErr);
          }
        }
      }

      // Retorna 200 no final.
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Webhook Error Fatal]:', error?.message || error);
      res.status(500).json({ error: 'Erro interno no webhook', details: error?.message });
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
