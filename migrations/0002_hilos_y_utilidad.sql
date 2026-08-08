-- Votos de utilidad sobre comentarios, y los invariantes del hilo.
--
-- No se reutiliza `vote`: allí el valor es 1..5 y `subject_id` es NOT NULL
-- contra `subject`. Meter comentarios ahí obligaría a aflojar el CHECK del
-- rango y a hacer nullable la clave foránea, o sea a destruir justo la
-- garantía que hoy hace imposible guardar un voto inválido.

CREATE TABLE comment_vote (
  comment_id TEXT    NOT NULL REFERENCES comment(id) ON DELETE CASCADE,
  visitor_id TEXT    NOT NULL CHECK (length(visitor_id) BETWEEN 8 AND 64),
  -- Solo −1 y 1. Retirar el voto es BORRAR la fila, no guardar un cero: así no
  -- existe un estado «votó nada» que haya que filtrar en cada consulta.
  value      INTEGER NOT NULL CHECK (value IN (-1, 1)),
  ip_hash    TEXT    NOT NULL CHECK (length(ip_hash) = 64),
  country    TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (comment_id, visitor_id)
);

-- La clave primaria ya indexa (comment_id, visitor_id), que cubre el JOIN de
-- la vista y el WHERE por comentario. El único índice que falta es el de la
-- consulta del limitador por IP.
CREATE INDEX idx_comment_vote_ip ON comment_vote (ip_hash, created_at);

-- Un CHECK de SQLite no puede mirar otra tabla, así que los invariantes que
-- cruzan tablas van en triggers. Misma idea que el CHECK de dwell_ms: que el
-- dato malo no entre ni aunque el endpoint falle.

-- `IS NOT` y no `<>`: si el comentario no existe, la subconsulta da NULL, y
-- `NULL <> 'approved'` es NULL — no abortaría. `NULL IS NOT 'approved'` es 1.
CREATE TRIGGER trg_comment_vote_solo_aprobados_ins
BEFORE INSERT ON comment_vote
BEGIN
  SELECT RAISE(ABORT, 'comentario no publicado')
  WHERE (SELECT status FROM comment WHERE id = NEW.comment_id) IS NOT 'approved';
END;

CREATE TRIGGER trg_comment_vote_solo_aprobados_upd
BEFORE UPDATE OF value ON comment_vote
BEGIN
  SELECT RAISE(ABORT, 'comentario no publicado')
  WHERE (SELECT status FROM comment WHERE id = NEW.comment_id) IS NOT 'approved';
END;

-- El DELETE no lleva trigger a propósito: retirar el voto siempre se puede,
-- aunque el comentario se haya rechazado entretanto.

-- Un solo nivel de anidamiento, y la respuesta cuelga de un comentario raíz
-- del MISMO artículo. Hoy el endpoint acepta cualquier parent_id, así que un
-- cliente puede colar una respuesta en el hilo de otro artículo.
CREATE TRIGGER trg_comment_respuesta_un_nivel
BEFORE INSERT ON comment
WHEN NEW.parent_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'la respuesta debe colgar de un comentario raiz del mismo articulo')
  WHERE NOT EXISTS (
    SELECT 1 FROM comment p
     WHERE p.id = NEW.parent_id
       AND p.parent_id IS NULL
       AND p.subject_id = NEW.subject_id
  );
END;

-- Utilidad por comentario. Como todo agregado en este esquema, se calcula al
-- leer: no hay contador almacenado que pueda desincronizarse.
--
-- Los votos de un comentario rechazado NO se borran. Rechazar es reversible, y
-- borrarlos convertiría un clic equivocado del moderador en la pérdida
-- irrecuperable de los votos. Desaparecen de todo número público por
-- construcción, porque la vista filtra por 'approved'; si vuelve a aprobarse,
-- su conteo reaparece intacto.
CREATE VIEW v_comment_utilidad AS
SELECT c.id                                           AS comment_id,
       c.subject_id                                   AS subject_id,
       SUM(CASE WHEN cv.value =  1 THEN 1 ELSE 0 END) AS utiles,
       SUM(CASE WHEN cv.value = -1 THEN 1 ELSE 0 END) AS no_utiles,
       COUNT(DISTINCT cv.ip_hash)                     AS distinct_ips
FROM comment c
LEFT JOIN comment_vote cv ON cv.comment_id = c.id
WHERE c.status = 'approved'
GROUP BY c.id, c.subject_id;

-- Lo que lee el hilo público, con el hueco de la respuesta huérfana tapado: si
-- un padre pasa a 'rejected' sus respuestas siguen 'approved', y una respuesta
-- sin su pregunta puede leerse como lo contrario de lo que dijo su autor. El
-- invariante vive aquí y no en el cliente, así el snapshot y el build lo
-- heredan gratis.
CREATE VIEW v_comment_hilo AS
SELECT p.id, p.subject_id, p.slug, p.parent_id, p.author_name, p.body,
       p.country, p.created_at,
       COALESCE(u.utiles, 0) AS utiles
FROM v_comment_publico p
LEFT JOIN v_comment_utilidad u ON u.comment_id = p.id
WHERE p.parent_id IS NULL
   OR EXISTS (SELECT 1 FROM comment padre
               WHERE padre.id = p.parent_id AND padre.status = 'approved');
