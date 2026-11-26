-- Atribución de cada venta de Hotmart (sck completo, clic de ChatGPT Ads) y resultado del envío a la
-- Conversions API de OpenAI. La llena functions/api/hotmart-webhook.js (v4).
CREATE TABLE IF NOT EXISTS hotmart_atribucion (
  transaction_code TEXT PRIMARY KEY,
  sck TEXT,
  oppref TEXT,
  obref TEXT,
  openai TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
