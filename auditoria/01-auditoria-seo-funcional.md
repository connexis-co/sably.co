# Auditoría SEO y funcional — academiadebelleza.edu.co

**Fecha:** 2026-08-05 · **Fuentes:** Search Console (propietario), GA4 (347571020), GTM (GTM-NVWXPBB), índice de Google, catálogo Hotmart/Seminarios Online. Cifras verificadas con doble consulta independiente a las APIs. Datos crudos en `auditoria/datos/`.

> **Limitación:** la política de red del entorno bloqueó el acceso directo al
> sitio, al wp-admin, a `*.hotmart.com` y al SSH del servidor (ver
> `00-bloqueo-de-red.md`). Todo lo reportado se reconstruyó desde Google APIs,
> el índice de Google y el catálogo público. Lo pendiente de verificación
> directa está marcado como **[pendiente acceso]**.

---

## Resumen ejecutivo

El sitio tiene **dos problemas independientes que se suman**:

1. **El embudo de compra está roto desde el 6 de diciembre de 2025.** El evento
   de conversión `envio_formulario_compra_curso` (formulario de compra, Contact
   Form 7) pasó de 12–47/mes durante todo 2025 a **cero absoluto durante 8 meses
   consecutivos** (ene–ago 2026), mientras `form_start` sigue sano (60–130/mes) y
   `lead_contacto` (formulario de contacto) sigue funcionando e incluso subió. Es
   decir: la gente sigue intentando comprar y el formulario de compra falla en el
   envío o en la redirección. `begin_checkout` colapsó de 12–36/mes a 0–6 (último:
   2026-03-24). Aquí es donde se pierden las ventas.

2. **Pérdida real de SEO por devaluación algorítmica, iniciada la semana del
   23–27 de febrero de 2026** (segundo escalón el 6–8 de marzo). De 4.902 clics
   orgánicos en enero 2026 a 1.906 en junio (**−61%**); posición media de 6,7 →
   11,8. **No es un problema técnico**: las páginas siguen indexadas (11/11
   inspecciones PASS), no hay hackeo ni spam. El patrón golpeado es la matriz
   doorway: 5 ciudades × 13 páginas de curso clonadas con contenido casi
   idéntico — exactamente lo que los core updates de Google devalúan.

Los enlaces a Hotmart **no están rotos**: en agosto 2026 se siguen registrando
clics en 21 acortadores distintos. Los clics salientes cayeron −55% (528 →
238/mes entre enero y julio 2026) **en proporción a la caída de tráfico**, con
CTR estable. La monetización real del sitio es mucho mayor de lo inventariado:
**~60 acortadores `hotm.art/*-curso-venta-SO` activos en 63 páginas**, más 7
checkouts directos `pay.hotmart.com` **sin referencia de afiliado visible**
(riesgo de comisión, ver §6).

---

## 1. La caída de ventas: embudo de compra roto (CRÍTICO)

Serie mensual de eventos de conversión (GA4, propiedad 347571020, verificado):

| Evento | 2025 (rango mensual) | dic-25 | ene–ago 2026 | Último disparo |
|---|---|---|---|---|
| `envio_formulario_compra_curso` | 12–47 | 5 | **0,0,0,0,0,0,0,0** | **2025-12-06** |
| `begin_checkout` | 12–36 | 12 | 2,4,3,5,6,0,1,0 | 2026-03-24 |
| `purchase` | 0–3 | 1 | 1 y luego 0 | 2026-01-08 |
| `lead_contacto` (contacto) | 19–66 | 54 | 92,68,57,50,75,47,65,… | **sigue vivo** |
| `form_start` | 71–141 | 83 | 131,84,82,62,73,61,90,… | **sigue vivo** |

**Interpretación.** El tag de GA4 funciona (lead_contacto vivo), GTM no cambió
en esa ventana (ninguna publicación entre ene-2025 y jun-2026). La conversión
depende de que WordPress empuje el evento `wpcf7_course_purchase` al dataLayer
cuando Contact Form 7 dispara `wpcf7mailsent`. Por tanto la ruptura está **en el
sitio**: alrededor del 6-dic-2025 el formulario de compra de curso (o el código
que empuja su evento, o su redirección post-envío) se rompió o fue reemplazado.
Coincide con lo que reportas: los formularios no están llevando al usuario a la
página de Hotmart.

