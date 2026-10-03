# Migración editorial a EmDash 1.1.0

La migración tiene dos partes: un exportador determinista que sólo lee archivos locales y un importador explícito limitado a `dev.sably.co`. El contenido completo se aplica por lotes a D1 y los medios se guardan mediante la biblioteca y el almacenamiento R2 nativos de EmDash. Producción no es un destino permitido.

## Inventario

| Colección | Completo | Piloto incluido en el Worker |
| --- | ---: | ---: |
| `categories` | 13 | 1 |
| `countries` | 8 | 8 |
| `creators` | 2 | 0 |
| `cities` | 36 | 0 |
| `courses` | 121 | 1 |
| `course_locales` | 726 | 8 |
| `blog` | 10 | 1 |
| `testimonials` | 40 | 0 |
| `pages` | 4 | 0 |
| `homologaciones` | 4 | 0 |
| Total | **964** | **19** |

El piloto conserva barbería, sus ocho variantes y el artículo `como-emprender-con-un-oficio-en-2026`, más sus dependencias editoriales. Los registros procedentes del sitio público tienen estado `published` y locale `es`; un snapshot de EmDash conserva el estado editorial ya existente. Los países son variantes comerciales, no traducciones: se conserva la cobertura parcial de los 726 registros.

El inventario de imágenes contiene 290 URLs únicas: 289 archivos locales de `public/` y una fotografía histórica de autor alojada en Hotmart. En la importación, esa única URL externa respondió HTTP 403; conserva su referencia externa y no se sustituyó por una imagen inventada. Los 289 archivos locales se procesaron correctamente en la biblioteca y R2. Incluye medios usados en contenido y archivos de la biblioteca aunque ninguna entrada los utilice. Se deduplican en destino por SHA-256; por ello la cantidad de registros de medios puede ser menor que la cantidad de URLs.

## Generación y verificación local

Se requiere la versión de Node compatible con el proyecto, con `node:sqlite` y ejecución nativa de TypeScript; se verificó con Node 25. Los comandos no necesitan credenciales:

```sh
node scripts/emdash-content.mjs
node scripts/emdash-content.mjs --check
node scripts/emdash-content.mjs --profile full --existing-seed .emdash/existing-content.json --output .emdash/migration-content.seed.json
node scripts/emdash-media-manifest.mjs
node --test scripts/emdash-content.test.mjs scripts/emdash-import.test.mjs
node scripts/emdash-import.mjs
```

El último comando sólo muestra el plan. `--execute` es necesario para enviar solicitudes. El full seed tiene aproximadamente 26,4 MB y se guarda en `.emdash/migration-content.seed.json`, ignorado por Git. Nunca guardarlo como `.emdash/seed.json`: EmDash da prioridad a ese nombre y lo incorporaría al Worker. El bootstrap `emdash.seed.json` tiene aproximadamente 382 KB; incluye el modelo completo, cinco tipos de bloque, diez secciones de inicio y los menús y áreas del tema.

Las fuentes MDX y JSON se conservan en su lugar. Los nueve archivos TypeScript/Astro cuyo contenido se convirtió a consultas CMS se congelaron en `scripts/migration-source/legacy-site.json` antes de reemplazar las rutas. `readMigrationSource()` utiliza ese snapshot: regenerar el exportador no interpreta como contenido la nueva plantilla CMS ni pierde los textos originales.

## Contrato editorial

Los slugs públicos se conservan. Curso: `curso-de-barberia`; variante: `curso-de-barberia--co`; ciudad: `co--bogota`. `courses.urlPattern` es `/co/{slug}/` y blog `/blog/{slug}/`. Las variantes se consultan por el slug interno; el frontend construye sus URLs por país.

Las consultas SSR usan `getEmDashEntry()` y `getEmDashCollection()` de `emdash`, con `{ locale: 'es' }` y paginación. En rutas sin autenticación, la conexión de runtime se obtiene desde `emdash/runtime`, no desde el export principal. El frontend debe dar prioridad a los campos editoriales siguientes:

