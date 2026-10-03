-- Ocultar el botón de WhatsApp por página, sin desplegar.
--
-- `activo` ya apaga el botón en TODO el sitio; esta columna lo apaga solo en
-- rutas concretas (lista JSON de patrones, `*` como comodín), editable desde
-- /admin/widgets. El cliente compara location.pathname contra la lista.
ALTER TABLE widget_whatsapp ADD COLUMN paginas_ocultas TEXT NOT NULL DEFAULT '[]';
