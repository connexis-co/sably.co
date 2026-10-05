# Entrega de Sably en Cloudflare

La plantilla utiliza el proveedor oficial `cacheCloudflare()` de Astro y Workers Cache. EmDash conserva su caché de objetos KV independiente por entorno. La biblioteca y entrega adaptativa de imágenes se describen en [IMAGES.md](IMAGES.md).

## Medición de partida (4 de octubre de 2026)

Antes de este ajuste, una página sin caché hacía entre 43 y 92 consultas D1 y tardaba de 2,7 a 5,2 s desde Colombia. En Workers Analytics, la mediana de las ejecuciones desde SIN, FRA, GRU o CDG estaba entre 7 y 15 s: cada consulta cruzaba hasta ENAM, donde viven las dos bases. La caché del borde apenas ayudaba: el HTML duraba 60 s sin servirse vencido, y cualquier cookie de GA/Clarity o un `?gclid`/`?utm_*` hacía `BYPASS`, de modo que casi todas las visitas reales y todo el tráfico de anuncios renderizaban la página entera. Con la caché llena, la página carga en unos 375 ms (Lighthouse escritorio, red real).

## Páginas públicas

El HTML es fresco hasta un día en el borde y después se sirve vencido hasta una semana mientras una sola petición lo regenera en segundo plano (`stale-while-revalidate`). El día se acorta hasta el próximo inicio o fin de una promoción activa (`pageMaxAge` y `readNextPromoBoundary`), porque la barra de promoción se pinta en el servidor. Con poco tráfico por centro de datos, un TTL de 5 minutos dejaba casi todas las visitas en un render completo (comprobado el 4 de octubre: páginas calentadas volvían a `MISS`/`EXPIRED`). El navegador revalida en cada navegación (`max-age=0`, sin `must-revalidate`, que también impediría al borde servir la copia vencida). Las publicaciones, despublicaciones y cambios de contenido invalidan las etiquetas editoriales nativas de EmDash; las páginas incluyen las colecciones utilizadas por el catálogo y la etiqueta de ajustes del sitio. Las modificaciones correctas de los plugins Sably, las subidas, reemplazos o borrados de medios y los refrescos autenticados de precios (`POST /api/v1/precios`, `/api/v1/subjects`) invalidan además `sably:public`. Los envíos de visitantes (leads, votos, comentarios, el refresco de precio limitado por curso) nunca purgan.

Cada despliegue tiene una caché independiente y la etiqueta de versión de Cloudflare. No se comparte entre versiones porque el HTML anterior apunta a recursos `/_astro/` con hash que la nueva versión ya no publica. Tras promover, el workflow ejecuta `scripts/warm-public-cache.mjs`: pide de forma anónima cada página de los sitemaps y las dos API compartidas (3 en paralelo; D1 atiende una consulta a la vez por base y más paralelismo solo las encola) y deja el resumen en `dist/cache-warm.json`. Llena los niveles de caché de la región del runner y la caché de objetos de EmDash; los centros de datos lejanos se llenan con su primera visita. No bloquea el despliegue.

### Variantes que no deben partir la caché

Workers Cache usa la ruta y la query como clave, y `Vary` separa cookies y credenciales también en la consulta que ocurre antes del Worker. Para que las cookies de analítica, las recargas y los identificadores de anuncios no creen una página por visitante, `sharedPublicRequest()` reconoce la forma anónima de la petición: quita las cookies, `Cache-Control`/`Pragma` y los parámetros de seguimiento (`utm_*`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, `ttclid`, `_gl`, `srsltid`…) y responde con la copia anónima guardada en la Cache API del Worker (`src/lib/shared-page-cache.ts`, el mismo patrón que Sovialis): fresca 10 minutos, después se sirve y se renueva en segundo plano, y separada por versión del Worker. Esa copia no recibe las purgas por etiqueta de Workers Cache, así que tras una edición estos visitantes pueden ver la versión anterior hasta 10 minutos. El visitante recibe ese HTML anónimo, que no se almacena con su clave en Workers Cache. (La primera versión reentraba por `ctx.exports.default` a través de Workers Cache; en producción esa vuelta se quedaba ~20 s con entradas vencidas y se retiró el 4 de octubre.) El servidor no lee esos parámetros; el navegador conserva la URL original, así que el reparto de UTM y el cupón de `?promo=` siguen funcionando en cliente.

No se comparte nada cuando hay sesión o modo edición de EmDash (`astro-session`, `emdash-*`), Cloudflare Access, `Authorization`, cabeceras de preview o rangos, `?_preview`, `?promo=` o cualquier otro parámetro. Esas peticiones renderizan como antes, privadas. Las API, los formularios, los errores y el administrador quedan fuera.

### Lo que se cachea además del HTML

| Recurso | Borde | Navegador | Invalidación |
| --- | --- | --- | --- |
| `GET /api/v1/promo`, `/api/v1/config` | 60 s + 60 s vencido | 30 s | `sably:public` |
| Originales `/_emdash/api/media/file/*` (imagen, vídeo, audio) | 30 días | lo que fija EmDash (revalidar) | `sably:media` |
| `/` → `/co/`, redirecciones heredadas y barra final (301) | 1 día | 1 hora | por versión |

Los originales de medios alimentan las variantes de `/cdn-cgi/image/`; antes cada variante nueva arrancaba EmDash y leía R2 (0,6–1,7 s). EmDash revalida en el navegador porque «Reemplazar original» puede sobrescribir la misma clave; por eso la caché del borde se purga con cualquier escritura en `/_emdash/api/media`.

