# Revisión SEO y publicación editorial en EmDash

## Evidencia de Search Console

Se consultó `sc-domain:sably.co` mediante la cuenta de servicio autorizada, con datos finales de búsqueda web y dimensiones consulta, página y país. Los resultados se conservan en `.emdash/seo-audit/`, fuera de Git. No son volúmenes de búsqueda ni estimaciones de mercado; las consultas anónimas de Google no aparecen en este desglose.

| Periodo | Filas consulta/página/país | Grupos consulta/país | Grupos con varias URLs |
| --- | ---: | ---: | ---: |
| 3 agosto–2 septiembre de 2026 | 2533 | 1956 | 407 |
| 3–30 septiembre de 2026 | 77 | 75 | 2 |

De los 407 grupos iniciales, 202 correspondían al mismo slug de curso en distintas rutas geográficas. Se mantiene la canónica de ciudad hacia país y la exclusión deliberada de los directorios de ciudad. La menor superposición reciente no demuestra una recuperación: coincide con la caída general de visibilidad y una muestra muy pequeña.

## Duplicidad consolidada

`curso-de-barista` y `curso-de-barismo-y-cafe-de-especialidad` compartían tanto el enlace comercial como el destino de checkout resuelto. Coincidían en 33 grupos consulta/país, con 196 impresiones sumadas en esos grupos. Se conserva **Barista** como ficha comercial, por su denominación directa y mayor número de impresiones de página en el desglose (229 frente a 159).

En ambos CMS se guardaron 44 redirecciones 301 nativas, desde las ocho rutas de país y las 36 de ciudad del duplicado hacia la ficha Barista de su país. La ficha duplicada y sus ocho variantes quedan como borradores recuperables; dos testimonios conservan su contenido y ahora referencian la ficha mantenida. La biblioteca de medios y los historiales operativos se conservan. El sitemap deja de enumerar las ocho URLs duplicadas.

No se fusionan productos distintos por compartir una consulta genérica. Uñas/acrílicas, masajes/descontracturante y barbería/artística tienen enfoques y destinos comerciales diferentes. En la muestra reciente no hubo un grupo consulta/país con dos cursos comprables diferentes. Esto no garantiza ausencia futura de canibalización; el seguimiento debe comparar consultas, países y páginas con un periodo suficiente tras el nuevo rastreo.

## Tres artículos publicados

La prioridad combina señales existentes y ausencia de una guía que resuelva esa duda. Las impresiones siguientes son sumas de filas del desglose, no usuarios únicos. Todos se publicaron como entradas nativas de la colección `blog`, con texto Portable Text, imagen de la biblioteca del entorno, título y descripción SEO, fecha real, autoría del equipo Sably y enlaces a cursos y categorías.

| Guía e intención informativa | Señal inicial | Señal reciente | Destino comercial |
| --- | --- | --- | --- |
| [Aprender portugués desde cero: plan de práctica](https://sably.co/blog/aprender-portugues-desde-cero-plan-de-practica/) | 297 impresiones, 0 clics | 13 impresiones | Portugués para principiantes |
| [Materiales para decorar con globos: kit inicial](https://sably.co/blog/materiales-para-decorar-con-globos/) | 112 impresiones, 0 clics | 8 impresiones | Decoración, globoflexia y bouquets |
| [Cómo empezar a coser en casa: primeras prácticas](https://sably.co/blog/empezar-a-coser-en-casa/) | 213 impresiones, 5 clics | 18 impresiones | Modistería y categoría de moda y confección |

Cada guía desarrolla una tarea práctica diferente de la intención «comprar curso», cita fuentes primarias donde corresponde y evita inventar certificaciones, salarios, demanda o resultados. Se contrastaron con los diez artículos anteriores para no repetir temas. El catálogo operativo se reconcilió con 13 artículos y 120 cursos publicados, de los cuales 103 tienen checkout activo; los comentarios y valoraciones siguen conectados a los slugs del CMS. Las guías relacionadas generan enlaces de vuelta desde sus cursos.

## Rendimiento y límites de comprobación

El rastreo HTTP inicial de EmDash comprobó las 976 URLs de sus once sitemaps: todas respondieron 200, con una canónica propia, un H1, Open Graph completo y JSON-LD parseable. No aparecieron títulos ni descripciones duplicadas, referencias a desarrollo ni páginas noindex dentro de esos sitemaps. Esta comprobación sintáctica no sustituye la elegibilidad de resultados enriquecidos de Google.

Quedaban tres títulos largos de la ficha de Uñas, 182 fichas con un único enlace entrante desde las páginas indexables y 16 perfiles de creador huérfanos. El título base se corrigió a «Curso de Manicura y Negocio de Uñas» mediante una revisión nativa en ambos CMS; se conserva la variante editorial de Colombia y el nombre de país en las demás. El catálogo añade una lista ligera de los cursos que no aparecen entre sus cuatro tarjetas iniciales por categoría, para que todos sean descubribles en HTML además de su categoría.

Los dos creadores importados no tenían cursos asociados en las relaciones nativas. Sus perfiles se conservan, muestran un enlace útil al catálogo y permanecen noindex/fuera del sitemap mientras estén vacíos. Cuando se asocien cursos desde EmDash, el catálogo y las fichas los enlazarán y volverán automáticamente al sitemap. No se atribuyen productos a creadores a partir de una política de cupones. Esto deja 960 URLs previstas en el sitemap; el rastreo posterior al despliegue debe confirmar el resultado.

Después del corte, cinco solicitudes desde la conexión de validación midieron aproximadamente 0,75–2,95 segundos hasta recibir cabeceras; no equivalen a Core Web Vitals de usuarios reales ni a la ubicación de Ahrefs. Se configura el adaptador de caché de objetos oficial de EmDash, con namespaces KV independientes, TTL de respaldo de 300 segundos, revalidación de epochs y timeout de un segundo. Se cachean lecturas a través de la API nativa, sin introducir caché compartida del HTML personalizado, promociones por URL o vistas previas. Los cambios editoriales usan la invalidación del CMS. La configuración rechaza compartir caché con sesiones o con desarrollo.

El informe detallado de Ahrefs sigue inaccesible (`Insufficient plan`). Los 28 casos 404 y las siete discrepancias de canónica del resumen histórico de Search Console necesitan sus URLs concretas para contrastarlos individualmente; las exportaciones de cobertura disponibles solo incluyen totales. Los avisos de vídeos en páginas cuyo propósito principal es vender un curso no se confunden con una prohibición de indexar esas páginas en búsqueda web. No se promete una recuperación de posiciones ni se presenta como completado un nuevo rastreo de Google o Ahrefs.
