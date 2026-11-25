# Panel de administración de sably.co · auditoría y orden · 25-nov-2026

Mirado en local (`develop` en `5b8c4b1`, EmDash 1.1.0, copia de datos de producción, entrada con el acceso de
desarrollo). Capturas en `capturas/antes-*.jpg` y `capturas/despues-*.jpg`. Implementación: rama `feat/orden-panel`.

## 1. Qué hay hoy

**Menú lateral** (orden real):
- Escritorio · Calendar (en inglés).
- Contenido: carpeta **Catálogo** (Cursos, Cursos por país, Categorías, Creadores, Testimonios editoriales,
  Homologaciones) · Artículos · carpeta **Sitio** (Países, Ciudades, Páginas) · Medios.
- Administrar: Comentarios, Menús, Redirecciones, Widgets, Secciones, **Categories** y **Tags** (taxonomías del núcleo,
  en inglés y sin uso en el sitio), Firmas.
- Admin: Tipos de contenido, Esquema de firmas, Usuarios, Plugins, Registro, Importar, Ajustes.
- Plugins (al final, en el orden de `astro.config.mjs`): «Sably · integraciones», «Sably · SEO», «Sably ·
  operaciones», «Sably · WhatsApp».

**Dónde está cada ajuste guardado** (tabla `options`, nombre `plugin:<plugin>:settings:<clave>`):

| Clave | Plugin | Dónde se edita hoy | Problema |
|---|---|---|---|
| `temaPorDefecto` «Tema del sitio» | sably-operations | Plugins → sably-operations → engranaje (formulario genérico de EmDash) | Lo más peligroso del panel, mezclado con la caja y sin aviso: **el formulario genérico no pinta la descripción de los desplegables**, así que el texto de ayuda no se ve |
| `cajaVariante`, `cajaContador`, `cajaTitulo`, `cajaSubtitulo`, `mostrarCreador` | sably-operations | Mismo formulario | Rótulos «V2 · …» (jerga interna); contador y variante sin ayuda visible (desplegables) |
| `estiloCampo` | sably-operations | Mismo formulario | Sin ayuda; no dice dónde se nota |
| `notificationEmail` | sably-operations | Mismo formulario **y** «Sably · integraciones» → Correo con Brevo | Duplicado (dos sitios para lo mismo) |
| `browserMode`, `gtmId`, `gtmDelay`, `ga4Id`, `metaPixelId`, `serverConversions`, `ga4ApiSecret`, `metaCapiToken`, `hotmartHottok` | sably-integrations | Página «Sably · integraciones» (con validación y ayuda) **y** formulario genérico | Duplicado; el genérico no valida formatos («API Secret de GA4», «Token de Conversion API» en inglés a medias) y no tiene ninguna ayuda |
| `apiKey`, `fromEmail`, `fromName` | sably-brevo | «Sably · integraciones» → Correo **y** formulario genérico | Duplicado; el genérico sí tiene ayuda |
| Campañas y cupones (tabla `promo` de `SABLY_DB`) | sably-operations | «Sably · operaciones» → pestaña «Promociones y calendario» | Escondido dentro de «operaciones» |
| Vídeo de presentación y aviso de prueba social (tabla de widgets de `SABLY_DB`) | sably-operations | «Sably · operaciones» → pestaña «Widgets» | Rótulo genérico; mezcla medios con conversión |
| WhatsApp flotante (KV del plugin) | sably-whatsapp | «Sably · WhatsApp» | Bien resuelto, pero suelto |
| Auditoría SEO | sably-seo | «Sably · SEO» | Solo lectura; bien |

**Otros hallazgos:**
- «Sably · operaciones» → Resumen muestra «Plugin route error» en local sin `SABLY_DB` (mensaje en inglés, sin
  explicación). En producción no se comprobó.
- En «Plugins» los nombres son los identificadores técnicos (`sably-operations`), no nombres legibles; EmDash 1.1 no
  permite cambiarlos sin cambiar el id (y el id es parte de las claves guardadas: **no se toca**).
- EmDash 1.1.0 no admite carpetas para páginas de plugin (sí para colecciones): las páginas de plugin salen siempre
  sueltas al final del menú, en el orden de `astro.config.mjs`.
