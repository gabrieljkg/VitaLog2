import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/emit-nfce", async (req, res) => {
    try {
      const { storeSettings, saleData } = req.body;
      
      if (!storeSettings) {
        return res.status(400).json({ error: "Configurações da loja ausentes" });
      }

      const isProd = storeSettings.focus_environment === 'producao';
      const token = isProd ? storeSettings.focus_token_prod : storeSettings.focus_token_homolog;
      const baseUrl = isProd ? "https://api.focusnfe.com.br/v2" : "https://homologacao.focusnfe.com.br/v2";

      if (!token) {
        return res.status(400).json({ error: "Token da API Focus NFe não configurado para o ambiente selecionado." });
      }

      // Referência única da venda
      const ref = saleData.reference || Date.now().toString();

      // Dispara a nota para a API Focus NFe
      const response = await fetch(`${baseUrl}/nfce?ref=${ref}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${Buffer.from(token + ":").toString("base64")}`
        },
        body: JSON.stringify(saleData.payload)
      });

      const responseData = await response.json();

      if (response.ok || responseData.status === "processando" || responseData.status === "autorizado") {
        // Focus NFe pode retornar o status autorizado e os caminhos do PDF/XML
        // Ajuste de acordo com a resposta exata da API
        res.json({
          success: true,
          status: responseData.status,
          url_pdf: responseData.caminho_danfe,
          url_xml: responseData.caminho_xml_nota_fiscal,
          raw_response: responseData
        });
      } else {
        res.status(response.status).json({ success: false, error: responseData });
      }
    } catch (error: any) {
      console.error("Erro na emissão NFC-e:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
