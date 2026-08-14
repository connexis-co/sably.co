-- Promociones multi-instancia: varias campañas a la vez, cada una con su
-- porcentaje, su proveedor objetivo, sus exclusiones y su ventana de fechas.
--
-- Sustituye al interruptor único de 0003_promocion.sql (promo_override, una
-- sola fila). Aquel solo sabía «hay un descuento o no lo hay»; este permite,
-- por ejemplo, un Black Friday al 50 % SOLO para los cursos de Mauricio Duque
-- programado para el 27 de noviembre, excluyendo tres cursos concretos, y a la
-- vez un 25 % perpetuo para otro proveedor. Cada fila es una campaña.
--
-- El calendario horneado de src/lib/promo.ts sigue existiendo para las fechas
-- fijas del año; esta tabla es el control en vivo que manda sobre él.
CREATE TABLE IF NOT EXISTS promocion (
  id           TEXT PRIMARY KEY,

  -- Nombre interno, solo para el panel. No se muestra al visitante.
  nombre       TEXT    NOT NULL DEFAULT 'Promoción',

  activa       INTEGER NOT NULL DEFAULT 0 CHECK (activa IN (0, 1)),

  -- Solo 25 o 50: son los dos únicos cupones que Hotmart reconoce. Anunciar un
  -- porcentaje que el cupón no aplica es prometer lo que el checkout no cumple.
  pct          INTEGER NOT NULL DEFAULT 25 CHECK (pct IN (25, 50)),
  cupon        TEXT    NOT NULL DEFAULT '010775',

  titular      TEXT    NOT NULL DEFAULT 'Descuento activo',

  -- Proveedores objetivo (JSON de ids de src/lib/proveedores.ts). Vacío = todos.
  -- Es el «a qué autor/proveedor aplica»: ['masterclasses'] deja fuera de la
  -- promo a los cursos de cursosdecocina y a peluquería sin listarlos uno a uno.
  proveedores  TEXT    NOT NULL DEFAULT '[]',

  -- Slugs que entran aunque su proveedor no esté en la lista (JSON). La puerta
  -- de atrás para meter un curso suelto en una promo de otro proveedor.
  incluir      TEXT    NOT NULL DEFAULT '[]',

  -- Slugs que NO entran nunca, aunque su proveedor sí esté (JSON). El «excluir
  -- algunos cursos en particular» que se pidió: excluir gana siempre.
  excluir      TEXT    NOT NULL DEFAULT '[]',

  -- Países (JSON de códigos). Vacío = todos.
  paises       TEXT    NOT NULL DEFAULT '[]',

  -- Ventana de vigencia, en epoch. Ambas opcionales:
  --   desde NULL  → vigente desde ya (permite programar el futuro con un valor)
  --   hasta NULL  → perpetua, y por eso SIN cuenta atrás (un reloj que no
  --                 termina es lo único de aquí que sí sería mentir)
  desde        INTEGER,
  hasta        INTEGER,

  -- Si dos promociones aplican al mismo curso, gana la de mayor prioridad.
  prioridad    INTEGER NOT NULL DEFAULT 100,

  actualizado  INTEGER NOT NULL DEFAULT (unixepoch()),
  por          TEXT,

  -- Una promoción con cuenta atrás (hasta no nulo) no puede terminar antes de
  -- empezar. Si ambas fechas están, hasta va después de desde.
  CHECK (desde IS NULL OR hasta IS NULL OR hasta > desde)
);

-- El endpoint filtra por activa y ordena por prioridad en cada visita.
CREATE INDEX IF NOT EXISTS idx_promocion_activa ON promocion (activa, prioridad);

-- Migra el descuento manual actual (promo_override) a una promoción, pero ya
-- acotada a Mauricio Duque: es justo el recorte pedido —que el 50 % activo deje
-- de tocar los cursos que no son suyos—. Solo se siembra si el override está
-- encendido; si no, la tabla arranca vacía y no hay promoción viva.
INSERT OR IGNORE INTO promocion
  (id, nombre, activa, pct, cupon, titular, proveedores, incluir, excluir, paises, desde, hasta, prioridad, por)
SELECT
  'legacy-manual',
  'Descuento manual (migrado)',
  activa, pct, cupon, titular,
  '["masterclasses"]',
  CASE WHEN alcance = 'algunos' THEN slugs ELSE '[]' END,
  '[]',
  paises,
  NULL,
  CASE WHEN modo = 'perpetua' THEN NULL ELSE hasta END,
  100,
  por
FROM promo_override
WHERE id = 1 AND activa = 1;
