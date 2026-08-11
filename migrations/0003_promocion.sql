-- Promoción manual: el interruptor que permite abrir un descuento sin desplegar.
--
-- El calendario de campañas vive en src/lib/promo.ts y se hornea en las 5.955
-- páginas estáticas. Eso cubre las fechas previstas, pero no el caso de «necesito
-- vender hoy»: cambiar el código y esperar al build no sirve cuando la decisión
-- es de esta tarde. Esta tabla es ese interruptor, y manda sobre el calendario.
--
-- Una sola fila (id = 1). No es un histórico de campañas: es el estado actual.
-- Quién y cuándo lo tocó queda registrado para poder preguntar por qué.
CREATE TABLE IF NOT EXISTS promo_override (
  id           INTEGER PRIMARY KEY CHECK (id = 1),

  activa       INTEGER NOT NULL DEFAULT 0 CHECK (activa IN (0, 1)),

  -- Solo dos valores posibles porque solo hay dos cupones que Hotmart reconozca.
  -- Anunciar un porcentaje que el cupón no aplica es prometer lo que no se cumple.
  pct          INTEGER NOT NULL DEFAULT 25 CHECK (pct IN (25, 50)),
  cupon        TEXT    NOT NULL DEFAULT '010775',

  titular      TEXT    NOT NULL DEFAULT 'Descuento activo',

  -- 'todos' aplica a todo el catálogo; 'algunos' solo a los slugs de la lista.
  alcance      TEXT    NOT NULL DEFAULT 'todos' CHECK (alcance IN ('todos', 'algunos')),
  slugs        TEXT    NOT NULL DEFAULT '[]',

  -- 'ventana' termina en `hasta` y enseña cuenta atrás.
  -- 'perpetua' no termina, y por eso NO enseña cuenta atrás: un reloj que se
  -- reinicia solo es la única parte de esto que sí sería mentir al visitante.
  modo         TEXT    NOT NULL DEFAULT 'ventana' CHECK (modo IN ('ventana', 'perpetua')),
  hasta        INTEGER,

  -- Vacío = todos los países. Si no, lista JSON de códigos ('co', 'mx', ...).
  paises       TEXT    NOT NULL DEFAULT '[]',

  actualizado  INTEGER NOT NULL DEFAULT (unixepoch()),
  por          TEXT,

  -- Una ventana sin fecha de fin no tiene cuenta atrás que mostrar.
  CHECK (modo = 'perpetua' OR hasta IS NOT NULL)
);

INSERT OR IGNORE INTO promo_override (id, activa) VALUES (1, 0);