Los datos operativos y los cambios hechos directamente fuera de esas rutas quedan sujetos a la frescura de la página (hasta un día) más una petición vencida. Si se modifica una integración por SQL, una importación externa o un script, hay que purgar `sably:public` mediante Workers Cache, o esperar ese intervalo. La caché no almacena claves, solicitudes ni datos de contactos.

## Ubicación del Worker

Producción corre sin `placement`. Las dos bases D1 figuran en «ENAM», pero un Worker de prueba con `SELECT 1` midió el 4 de octubre, entrando por MIA: ~10 ms sin ubicación o con `smart`, 25 ms con `gcp:us-east1` y 41 ms con `aws:us-east-1`. La base está junto a Miami, por donde entra el tráfico de Colombia, y una pista fija hacia Virginia cuadruplicaba cada consulta. Con la pista y con Smart Placement aparecieron además esperas de ~20 s en peticiones reenviadas, y cada ubicación mantenía su propia caché. Sin ubicación, el render ocurre donde entra la visita; solo las colos lejanas (SIN, FRA, GRU) pagan más por consulta, y esas páginas se sirven de la caché tras la primera visita. `validateTarget` rechaza cualquier `placement` en producción.

## Recursos

En producción, `/_astro/*` y los archivos públicos de marca y fotos (`/brand/`, `/covers/`, `/creadores/`, `/heroes/`, el certificado, favicons, iconos y el manifiesto) salen directamente de Workers Static Assets, sin ejecutar el Worker (`PRODUCTION_ASSET_BYPASS` en `scripts/environment-config.mjs`). `/_astro/*` lleva caché inmutable de un año; los demás, una semana con revalidación en segundo plano (`public/_headers`). El resto pasa por las reglas del Worker. Desarrollo conserva `run_worker_first: true`, sin Workers Cache, incluido el acceso a recursos estáticos.

Las fuentes Inter y Outfit se alojan en el mismo dominio, mantienen `font-display: swap` y los caracteres latinos y latinos extendidos. Se precargan las dos fuentes utilizadas en la primera pantalla; sus cabeceras `Link` son compatibles con Early Hints si la zona lo tiene habilitado. La carga inicial de datos de portada y de WhatsApp evita esperas secuenciales entre consultas independientes.

## Etiquetas de terceros y navegación

GTM y lo que carga (GA4 por la pasarela de Google, píxel de Meta, Clarity) suman unos 600 KB de JavaScript. Con «Cargar Tag Manager después de la página» (activado por defecto en **Sably · integraciones**) el contenedor se carga tras `load` y un momento libre del navegador, o con la primera interacción si llega antes. Los eventos empujados antes quedan en `dataLayer` y GTM los procesa al arrancar; `gclid` y `fbclid` siguen en la URL. Es el mismo criterio aplicado en Sovialis.

Speculation Rules (`eagerness: moderate`) precargan la página de un enlace interno al pasar el cursor o empezar a tocarlo, salvo `/_emdash`, `/admin`, `/api`, XML/TXT, `nofollow`, `target=_blank`, descargas y `data-no-prefetch`. La respuesta sale de la caché del borde, así que la navegación es casi instantánea. Speed Brain de Cloudflare solo precarga con el clic ya iniciado.

## Estabilidad visual

La barra y el bloque de promoción se pintan en el servidor con la misma regla que el navegador (`mejorPromocion`), así ocupan su sitio desde el primer pintado. Antes nacían ocultos y aparecían al responder `/api/v1/promo`, empujando la página (CLS 0,124 en la portada móvil). El script confirma la campaña al cargar porque el HTML puede venir de la caché: la mantiene, la cambia de tema o la retira, y si el endpoint falla conserva la del servidor. `/api/v1/promo` y `/api/v1/config` se piden una sola vez por página (`cargarPromos`, `leerConfig`), compartidas entre la barra, la ficha, WhatsApp, la prueba social y el reproductor.

## Verificación

Comprobar un GET anónimo repetido: `CF-Cache-Status: HIT` debe aparecer después del primer llenado, y `UPDATING`/`STALE` una vez vencido. Repetir con `_ga`, `?gclid=` o `Cache-Control: no-cache`: deben responder rápido con el HTML anónimo (`Cloudflare-CDN-Cache-Control` no aparece; `Cache-Control: max-age=0`). Con cookie de sesión, Authorization, `_preview` y `promo` no deben compartir el HTML. Confirmar que las páginas desconocidas mantienen 404, los recursos de desarrollo siguen protegidos, la edición conserva su barra y las publicaciones invalidan la caché. La prueba se hace sobre el dominio canónico HTTPS.

HTTP/3 y compresión se comprueban en las respuestas reales. Speed Brain, Rocket Loader, Polish y otros servicios no sustituyen la caché nativa ni se activan a ciegas: algunos no aplican a rutas Workers o pueden interferir con módulos y medición. No se contratan servicios ni se modifican reglas de acceso de rastreadores. Los tiempos HTTP de una muestra no equivalen a los Core Web Vitals de usuarios reales.

Referencias: [Workers Cache](https://developers.cloudflare.com/workers/cache/), [claves de caché](https://developers.cloudflare.com/workers/cache/cache-keys/), [configuración y variantes](https://developers.cloudflare.com/workers/cache/configuration/), [invalidación](https://developers.cloudflare.com/workers/cache/purge/), [ubicación](https://developers.cloudflare.com/workers/configuration/placement/).
