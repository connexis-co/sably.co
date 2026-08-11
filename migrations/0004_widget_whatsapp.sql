-- Botón flotante de WhatsApp configurable desde el panel, sin desplegar.
--
-- Una sola fila (id = 1), igual que promo_override: es el estado actual del
-- widget, no un histórico. `numero` vacío significa «usa el número del país»
-- (el que ya vive en src/lib/countries.ts), así que activar la tabla no obliga
-- a decidir un número global.
--
-- Los offsets son píxeles desde la derecha (x) y desde abajo (y). En móvil el
-- componente les suma solo el carril del CTA fijo inferior; el valor guardado
-- siempre es el del hueco «natural» del botón.
CREATE TABLE IF NOT EXISTS widget_whatsapp (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  activo      INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  numero      TEXT    NOT NULL DEFAULT '',
  offset_x    INTEGER NOT NULL DEFAULT 21 CHECK (offset_x BETWEEN 0 AND 400),
  offset_y    INTEGER NOT NULL DEFAULT 58 CHECK (offset_y BETWEEN 0 AND 800),
  actualizado INTEGER NOT NULL DEFAULT (unixepoch()),
  por         TEXT
);

-- Lección de 0003: el CHECK se evalúa también contra la fila semilla y un
-- INSERT OR IGNORE se traga el rechazo sin decir nada. Aquí los defaults
-- cumplen todos los CHECK, y aun así: verificar con SELECT tras aplicar.
INSERT OR IGNORE INTO widget_whatsapp (id) VALUES (1);
