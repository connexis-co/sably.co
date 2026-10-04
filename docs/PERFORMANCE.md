# Entrega de Sably en Cloudflare

La plantilla utiliza el proveedor oficial `cacheCloudflare()` de Astro y Workers Cache. EmDash conserva su caché de objetos KV independiente por entorno. La biblioteca y entrega adaptativa de imágenes se describen en [IMAGES.md](IMAGES.md).

## Páginas públicas

El HTML publicado puede permanecer 60 segundos en el borde. No hay ventana de contenido vencido. El navegador revalida en cada navegación. Las publicaciones, despublicaciones y cambios de contenido invalidan las etiquetas editoriales nativas de EmDash; las páginas incluyen las colecciones utilizadas por el catálogo y la etiqueta de ajustes del sitio. Las modificaciones correctas de los plugins Sably invalidan además `sably:public`. Cada despliegue tiene una caché independiente y la etiqueta de versión de Cloudflare.

Se excluyen las solicitudes con cookies, autorización, parámetros, cabeceras de preview o rangos, los formularios, las API, los errores y el administrador. `Vary` separa cookies y credenciales también en la consulta de caché que ocurre antes del Worker. Las campañas con query string se resuelven directamente. El administrador y el modo de edición siempre conservan la protección y frescura de EmDash.

Los datos operativos y los cambios hechos directamente fuera de la API editorial quedan sujetos al máximo de 60 segundos. Si se modifica una integración por SQL, una importación externa o un script, hay que purgar `sably:public` mediante Workers Cache, o esperar ese intervalo. La caché no almacena claves, solicitudes ni datos de contactos.

## Recursos

En producción, solo `/_astro/*` puede saltar directamente a Workers Static Assets. Se mantienen nombres con hash y caché inmutable. El resto pasa por las reglas del Worker. Desarrollo conserva `run_worker_first: true`, sin Workers Cache, incluido el acceso a recursos estáticos.

Las fuentes Inter y Outfit se alojan en el mismo dominio, mantienen `font-display: swap` y los caracteres latinos y latinos extendidos. Se precargan las dos fuentes utilizadas en la primera pantalla; sus cabeceras `Link` son compatibles con Early Hints si la zona lo tiene habilitado. La carga inicial de datos de portada y de WhatsApp evita esperas secuenciales entre consultas independientes.

## Verificación

Comprobar un GET anónimo repetido: `CF-Cache-Status: HIT` debe aparecer después del primer llenado. Repetir con cookie de sesión, Authorization, `_preview`, `promo` y `Cache-Control: no-cache`: no deben compartir el HTML en caché. Confirmar que las páginas desconocidas mantienen 404, los recursos de desarrollo siguen protegidos, la edición conserva su barra y las publicaciones invalidan la caché. La prueba se hace sobre el dominio canónico HTTPS.

HTTP/3 y compresión se comprueban en las respuestas reales. Speed Brain, Rocket Loader, Polish y otros servicios no sustituyen la caché nativa ni se activan a ciegas: algunos no aplican a rutas Workers o pueden interferir con módulos y medición. No se contratan servicios ni se modifican reglas de acceso de rastreadores. Los tiempos HTTP de una muestra no equivalen a los Core Web Vitals de usuarios reales.

Referencias: [Workers Cache](https://developers.cloudflare.com/workers/cache/), [configuración y variantes](https://developers.cloudflare.com/workers/cache/configuration/), [invalidación](https://developers.cloudflare.com/workers/cache/purge/).
