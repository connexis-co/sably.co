-- sably-pulso · esquema inicial (Cloudflare D1 / SQLite)
--
-- REGLA RECTORA: no hay tablas de agregados. El promedio y los conteos salen
-- de vistas sobre las tablas base. Un contador almacenado hay que mantenerlo
-- sincronizado en cada INSERT, UPDATE y DELETE, y basta olvidar un caso —
-- borrar una reseña ya aprobada, por ejemplo— para publicar un número que no
-- corresponde a ninguna fila. Sin contador no hay nada que desincronizar, y a
-- esta escala (miles de filas, leídas una vez por build) calcularlo es gratis.
--
-- Lo que Google lee se hornea en el build desde el snapshot; nada de esto se
-- hidrata por fetch en la página. Así el marcado es auditable en dist/.
--
-- Tablas en singular y PK de texto (ULID) para mapear 1:1 a Eloquent con
-- HasUlids cuando esto migre a Laravel. Timestamps en INTEGER unixepoch UTC.
-- Sin "PRAGMA foreign_keys": D1 ya las aplica y el pragma rompe la migración.

-- ---------------------------------------------------------------- subject
-- Lista blanca de lo que se puede votar o comentar, sembrada desde las content
-- collections antes del build. Un voto sobre un slug inexistente no es algo que
-- el endpoint deba validar: la clave foránea no deja crear la fila.
CREATE TABLE subject (
  id        TEXT PRIMARY KEY,              -- 'blog:como-emprender' | 'course:curso-de-unas'
  kind      TEXT NOT NULL CHECK (kind IN ('blog', 'course')),
  slug      TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  seeded_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (kind, slug)
);
CREATE INDEX idx_subject_activo ON subject (is_active, kind);