**Reparación [pendiente acceso]:** entrar al WP, localizar los formularios CF7
de compra, verificar (a) que envían sin error, (b) que el hook que hace
`dataLayer.push({event:'wpcf7_course_purchase'})` sigue presente (functions.php
del tema o plugin de snippets), y (c) que la redirección post-envío apunta al
enlace Hotmart correcto guardado en el custom field de cada página.
`scripts/wordpress/wp_audit.py custom-fields` extrae exactamente eso.

## 2. La caída SEO: fechas, magnitud y causa

**Tendencia mensual de clics orgánicos (GSC, dominio, verificado):**

2025: abr 4.014 · may 4.433 · jun 4.130 · jul 4.616 · ago 4.016 · sep 4.041 ·
oct 3.954 · nov 3.404 · dic 2.833 (valle estacional) —
2026: **ene 4.902 (pico)** · feb 3.459 · mar 3.099 · abr 2.618 · may 2.435 ·
**jun 1.906 (valle, −61%)** · jul 2.143.

- Inicio exacto: semana del **23–27 feb 2026** (impresiones 7d: 42.276 → 32.233);
  segundo escalón **6–8 mar 2026** (37.636 → 29.676). Interanual julio: −53,6%.
- **Es pérdida de posición, no de indexación**: posición media 6,73 (ene) →
  11,83 (jul); las 11 URLs clave inspeccionadas están indexadas (PASS), con
  canonicals correctos y rastreo reciente (home: 2026-08-03).
- **No hay hackeo**: 0 URLs spam en 606 URLs de 16 meses; queries 100% temáticas.
- Las páginas top son las que más caen (3m vs 3m previos): `las-10-mejores-academias-de-belleza-en-bogota/`
  −255 clics (pos 7,7→9,7) · `/bogota/cursos-cosmetologia-y-estetica/facial-y-corporal/`
  −164 (12,3→20,9) · `/bogota/` −163 (9,7→15,2) · home −106 (9,3→16,8) · `/cali/` −112.

**Causa más probable: core update de Google de feb/mar 2026** golpeando el
patrón del sitio:

- **Matriz doorway confirmada y cuantificada**: bogotá, medellín, cali,
  barranquilla y bucaramanga replican **exactamente** las mismas 13 páginas de
  curso y 7 categorías (27 sub-rutas idénticas por ciudad, 26 con equivalente
  genérico sin ciudad); villavicencio solo tiene portada. Titles idénticos
  cambiando solo la ciudad. Sitio afiliado sin sede física bajo dominio
  `.edu.co`: perfil de riesgo alto ante core updates y site reputation.
