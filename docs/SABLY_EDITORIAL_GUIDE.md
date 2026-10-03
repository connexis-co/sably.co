# Administración editorial de Sably en EmDash

## Qué se edita y dónde

La plantilla `sably-classic` recibe datos del CMS. El contenido publicado se consulta en cada petición: una corrección editorial no necesita recompilar Astro. La portada, listados y fichas comparten componentes de la plantilla.

| Colección | Uso editorial |
| --- | --- |
| Cursos | Ficha central: contenido enriquecido, imagen, temario, preguntas, objetivos, público, instructor, categoría, creador y compra. |
| Versiones por país | Adaptaciones del curso por mercado; conservar la relación con el curso y el país. |
| Categorías | Nombre, descripción e imagen del catálogo. |
| Países y ciudades | Navegación geográfica, datos locales y relación ciudad–país. |
| Creadores | Perfiles y cursos relacionados. |
| Blog | Artículos, cuerpo enriquecido, imagen y SEO. |
| Testimonios | Opiniones editoriales identificadas; independientes de las reseñas moderadas. |
| Páginas | Contenido institucional y páginas nuevas con bloques de diseño. |
| Homologaciones | Fichas informativas de programas. |

Los campos de procedencia preservan el material original para auditar la migración. Para el trabajo cotidiano se usan el editor enriquecido, los selectores de relaciones, imágenes y listas de temario o preguntas. Los borradores no se muestran en el sitio público. Los cursos pendientes de enlace de compra conservan su tratamiento anterior y no entran en el sitemap de cursos publicados.

## Páginas y plantilla

Las diez secciones reutilizables de la portada se editan en **Secciones**: hero, categorías, cursos, beneficios, testimonios, ciudades, blog y preguntas. Sus títulos, párrafos y llamadas a la acción conservan el diseño; los marcadores `{pais}` y `{moneda}` adaptan el texto al mercado.

Los bloques disponibles son texto enriquecido, imagen, hero, llamada a la acción, preguntas frecuentes, historia con imagen, grupo de tarjetas y formulario con canales de contacto. El orden de los bloques define el contenido de la página; sus componentes Astro definen la presentación. Los menús principal, pie, redes y ecosistema se guardan en EmDash, igual que las áreas de widgets después de la cabecera y del pie.

**Contacto y Nosotros:** entra en **Sitio → Páginas**, abre la página y modifica **Título visible**, **Antetítulo de cabecera**, **Introducción de cabecera** y **Diseño de la página**. El título SEO y la descripción se editan por separado. Publica para ver el resultado.

- **Nosotros:** bloques de historia (incluida su imagen de Medios), principios, ecosistema y llamada a la acción. Las tarjetas se añaden, ordenan y eliminan desde el repetidor. El contenido original queda preservado en **Contenido**, que actúa como alternativa cuando la página no tiene bloques.
- **Contacto:** el bloque **Formulario y canales de contacto** contiene título, etiquetas de los campos, ayuda del mensaje, botón, texto de autorización, enlace de privacidad, correo público, WhatsApp, horario y tarjeta de ayuda. WhatsApp vacío usa el teléfono del país. Correo u horario vacíos ocultan ese canal. El formulario registra el país elegido y el consentimiento mostrado; las solicitudes aparecen en **Sably · operaciones → Solicitudes**. El destino de notificaciones se configura por separado en el plugin de operaciones; cambiar el correo público no redirige correos privados.
- Los bloques pueden reutilizarse en páginas nuevas. Cambiar el slug no desactiva el formulario: su funcionamiento depende del bloque nativo. Los estados de envío y validación pertenecen a la plantilla.

`src/themes/index.ts` selecciona la plantilla y `src/themes/sably-classic/manifest.ts` documenta su contrato. Para un rediseño se implementa otra plantilla que respete las colecciones, bloques, rutas y metadatos existentes; se prueba en desarrollo y se despliega. El cambio de plantilla es una entrega de código Astro, no requiere volver a importar el catálogo.

## Módulos operativos

