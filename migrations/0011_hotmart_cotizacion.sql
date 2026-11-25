-- Última cotización buena de Hotmart por curso, país y cupón (src/lib/cotizaciones-guardadas.ts).
-- La ficha la enseña, con su fecha, cuando la cotización en vivo falla o tarda, en vez de caer a USD.
-- En Node la tabla se crea también al vuelo la primera vez que se usa (mismo SQL).
CREATE TABLE IF NOT EXISTS hotmart_cotizacion (
  slug     TEXT NOT NULL,
  mercado  TEXT NOT NULL CHECK (length(mercado) = 2),
  cupon    TEXT NOT NULL DEFAULT '',
  moneda   TEXT NOT NULL CHECK (length(moneda) = 3),
  base     REAL NOT NULL CHECK (base > 0),
  rebajado REAL CHECK (rebajado IS NULL OR rebajado > 0),
  leida    INTEGER NOT NULL,
  PRIMARY KEY (slug, mercado, cupon)
);
