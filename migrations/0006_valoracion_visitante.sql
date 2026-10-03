-- Valoración de visitantes: el toque de estrellas en la ficha del curso.
--
-- Se guarda APARTE de la valoración de compradores (hotmart_valoracion) a
-- propósito: la nota que se publica y se marca en JSON-LD es la de gente que
-- pagó el curso; la del visitante anónimo es señal de interés, no de calidad
-- verificada. Mezclarlas convertiría un dato defendible en uno dopado.
--
-- Un voto por visitante y curso: la clave (slug, ip_hash) reemplaza el voto
-- anterior en vez de acumularlo (cambiar de opinión es legítimo; votar veinte
-- veces no).
CREATE TABLE IF NOT EXISTS visitor_rating (
  slug       TEXT    NOT NULL,
  ip_hash    TEXT    NOT NULL,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (slug, ip_hash)
);

CREATE VIEW IF NOT EXISTS v_visitor_rating AS
SELECT slug, COUNT(*) AS votos, ROUND(AVG(rating), 2) AS media
FROM visitor_rating
GROUP BY slug;
