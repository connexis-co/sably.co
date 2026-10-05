# Entrega de Sably en Cloudflare

La plantilla utiliza el proveedor oficial `cacheCloudflare()` de Astro y Workers Cache. EmDash conserva su caché de objetos KV independiente por entorno. La biblioteca y entrega adaptativa de imágenes se describen en [IMAGES.md](IMAGES.md).

## Medición de partida (4 de octubre de 2026)

Antes de este ajuste, una página sin caché hacía entre 43 y 92 consultas D1 y tardaba de 2,7 a 5,2 s desde Colombia. En Workers Analytics, la mediana de las ejecuciones desde SIN, FRA, GRU o CDG estaba entre 7 y 15 s: cada consulta cruzaba hasta ENAM, donde viven las dos bases. La caché del borde apenas ayudaba: el HTML duraba 60 s sin servirse vencido, y cualquier cookie de GA/Clarity o un `?gclid`/`?utm_*` hacía `BYPASS`, de modo que casi todas las visitas reales y todo el tráfico de anuncios renderizaban la página entera. Con la caché llena, la página carga en unos 375 ms (Lighthouse escritorio, red real).

## Páginas públicas

El HTML es fresco 5 minutos en el borde y después se sirve vencido hasta un día mientras una sola petición lo regenera en segundo plano (`stale-while-revalidate`). El navegador revalida en cada navegación (`max-age=0`, sin `must-revalidate`, que también impediría al borde servir la copia vencida). Las publicaciones, despublicaciones y cambios de contenido invalidan las etiquetas editoriales nativas de EmDash; las páginas incluyen las colecciones utilizadas por el catálogo y la etiqueta de ajustes del sitio. Las modificaciones correctas de los plugins Sably, las subidas, reemplazos o borrados de medios y los refrescos autenticados de precios (`POST /api/v1/precios`, `/api/v1/subjects`) invalidan además `sably:public`. Los envíos de visitantes (leads, votos, comentarios, el refresco de precio limitado por curso) nunca purgan.

Cada despliegue tiene una caché independiente y la etiqueta de versión de Cloudflare. No se comparte entre versiones porque el HTML anterior apunta a recursos `/_astro/` con hash que la nueva versión ya no publica. Para que la primera visita tras desplegar no pague el render completo, el workflow de promoción ejecuta `scripts/warm-public-cache.mjs`: pide de forma anónima cada página de los sitemaps y las dos API compartidas, y deja el resumen en `dist/cache-warm.json`. No bloquea el despliegue.

### Variantes que no deben partir la caché

Workers Cache usa la ruta y la query como clave, y `Vary` separa cookies y credenciales también en la consulta que ocurre antes del Worker. Para que las cookies de analítica, las recargas y los identificadores de anuncios no creen una página por visitante, `sharedPublicRequest()` reconoce la forma anónima de la petición: quita las cookies, `Cache-Control`/`Pragma` y los parámetros de seguimiento (`utm_*`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, `ttclid`, `_gl`, `srsltid`…) y vuelve a entrar al Worker por `ctx.exports.default`, que pasa por la caché. El visitante recibe ese HTML anónimo, que no se almacena con su clave. El servidor no lee esos parámetros; el navegador conserva la URL original, así que el reparto de UTM y el cupón de `?promo=` siguen funcionando en cliente.

No se comparte nada cuando hay sesión o modo edición de EmDash (`astro-session`, `emdash-*`), Cloudflare Access, `Authorization`, cabeceras de preview o rangos, `?_preview`, `?promo=` o cualquier otro parámetro. Esas peticiones renderizan como antes, privadas. Las API, los formularios, los errores y el administrador quedan fuera.

### Lo que se cachea además del HTML

| Recurso | Borde | Navegador | Invalidación |
| --- | --- | --- | --- |
| `GET /api/v1/promo`, `/api/v1/config` | 60 s + 60 s vencido | 30 s | `sably:public` |
| Originales `/_emdash/api/media/file/*` (imagen, vídeo, audio) | 30 días | lo que fija EmDash (revalidar) | `sably:media` |
| `/` → `/co/`, redirecciones heredadas y barra final (301) | 1 día | 1 hora | por versión |

