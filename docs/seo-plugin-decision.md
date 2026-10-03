# Decisión del plugin SEO

Se incorpora `sably-seo` 1.0.0 como plugin nativo de auditoría editorial de Sably. Los títulos, canónicas, robots, imágenes sociales, alternates y datos estructurados públicos siguen bajo EmDash y las plantillas de Sably. El plugin lee contenido y presenta observaciones en el administrador; además compone el Article de las páginas del blog dentro del resolvedor nativo de metadatos, conservando una sola representación.

## Evaluación de SEO Suite

Se revisó **SEO Suite 0.2.0**, publicado por `@nookeshk.bsky.social` en el [registro oficial de EmDash](https://plugins.emdashcms.com/plugins/%40nookeshk.bsky.social/seo-suite). Es un plugin comunitario distribuido mediante el registro oficial; esa distribución no implica que Cloudflare sea su autor. No se encontraron métricas suficientes para llamarlo popular o el más utilizado.

Identidad de la captura revisada:

- Package: `at://did:plc:suw5qc22clrlpslfo6qapiu4/com.emdashcms.experimental.package.profile/seo-suite`.
- Release: `at://did:plc:suw5qc22clrlpslfo6qapiu4/com.emdashcms.experimental.package.release/seo-suite:0.2.0`.
- Licencia declarada: MIT; distribución publicada el 29 de septiembre de 2026.
- SHA-256 del paquete de 10.092 bytes: `34ab25bdb4814a7c0c1fe2c3bc78f093da1641386e43ac5000593d8c83f33c3a`.
- Multihash recalculado: `bciqdjkzfxw2icst4bqp6fq54pdyjhwqwie4g4q5mkaafspmmqpztyoq`, coincide exactamente con el checksum del registro.
- SHA-256 de `backend.js`: `96c43c8ab7c768a8ba5fd859e9bde36a2406ba88f9f1468c880d94ee48893818`.
- Evidencia local descargada: `.emdash/registry/seo-suite.json`, `seo-suite-0.2.0.tgz` y `seo-suite/{backend.js,manifest.json,README.md}`. Estos artefactos locales están excluidos de Git; no son dependencias necesarias para construir Sably.

El repositorio del autor indicado en la distribución no estaba disponible durante la revisión inicial. El paquete oficial permite verificar su integridad y examinar el código distribuido; el checksum comprueba identidad del artefacto, no demuestra ausencia de fallos.

El formato sandbox del paquete es compatible con las APIs de EmDash 1.1, pero su comportamiento no se ajusta directamente a Sably:

| Comportamiento observado en el artefacto | Consecuencia en Sably |
| --- | --- |
| `page:metadata` emite `WebSite` siempre y `BlogPosting`/`Article` para cualquier página de tipo `content`. | Duplica el esquema del sitio y clasifica fichas de curso como artículos. |
| Ajustes limitados a organización, tipo de artículo, política de publicación, Twitter y colecciones. | No existe un interruptor de JSON-LD. `publishPolicy: off` solo desactiva la política de publicación. |
| Panel editorial declarado únicamente para `posts` y `pages`. | No aparece por defecto en `courses`, `course_locales` ni `blog`. |
| El análisis lee `content`, `excerpt` y `featured_image`. | Sably utiliza `body`, `description`/`short_description`/`meta_description` y `cover_image`; cambiar solo el nombre de colección produce observaciones incorrectas. |
| La revisión de salud consulta hasta 40 entradas por colección sin recorrer el cursor. | No cubre los 121 cursos ni las 726 variantes existentes. |
| Solicita escritura de contenido, borradores y redirecciones, además de lectura y política de publicación. | Supera los permisos necesarios para una auditoría editorial de solo lectura. |

Los hallazgos anteriores proceden de la inspección del `backend.js` y `manifest.json` cuyos checksums figuran arriba, no de una ejecución del plugin en producción.

## Instalación administrada por configuración

EmDash admite declarar plugins estándar en `sandboxed: []` junto con `sandboxRunner: sandbox()`; esto permite incorporar un artefacto revisado mediante despliegue sin crear tokens de administrador ni insertar instalaciones directamente en D1. Está documentado en la [referencia oficial de configuración](https://docs.emdashcms.com/reference/configuration/#sandboxed).

El código instalado de EmDash 1.1 confirma que el descriptor admite `format: 'standard'`, `entrypoint`, `capabilities`, `routes`, `hooks`, `adminPages`, `adminWidgets`, `editorPanels` y `settingsSchema`. El proxy solo registra los hooks declarados; un descriptor administrado con `hooks: []` evitaría el JSON-LD de SEO Suite. Sin embargo, eso no corrige sus campos de análisis ni su paginación. Sus ajustes estándar se leen mediante `ctx.settings`; pasar `options` al descriptor no configura el paquete, pues `options` corresponde al formato nativo.

Por esas razones no se instala SEO Suite 0.2.0 sin modificaciones. Tampoco se cambia el modo de aislamiento ni se crea una instalación por acceso directo a la base. Una futura versión con campos configurables, paginación completa y JSON-LD desactivable podrá evaluarse nuevamente.

## Plugin incorporado

`src/plugins/sably-seo/index.ts` exporta `createPlugin()`. Su página React se registra desde `src/plugins/sably-seo/admin.tsx` con ruta `/seo` y etiqueta **Sably · SEO**. El descriptor de despliegue utiliza `id: 'sably-seo'` y `version: '1.0.0'`.

- Capacidad única: `content:read`. Endpoint privado `GET /_emdash/api/plugins/sably-seo/audit`.
- Permiso EmDash `content:read` y sesión de editor o administrador (`role >= 40`) comprobados antes de consultar contenido.
- Solo consulta las colecciones `courses`, `course_locales`, `blog`, `pages`, `categories`, `countries`, `cities`, `creators` y `homologaciones` publicadas. Recorre toda su paginación y falla explícitamente ante cursores repetidos; no presenta un informe parcial como completo.
- Reconoce campos editoriales de Sably, precedencia del panel SEO nativo y herencia del curso en las variantes. Señala descripciones/títulos ausentes, títulos y descripciones extensos, canónicas inválidas o externas, imágenes del cuerpo sin texto alternativo e imágenes editoriales ausentes.
- Las entidades de listado no requieren cuerpo editorial. Países y ciudades pueden generar la descripción en su plantilla; no se marca como ausente. Cuando la API no expande un curso relacionado, la variante muestra la limitación de herencia en lugar de avisos incorrectos de cuerpo o imagen.
- `noindex` y curso pendiente de checkout (incluido el marcador `PENDIENTE`) son observaciones informativas. Las longitudes son orientativas, no reglas de posicionamiento ni bloqueos de publicación.
- Incluye filtros por colección y texto y enlaces a la entrada para editarla con EmDash. React escapa los valores del contenido; no usa HTML directo para el informe.
- No cambia redirecciones, publica entradas, guarda ajustes ni hace solicitudes a terceros.
- El hook tipado `page:metadata` aporta el Article del blog con `id: primary`, que sustituye por deduplicación el BlogPosting base de EmDash. Conserva idioma, palabras, tiempo de lectura, palabras clave, referencia al blog y autor/editor Organization del contenido CMS, y aplica las fechas `articleMeta` y los valores del panel SEO. El renderizador de EmDash serializa el resultado de forma segura. `page:metadata` no exige una capacidad adicional en EmDash 1.1; no se concede `hooks.page-fragments:register`.

Límites: analiza datos guardados, no el borrador sin guardar ni el HTML renderizado; una plantilla puede generar texto o imágenes adicionales. Tampoco rastrea enlaces rotos, Core Web Vitals o resultados de búsqueda. Esos controles siguen correspondiendo al rastreo técnico y a las pruebas de paridad.

Validación realizada: siete pruebas locales de campos, herencia, canónicas, paginación, control de acceso y composición nativa del Article sin duplicación ni cierre de script inyectable; comprobación TypeScript aislada sin errores. El aplicador del esquema operativo tiene seis pruebas independientes. La validación visual autenticada y el despliegue del descriptor corresponden al flujo de integración; este documento no afirma que se hayan completado.
