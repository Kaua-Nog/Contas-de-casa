import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

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
