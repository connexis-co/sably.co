-- Cuenta de usuario (núcleo común de cuenta, contrato del 25-nov-2026 §6).
--
-- Cuentas propias de sably.co, sin identidad compartida con otros dominios.
-- Comprar NO exige cuenta: nada de aquí toca los enlaces de compra.
-- Primera entrega: acceso con Google, sesión, preferencias, guardados y
-- constancia del consentimiento. El código por correo (`account_codes`), el
-- borrado que pide Meta (`account_deletions`) y los avisos por correo
-- (`account_notices`) llegan con sus fases, en migraciones propias.
--
-- Datos personales mínimos: el correo en claro solo en `accounts`; nombre y
-- foto, los que dio Google, en `account_identities` (se borran al desconectar
-- o al borrar la cuenta, en cascada). Tokens de sesión, `state` y claves de
-- límite se guardan como HMAC, nunca en claro.
--
-- La aplica también `src/lib/cuenta/almacen.ts` al primer uso (todo es
-- IF NOT EXISTS), porque el servidor Node no ejecuta `wrangler d1 migrations`.

CREATE TABLE IF NOT EXISTS accounts (
  id         INTEGER PRIMARY KEY,
  email      TEXT    NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
  created    INTEGER NOT NULL,
  last_login INTEGER,
  status     TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked'))
);

CREATE TABLE IF NOT EXISTS account_identities (
  account  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT    NOT NULL CHECK (provider IN ('google', 'facebook')),
  subject  TEXT    NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
  email    TEXT,
  name     TEXT,
  picture  TEXT,
  linked   INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS account_identities_account ON account_identities(account);

CREATE TABLE IF NOT EXISTS account_profiles (
  account      INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS account_sessions (
  token   TEXT    PRIMARY KEY,
  account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  started INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  shared  INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0, 1)),
  label   TEXT
);
CREATE INDEX IF NOT EXISTS account_sessions_account ON account_sessions(account);
CREATE INDEX IF NOT EXISTS account_sessions_expires ON account_sessions(expires);

CREATE TABLE IF NOT EXISTS account_oauth (
  flow     TEXT    PRIMARY KEY,
  state    TEXT    NOT NULL,
  nonce    TEXT    NOT NULL,
  verifier TEXT    NOT NULL,
  expires  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account_rates (
  key      TEXT    PRIMARY KEY,
  started  INTEGER NOT NULL,
  requests INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account_saves (
  account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item    TEXT    NOT NULL CHECK (length(item) BETWEEN 3 AND 160),
  created INTEGER NOT NULL,
  PRIMARY KEY (account, item)
);

CREATE TABLE IF NOT EXISTS account_prefs (
  account INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  doc     TEXT    NOT NULL,
  version INTEGER NOT NULL,
  updated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account_consents (
  account      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  purpose      TEXT    NOT NULL,
  text_version TEXT    NOT NULL,
  text         TEXT    NOT NULL,
  granted_at   INTEGER NOT NULL,
  ip_hash      TEXT
);
CREATE INDEX IF NOT EXISTS account_consents_account ON account_consents(account);