- Ajustes del núcleo: «Media usage tracking» y «Transfer» en inglés (vienen de EmDash; no se pueden traducir desde el
  sitio).

**Cómo lo resuelve la academia** (`academiadebelleza.edu.co/web/plugins/_shared/admin-kit`, solo lectura): un kit
común de React (3.400 líneas) con `PluginPage`, pestañas accesibles, campos con ayuda y error, barra de guardado fija,
confirmaciones y avisos, y un plugin por tarea (`adb-precios`, `adb-promos`, `adb-video`…). Se toma la idea (una
página por tarea, pestañas, ayuda en cada campo, guardar por sección, confirmar lo peligroso) sin portar el kit entero:
portar el kit es una sesión aparte ya decidida por la orquestadora (RELEVO, «Portar el plugin `adb-caja` y el
`admin-kit`»).

## 2. Propuesta de orden (implementada en `feat/orden-panel`)

Una sola entrada nueva, **«Ajustes del sitio»**, primera del bloque de plugins, con ocho pestañas en este orden. Cada
campo lleva rótulo en español, ayuda, su valor por defecto a la vista y la marca «guardado» o «de fábrica». Se guarda
por pestaña y por la **misma ruta del formulario de EmDash** (`/_emdash/api/admin/plugins/<plugin>/settings`): mismas
claves, mismo almacenamiento, misma invalidación de caché.

| Pestaña | Qué tiene | De dónde sale |
|---|---|---|
| 1 · Sitio y tema | **Zona aparte, en rojo: «Tema del sitio»** con aviso, valor actual y confirmación obligatoria («Entiendo que cambia lo que ven todos los visitantes»); estilo de los campos de formulario | `temaPorDefecto`, `estiloCampo` |
| 2 · Campañas y cupones | Lista, calendario y editor de campañas (lo mismo que había) | Pestaña «Promociones y calendario» de operaciones, movida |
| 3 · Caja de compra | Variante, contador, título, subtítulo, «Lo dicta …»; aviso de prueba social | `caja*`, `mostrarCreador`; widget `social` movido |
| 4 · Cursos y contenido | Accesos directos a Cursos, Cursos por país, Categorías, Creadores, Países, Páginas, Artículos, Menús y Moderación | Enlaces |
| 5 · Medios: audio y vídeo | Vídeo de presentación (arranque y repetición); huecos rotulados para narraciones y reproductor de vídeo | Widget `video` movido |
| 6 · SEO y medición | Accesos a «Medición y conversiones» y «Auditoría SEO», con una línea de qué hace cada uno | Enlaces |
| 7 · Integraciones | Correo del equipo; accesos a WhatsApp, Medición y conversiones (claves cifradas) y Correo de EmDash | `notificationEmail` (deja de estar duplicado en el formulario genérico: sigue ahí como respaldo) |
| 8 · Avanzado | Cómo revisar un tema sin cambiarlo (`?tema=`), la variable `SABLY_TEMA_POR_DEFECTO`, la lista de claves técnicas y el acceso al formulario genérico | Texto |

**Otras páginas del menú** (renombradas, mismas rutas internas):
- «Sably · operaciones» → **«Moderación y contactos»** (Resumen, Moderación, Calificaciones, Solicitudes). Lo que se
  fue a «Ajustes del sitio» deja un aviso con enlace.
- «Sably · integraciones» → **«Medición y conversiones»**.
- «Sably · SEO» → **«Auditoría SEO»**.
- «Sably · WhatsApp» → **«WhatsApp»**.

**Formulario genérico de EmDash** (Plugins → engranaje): se conserva como respaldo de emergencia (los documentos de
despliegue dicen cómo apagar V2 desde ahí). Se reordena por grupos, los rótulos llevan el grupo delante («Caja de
compra · Variante»), se quita «V2 ·», y cada campo tiene ayuda con su valor por defecto. Como ese formulario no pinta
la ayuda de los desplegables, el rótulo del tema avisa por sí mismo: «Tema del sitio (cambia lo que ven todos)».
Los valores de las opciones («Clásico», «V2 (rediseño)») no cambian.

