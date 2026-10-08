# Recuperación técnica de Sably — 8 de octubre de 2026

Los seis archivos de Search Console se contrastaron con las URLs públicas, inspecciones de Google y el código de EmDash. Los originales no se modificaron. Este documento describe la corrección preparada y las comprobaciones necesarias para publicarla; el resultado del despliegue se conserva en los artefactos de GitHub Actions y en el informe local posterior.

## Diagnóstico comprobado

| Evidencia | Resultado | Interpretación y acción |
| --- | --- | --- |
| Cobertura, actualización 3 de octubre | 3.683 indexadas; 692 excluidas | Excluida no equivale siempre a error: Google debe elegir una URL preferida por contenido. |
| Evolución de cobertura | 4.184 indexadas el 4 de septiembre → 3.683 el 3 de octubre | Caída de 501 URLs (12%). La caída de visibilidad comenzó antes de la migración de octubre; estos datos no prueban una única causa. |
| Rendimiento GSC, datos finales | 9 septiembre–6 octubre: 14 clics, 302 impresiones, posición media 53,12. 12 agosto–8 septiembre: 240 clics, 6.820 impresiones, posición 23,33 | Caída real de visibilidad: −94,2% clics y −95,6% impresiones. La recuperación técnica no garantiza recuperar posiciones. |
| Rastreo público de 1.598 URLs distintas | Todos los destinos finales HTTP 200 | No se detectaron errores 404/5xx en esta muestra. No equivale a haber revisado las 28 URLs 404 del informe: sus detalles no venían adjuntos. |
| 975 URLs del sitemap principal antes del cambio | HTTP 200 directo, una canónica propia, ningún noindex, un H1, títulos únicos y JSON-LD parseable | El sitemap actual no está bloqueado globalmente. Se añade la biblioteca `/videos/`, resultando 976 URLs con el catálogo actual. |
| 27 URLs del drilldown noindex | Páginas de ciudad/catálogos/categorías con `googlebot: noindex` y canónica hacia el país | Retirar ese noindex específico. Mantener HTML público, enlaces locales y canónica del país; conservar rutas que pueden recibir referencias de ChatGPT. |
| 118 URLs del drilldown redirecciones | Todas terminan en HTTP 200; ninguna redirección externa ni bucle | Mantener las 301 legítimas. 30 destinos pertenecen a cursos PENDIENTE con noindex deliberado; no publicar ofertas inexistentes. HTTP puede necesitar dos saltos por la conversión HTTPS de Cloudflare. |
| 460 alternativas con canónica | Categoría general, sin drilldown adjunto | Es normal excluir alternativas si Google indexa la preferida. No quitar canónicas ni incluir miles de duplicados en el sitemap. |
| Vídeo, actualización 4 octubre | 67 no indexados, 0 indexados: «El vídeo no está en una página de visualización» | Las fichas de venta no son páginas de visualización. Mantener sus ventas y texto; enlazar las 15 páginas reales de vídeo desde una nueva biblioteca, inicio y mapa del sitio. |
| Inspección GSC de las 15 páginas reales de vídeo | 8 desconocidas, 7 descubiertas sin indexar; ninguna rastreada/indexada todavía | HTTP 200, reproductor visible, VideoObject, miniatura nativa y MP4 disponible. Mejorar descubrimiento y reenviar sitemap de vídeos. Google decide si las indexa y muestra. |
| Product snippets y Merchant listings, actualización 5 octubre | 13 válidos, 0 inválidos en cada informe | Las advertencias opcionales no invalidan las fichas. Conservar Product/Offer reales. |
| Reseñas propias elegibles | 0 en la base operativa | No inventar aggregateRating/review ni reutilizar estrellas externas como si fueran reseñas propias. Tampoco inventar GTIN, envío físico o políticas comerciales para eliminar avisos. |

La ficha de corte y confección señalada en algunas inspecciones pertenece a un curso PENDIENTE. Su noindex es intencional mientras no exista inscripción real; no debe redirigirse a un curso parecido como si fuera el mismo producto.

## Cambios de esta entrega

