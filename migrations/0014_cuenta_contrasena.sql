-- Contraseñas de la cuenta (26-nov-2026). Solo el hash (Argon2id, o scrypt donde Node no trae Argon2).
-- Todo IF NOT EXISTS: el almacén lo aplica la primera vez que se usa una ruta de cuenta.

CREATE TABLE IF NOT EXISTS account_passwords (
  account INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,               -- $argon2id$… o $scrypt$…
  updated INTEGER NOT NULL
);

-- Contraseña nueva a la espera del código del correo (alta o «olvidé mi contraseña»), atada al mismo
-- navegador que el código: misma clave que account_codes. Se borra al usarse o al caducar.
CREATE TABLE IF NOT EXISTS account_pending_passwords (
  flow TEXT PRIMARY KEY,            -- HMAC de la cookie flow (igual que account_codes.flow)
  hash TEXT NOT NULL,
  expires INTEGER NOT NULL
);
