import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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
      db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || firebaseConfig.projectId);
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
        model: 'gemini-3.5-flash',
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

  // WhatsApp Webhook endpoint
  app.post('/api/webhook/whatsapp-bot', async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY do Gemini não está configurada nos segredos.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Parse incoming WhatsApp message variables depending on payload format (direct, twilio, or standard)
      let incomingText = '';
      let fileData = '';
      let mimeType = '';
      let sender = 'WhatsApp User';

      // Support multi-format input
      if (req.body.Body) {
        // Twilio
        incomingText = req.body.Body;
        sender = req.body.From || 'WhatsApp';
      } else if (req.body.data && req.body.data.message) {
        // Evolution API/WppConnect format
        const msg = req.body.data.message;
        incomingText = msg.conversation || msg.extendedTextMessage?.text || '';
        sender = req.body.data.key?.remoteJid || 'User';
      } else {
        // Direct format (Simulator / Generic JSON Payload)
        incomingText = req.body.text || '';
        fileData = req.body.fileData || '';
        mimeType = req.body.mimeType || '';
        sender = req.body.sender || '5511999999999';
      }

      if (!incomingText && !fileData) {
        return res.status(400).json({ error: 'Nenhum texto ou foto foi enviado no webhook.' });
      }

      let parsedResult: any = {
        intent: 'fallback',
        assistantReplyText: 'Desculpe, não entendi o comando. Tente algo como "adicionar 3 sabonetes e 2 leites" ou "lançar conta Enel 135 vencimento 12/06".'
      };

      if (fileData && mimeType) {
        // OCR Analysis for bills & store receipts
        const inlinePart = {
          inlineData: {
            data: fileData,
            mimeType: mimeType,
          },
        };

        const imagePrompt = {
          text: `Você é o assistente inteligente "Lar em Ordem" para WhatsApp.
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
          - "assistantReplyText": Mensagem explicativa em português (Brasil) para o WhatsApp usando negritos *texto* detalhando o que foi reconhecido com sucesso e lançado na Nuvem do Lar em Ordem.`
        };

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
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

      } else {
        // Natural language instruction for shopping items or launching bills
        const textPrompt = `Você é o bot inteligente "Lar em Ordem" para WhatsApp. O usuário enviará uma mensagem de texto querendo:
        a) Lançar uma conta de casa (Exemplos: "lançar conta Sabesp R$ 56 vencimento 10/06", "conta de luz Enel 120,50 para dia 25")
        b) Adicionar mantimentos/itens na lista de compras (Exemplos: "colocar 3 sabonetes e 2 leites na lista", "adicionar arroz, feijão e chocolate de sobremesa", "detergente 1, agua sanitaria 2, macarrao 4")
        
        Identifique a intenção ('bill' ou 'shopping') e extraia os detalhes.
        Para 'shopping' (lista de compras):
           Mapeie os itens solicitados em:
           "shoppingItems": array de objetos contendo:
              - "name": nome limpo do produto (ex: "Sabonete Dove")
              - "quantity": unidade numérica (default 1)
              - "category": classificação inteligente baseada no nome (uma entre: "Alimentos", "Bebidas", "Limpeza", "Higiene", "Outros")
              
        Para 'bill' (lançar conta da casa):
           Mapeie a conta em:
           "bill": objeto contendo:
              - "type": tipo exato ("agua", "energia", "racao_gatos", "racao_cachorro", "outros")
              - "customTitle": se tipo for "outros", coloque o nome (ex: "Internet Claro"). Para água/luz coloque o fornecedor (ex: "Sabesp" ou "Enel").
              - "value": valor numérico float (ex: 56.40)
              - "dueDate": data de vencimento "YYYY-MM-DD". Hoje é dia 2026-06-01 (segunda-feira). Calcule o ano/mês corretamente.

        Retorne obrigatoriamente uma estrutura JSON contendo os campos descritos e uma mensagem amigável:
        - "intent": "bill" | "shopping" | "fallback"
        - "assistantReplyText": Mensagem simpática de retorno formatada com Markdown do WhatsApp (asteriscos * para negrito, listagens amigáveis) resumindo e confirmando as inserções da nuvem.` +
        `\n\nMensagem do WhatsApp enviada pelo usuário: "${incomingText}"`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
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
      }

      // Persist values in Firestore database if configuration exists
      if (db) {
        if (parsedResult.intent === 'shopping' && parsedResult.shoppingItems && parsedResult.shoppingItems.length > 0) {
          for (const item of parsedResult.shoppingItems) {
            const itemId = `shop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            
            // Normalize product category
            let cat = item.category || 'Outros';
            if (!['Alimentos', 'Bebidas', 'Limpeza', 'Higiene', 'Outros'].includes(cat)) {
              cat = 'Outros';
            }

            const newItem = {
              id: itemId,
              name: item.name || 'Sem nome',
              quantity: Number(item.quantity) || 1,
              category: cat,
              checked: false,
              date: '',
              concluded: false
            };
            
            await setDoc(doc(db, 'shopping_items', itemId), newItem);
          }
        } else if (parsedResult.intent === 'bill' && parsedResult.bill) {
          const b = parsedResult.bill;
          const billId = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          
          let bType = b.type || 'outros';
          if (!['agua', 'energia', 'racao_gatos', 'racao_cachorro', 'outros'].includes(bType)) {
            bType = 'outros';
          }

          const dueDateVal = b.dueDate || new Date().toISOString().split('T')[0];
          const billMonth = dueDateVal.substring(0, 7);

          const newBill = {
            id: billId,
            type: bType,
            customTitle: b.customTitle || '',
            value: Number(b.value) || 0,
            dueDate: dueDateVal,
            month: billMonth,
            paid: false
          };

          await setDoc(doc(db, 'bills', billId), newBill);
        }
      }

      return res.json({
        success: true,
        replyText: parsedResult.assistantReplyText,
        intent: parsedResult.intent,
        data: parsedResult
      });

    } catch (err: any) {
      console.error('Error in WhatsApp bot execution: ', err);
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Falha ao processar comando da IA.'
      });
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