**Qué NO cambia:** ninguna clave, ningún id de plugin, ningún valor guardado, ninguna ruta de API, nada de lo que ve
el público. Prueba: `tests/ajustes-panel.test.ts` (claves y valores permitidos idénticos a `develop`; cada clave en
una sola pestaña; los ajustes de la copia de producción se leen igual) y `scripts/verificar-ajustes-panel.mjs`
(compara la tabla `options` antes y después de guardar cada pestaña sin cambios).

## 3. Dónde cuelga cada pantalla nueva (para las otras sesiones)

- **Narraciones (audio):** pestaña «5 · Medios: audio y vídeo», en el hueco «Narraciones». Si necesita lista propia
  (muchas narraciones), página aparte «Narraciones» en `sably-operations` justo después de «Ajustes del sitio», y en la
  pestaña 5 un acceso directo.
- **Reproductor de vídeo:** misma pestaña 5, hueco «Reproductor de vídeo» (ajustes del reproductor) y, si hay
  biblioteca, página aparte «Vídeos».
- **Caja de compra** (variantes de la academia, IA del título): pestaña «3 · Caja de compra». Si llega el plugin
  `sably-caja` portado de `adb-caja`, su página se llama «Caja de compra» y la pestaña 3 enlaza a ella; las claves
  actuales `caja*` no se renombran.
- **Tienda:** página propia «Tienda» cuando exista; sus ajustes generales, como pestaña nueva entre «Caja de compra» y
  «Cursos y contenido».
- **Cuenta y preferencias:** pestaña «Avanzado» para lo técnico; si tiene moderación o usuarios, página propia.
- **Cookies y consentimiento:** «SEO y medición».
- Regla para todas: rótulo en español, ayuda en cada campo, valor por defecto visible, nada peligroso sin
  confirmación, y **nunca** renombrar una clave guardada (si hace falta otra forma, clave nueva y lectura de la vieja).

## 4. Lo que decide JP

1. Ocultar del menú «Categories» y «Tags» (taxonomías del núcleo sin uso): se hace en `Tipos de contenido` del panel de
   producción, no en código; no lo he tocado.
2. Si el formulario genérico de EmDash debe quedar como respaldo (propuesto) o desaparecer (quitar `settingsSchema`
   deja un solo sitio, pero rompe la instrucción de emergencia «Plugins → sably-operations → Tema del sitio» que citan
   `RELEVO-ORQUESTADORA.md` y `DESPLIEGUE-V2.md`).
3. Si «Moderación y contactos» debe partirse en dos («Opiniones» y «Contactos»).

## 5. Verificado (25-nov, local con copia de producción)

- `npm run test:migration` 346/346 y `npm run check` 0 errores (rama `feat/orden-panel`).
- `tests/ajustes-panel.test.ts`: claves, tipos, opciones y valores de fábrica iguales a `develop`; cada ajuste en una
  sola pestaña; todos con ayuda; los ajustes guardados en la copia de producción (más `temaPorDefecto = v2`) se leen
  igual; la página solo envía lo que cambió y el tema exige confirmación.
- De punta a punta en el panel local: guardar sin cambios en «Sitio y tema», «Caja de compra» e «Integraciones» →
  `scripts/verificar-ajustes-panel.mjs` da «Sin cambios: 8 ajustes iguales». Cambiar el estilo de los campos y el tema
  (con la casilla de confirmación; sin ella el botón está desactivado) → cambian exactamente esas dos filas, con el
  mismo nombre (`plugin:sably-operations:settings:estiloCampo` y `…:temaPorDefecto`), y la portada local sale con
  `data-tema="v2"`.

**No verificado:** campañas, prueba social y vídeo dentro de la página nueva (en local no hay `SABLY_DB`; la pantalla
antigua daba el mismo error, «Plugin route error»); producción; lectores de pantalla; modo oscuro del panel.

**Riesgo encontrado (sin cambiar):** el botón «Guardar configuración» del formulario genérico de EmDash guarda todos
los campos, también los que están de fábrica. Si alguien lo pulsa con el tema sin guardar, fija el tema y la variable
`SABLY_TEMA_POR_DEFECTO` deja de mandar. En producción el tema ya está guardado (`v2` desde el 25-nov), así que hoy no
cambia nada, pero conviene usar «Ajustes del sitio».