| Colección | Campos editables principales |
| --- | --- |
| Cursos | `title`, `meta_title`, `short_description`, `category`, `subcategory`, `level`, `duration_hours`, `lessons_count`, `price_usd`, `original_price_usd`, `hotmart_url`, `body`, `template`, `cover_image`, `card_image`, `curriculum`, `learning_items`, `audience_items`, `keyword_items`, `faq_items`, `instructor_name`, `instructor_title`, `instructor_bio` |
| Variantes | `h1`, `subtitulo`, `meta_title`, `meta_description`, `body`, `faq_items`, `benefit_items`, `audience_items`, `requirement_items`, `certificado`, `garantia`, `course_slug`, `country` |
| Blog | `title`, `description`, `category`, `body`, `template`, `cover_image`, `card_image`, `faq_items`, `keyword_items`, `original_published_at` |
| Categorías | `name`, `emoji`, `description`, `gradient_start`, `gradient_end`, `subcategories`, `external_url`, `cover_image`, `card_image` |
| Países | `code`, `name`, `flag`, `hreflang`, `currency`, `currency_symbol`, `usd_rate`, `price_round`, `whatsapp`, `phone_display`, `hero_image`, `template` |
| Ciudades | `name`, `city_slug`, `country_code`, `country_record` |
| Creadores | `name`, `bio`, `since`, `verified`, `best_seller`, `photo`, `course_slugs` |
| Testimonios editoriales | `name`, `text`, `rating`, `city_slug`, `country_code`, `course_slug`, `category` |
| Páginas | `title`, `description`, `hero_heading`, `path`, `template`, `body`, `layout` |
| Homologaciones | `name`, `emoji`, `cover_category`, `short_description`, `keyword`, `audience_items`, `evaluation_items`, `locations`, `cover_image`, `template` |

`body` utiliza Portable Text nativo. Se convierte con `markdownToPortableText` del paquete oficial y claves deterministas. Los archivos MDX originales sólo se archivan como texto y nunca se ejecutan desde el CMS. El cuerpo de las páginas institucionales se extrae de nodos estáticos mediante el compilador de Astro, conservando títulos, párrafos, listas y enlaces. El bloque legal correspondiente conserva `anchor: 'afiliacion'` para mantener el enlace existente.

Los repeaters de listas simples tienen `{ text }`; preguntas frecuentes `{ q, a }`; temario `{ title, lessons_text }` con una lección por línea; subcategorías `{ slug, name }`; ubicaciones `{ city, region }`. EmDash 1.1 no admite repeaters anidados: `lessons_text` evita exigir edición JSON para el temario.

Las siete relaciones nativas conectan cursos con categorías y creadores, variantes con cursos y países, ciudades con países y testimonios con cursos y países. Los campos son `category_record`, `creator_record`, `course_record` y `country_record`, según la colección. Los slugs escalares se mantienen para las URLs y compatibilidad. Las relaciones se almacenan en `_emdash_content_references`; no son columnas en las tablas de contenido.

Todos los modelos conservan `source_metadata`, `source_path`, `source_sha256` y, cuando corresponde, `source_body`. Los anteriores JSON (`modules`, `faqs`, `learnings`, etc.) permanecen para trazabilidad y compatibilidad, etiquetados `Archivo — ...`, al final del formulario y sin obligación de rellenarlos en registros nuevos. EmDash 1.1 sólo expone `listColumns` y `quickCreate` en `CollectionAdminConfig`; no se inventaron opciones para pestañas u ocultación.

Las fechas originales se normalizan a ISO UTC en `original_published_at`; no sustituyen `published_at` del ciclo editorial. Los testimonios de esta colección son los 40 textos editoriales originales. Las reseñas verificadas, votos, precios Hotmart, visitantes y operaciones pertenecen al backend operativo separado y no se mezclan con esta colección.

## Bloques y tema

`template` permite `sably-classic`. Las páginas usan un campo nativo `layout` de tipo `blocks` y cada bloque tiene `_type`, `_version: 1`, `_key`:

- `sably_rich_text`: `content` Portable Text.
- `sably_image`: `image`, `caption`.
- `sably_hero`: `title`, `text`, `image`, `button_label`, `button_url`.
- `sably_cta`: `title`, `text`, `button_label`, `button_url`.
- `sably_faq`: `title`, `faq_items`.

`src/themes/sably-classic/seed.mjs` aporta cuatro menús, dos áreas de widgets y diez secciones nativas de inicio. Las cinco colecciones públicas auxiliares —categorías, países, ciudades, creadores y homologaciones— también declaran soporte SEO nativo. El importador filtra por nombre los menús y áreas que ya existen antes de aplicar la estructura: en EmDash 1.1, `onConflict: skip` por sí solo no protege sus elementos frente a reemplazos.

## Importación explícita en desarrollo

Antes de importar se obtiene un backup y un snapshot limitado al contenido piloto. `.emdash/existing-content.json` contiene los resultados de tres consultas de contenido, nunca usuarios ni credenciales. El exportador superpone sus valores al origen antes de generar campos editoriales; aborta ante registros inesperados o eliminados que necesitan reconciliación.

La ruta temporal `/internal/migrate-emdash` exige simultáneamente el acceso normal del staging y `SABLY_MIGRATION_TOKEN`, un secreto independiente de al menos 32 caracteres. Comprueba host `dev.sably.co` y entorno `development`; también acepta localhost para pruebas locales. Las credenciales sólo entran por variables del proceso, no como argumentos de shell ni archivos versionados:

```sh
# SABLY_DEV_PASSWORD y SABLY_MIGRATION_TOKEN ya deben estar en el entorno del proceso.
node scripts/emdash-import.mjs --execute --only schema
node scripts/emdash-import.mjs --execute --only media
node scripts/emdash-import.mjs --execute --only content
node scripts/emdash-import.mjs --execute --only status
```