- Marca débil: la query top es genérica ("mejores academias de belleza en
  bogotá", 71 clics). Sin búsqueda de marca que amortigüe.
- 92,7% del tráfico es Colombia; 80,6% móvil (posición móvil 7,8 vs desktop 20,9).

## 3. Problemas técnicos SEO (secundarios pero reparables ya)

| Problema | Evidencia | Acción |
|---|---|---|
| **197 URLs duplicadas `?PageSpeed=noscript` indexadas** | 197/606 URLs del inventario; p. ej. `/la-anatomia-de-las-unas…/?PageSpeed=noscript` con 29 clics/15.046 impresiones | mod_pagespeed en el servidor Hetzner genera variantes indexables. Añadir `ModPagespeedModifyCachingHeaders`/noindex de variantes o apagar el módulo; canonical ya existe pero Google las indexa igual. **[pendiente acceso servidor]** |
| **56 URLs `http://` indexadas** | ~4.500 impresiones | Verificar redirección 301 http→https global (parece incompleta) |
| **Sitemap sin re-enviar desde 2025-05-05, 6 warnings** | 209 URLs web + 2.036 imágenes; inventario real ~350 páginas únicas | Regenerar, corregir warnings, re-enviar |
| **Dominio hermano `academiadebelleza.co` vivo e indexado** | Contenido solapado, mismo email/WhatsApp; GA4 propio (G-JFZ0VBBENC) y GTM propio (GTM-WNL62K7J); orgánico residual 29 ses/mes | Decidir canónico y **redirigir 301 todo el `.co` al `.edu.co`** (o al dominio sably futuro): hoy divide autoridad y canibaliza marca |
| **Titles mal formados en páginas de dinero** | `【CERTIFICATE】` en inglés; mezcla arbitraria `▷ ➤ ⇨ 👉 【】`; "…para hombre en 2023" vigente en 2026; "▷Academia" sin espacio | Normalizar plantilla de titles en español, sin emoji-stuffing, refrescar años |
| **Restos de WooCommerce** | `/product/`, `/product-category/`, `/tienda` en el índice | Eliminar/redirigir si la tienda no se usa |

## 4. Auditoría GTM / medición (contenedor GTM-NVWXPBB, live v16 del 2026-06-24)

Configuración base **correcta**: GA4 `G-G7HV230BFJ` en All Pages (estable desde
2023), conversiones GA4 vía triggers `wpcf7_course_purchase` / `wpcf7_generate_lead`,
Microsoft Clarity (`jrj49926l0`), Hotmart Analytics launcher. Custom HTML **sin
código malicioso** (sin redirects, sin scripts ofuscados).

Problemas:

1. **Tag "Meta Pixel - Evento Purchase" huérfano**: sin ningún trigger; nunca se
   ha disparado. Añadido y publicado el 2026-06-24. Además la compra ocurre en el
   checkout de Hotmart donde este GTM no carga: medir Purchase requiere la
   integración Hotmart↔Meta o webhook, no un tag en el sitio.
2. **Dos píxeles base de Meta disparando a la vez en todas las páginas** desde la
   v16: `1711030209407213` (desde dic-2023) y `1414716853721578` (añadido
   jun-2026). Todo `fbq('track')` se duplica en dos cuentas de píxel. Decidir el
   vigente y eliminar el otro.
3. **Fragilidad estructural**: las conversiones GA4 dependen de eventos dataLayer
   que empuja código del WP — si ese código cambia, la medición muere en
   silencio (exactamente lo que pasó el 6-dic-2025).
4. **Seguridad — permisos excesivos**: la service account
   `agents-analytics-reader@connexis-co.iam.gserviceaccount.com` tiene **admin de
   cuenta y publish en los 8 contenedores** (debería ser solo lectura acorde a su
   nombre). También tienen publish: rodrigomisat@, contacto@academiadeconduccion.academy,
   sergiofernandezn2001@, connexis.co@, juanpablo@innovamos.co. Revisar y rebajar.
   (No se modificó nada durante la auditoría.)
5. No existe ningún contenedor "sably" aún (27 contenedores revisados).

## 5. Enlaces Hotmart: estado real

- **Los CTAs funcionan.** En agosto 2026 hay clics en 21 acortadores distintos.
  La caída de clics salientes (−55% ene→jul 2026) es proporcional a la caída de
  sesiones (−59%); el **CTR a Hotmart se mantuvo estable o subió**.
- Inventario real (GA4, 20 meses): **111 URLs Hotmart únicas** → ~60 acortadores
  `hotm.art/*-curso-venta-SO` + variantes `-curso-crashing` + 7 checkouts
  `pay.hotmart.com` directos. Mapa completo página→enlaces en
  `datos/page_to_hotmart_map_compact.json` y `datos/hotmart_links_unique_ga4.json`.
- Top enlaces por clics históricos: `masajista-experto-curso-venta-SO` (721),
  `cuidado-facial-con-dermapen-curso-venta-SO` (626),
  `masaje-descontracturante-curso-venta-SO` (558), `reduccion-corporal-curso-venta-SO`
  (460), `limpieza-facial-con-aparatologia-curso-venta-SO` (408).
- **15 páginas que tenían clics Hotmart en 2025 ya no los tienen en 2026**
  (p. ej. `/bogota/…/curso-de-masajes/`, `/cursos-belleza/peluqueria/curso-de-peluqueria/`,
  `/programa-cejas-y-pestanas/`): confirmar si perdieron el CTA o solo el tráfico.
  Las campañas `*-curso-crashing?offDiscount=031016` desaparecieron en 2026.

### Riesgo de comisión (verificar con prioridad) **[pendiente acceso]**

1. **7 checkouts directos `pay.hotmart.com/…?checkoutMode=10` sin parámetro de
   afiliado visible**: `H43635981L`, `D60401162V`, `J41994495N`, `S63192888Y`,
   `C63857704B`, `W69842801W`, `O42828007I` — usados sobre todo en las páginas de
   **barbería** (p. ej. `/bucaramanga/cursos-belleza/barberia/`). Un checkout sin
   token de afiliado = **venta sin comisión**. Solo un enlace del inventario
   lleva `?ref=` explícito (`manicure-y-pedicure-a-domicilio-curso-crashing?ref=E77558301G`).
2. Los `hotm.art` embeben el afiliado server-side (no verificable desde fuera):
   validar por muestreo que resuelven a `go.hotmart.com/<hotlink-tuyo>` y que el
   checkout muestra tus siglas **REF** (pie de página, abajo a la derecha).
   `scripts/hotmart/validar_enlaces.py` automatiza ambas cosas.

### Cómo viaja la comisión (documentado)

La comisión va en el **código del path del hotlink** (`go.hotmart.com/{CODIGO}`,
único por afiliado×producto). `?ap=` selecciona la página/oferta alternativa
(checkout limpio, checkout SO). Cookie de atribución en el redirect: 60 días por
defecto (configurable por el productor), last-click salvo configuración
contraria. La API pública de Hotmart **no tiene endpoint para crear acortadores
hotm.art ni para gestionar hotlinks** (verificado contra el OpenAPI oficial):
se crean solo desde la UI (Herramientas → Administrador de links). Alternativa
recomendada: redirector propio `/go/{slug}` (ver `03-plan-reconstruccion…`).

## 6. Cursos de belleza de Seminarios Online: cobertura y faltantes

Productor: **MasterClasses.La®** (Master Classes Latinoamérica, Mauricio Duque
Zuluaga), +100 productos, comisiones hasta 80%. Catálogo de belleza activo 2026:
**37 cursos** (detalle completo con URLs en `datos/seminarios_online_catalogo_belleza.json`).

Los 4 que priorizas, con su ID de producto:

| Curso | Producto Hotmart |
|---|---|
| Maquillaje Social | `N41531652U` |
| Aprende Barbería y Monta tu Negocio | `P63130893D` |
| Especialista en Uñas | `J43302170O` |
| Masajista Master desde Cero | `K63104274A` |

**Nota**: por clics de GA4, el sitio ya monetiza bastantes más (masajista
experto, dermapen, reducción corporal, colorimetría, microblading, etc.). Los
huecos reales de cobertura — cursos activos sin página dedicada ni clics:

- **Cejas y pestañas** (mayor hueco): Maquillaje Permanente `J44578783I`, Master
  en Extensiones de Pestañas `L79896912J`, Experta en Extensiones de Pestañas `G75458369D`
- **Uñas**: Master en Uñas Acrílicas `C55918118T`, Uñas Acrílicas/Semi/Tech Gel `V45366158M`
- **Peluquería**: Tintes Master `L50322226B`, Estilista Premium `O63751953D`,
  Experta en Extensiones de Cabello `G60509134A`, Trenzas y Peinados `D41737748T` / `V48797673L`
- **Maquillaje**: Maquillaje Pro para Redes `T61997327V`, Maquillaje Artístico `Q42346472T`,
  Automaquillaje Master `U59401097I`
- **Masajes**: Masajista Expert `I46337891M`, Emprende como Masajista Terapéutico `T61450956V`

Al expandirlos a ciudades, **no clonar**: crear la página canónica del curso y
solo variantes de ciudad con contenido local real (ver §7).

## 7. Estructura, UX/UI — recomendaciones

**Estructura actual**: home → hubs ciudad (6) → hubs categoría (7) → curso (13
clonados por ciudad) + blog en raíz + restos WooCommerce. Dos árboles paralelos
(`/cursos-belleza/` y `/cursos-cosmetologia-y-estetica/`) que fragmentan la
navegación.

1. **Aplanar la duplicación ciudad×curso**: página de curso única y fuerte
   (`/cursos/{curso}/`) con schema `Course`+`FAQPage`; ciudades solo como
   páginas locales diferenciadas donde haya demanda real (GSC la muestra:
   Bogotá, Medellín, Cali concentran los clics) — testimonios locales, precios
   COP, WhatsApp, no plantilla clonada. Canonical/301 del resto.
2. **Un solo árbol de categorías** (fusionar cosmetología dentro de un catálogo
   único con filtros).
3. **CTA consistente**: hoy conviven `hotm.art` (con y sin sufijo estándar),
   `pay.hotmart.com` con `checkoutMode=10`, y campañas `offDiscount` muertas.
   Un único componente de CTA servido desde datos (redirector `/go/`),
   con evento `click_checkout` medido de forma nativa, elimina la clase entera
   de errores "enlace pegado a mano".
4. **Formulario de compra**: si el formulario existe para capturar el lead antes
   del checkout, hacerlo en un paso, con validación en línea, y redirección
   server-side al checkout (no dependiente de JS del tema). Medir
   `lead_form_submit` y `click_checkout` como key events.
5. **Móvil primero**: 80% del tráfico y mejor posición móvil; revisar CWV tras
   quitar mod_pagespeed **[pendiente acceso]**.
6. **Blog**: los posts de listas (cortes de cabello) traen tráfico no cualificado
   (engagement 0,30, 33–44 s) — reorientar a contenido que alimente los cursos
   (guías "cómo empezar", salidas laborales, precios) con CTA contextual.
7. **Confianza**: unificar identidad (hoy "Beauty Luxe" solo aparece en
   `/nosotros/`), página de garantía Hotmart, reseñas reales; el dominio
   `.edu.co` sin institución real es un riesgo reputacional — la marca sably
   resuelve esto a futuro.

## 8. Plan de acción priorizado

| # | Acción | Impacto | Depende de |
|---|---|---|---|
| **P0** | Reparar formulario de compra + su `dataLayer.push` + redirección a Hotmart (roto desde 2025-12-06) | Ventas | Acceso WP (red o manual) |
| **P0** | Verificar comisión en los 7 checkouts `pay.hotmart.com` y en muestreo de `hotm.art` (REF en checkout) | Ventas | Red a hotmart.com |
| **P1** | GTM: eliminar píxel Meta duplicado + resolver tag Purchase huérfano; crear key event sobre `click` outbound a hotm.art/pay.hotmart.com como proxy de conversión | Medición | Permisos ya disponibles |
| **P1** | 301 `academiadebelleza.co` → `.edu.co`; re-enviar sitemap; corregir http→https | SEO | Acceso WP/servidor |
| **P2** | Apagar variantes `?PageSpeed=noscript` (mod_pagespeed) | SEO | Acceso servidor Hetzner |
| **P2** | Normalizar titles; refrescar contenidos con año viejo | SEO | Acceso WP |
| **P2** | Consolidar matriz ciudad×curso (canonicals/301 + diferenciación real en 3 ciudades top) | SEO (recuperación core update) | Decisión + acceso WP |
| **P3** | Añadir cursos faltantes (§6) con páginas canónicas + mapa de acortadores completo | Ingresos | Panel Hotmart |
| **P4** | Reconstrucción Astro 7 + Laravel 13/Octane con redirector `/go/` (ver doc 03) | Todo | Fases anteriores |

## 9. Verificación de hallazgos

Los 12 hallazgos críticos/altos pasaron por una segunda ronda de verificación
independiente contra las APIs: 7 confirmados exactos, 4 confirmados con
correcciones menores de cifras (incorporadas en este documento), 1 corregido
(la serie de clics Hotmart del primer análisis mezclaba subconjuntos; la cifra
correcta es −55% con CTR estable, como figura arriba).