1. Retirar el noindex de Google en los tres tipos de páginas de ciudad, conservando HTTP 200 y sus canónicas hacia el país. Los breadcrumbs de fichas apuntan a las URLs preferidas del país.
2. Añadir `/videos/` con enlaces HTML a los 15 vídeos reales. Incluirla en sitemap de páginas, portada y mapa del sitio. La biblioteca usa ItemList; VideoObject permanece en cada página de visualización individual.
3. El sitemap temporal antiguo de ciudades deja de anunciar 504 duplicados y lista sus 112 destinos preferidos. Permanece fuera del índice principal.
4. Ampliar el margen total del trabajo de producción a 55 minutos para que el calentamiento de caché de hasta 40 minutos pueda finalizar tras instalar y compilar. El límite anterior de 30 minutos cortaba el trabajo antes de completar el calentamiento.
5. Verificar después de publicar: URLs preferidas HTTP 200, noindex ausente, canónica correcta, H1 y JSON-LD; comprobar ciudades con Googlebot, OAI-SearchBot y ChatGPT-User.
6. Proteger con una prueba los parámetros `utm_source=chatgpt.com&utm_medium=referral` durante la redirección de portada y el uso de caché anónima.

## Protección de tráfico de IA

Se conserva la política pública de robots: `search=yes`, `ai-input=yes`, `ai-train=yes`, acceso a contenido y archivos de medios. El bloqueo específico de Bytespider no se extiende a OpenAI. No se modifica la seguridad WAF ni se crea una excepción basada únicamente en User-Agent.

Las pruebas HTTP desde el equipo con OAI-SearchBot y ChatGPT-User responden 200. Esto comprueba la respuesta a esos encabezados, no el acceso desde las IP reales de OpenAI. La API de Bot Management devolvió 403 por permisos del token; no se puede certificar toda esa configuración mediante esta credencial. Los rulesets visibles corresponden a normalización, reglas administradas y DDoS. Se mantienen medición, checkout y parámetros de referencia.

El rendimiento HTTP medido en páginas ya almacenadas fue de aproximadamente 0,22 segundos hasta el primer byte. Esto no mide LCP móvil ni una primera visita a una página todavía sin caché. El calentamiento y las verificaciones de la entrega deben contrastarse con el artefacto `cache-warm.json`; no se presentan estas mediciones como una puntuación de PageSpeed.

## Acciones operativas y pendientes

- Publicar mediante CI en develop, promover a main con CI correcto para ese SHA y ejecutar el flujo de producción. Confirmar el despliegue y el resultado real del calentamiento.
- Retirar la copia antigua indexable de `sably.pages.dev` mediante redirecciones permanentes al dominio principal, conservando rutas y referencias. Guardar identificación del despliegue anterior para reversión.
- Reenviar a Search Console el índice principal y los sitemaps canónicos, especialmente blog y vídeos, después de verificar producción. El envío no solicita ni garantiza indexación inmediata.
- Para resolver los casos restantes URL por URL faltan cuatro drilldowns: **404 (28), rastreada sin indexar (30), descubierta sin indexar (22), canónica distinta elegida por Google (7)**. La API de inspección no enumera esas listas; las muestras revisadas no permiten declarar todos esos casos resueltos.
- Revisar evolución de clics, impresiones y URLs preferidas tras nuevos rastreos. Mantener separados ingresos/referencias de ChatGPT y tráfico Google; los ingresos de IA son un dato aportado por el propietario, no una métrica auditada aquí.

## Fuentes oficiales

- [Interpretar el informe de indexación](https://support.google.com/webmasters/answer/7440203?hl=es).
- [Consolidar URLs duplicadas: Google desaconseja noindex para seleccionar una canónica](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
- [Requisitos de indexación de vídeos y páginas de visualización](https://developers.google.com/search/docs/appearance/video).
- [Product snippets: propiedades requeridas y recomendadas](https://developers.google.com/search/docs/appearance/structured-data/product-snippet).
- [Merchant listings y elegibilidad comercial](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing).
- [OpenAI: OAI-SearchBot, ChatGPT-User y rangos de IP publicados](https://developers.openai.com/api/docs/bots).