`--execute` sin `--only` ejecuta las tres fases en orden. No crea cuentas, sesiones, tokens administrativos ni instala plugins.

El protocolo limita JSON a 1,5 MB, lotes de contenido a diez registros e imágenes a 2 MB. Los archivos locales se verifican contra el hash del inventario; la fotografía externa sólo permite su URL exacta conocida. Las demás fuentes permitidas son HTTPS en `sably.co` o `cdn.sably.co`, sin credenciales, puertos o redirecciones. El servidor recibe bytes y verifica SHA-256; usa `MediaRepository` y `R2Storage`, no una tabla o formato paralelo. Guarda las correspondencias de cada URL con su valor nativo en `.emdash/media-replacements.json`.

El esquema se actualiza sin borrar campos. El piloto anterior tenía 21 columnas de archivo con `NOT NULL`; EmDash exige migración manual para relajar ese requisito. `scripts/emdash-relax-legacy.mjs` generó un lote acotado de 104 statements, probado en SQLite y D1 nativo local y aplicado mediante `DB.batch()` con checksum fijado en el endpoint. Conservó los valores e IDs de las diez filas, 56 índices y nueve triggers; comprobó cada campo antes y después. El plan y su resultado se archivan localmente en `.emdash/relax-legacy-*.json`. No volver a ejecutar esta migración sobre otro esquema o snapshot. Los registros nuevos usan `skip`. Sólo las diez entradas piloto permiten completar campos: se comprueba el hash del snapshot anterior y se conservan todos los valores ya existentes; sólo se rellenan campos nuevos o nulos. Si el piloto fue editado desde el snapshot, el lote aborta para volver a exportarlo y revisar. Esta comprobación es optimista, no un bloqueo editorial de transacción larga; debe ejecutarse en la ventana de migración sin edición simultánea del piloto.

`$ref:` sólo se resuelve dentro de un `applySeed()` individual. Por eso el servidor resuelve cada referencia contra el ID real del registro ya importado, en orden de dependencias, antes de llamar a la API nativa. Una referencia faltante aborta el lote. Los campos de imagen reciben valores locales de la biblioteca; ningún `$media` remoto puede atravesar la fase de contenido o esquema.

Cada lote completo registra un hash e informe de conteos en `_sably_migration_batches`. Repetir el mismo lote devuelve su resultado; reutilizar el identificador con otro payload falla. `.emdash/import-log.jsonl` guarda conteos, hashes e IDs de medios, sin secretos ni filas editoriales completas. Tras verificar importación, retirar la ruta temporal y eliminar `SABLY_MIGRATION_TOKEN`; el CMS continúa siendo la fuente editorial y el seed no se vuelve a aplicar con cada build.

## Evidencia y límites

Las seis pruebas automatizadas verifican generación idéntica, aplicación nativa del seed completo a SQLite temporal, lectura de los 964 registros con comparación de cada campo y cuerpo original, todas las aristas de relación, segunda aplicación sin duplicados, preservación de ediciones, guardas del endpoint, fuentes permitidas y límites de entrada. Las pruebas de contenido usan imágenes de proveedor externo de prueba para no acceder a la red; el almacenamiento real se verifica durante la importación de desarrollo.

El proceso conserva las afirmaciones comerciales del origen; no las verifica. No sincroniza usuarios, pedidos, datos personales ni autenticación. No copia el backend operativo a las tablas editoriales. La promoción a producción requiere su procedimiento separado y no forma parte del destino permitido por este importador.

Referencias primarias: [Seed Files](https://docs.emdashcms.com/themes/seed-files/), [Field Types](https://docs.emdashcms.com/reference/field-types/), [Relations](https://docs.emdashcms.com/guides/relations/) y [Querying Content](https://docs.emdashcms.com/guides/querying-content/). El código y las pruebas se contrastaron con el paquete instalado `emdash@1.1.0`.

## Resultado de la importación de desarrollo

La aplicación remota creó 954 registros y completó los diez pilotos, conservando sus valores existentes. La comparación posterior verificó los 964 registros, 22.813 campos y 1.676 aristas de relación. Se verificaron 287 imágenes locales únicas procedentes de 289 archivos, y se conservó otro registro existente de biblioteca. Una fotografía histórica externa respondió 403 en origen y sigue como referencia externa editable.

La segunda pasada devolvió cero creaciones, cero actualizaciones y 964 omisiones. La huella de IDs, fechas, versiones y revisiones fue idéntica antes y después. Evidencia local ignorada por Git: `.emdash/remote-integrity-report.json`, `.emdash/structure-integrity-report.json`, `.emdash/import-log.jsonl` y `.emdash/relax-legacy-result.json`. `scripts/emdash-verify-remote.mjs` sólo consulta datos editoriales de desarrollo; `--state-only` compara la huella contra el informe anterior.
