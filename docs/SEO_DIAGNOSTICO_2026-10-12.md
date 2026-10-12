# Diagnóstico de la caída de Sably en Google — 12 de octubre de 2026

Fuentes: los cuatro XLSX de Search Console exportados el 12 de octubre (cobertura general y detalles de «alternativa con canónica», «redirección» y «noindex»), el historial completo de Git, los diagnósticos anteriores de este directorio y el [Search Status Dashboard](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history) de Google. Desde este entorno no hubo acceso a la API de Search Console ni al sitio público (la red del contenedor bloquea `sably.co`), así que nada de lo que sigue procede de una consulta en vivo.

## Conclusión

1. **Google no ha desindexado el sitio.** Al 8 de octubre hay 3.639 URLs indexadas, y el propietario confirmó el 3 de octubre que no hay acciones manuales ni problemas de seguridad.
2. **Lo que se perdió fue el posicionamiento.** Las páginas siguen en el índice, pero en la posición media 52–53 en vez de 22: −96 % de impresiones y −97 % de clics.
3. **La caída tiene fecha exacta: 18 de agosto.** Ese día las impresiones pasaron de 958 a 37 mientras el número de páginas indexadas seguía en 4.172. Ese mismo día empezó la [actualización de spam de agosto de 2026](https://www.seroundtable.com/google-august-2026-spam-update-done-41906.html) (del 18 al 21 de agosto, global y en todos los idiomas). Es el perfil de una degradación algorítmica (SpamBrain), no de un fallo técnico de rastreo o indexación.
4. **El sitio encaja en dos políticas de spam de Google:** [páginas puerta (*doorway abuse*) y contenido a escala (*scaled content abuse*)](https://developers.google.com/search/docs/essentials/spam-policies). Las pruebas están en el propio repositorio (tabla más abajo).
5. **Nada de lo hecho desde agosto ataca esa causa.** Canónicas, noindex, redirecciones, vídeos, caché y el paso de Cloudflare a Hetzner eran mejoras técnicas correctas, pero no cambian lo que el clasificador detecta. Por eso no hubo recuperación, tampoco con la actualización de spam de septiembre (24 sep – 8 oct).
6. **Los «errores» de Search Console no son la causa.** De las 492 «alternativas con canónica», 484 son páginas de ciudad (98 %). De los 35 noindex, 30 son de ciudad y 5 son cursos PENDIENTE. Su «Validación: error» solo indica que Google sigue viendo el estado configurado. Validarlas fallará siempre.

## Línea de tiempo

| Fecha | Hecho | Fuente |
| --- | --- | --- |
| Antes del 3 ago | 0 impresiones: dominio sin historial en Google | Coverage, `Gráfico` |
| 5 ago | Lanzamiento: Google conoce 6.117 URLs (3.468 sin indexar + 2.649 indexadas) en un dominio nuevo, publicado en un día | Coverage; 42 commits del 5 ago |
| 6 ago | 968 variantes de país generadas con Gemini, cada una con un «ángulo» distinto para bajar la similitud al 7 % (umbral «anti-doorway» < 60 %) | `af15e5c`, `docs/COSTOS_CONTENIDO_GEMINI.md` |
| 6–17 ago | 600–1.300 impresiones/día, posición ~22. 340 de 422 clics del lanzamiento llegan a fichas ciudad+curso | `docs/GSC_AUDIT_2026-10-03.md` |
| 14 ago | Se retiran la prueba social y el instructor inventados | `f0e1f11`, `15a29d9` |
| 16 ago 12:44 | Canónica masiva ciudad → país (#104); se revierte el 17 a las 03:08 (#105) | `0a9f8b5`, `f8f68fd` |
| **18 ago** | **Empieza la actualización de spam de agosto. Impresiones 958 → 37** | Search Status Dashboard; GSC |
| 18 ago 22:15 | El propio commit #110 constata «páginas de ciudad 94–97 % idénticas a la de país» y lo deja como P1 | `8d0d74b` |
| 13 sep – 8 oct | Google reprocesa las ciudades como alternativas: 23 → 492 | Drilldown «alternativa» |
| 24 sep – 8 oct | Actualización de spam de septiembre: sin recuperación | ppc.land; Coverage |
| 10 oct | Migración a Connexis/Hetzner | `df358f0` |

La reversión de la canónica del 16–17 de agosto coincide en el tiempo, pero no explica la caída: duró unas 14 horas, una canónica tarda días en procesarse sobre miles de URLs y redistribuye el tráfico entre ciudad y país en lugar de hundir la posición media de todo el sitio de 22 a 52. Además, la caída sigue igual ocho semanas después de revertirla.

## Por qué el sitio encaja en las políticas de spam

| Señal | Evidencia | Política |
| --- | --- | --- |
| ~4.800 URLs de ciudad (36 ciudades × hub, catálogo, 12 categorías y ~120 cursos) casi idénticas a la de país | «Páginas de ciudad 94–97 % idénticas a la de país» (`8d0d74b`); «~4.834 casi-duplicados» (`0a9f8b5`) | *Doorway*: páginas dirigidas a regiones o ciudades concretas que llevan al mismo destino |
| Intención local para un producto 100 % online | Títulos «Curso de X en Houston», FAQ «¿Puedo tomar este curso desde Houston?» | *Doorway*: intermediarias menos útiles que el destino |
| 968 descripciones de país generadas por IA para que el mismo curso parezca distinto en cada país | `docs/COSTOS_CONTENIDO_GEMINI.md` §2 («similitud MX vs CO: 7 %») | *Scaled content*: generación automática de muchas páginas sin aportar valor |
| Unas 6.000 URLs en un día en un dominio sin historial | Coverage, 5 ago | Volumen típico de los patrones anteriores |
| 40 testimonios inventados, con nombre, ciudad y 5 estrellas, visibles en fichas y portada | Los generó un «workflow multiagente» (`docs/CHANGELOG_FRONTEND.md`); se retiraron el 11 ago (#67), una sobrescritura de la plantilla los devolvió el 13 ago (`dbb9931`) y la migración los llevó a EmDash (40 registros) | Engaño al usuario. El propio repositorio lo prohíbe en `COSTOS_CONTENIDO_GEMINI.md` §4. En EE. UU. (/us/) además infringe la norma de la FTC sobre reseñas falsas |

Google no publica qué detectó en cada sitio. Esta conclusión se basa en la coincidencia exacta de fechas y en el patrón; no hay una confirmación de Google para sably.co.

## Lo que no es la causa

- **Presupuesto de rastreo o límite de Cloudflare.** Google llegó a indexar 4.184 URLs y sigue rastreando: los detalles registran visitas hasta el 10 de octubre. Lo que cayó fue la posición, no el rastreo.
- **El servidor.** La caída es siete semanas anterior a la migración a Hetzner.
- **Las advertencias de Product, vídeo o «Validar corrección».** Son estados informativos, sin relación con el ranking.

## ¿Google «descargó» el sitio? Cómo comprobarlo

No. Comprobaciones en Search Console, sin herramientas externas:

1. **Seguridad y acciones manuales → Acciones manuales.** Debe seguir sin incidencias. Si apareciera una, el camino sería otro: corregir y pedir reconsideración.
2. **Rendimiento → Consulta que contiene «sably».** Si la marca sigue saliendo en la posición 1–3, el sitio no está vetado: está degradado para las búsquedas genéricas.
3. **Inspección de URLs** de `https://sably.co/co/` y de dos o tres fichas de país: «La URL está en Google».
4. **Configuración → Estadísticas de rastreo** desde el 10 de octubre: códigos de respuesta, estado del host y tiempo medio de respuesta del servidor nuevo. Un aumento de 5xx o de tiempos altos sería un problema nuevo e independiente de la caída de agosto.

## Cambiar de dominio: evaluación

| Opción | Resultado esperado |
| --- | --- |
| Dominio nuevo **con** 301 desde sably.co | Google transfiere las señales del sitio, incluida la clasificación de spam. No ayuda. |
| Dominio nuevo **sin** 301 y con el mismo modelo (país × ciudad × curso, textos de IA) | El patrón que se clasificó en 13 días se repite. Es probable que el resultado también. |
| Dominio nuevo **sin** 301 y con un modelo limpio | Puede funcionar, pero el mismo modelo limpio en sably.co también puede. Se pierden la marca indexada, el historial de Search Console, los enlaces, los acortadores de Hotmart, las redes y las menciones de ChatGPT. |

**Recomendación: no cambiar de dominio ahora.** sably.co solo acumuló 13 días de historial positivo, así que lo que tiene que cambiar es el modelo del sitio, no el dominio. Volver a evaluarlo si, **al menos 12 semanas después de desplegar la limpieza** y tras al menos una actualización de spam o core de Google, las impresiones sin marca no muestran ninguna tendencia de recuperación. En ese caso: dominio nuevo sin redirecciones, lanzado únicamente con el catálogo limpio, y sably.co retirado para no duplicar contenido.

Google indica que, después de una actualización de spam, los cambios ayudan «si nuestros sistemas automáticos aprenden durante un período de meses que el sitio cumple las políticas» ([actualizaciones de spam](https://developers.google.com/search/docs/appearance/spam-updates)). No hay solicitud de reconsideración para una degradación algorítmica ni un plazo garantizado.

## Acciones ejecutadas en la rama `claude/seo-positioning-issue-eg6c2m`

1. **Páginas de ciudad → 301 a su equivalente de país** (`src/lib/page-loaders/city-redirect.ts`):

   | Ruta de ciudad | Destino |
   | --- | --- |
   | `/{país}/{ciudad}/` | `/{país}/` |
   | `/{país}/{ciudad}/cursos/` | `/{país}/cursos/` |
   | `/{país}/{ciudad}/cursos/{categoría}/` | `/{país}/cursos/{categoría}/` |
   | `/{país}/{ciudad}/{curso}/` | `/{país}/{curso}/` |

   Se conserva la query, incluidos `utm_source=chatgpt.com` y los parámetros de campaña. Una ciudad, curso o categoría inexistente sigue respondiendo 404, sin redirigir a una página ajena. Las páginas personalizadas del CMS en esas rutas siguen teniendo prioridad.
2. **Sin enlaces internos a ciudades.** Se retiran la sección «Ciudades» de la portada de cada país y el paso de ciudad del selector geográfico, que ahora lleva a la portada del país. Se eliminan las plantillas y loaders que solo servían a las páginas de ciudad.
3. **Redirecciones heredadas en un solo salto.** `/{país}/{ciudad}/{slug-antiguo}/` va directo a `/{país}/{slug-nuevo}/`.
4. **Sin testimonios inventados.** Se dejan de mostrar los 40 testimonios editoriales en fichas y portadas. La prueba social pública queda limitada a las reseñas verificadas de compras (`VerifiedReviews`).
5. **Verificación posterior al despliegue.** `scripts/verify-production-seo.mjs` exige 301 al país para Googlebot, OAI-SearchBot y ChatGPT-User, con los parámetros de referencia de ChatGPT incluidos.

**Contrapartida.** Esto cambia la decisión anterior de mantener las ciudades con HTTP 200 para las referencias de ChatGPT. El visitante que llega desde ChatGPT sigue aterrizando en la ficha del mismo curso, y los parámetros se conservan. OAI-SearchBot actualizará sus URLs al país. Si los ingresos atribuidos a ChatGPT cayeran después del despliegue, revisarlo con datos antes de revertir.

## Pendiente

| Prioridad | Acción | Criterio |
| --- | --- | --- |
| P0 | Publicar: PR → `develop` → `main` → imagen Connexis → **Update** en Dockge | Comprobar a mano `curl -I https://sably.co/co/bogota/curso-de-unas/`: 301 a `/co/curso-de-unas/` |
| P0 | En Search Console: **no** validar «Alternativa con canónica», «Página con redirección» ni «noindex». Reenviar `sitemap-index.xml`. No pedir indexación URL por URL | Las ~4.800 ciudades pasarán a «Página con redirección». Es lo esperado y no es un error |
| P0 | Borrar en EmDash los 40 testimonios editoriales (`t-001` a `t-040`). La fuente de importación `src/content/testimonials.json` ya está vacía, así que un reimport no los devuelve. Desde un equipo con acceso: `npx emdash login --url https://sably.co` y después `for n in $(seq -w 1 40); do npx emdash content delete testimonials t-0$n --url https://sably.co; done`. También se puede hacer desde el panel, en «Testimonios editoriales» | `npx emdash content list testimonials --url https://sably.co` no devuelve nada. Delete los envía a la papelera, así que se pueden restaurar con `content restore` |
| Aplazado | **Variantes de país generadas con IA (968).** El propietario decidió mantenerlas por ahora (12 oct). Si no hay recuperación, se puede reconsiderar. Opción A: mantener los 8 mercados con hreflang, pero con descripción común real y solo datos locales verificables (precio, medios de pago, garantía). Opción B: indexar solo los mercados con demanda (CO, MX, ES…) y redirigir el resto | Eliminar el texto variado artificialmente por país |
| P1 | 17 cursos PENDIENTE × 8 países (136 fichas noindex de productos que no existen): responder 404/410 o no publicarlos hasta tener checkout | No mantener páginas «Próximamente» a escala |
| P1 | Fichas de país con información propia comprobable: temario real, creador real, vídeo de muestra, condiciones del checkout | Lo que una persona no encontraría copiado en otras 7 fichas |
| P2 | Medición semanal en Search Console: impresiones y posición **sin marca**, por tipo de página y país, anotando la fecha del despliegue | Esperar semanas sin cambios. Evaluar a las 4, 8 y 12 semanas |

No se recomienda crear más páginas geográficas, volver a abrir ciudades ni alternar canónicas y noindex: cada cambio de señales reinicia la evaluación.

## Fuentes

- [Políticas de spam de Google: *doorway abuse* y *scaled content abuse*](https://developers.google.com/search/docs/essentials/spam-policies)
- [Actualizaciones de spam: recuperación «durante un período de meses»](https://developers.google.com/search/docs/appearance/spam-updates)
- [Search Status Dashboard: historial de actualizaciones](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history)
- [Search Engine Roundtable: la actualización de spam de agosto de 2026 terminó el 21 de agosto](https://www.seroundtable.com/google-august-2026-spam-update-done-41906.html)
- [PPC Land: tercera actualización de spam de 2026, global y en todos los idiomas](https://ppc.land/googles-third-spam-update-of-2026-hits-every-language-and-region/)
- [PPC Land: la actualización de spam de septiembre de 2026 termina tras casi 14 días](https://ppc.land/googles-spam-update-ends-after-nearly-14-days-violating-sites-risk-demotion/)
- [Mover un sitio con cambios de URL](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Consolidar URLs duplicadas](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
