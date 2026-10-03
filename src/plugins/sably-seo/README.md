# Sably SEO

Plugin nativo EmDash 1.1 de auditoría editorial. Registro: `id: 'sably-seo'`, `version: '1.0.0'`, servidor `index.ts`, administrador `admin.tsx`, página `/seo`.

Consulta únicamente contenido publicado de cursos, variantes, artículos, páginas, categorías, países, ciudades, creadores y homologaciones con `content:read`. El endpoint requiere una sesión de editor o administrador. El informe se ejecuta al pulsar **Analizar contenido publicado** y recorre toda la paginación.

Las observaciones se corrigen desde el editor y el panel SEO nativo. El plugin no cambia datos ni impide publicar. Su hook de metadatos conserva un único Article por entrada del blog dentro de la composición nativa de EmDash, con los campos editoriales existentes y el panel SEO. Consulta [la decisión e investigación de compatibilidad](../../../../docs/seo-plugin-decision.md) para el análisis de SEO Suite y los límites del módulo.

Pruebas: `node --import tsx --test tests/sably-seo.test.ts`.
