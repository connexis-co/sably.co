# Entrega de Sably en Cloudflare

La plantilla utiliza el proveedor oficial `cacheCloudflare()` de Astro y Workers Cache. EmDash conserva su caché de objetos KV independiente por entorno. La biblioteca y entrega adaptativa de imágenes se describen en [IMAGES.md](IMAGES.md).

## Medición de partida (4 de octubre de 2026)

Antes de este ajuste, una página sin caché hacía entre 43 y 92 consultas D1 y tardaba de 2,7 a 5,2 s desde Colombia. En Workers Analytics, la mediana de las ejecuciones desde SIN, FRA, GRU o CDG estaba entre 7 y 15 s: cada consulta cruzaba hasta ENAM, donde viven las dos bases. La caché del borde apenas ayudaba: el HTML duraba 60 s sin servirse vencido, y cualquier cookie de GA/Clarity o un `?gclid`/`?utm_*` hacía `BYPASS`, de modo que casi todas las visitas reales y todo el tráfico de anuncios renderizaban la página entera. Con la caché llena, la página carga en unos 375 ms (Lighthouse escritorio, red real).

## Páginas públicas

El HTML es fresco hasta un día en el borde y después se sirve vencido hasta una semana mientras una sola petición lo regenera en segundo plano (`stale-while-revalidate`). El día se acorta hasta el próximo inicio o fin de una promoción activa (`pageMaxAge` y `readNextPromoBoundary`), porque la barra de promoción se pinta en el servidor. Con poco tráfico por centro de datos, un TTL de 5 minutos dejaba casi todas las visitas en un render completo (comprobado el 4 de octubre: páginas calentadas volvían a `MISS`/`EXPIRED`). El navegador revalida en cada navegación (`max-age=0`, sin `must-revalidate`, que también impediría al borde servir la copia vencida). Las publicaciones, despublicaciones y cambios de contenido invalidan las etiquetas editoriales nativas de EmDash; las páginas incluyen las colecciones utilizadas por el catálogo y la etiqueta de ajustes del sitio. Las modificaciones correctas de los plugins Sably, las subidas, reemplazos o borrados de medios y los refrescos autenticados de precios (`POST /api/v1/precios`, `/api/v1/subjects`) invalidan además `sably:public`. Los envíos de visitantes (leads, votos, comentarios, el refresco de precio limitado por curso) nunca purgan.

Cada despliegue tiene una caché independiente y la etiqueta de versión de Cloudflare. No se comparte entre versiones porque el HTML anterior apunta a recursos `/_astro/` con hash que la nueva versión ya no publica. Tras promover, el workflow ejecuta `scripts/warm-public-cache.mjs`: pide de forma anónima cada página de los sitemaps y las dos API compartidas (3 en paralelo; D1 atiende una consulta a la vez por base y más paralelismo solo las encola) y deja el resumen en `dist/cache-warm.json`. Empieza por las portadas de país, los catálogos y Colombia, y el paso tiene 40 minutos (con 15 se cortaba hacia las 550 páginas). Como el almacén de páginas es global, lo que calienta el runner sirve a todas las colos. Llena los niveles de caché de la región del runner y la caché de objetos de EmDash; los centros de datos lejanos se llenan con su primera visita. No bloquea el despliegue.

### Variantes que no deben partir la caché

Workers Cache usa la ruta y la query como clave. Solo se guardan renders anónimos (cualquier cookie impide guardar), así que la entrada no varía por cookie: el visitante que ya trae las cookies de GA o Clarity recibe el mismo `HIT` que uno nuevo, sin ejecutar el Worker. `Vary` separa solo credenciales, previews y rangos. Consecuencia para el equipo: con sesión iniciada, una página ya cacheada se ve como la ve el público (sin la barra de edición de EmDash); para editar en el sitio, abre la página desde el panel o añade cualquier parámetro, por ejemplo `?editar=1`, que siempre renderiza en privado. Si la petición llega al Worker, `sharedPublicRequest()` reconoce su forma anónima: quita las cookies, `Cache-Control`/`Pragma` y los parámetros de seguimiento (`utm_*`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, `ttclid`, `_gl`, `srsltid`…). Sin parámetros (solo cookies o una recarga), renderiza esa petición anónima y Workers Cache la guarda con la URL para todos. Con parámetros de anuncio cada clic tiene su propia clave, así que la copia se entrega sin guardarse con ella en Workers Cache. El servidor no lee esos parámetros; el navegador conserva la URL original, así que el reparto de UTM y el cupón de `?promo=` siguen funcionando en cliente.