Los originales de medios alimentan las variantes de `/cdn-cgi/image/`; antes cada variante nueva arrancaba EmDash y leía R2 (0,6–1,7 s). EmDash revalida en el navegador porque «Reemplazar original» puede sobrescribir la misma clave; por eso la caché del borde se purga con cualquier escritura en `/_emdash/api/media`.

Los datos operativos y los cambios hechos directamente fuera de esas rutas quedan sujetos a los 5 minutos de frescura más una petición vencida. Si se modifica una integración por SQL, una importación externa o un script, hay que purgar `sably:public` mediante Workers Cache, o esperar ese intervalo. La caché no almacena claves, solicitudes ni datos de contactos.

## Ubicación del Worker

Producción usa `placement.region: aws:us-east-1`, junto a las bases D1 en ENAM. La caché se consulta antes del Worker en el centro de datos del visitante: un HIT nunca sale del borde. Solo las páginas sin caché, las API y los originales de medios se ejecutan cerca de los datos, donde cada consulta cuesta 1–3 ms en lugar de 40–220 ms. La respuesta lleva `cf-placement` para comprobarlo.

## Recursos

En producción, `/_astro/*` y los archivos públicos de marca y fotos (`/brand/`, `/covers/`, `/creadores/`, `/heroes/`, el certificado, favicons, iconos y el manifiesto) salen directamente de Workers Static Assets, sin ejecutar el Worker (`PRODUCTION_ASSET_BYPASS` en `scripts/environment-config.mjs`). `/_astro/*` lleva caché inmutable de un año; los demás, una semana con revalidación en segundo plano (`public/_headers`). El resto pasa por las reglas del Worker. Desarrollo conserva `run_worker_first: true`, sin Workers Cache, incluido el acceso a recursos estáticos.

Las fuentes Inter y Outfit se alojan en el mismo dominio, mantienen `font-display: swap` y los caracteres latinos y latinos extendidos. Se precargan las dos fuentes utilizadas en la primera pantalla; sus cabeceras `Link` son compatibles con Early Hints si la zona lo tiene habilitado. La carga inicial de datos de portada y de WhatsApp evita esperas secuenciales entre consultas independientes.

## Estabilidad visual

La barra y el bloque de promoción se pintan en el servidor con la misma regla que el navegador (`mejorPromocion`), así ocupan su sitio desde el primer pintado. Antes nacían ocultos y aparecían al responder `/api/v1/promo`, empujando la página (CLS 0,124 en la portada móvil). El script confirma la campaña al cargar porque el HTML puede venir de la caché: la mantiene, la cambia de tema o la retira, y si el endpoint falla conserva la del servidor. `/api/v1/promo` y `/api/v1/config` se piden una sola vez por página (`cargarPromos`, `leerConfig`), compartidas entre la barra, la ficha, WhatsApp, la prueba social y el reproductor.

## Verificación

Comprobar un GET anónimo repetido: `CF-Cache-Status: HIT` debe aparecer después del primer llenado, y `UPDATING`/`STALE` tras los 5 minutos. Repetir con `_ga`, `?gclid=` o `Cache-Control: no-cache`: deben responder rápido con el HTML anónimo (`Cloudflare-CDN-Cache-Control` no aparece; `Cache-Control: max-age=0`). Con cookie de sesión, Authorization, `_preview` y `promo` no deben compartir el HTML. Confirmar que las páginas desconocidas mantienen 404, los recursos de desarrollo siguen protegidos, la edición conserva su barra y las publicaciones invalidan la caché. La prueba se hace sobre el dominio canónico HTTPS.

HTTP/3 y compresión se comprueban en las respuestas reales. Speed Brain, Rocket Loader, Polish y otros servicios no sustituyen la caché nativa ni se activan a ciegas: algunos no aplican a rutas Workers o pueden interferir con módulos y medición. No se contratan servicios ni se modifican reglas de acceso de rastreadores. Los tiempos HTTP de una muestra no equivalen a los Core Web Vitals de usuarios reales.

Referencias: [Workers Cache](https://developers.cloudflare.com/workers/cache/), [claves de caché](https://developers.cloudflare.com/workers/cache/cache-keys/), [configuración y variantes](https://developers.cloudflare.com/workers/cache/configuration/), [invalidación](https://developers.cloudflare.com/workers/cache/purge/), [ubicación](https://developers.cloudflare.com/workers/configuration/placement/).