- **WhatsApp:** visibilidad, teléfono por defecto o por país, mensaje contextual, dispositivos, posición, horarios y reglas por curso, categoría, país o ruta. La regla de mayor prioridad que coincide decide el contacto. El enlace sólo abre WhatsApp cuando el visitante pulsa el botón.
- **Promociones:** calendario, inicio/fin, prioridad, países, proveedores y cursos incluidos/excluidos. `?promo=clave` selecciona una campaña válida para ese contexto. Un cupón sólo se anuncia para los cursos cuyo checkout lo acepta.
- **Moderación y calificaciones:** reseñas y comentarios con estados de aprobación. Los cambios publicados se reflejan al volver a cargar la ficha.
- **Solicitudes:** bandeja privada con nombre, correo, teléfono, curso, país, origen y consentimiento; filtros y exportación CSV de todos los resultados. Las solicitudes repetidas del mismo día y curso no generan otra fila ni otro aviso. Desarrollo guarda solicitudes de prueba y no envía correos.
- **Widgets:** vídeo y avisos sociales configurables desde el panel.

Los plugins se administran dentro de EmDash y usan sus permisos y rutas oficiales. La base operativa `SABLY_DB` mantiene solicitudes, moderación y campañas separadas de las tablas editoriales `DB`. Ambas pertenecen a la misma aplicación y a un entorno concreto.

## Correo

**Sably · Brevo** integra el proveedor que ya utiliza el sitio como transporte aislado. En sus ajustes, configurar una clave de envío, el nombre y la dirección del remitente verificado en Brevo; después revisar el proveedor en **Ajustes → Correo**. La clave se guarda con el cifrado nativo de EmDash, fuera del repositorio. En los ajustes de **Sably · operaciones**, configurar **Correo del equipo** para recibir solicitudes y atender respuestas. Sin proveedor o destinatario configurado se guardan los datos, sin enviar avisos ni afirmar que se entregó un correo al visitante.

Los formularios de desarrollo no envían mensajes. La recuperación de compras está reservada al entorno productivo activado y envía solo al comprador, sin copia visible del equipo. El [informe de plugins](plugin-marketplace-review.md) explica la selección y las alternativas para formularios futuros.

## Comentarios del blog

Cada artículo publicado muestra su hilo y formulario. El visitante puede comentar, responder a un comentario principal aprobado y marcarlo como útil. Los envíos comienzan pendientes; **Sably · operaciones → Moderación** permite aprobarlos, rechazarlos o marcarlos como spam. El correo es opcional y nunca se muestra en el hilo público. No se envían notificaciones automáticas a comentaristas.

Los comentarios aprobados llegan en el HTML y se actualizan desde el backend. Rechazar un comentario principal oculta también sus respuestas; despublicar el artículo cierra el hilo y los votos sin borrar el historial. La plantilla `sably-classic/components/Comments.astro` controla su diseño (Outfit/Inter, azul oscuro, rosado, tarjetas y formulario), mientras que el contrato de datos y la moderación permanecen en el plugin. Un futuro tema puede sustituir `Comments` desde el selector de plantilla.

## SEO y publicación

El panel SEO nativo administra título, descripción, imagen social, canonical e indexación. La plantilla integra las salidas oficiales de EmDash con los datos estructurados de Sably y los hreflang por país. Los sitemaps se calculan con contenido publicado. Desarrollo añade `noindex` y requiere acceso; no debe enviarse a indexar.

El módulo **Sably · SEO** revisa las nueve colecciones indexables, recorre todas sus entradas y enlaza cada observación con el editor. Respeta la herencia de las variantes y no bloquea la publicación por una recomendación de longitud. Véase [la evaluación del plugin](seo-plugin-decision.md).

Publicar un contenido en EmDash cambia los datos de ese entorno. Promover código con CI/CD cambia la plantilla y los módulos, sin reemplazar el contenido de producción. La copia editorial de producción a desarrollo es un proceso independiente descrito en [CI_CD.md](CI_CD.md).

## Acceso

Abrir `https://dev.sably.co/_emdash/admin`. La entrada protegida del entorno y la sesión nativa del CMS son dos pasos distintos. EmDash usa la passkey del administrador registrada en su navegador.