No se comparte nada cuando hay sesión o modo edición de EmDash (`astro-session`, `emdash-*`), Cloudflare Access, `Authorization`, cabeceras de preview o rangos, `?_preview`, `?promo=` o cualquier otro parámetro. Esas peticiones renderizan como antes, privadas. Las API, los formularios, los errores y el administrador quedan fuera.

#### Almacén global de páginas (KV)

Comprobación del 8 de octubre: la portada canónica respondió con HTML antiguo mientras una URL con UTM ya entregaba el bloque de vídeos nuevo. Además, la primera referencia con UTM tardó 2,2 s y devolvió `x-sably-store: MISS`, aunque la portada simple ya era `HIT` en el borde. Se fija explícitamente `cache.cross_version_cache: false` y el validador rechaza su ausencia o activación. El calentamiento pide primero la variante de seguimiento (normalizada a la misma clave global) y luego la URL canónica: así un HIT del borde no basta para declarar preparada la primera visita con referencia. El control de publicación también exige el nuevo enlace `/videos/` en la portada.

Workers Cache vive por centro de datos: con ~1.000 páginas y poco tráfico, la primera visita en cada colo no encontraba nada, y al vencer una entrada la primera visita esperaba el render completo (`EXPIRED`, 3–8 s el 5 de octubre: 23 de 30 páginas al azar). Cuando Workers Cache falla, el Worker lee la página del almacén global en KV (`src/lib/page-store.ts`, prefijo `sably:page:` en el namespace `CACHE`), que comparten todas las colos. Si la copia sigue fresca se entrega con la frescura que le queda; si venció, se entrega al instante (`x-sably-store: STALE`, 60 s en el borde) y un solo render la reemplaza en segundo plano. Solo se guardan renders anónimos que la política del borde compartiría.

Las claves llevan la versión del Worker y una generación (`sably:page-generation`). Cada `cache.invalidate` de EmDash (publicar, editar, menús, ajustes) pasa por `src/lib/sably-cache-provider.ts`, que además de purgar Workers Cache estrena generación; lo mismo hacen las escrituras de plugins Sably, medios y precios. Así ninguna invalidación necesita listar ni borrar claves; las copias viejas expiran solas. Los colos ven la generación nueva en ≤30 s.

La caché de objetos de EmDash (`kvCache`) pasó de 300 s a 1 día: EmDash la retira por época en cada escritura editorial, y con 300 s la mayoría de los renders no encontraba nada (48–79 mil lecturas fallidas al día) y volvía a D1.

## Lo que se cachea además del HTML

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

### Primer render móvil, 8 de octubre

