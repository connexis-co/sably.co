# Auditoría HTTP del desarrollo

Origen: https://dev.sably.co. Versión Worker: `58ca1169-3ce1-4685-8e83-a2d7f303798b`. Inicio: 2026-10-03T03:16:55.334Z. Final: 2026-10-03T03:22:02.493Z. Concurrencia: 4.

Se consultaron 981 rutas de 11 sitemaps (981 esperadas). 981 respondieron 200; 18 presentan observaciones. Se comprobaron 244 imágenes locales únicas mediante HEAD; 0 fallaron. No se solicitaron las 3 imágenes externas únicas.

Comprobaciones: estado HTTP, protección noindex/no-store del desarrollo, una etiqueta title y una canónica absoluta, ruta canónica, JSON-LD válido, Course en fichas, ausencia de artículo en fichas y de WebSite duplicado, y fuentes de imágenes. Los cambios intencionales de canónica requieren revisión; una observación no demuestra un fallo de indexación. No se ejecutó JavaScript ni se accedió a sesiones privadas de EmDash.

## Observaciones de páginas

| Ruta | Estado | Observaciones |
| --- | --- | --- |
| /ar/ | 200 | duplicate-website-schema |
| /cl/ | 200 | duplicate-website-schema |
| /co/ | 200 | duplicate-website-schema |
| /ec/ | 200 | duplicate-website-schema |
| /es/ | 200 | duplicate-website-schema |
| /mx/ | 200 | duplicate-website-schema |
| /pe/ | 200 | duplicate-website-schema |
| /us/ | 200 | duplicate-website-schema |

## Imágenes locales

Todas las imágenes locales consultadas respondieron 200 con Content-Type de imagen.

Detalle completo en el JSON homónimo. No contiene credenciales ni cuerpos HTML.

## Revisión adicional del marcado de artículos

Los tipos JSON-LD capturados confirman Article y BlogPosting simultáneos en los diez artículos del blog. La revisión del código confirma dos emisores para el mismo documento. Se añadieron estas diez observaciones al JSON del barrido; se comprobarán después del despliegue correctivo junto con las ocho portadas. No hubo errores HTTP ni de carga de imágenes.
