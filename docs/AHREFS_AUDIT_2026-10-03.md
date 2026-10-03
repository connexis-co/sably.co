# Ahrefs y verificación técnica de Sably — 3 de octubre de 2026

Proyecto [10474273](https://app.ahrefs.com/site-audit/10474273/issues), rastreo indicado por el propietario: `2026-10-03T07:33:16Z`. La consulta real del conector a `site-audit-issues` y `site-audit-projects` devolvió `Insufficient plan`. El resumen de 15 incidencias procede del propietario; no se obtuvo el listado de URLs afectadas ni se inició un nuevo rastreo mediante el conector.

| Observación del reporte | Comprobación y cambio |
| --- | --- |
| Open Graph incompleto (1091) | La plantilla de cursos no entregaba su portada al head y no había imagen general configurada. Ahora envía la portada de cada curso; todas las páginas tienen una imagen de respaldo absoluta. EmDash sigue componiendo y deduplicando las etiquetas, con prioridad para la imagen SEO del editor. |
| Títulos extensos (146 indexables y 156 adicionales) | Las plantillas de cursos, categorías y homologaciones generan frases más breves sin cortar nombres a mitad de palabra. Se preparó texto editorial específico para nueve artículos y Nosotros en el panel SEO nativo. No se impone un corte a las personalizaciones del editor. |
| Descripciones largas (14) y cortas (3) | Se prepararon descripciones específicas para cinco artículos y dos páginas legales; se abrevia la descripción generada de homologaciones y se aplica el límite de palabra existente también a las variantes únicas de cursos. |
| Indexables fuera del sitemap (137) | El CMS tiene 17 cursos cuyo checkout es `PENDIENTE`: 136 variantes de país excluidas del sitemap comercial. Se alinean sus robots con esa exclusión y se omite su hreflang hasta habilitar el checkout. Es una explicación probable de 136 casos, no una coincidencia por URL confirmada por Ahrefs. La ruta `/sitemap/` ya se incorporó al sitemap nativo. |
| Noindex / noindex follow (36) | Las 36 ciudades tienen una política anterior de canonical a país y noindex para Google. Se mantiene esa política. Desarrollo conserva su protección y noindex global. No se eliminan exclusiones para lograr un contador artificialmente verde. |
| Un único enlace interno (179 + 30) | Ya se añadieron enlaces desde cursos a guías relacionadas en PR127. Sin el detalle de Ahrefs no se afirma que todos estos casos estén resueltos; hace falta comparar sus URLs concretas tras el corte. |
| Redirecciones y cadenas | PR127 corrige tres rutas antiguas de cursos para dirigirlas a la ficha final y conservar parámetros. Las redirecciones HTTP→HTTPS son intencionales. Las cadenas restantes requieren los ejemplos del informe y la configuración efectiva del dominio productivo. |
| Páginas lentas / respuesta lenta a IA (4 + 4) | El resumen no contiene URLs ni tiempos. No se atribuye la causa a un plugin ni se declara una mejora de latencia sin mediciones. Se debe repetir el rastreo sobre el nuevo sitio público y comparar TTFB y tamaño. |

## Imagen de Nosotros

La URL de transformación `/_image?href=…/_emdash/api/media/file/migration/…` devolvía 404, mientras que el original nativo devolvía 200, JPEG y 122931 bytes. El adaptador `passthrough` sustituía silenciosamente el servicio configurado de Astro. Se usa ahora el modo `custom`, con un servicio que entrega las imágenes nativas desde su ruta de EmDash y conserva el comportamiento anterior de los demás recursos. La biblioteca sigue siendo editable en EmDash.

## Criterios

Google recomienda títulos descriptivos y concisos, pero no establece un máximo universal de caracteres: el recorte depende del ancho disponible. Los 60 caracteres usados aquí son una guía de composición, no una regla de indexación. [Documentación de títulos](https://developers.google.com/search/docs/appearance/title-link).

Las URLs excluidas intencionalmente se tratan con `noindex` rastreable y el sitemap principal enumera las canónicas que se pretende indexar. [Noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Publicación y validación

`scripts/seo-editorial-october.mjs` prepara y aplica únicamente campos SEO vacíos; conserva cuerpo, URL, canónica, imagen, noindex y valores del editor. Su ejecución es editorial y separada del despliegue: no se añade como seed recurrente a CI.

La corrección de código no modifica los contadores del rastreo histórico de Ahrefs. Cerrar los casos requiere desplegar el SHA validado, verificar HTTP/robots/medios y ejecutar un nuevo rastreo. No se ha acreditado un rastreo nuevo ni una recuperación de posiciones.
