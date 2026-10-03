-- Apply once to SABLY_DB development after legacy migrations 0001–0010.
-- DB is reserved for EmDash. No production connection or personal data involved.
ALTER TABLE promocion ADD COLUMN url_key TEXT NOT NULL DEFAULT '';
ALTER TABLE promocion ADD COLUMN tema TEXT NOT NULL DEFAULT 'medio';
ALTER TABLE promocion ADD COLUMN etiqueta TEXT NOT NULL DEFAULT 'Oferta';

-- Public Hotmart reviews already present in the site's checked-in snapshot.
-- Separate from course_review: imported public evidence is not a local purchase.
CREATE TABLE sably_public_review (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending','approved','rejected','spam')),
  created_at INTEGER NOT NULL,
  moderated_at INTEGER
);
CREATE INDEX idx_sably_public_review ON sably_public_review(slug,status);
CREATE TABLE sably_public_review_log (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL CHECK(entity='sably_public_review'),
  entity_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  moderator TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE sably_public_dataset (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  source TEXT NOT NULL,
  captured_at INTEGER NOT NULL
);
