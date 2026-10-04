# Imágenes de EmDash y Cloudflare

Las fotos conservan su archivo original y referencia en la biblioteca de EmDash/R2. `cms-image-service.ts` conecta los componentes oficiales `astro:assets` y `emdash/ui` con las transformaciones por URL de Cloudflare, ya habilitadas en la zona Sably.

En producción se sirven variantes de hasta 1600 px con calidad 80, `format=auto`, `fit=scale-down` y `onerror=redirect`. Cloudflare negocia AVIF/WebP o el formato compatible según el navegador. No se amplía ni se recorta el archivo; el encuadre visual continúa en el CSS de la plantilla. Si la transformación falla, Cloudflare puede redirigir al original del mismo dominio. Los `srcset` y `sizes` permiten elegir el ancho adecuado sin JavaScript.

Las portadas prioritarias conservan `fetchpriority=high` y carga inmediata. Las imágenes secundarias usan carga diferida. Se conservan dimensiones y textos alternativos. Los pósteres de vídeo también usan la entrega optimizada, mientras las imágenes sociales y las miniaturas del JSON-LD mantienen las URL originales estables.

Solo se transforman las rutas públicas de medios de EmDash y las imágenes estáticas conocidas de `sably.co`/`cdn.sably.co`. Se excluyen otros dominios, SVG/GIF, URL con credenciales o parámetros y rutas privadas. Los originales continúan accesibles para los rastreadores.

Desarrollo usa sus originales protegidos: el subrequest del optimizador no puede autenticar contra el acceso privado de `dev.sably.co`. Las pruebas ejercitan el generador productivo sin divulgar credenciales; la validación pública comprueba transformaciones reales y la plantilla tras desplegar.

No se cambia la suscripción ni se habilitan nuevas compras. Las variantes consumen las transformaciones del servicio existente y Cloudflare las almacena en caché según su política. No confundir este servicio con el plugin comunitario Image Optimizer del administrador, que solo informa de posibles ahorros.

Referencia: [opciones de transformación de Cloudflare](https://developers.cloudflare.com/images/optimization/features/).
