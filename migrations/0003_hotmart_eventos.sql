-- Base de compradores y eventos de Hotmart (la alimenta functions/api/hotmart-webhook.js).
-- Cada evento del webhook es una fila (histórico auditable); el estado vigente de una
-- transacción es su último evento. UNIQUE(transaction_code, event) absorbe los reintentos
-- de Hotmart sin duplicar.
CREATE TABLE IF NOT EXISTS hotmart_eventos (
  id TEXT PRIMARY KEY,
  transaction_code TEXT NOT NULL,
  event TEXT NOT NULL,
  status TEXT,
  product_id TEXT,
  product_name TEXT,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  country_iso TEXT,
  country_name TEXT,
  value REAL,
  currency TEXT,
  sck_fbp TEXT,
  sck_fbc TEXT,
  sck_cid TEXT,
  sck_gclid TEXT,
  approved_date INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (transaction_code, event)
);

CREATE INDEX IF NOT EXISTS idx_hotmart_eventos_email ON hotmart_eventos (buyer_email);
CREATE INDEX IF NOT EXISTS idx_hotmart_eventos_event ON hotmart_eventos (event);
CREATE INDEX IF NOT EXISTS idx_hotmart_eventos_creado ON hotmart_eventos (created_at);