-- ---------------------------------------------------------------- consent
-- La Ley 1581/2012 obliga a PODER PROBAR la autorización, no solo a pedirla,
-- y el RGPD art. 7.1 dice lo mismo. Por eso se guarda la versión de la política
-- y el texto literal que vio la persona, no un booleano.
CREATE TABLE consent (
  id             TEXT PRIMARY KEY,
  purpose        TEXT NOT NULL CHECK (purpose IN ('lead', 'comment', 'review')),
  policy_version TEXT NOT NULL,
  policy_url     TEXT NOT NULL,
  text_shown     TEXT NOT NULL,
  ip_hash        TEXT NOT NULL,
  country        TEXT,
  granted_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_consent_purpose ON consent (purpose, granted_at);

-- ------------------------------------------------------------------- vote
-- Un voto por (subject, visitante). visitor_id es un UUID en localStorage, no
-- una cookie, así que no dispara el banner de consentimiento. ip_hash guarda
-- SHA-256(ip + sal del día): permite exigir IPs distintas sin almacenar la IP.
--
-- El tiempo mínimo de lectura es un CHECK y no un if del endpoint: un voto
-- emitido a los 400 ms no se puede insertar ni aunque el código falle.
CREATE TABLE vote (
  subject_id TEXT    NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  visitor_id TEXT    NOT NULL CHECK (length(visitor_id) BETWEEN 8 AND 64),
  value      INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  ip_hash    TEXT    NOT NULL CHECK (length(ip_hash) = 64),
  country    TEXT,
  dwell_ms   INTEGER NOT NULL CHECK (dwell_ms >= 3000),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (subject_id, visitor_id)
);
CREATE INDEX idx_vote_subject ON vote (subject_id);
CREATE INDEX idx_vote_ip      ON vote (ip_hash, created_at);

-- ---------------------------------------------------------------- comment
-- Nace 'pending'. Sin aprobación no aparece en ninguna vista pública, luego no
-- entra en el snapshot, luego no llega al HTML. El email nunca se publica.
CREATE TABLE comment (
  id           TEXT NOT NULL PRIMARY KEY,
  subject_id   TEXT NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  parent_id    TEXT REFERENCES comment(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL CHECK (length(trim(author_name)) BETWEEN 2 AND 60),
  author_email TEXT,
  body         TEXT NOT NULL CHECK (length(body) BETWEEN 10 AND 1200),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  spam_score   REAL NOT NULL DEFAULT 0 CHECK (spam_score BETWEEN 0 AND 1),
  turnstile    TEXT NOT NULL DEFAULT 'fail' CHECK (turnstile IN ('pass', 'fail')),
  consent_id   TEXT NOT NULL REFERENCES consent(id),
  visitor_id   TEXT,
  ip_hash      TEXT NOT NULL,
  country      TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  moderated_at INTEGER,
  purge_after  INTEGER
);
CREATE INDEX idx_comment_publico ON comment (subject_id, status, created_at);
CREATE INDEX idx_comment_cola    ON comment (status, created_at);
CREATE INDEX idx_comment_purga   ON comment (purge_after);

-- ------------------------------------------------------------------- lead
-- El dato de menor riesgo: no se publica en ninguna parte. purge_after permite
-- cumplir el plazo de conservación sin depender de que alguien se acuerde.
CREATE TABLE lead (
  id              TEXT NOT NULL PRIMARY KEY,
  name            TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  email           TEXT NOT NULL,
  phone           TEXT,
  course_interest TEXT,
  country         TEXT,
  source          TEXT,
  consent_id      TEXT NOT NULL REFERENCES consent(id),
  turnstile       TEXT NOT NULL DEFAULT 'fail' CHECK (turnstile IN ('pass', 'fail')),
  ip_hash         TEXT NOT NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  purge_after     INTEGER
);
CREATE INDEX idx_lead_fecha ON lead (created_at);
CREATE INDEX idx_lead_purga ON lead (purge_after);
-- Un mismo correo no crea diez leads del mismo curso el mismo día.
CREATE UNIQUE INDEX idx_lead_dedupe
  ON lead (email, course_interest, date(created_at, 'unixepoch'));

-- --------------------------------------------------------------- purchase
-- Se siembra desde el webhook de Hotmart. Es la prueba de compra.
CREATE TABLE purchase (
  id          TEXT NOT NULL PRIMARY KEY,
  subject_id  TEXT NOT NULL REFERENCES subject(id),
  hotmart_tx  TEXT NOT NULL UNIQUE,
  buyer_hash  TEXT NOT NULL,
  country     TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_purchase_subject ON purchase (subject_id);

-- ----------------------------------------------------------- review_token
-- Un solo uso y con caducidad. Sin token no hay reseña.
CREATE TABLE review_token (
  token       TEXT NOT NULL PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchase(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);

-- ---------------------------------------------------------- course_review
-- purchase_id es UNIQUE y con clave foránea a purchase: una reseña sin compra
-- detrás no es un caso a validar en código, es una fila que la base rechaza.
-- Ahí está la garantía de que no se repite lo de las valoraciones inventadas.
CREATE TABLE course_review (
  id           TEXT NOT NULL PRIMARY KEY,
  subject_id   TEXT NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  purchase_id  TEXT NOT NULL UNIQUE REFERENCES purchase(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL CHECK (length(trim(author_name)) BETWEEN 2 AND 60),
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT CHECK (body IS NULL OR length(body) BETWEEN 10 AND 1200),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  consent_id   TEXT NOT NULL REFERENCES consent(id),
  country      TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  moderated_at INTEGER
);
CREATE INDEX idx_review_publico ON course_review (subject_id, status);

-- -------------------------------------------------------- moderation_log
-- Quién aprobó qué y cuándo. Si alguna vez hay que justificar una reseña ante
-- Google o ante la SIC, esto es lo que se enseña.
CREATE TABLE moderation_log (
  id          TEXT NOT NULL PRIMARY KEY,
  entity      TEXT NOT NULL CHECK (entity IN ('comment', 'course_review')),
  entity_id   TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  moderator   TEXT NOT NULL,
  reason      TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_modlog_entidad ON moderation_log (entity, entity_id);

-- =========================================================== VISTAS
-- Lo que consume el snapshot. Nada de esto se almacena.

-- Pulso de artículo. El umbral de publicación NO vive aquí: la vista expone
-- los números crudos y quien decide si se publican es el build, para que el
-- criterio esté en un solo sitio y se pueda cambiar sin migrar la base.
CREATE VIEW v_article_pulse AS
SELECT s.id                     AS subject_id,
       s.slug                   AS slug,
       COUNT(v.value)           AS votes,
       ROUND(AVG(v.value), 2)   AS avg_rating,
       COUNT(DISTINCT v.ip_hash) AS distinct_ips
FROM subject s
LEFT JOIN vote v ON v.subject_id = s.id
WHERE s.kind = 'blog' AND s.is_active = 1
GROUP BY s.id, s.slug;

-- Reseñas de curso, solo aprobadas y solo con compra verificada.
CREATE VIEW v_course_rating AS
SELECT s.id                        AS subject_id,
       s.slug                      AS slug,
       COUNT(r.id)                 AS reviews,
       ROUND(AVG(r.rating), 2)     AS avg_rating
FROM subject s
LEFT JOIN course_review r
       ON r.subject_id = s.id AND r.status = 'approved'
WHERE s.kind = 'course' AND s.is_active = 1
GROUP BY s.id, s.slug;

-- Comentarios publicables, sin el correo.
CREATE VIEW v_comment_publico AS
SELECT c.id, c.subject_id, s.slug, c.parent_id, c.author_name, c.body,
       c.country, c.created_at
FROM comment c
JOIN subject s ON s.id = c.subject_id
WHERE c.status = 'approved'
ORDER BY c.created_at;

-- Cola de moderación.
CREATE VIEW v_moderacion AS
SELECT 'comment' AS entity, id, subject_id, author_name, body,
       spam_score, turnstile, created_at
FROM comment WHERE status = 'pending'
UNION ALL
SELECT 'course_review', id, subject_id, author_name, COALESCE(body, ''),
       0, 'pass', created_at
FROM course_review WHERE status = 'pending';
