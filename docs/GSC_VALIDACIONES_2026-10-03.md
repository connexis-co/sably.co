# Validaciones de Search Console y recuperación de visibilidad

## Evidencia recibida y alcance

Los cinco nuevos XLSX contienen 258 alternativas con canónica, 114 redirecciones, 66 páginas con vídeo complementario y las mismas 12 fichas para los avisos `review` y `aggregateRating`: 447 URLs distintas. No contienen los detalles de los 28 antiguos 404 ni de las siete discrepancias de canónica del informe general anterior.

El primer rastreo completo de esta lista encontró 436 URLs HTTPS con destino HTTP 200, sin bucles ni cadenas de varias redirecciones. Las otras 11 son HTTP: desde la conexión local responden 302 hacia una página de Coljuegos, sin cabeceras de Cloudflare. No se interpreta ese destino HTTP 200 ajeno como una comprobación satisfactoria del sitio. Es una anomalía de acceso aún por contrastar desde otra red y no demuestra que Googlebot reciba la misma respuesta.

## Correcciones

- La antigua ruta `/cursos/curso-de-unas-semipermanentes` iba a la portada genérica. Su destino pasa a `/co/curso-de-unas/`, cuyo programa publicado incluye esmaltado semipermanente.
- El Worker normaliza HTTP y `www` al origen HTTPS principal para GET/HEAD y resuelve los slugs heredados en el mismo salto cuando la petición alcanza Cloudflare. Se preservan las campañas en la query y no se redirigen cuerpos de webhooks. El despliegue comprueba las respuestas desde GitHub Actions: un bloqueo anterior a Cloudflare no se puede corregir dentro del Worker.
- Se conserva la canónica de ciudad hacia país. Las tarjetas enlazan a la ficha de país y el bloque de disponibilidad de ciudades deja de multiplicar enlaces a fichas casi duplicadas. Las rutas locales existentes continúan disponibles.
- Cada vídeo con archivo medido, curso publicado e imagen nativa tiene una sola ruta `/videos/<curso>/`, con reproductor HTML visible y controlable sin JavaScript. Título, descripción y portada proceden de EmDash; duración y fecha corresponden al archivo real. La vista pertenece a la plantilla intercambiable. Su canónica y sitemap describen la página de visualización, no ocho fichas comerciales del mismo vídeo. `contentUrl` apunta al MP4; la página ya no se declara erróneamente como `embedUrl` de un reproductor independiente.
- Las reseñas propias aprobadas se leen junto con la compra del mismo curso activo. El promedio completo y las seis opiniones con texto más recientes alimentan la sección visible y el JSON-LD a partir del mismo resultado. No hay promedio de catálogo, reseñas de otros cursos ni reseñas de Hotmart dentro de ese marcado. La moderación de EmDash determina qué se publica.

## Límites que no debe ocultar un resultado verde

En la consulta del 3 de octubre hay **0 reseñas propias verificadas y 139 reseñas públicas importadas de Hotmart**. Por tanto, la corrección de la integración no proporciona automáticamente las reseñas que faltan en las 12 URLs. La revalidación de esos avisos puede seguir pendiente o fallar hasta disponer de opiniones propias reales. No se añaden estrellas ficticias ni se retira Product para ocultar el aviso: las ofertas siguen siendo válidas. Google explica que `offers` basta para la elegibilidad del fragmento, aunque pueda advertir de `review`/`aggregateRating` ausentes.

Las alternativas correctamente canonicalizadas y las URL que redirigen deben conservar su comportamiento. «Validar corrección» no debe convertirlas en páginas indexables independientes. Las fichas comerciales pueden continuar apareciendo como vídeos no indexados: las nuevas páginas de visualización ofrecen el destino apropiado, pero Google debe rastrearlo e indexarlo y no garantiza resultados de vídeo.

## Sobre la caída del lanzamiento

El gráfico muestra 434 clics y 11.758 impresiones, con una caída abrupta desde el 18 de agosto. El informe posterior todavía registra 3.918 páginas indexadas. No hay evidencia suficiente para atribuirlo exclusivamente al presupuesto de rastreo ni a una penalización; el propietario confirmó que no hay acciones manuales ni incidencias de seguridad.

El historial registra una canonicalización masiva ciudad → país el **16 de agosto** (`0a9f8b5`, PR #104) y su reversión el **17 de agosto** (`f8f68fd`, PR #105). La proximidad temporal merece investigación, pero no demuestra causalidad ni confirma cuándo Google procesó cada versión. El objetivo actual es mantener estables las URLs comerciales, consolidar señales internas y aportar contenido específico, sin alternar repetidamente reglas de indexación.

La muestra de consultas anterior ya identificó solapamientos geográficos y permitió consolidar el producto duplicado de Barista. Las tres nuevas guías informativas publicadas se conservan. La recuperación se evaluará con clics, impresiones y posición de grupos comparables de consulta/país, no con el número bruto de URLs indexadas ni con la desaparición de avisos opcionales.

## Fuentes primarias

- [Presupuesto de rastreo](https://developers.google.com/crawling/docs/crawl-budget).
- [Páginas de visualización y requisitos de vídeo](https://developers.google.com/search/docs/appearance/video).
- [Reseñas y prohibición de agregar calificaciones de otros sitios](https://developers.google.com/search/docs/appearance/structured-data/review-snippet).
- [Requisitos y advertencias de Product](https://developers.google.com/search/docs/appearance/structured-data/product-snippet).
- [Validación de indexación](https://support.google.com/webmasters/answer/7440203?hl=es).
