-- Datos vivos de Hotmart: precio real por moneda y valoración real por curso.
--
-- Por qué existe: el precio visible salía de `priceUSD × tasa estática` del
-- frontmatter — $140.000 COP en pantalla mientras el checkout cobraba
-- $165.450 COP. Y las estrellas (4.8, 569 reseñas) eran frontmatter inventado:
-- el producto real tiene 4.44 con 93 evaluaciones en Hotmart.
--
-- Cómo se llena:
--   1. Job diario (GitHub Action): captura USD de todos los productos.
--   2. /api/v1/precios/refresca: cada visita a una ficha refresca su precio
--      DESDE LA COLO DEL VISITANTE — Hotmart fija la moneda por IP, así que la
--      visita colombiana trae COP, la mexicana MXN… Las monedas locales las
--      mantienen frescas los propios visitantes de cada país.
--   3. El job nocturno funde D1 en src/data/hotmart-live.json y despliega:
--      el HTML rastreable siempre lleva el último precio conocido.

CREATE TABLE IF NOT EXISTS hotmart_producto (
  slug        TEXT PRIMARY KEY,
  -- pay.hotmart.com/<ID>?ref=<hotlink>: lo que el refresco necesita para
  -- consultar el checkout sin resolver acortadores en caliente.
  pay_url     TEXT NOT NULL,
  -- Código del hotlink (el ref); con ?dp=1 da la página pública del producto.
  hotlink     TEXT NOT NULL DEFAULT '',
  actualizado INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS hotmart_precio (
  slug      TEXT NOT NULL,
  moneda    TEXT NOT NULL CHECK (length(moneda) = 3),
  monto     REAL NOT NULL CHECK (monto > 0),
  capturado INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (slug, moneda)
);

CREATE TABLE IF NOT EXISTS hotmart_valoracion (
  slug      TEXT PRIMARY KEY,
  rating    REAL NOT NULL CHECK (rating BETWEEN 1 AND 5),
  total     INTEGER NOT NULL CHECK (total >= 0),
  capturado INTEGER NOT NULL DEFAULT (unixepoch())
);