[PageSpeed móvil de partida](https://pagespeed.web.dev/analysis/https-sably-co-co/1buctadr16?form_factor=mobile), sobre la versión `a03c17d`: rendimiento 63, FCP 1,7 s, LCP 7,4 s, bloqueo total 400 ms y CLS 0 (laboratorio, Moto G Power/4G lenta; sin datos de campo suficientes). En esa ejecución el LCP fue el texto de valoraciones/disponibilidad, con demora de renderizado; el HTML transfirió 30,4 KiB y el CSS 14,7 KiB. El informe identifica 336,3 KiB de JavaScript de Google servidos por `/jsrs/`, además de Meta y Clarity.

La portada entrega ahora el título, introducción, botones e imagen sin animaciones que empiezan con `opacity: 0`. Se elimina la animación continua de `box-shadow` del botón (el informe detectó pintura no compuesta) y los filtros de desenfoque grandes se sustituyen por gradientes. El menú cerrado y sus paneles inactivos llevan `inert` y quedan invisibles; los enlaces siguen en HTML y al abrir el menú se activan los controles del panel actual. Se ajusta el contraste de texto/CTA y se describe el enlace de afiliación. No se retiran páginas locales, robots, seguimiento ni parámetros de referencia. El efecto en LCP se debe medir de nuevo después de publicar; quitar una animación no garantiza por sí solo un tiempo concreto.

## Etiquetas de terceros y navegación

GTM y lo que carga (GA4 por la pasarela de Google, píxel de Meta, Clarity) suman unos 600 KB de JavaScript. Con «Cargar Tag Manager después de la página» (activado por defecto en **Sably · integraciones**) el contenedor se carga tras `load` y un momento libre del navegador, o con la primera interacción si llega antes. Los eventos empujados antes quedan en `dataLayer` y GTM los procesa al arrancar; `gclid` y `fbclid` siguen en la URL. Es el mismo criterio aplicado en Sovialis.

**Google tag gateway de Cloudflare.** La zona tiene activa la inyección automática de la pasarela de Google: Cloudflare añade al principio del `<head>` un cargador de GTM que pide `/jsrs/` de inmediato (≈340 KB de JS antes de que la página termine), así que el retraso de Sably no aplica mientras esa inyección siga activa. El cargador diferido de Sably detecta ese contenedor (`google_tags_first_party`) y no lo vuelve a cargar. Para que el diferido funcione hay que desactivar la inyección automática en Cloudflare (la pasarela puede seguir sirviendo `/jsrs/`).

Speculation Rules (`eagerness: moderate`) precargan la página de un enlace interno al pasar el cursor o empezar a tocarlo, salvo `/_emdash`, `/admin`, `/api`, XML/TXT, `nofollow`, `target=_blank`, descargas y `data-no-prefetch`. La respuesta sale de la caché del borde, así que la navegación es casi instantánea. Speed Brain de Cloudflare solo precarga con el clic ya iniciado.

## Estabilidad visual

La barra y el bloque de promoción se pintan en el servidor con la misma regla que el navegador (`mejorPromocion`), así ocupan su sitio desde el primer pintado. Antes nacían ocultos y aparecían al responder `/api/v1/promo`, empujando la página (CLS 0,124 en la portada móvil). El script confirma la campaña al cargar porque el HTML puede venir de la caché: la mantiene, la cambia de tema o la retira, y si el endpoint falla conserva la del servidor. `/api/v1/promo` y `/api/v1/config` se piden una sola vez por página (`cargarPromos`, `leerConfig`), compartidas entre la barra, la ficha, WhatsApp, la prueba social y el reproductor.

## Verificación

Comprobar un GET anónimo repetido: `CF-Cache-Status: HIT` debe aparecer después del primer llenado, y `UPDATING`/`STALE` una vez vencido. Repetir con `_ga`, `?gclid=` o `Cache-Control: no-cache`: deben responder rápido con el HTML anónimo (`Cloudflare-CDN-Cache-Control` no aparece; `Cache-Control: max-age=0`). Con cookie de sesión, Authorization, `_preview` y `promo` no deben compartir el HTML. Confirmar que las páginas desconocidas mantienen 404, los recursos de desarrollo siguen protegidos, la edición conserva su barra y las publicaciones invalidan la caché. La prueba se hace sobre el dominio canónico HTTPS.

HTTP/3 y compresión se comprueban en las respuestas reales. Speed Brain, Rocket Loader, Polish y otros servicios no sustituyen la caché nativa ni se activan a ciegas: algunos no aplican a rutas Workers o pueden interferir con módulos y medición. No se contratan servicios ni se modifican reglas de acceso de rastreadores. Los tiempos HTTP de una muestra no equivalen a los Core Web Vitals de usuarios reales.

Referencias: [Workers Cache](https://developers.cloudflare.com/workers/cache/), [claves de caché](https://developers.cloudflare.com/workers/cache/cache-keys/), [configuración y variantes](https://developers.cloudflare.com/workers/cache/configuration/), [invalidación](https://developers.cloudflare.com/workers/cache/purge/), [ubicación](https://developers.cloudflare.com/workers/configuration/placement/).
