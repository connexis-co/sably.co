-- Arranque del video de presentación de los cursos, editable desde /admin/widgets.
--
-- El sitio es estático: sin esta tabla, cambiar de "espera al play" a "arranca
-- solo" exigiría un despliegue de las 5.955 páginas. El reproductor lee
-- /api/v1/config al cargar y aplica lo que haya aquí.
--
-- `modo`:
--   'play' — se muestra el botón central y el video no baja hasta pulsarlo.
--   'auto' — arranca solo, siempre silenciado (ningún navegador permite otra
--            cosa) y solo cuando entra en pantalla. El reproductor ofrece un
--            botón para activar el sonido.
--
-- Lección de 0003 y 0004: el CHECK se evalúa también contra la fila semilla y
-- un INSERT OR IGNORE se traga el rechazo en silencio. Los defaults de aquí
-- cumplen todos los CHECK; aun así, verificar con SELECT tras aplicar.
CREATE TABLE IF NOT EXISTS widget_video (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  modo        TEXT    NOT NULL DEFAULT 'play' CHECK (modo IN ('play', 'auto')),
  bucle       INTEGER NOT NULL DEFAULT 0 CHECK (bucle IN (0, 1)),
  actualizado INTEGER NOT NULL DEFAULT (unixepoch()),
  por         TEXT
);

INSERT OR IGNORE INTO widget_video (id) VALUES (1);
