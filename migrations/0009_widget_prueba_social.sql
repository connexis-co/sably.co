-- Configuración del aviso de prueba social, gobernable desde /admin/widgets.
--
-- Fila única, igual que widget_whatsapp y widget_video: no hay varias
-- configuraciones, hay una y se edita.
--
-- Se saca del código porque cambiar dónde aparece el aviso, cada cuánto o
-- apagarlo obligaba a redesplegar las 5.971 páginas. Y porque «tapa el texto»
-- es justo el tipo de ajuste que se necesita en caliente.
CREATE TABLE IF NOT EXISTS widget_prueba_social (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  activo        INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  -- Esquina donde se ancla. Arriba estorba menos en móvil, abajo se ve más.
  posicion      TEXT    NOT NULL DEFAULT 'inferior-izquierda'
                CHECK (posicion IN ('inferior-izquierda', 'inferior-derecha',
                                    'superior-izquierda', 'superior-derecha')),
  -- Separación desde esa esquina, en px.
  offset_x      INTEGER NOT NULL DEFAULT 16  CHECK (offset_x BETWEEN 0 AND 400),
  offset_y      INTEGER NOT NULL DEFAULT 16  CHECK (offset_y BETWEEN 0 AND 400),
  -- Segundos hasta el primer aviso y entre avisos siguientes.
  espera_seg    INTEGER NOT NULL DEFAULT 8   CHECK (espera_seg BETWEEN 0 AND 600),
  intervalo_seg INTEGER NOT NULL DEFAULT 14  CHECK (intervalo_seg BETWEEN 5 AND 3600),
  -- Rutas donde no debe salir. JSON de cadenas, admite '*' al final.
  paginas_ocultas TEXT NOT NULL DEFAULT '[]',
  actualizado   INTEGER NOT NULL DEFAULT (unixepoch()),
  por           TEXT
);

-- Los valores por defecto reproducen exactamente el comportamiento actual, así
-- que aplicar la migración no cambia nada hasta que alguien toque el panel.
INSERT OR IGNORE INTO widget_prueba_social (id) VALUES (1);
