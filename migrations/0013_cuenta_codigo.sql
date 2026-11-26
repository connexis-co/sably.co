-- Acceso con código por correo (contrato común de cuenta del 25-nov-2026, §3).
-- Un código pendiente por navegador: la clave es el HMAC de la cookie `flow`, así el código
-- solo vale en el navegador que lo pidió. Del código solo se guarda su HMAC.
-- Todo IF NOT EXISTS: el almacén lo aplica la primera vez que se usa una ruta de cuenta.

CREATE TABLE IF NOT EXISTS account_codes (
  flow TEXT PRIMARY KEY,            -- HMAC(SABLY_AUTH_SECRET, 'codigo-flujo' \0 cookie flow)
  email TEXT NOT NULL,              -- correo normalizado al que se envió
  code TEXT NOT NULL,               -- HMAC(SABLY_AUTH_SECRET, 'codigo' \0 flow \0 correo \0 código)
  expires INTEGER NOT NULL,         -- 10 minutos desde el último envío
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  sent INTEGER NOT NULL             -- último envío: reenvío con 60 s de espera
);

CREATE INDEX IF NOT EXISTS account_codes_expires ON account_codes (expires);
