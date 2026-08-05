# Plan — Fase 1: Frontend SSG sably.co

**Fecha:** 2026-08-05
**Estado:** En ejecución

## Objetivo

Lanzar el hub sably.co como sitio Astro 7 100% estático (SSG) con SEO impecable desde el día 1,
multi-país (7 países), multi-ciudad (29 ciudades), catálogo de ~25 cursos como Content Collections,
y CTAs de afiliación a Hotmart con cupón `SABLY40` inyectado.

## Decisiones de arquitectura

| Decisión | Razonamiento |
|---|---|
| **Astro 7.1 + Tailwind v4 + TS estricto** | Stack canónico Connexis. SSG puro → Lighthouse ≥95. |
| **Interactividad en vanilla TS (scripts Astro), no React islands** | react-dom (~42KB gz) rompería solo el performance budget de JS (<50KB). Mega-menú, drawer, geo-selector, countdown, exit-intent y lead form suman <15KB en vanilla. React queda instalado para islas futuras que sí lo ameriten (búsqueda cmd+K, quiz). Documentado bajo la directiva de autonomía técnica del brief. |
| **Covers como gradientes CSS por categoría** | Cero peso de imágenes en v1; pendiente generar fotografía hiperrealista con Gemini API y migrar a `astro:assets`. |
| **Rutas país estáticas (`/co/`, `/mx/…`)** | Cada página se pre-renderiza por país con moneda/WhatsApp/precios locales. Preferencia del usuario en localStorage (nanostores persistent) solo guía navegación. |
| **Hreflang solo en páginas equivalentes entre países** (home, categoría, curso) | Las city landings no mapean 1:1 entre países → canonical a sí mismas, sin hreflang. Evita señales incoherentes. |
| **Precios: base USD × tasa estática por país** | Redondeo comercial por moneda. Fase 2: tasas dinámicas desde el backend. |
| **Content Collections (MDX + zod)** | El schema zod es el contrato para los agentes de contenido; el build valida todo. Fase 2 migra a API Laravel. |
| **Testimonios ficticios de lanzamiento** | Marcados para reemplazo por reseñas reales vía webhook Hotmart (UC-14) en Fase 2. |

## Pasos

1. ✅ Scaffold Astro 7 + Tailwind v4 + tokens design system Sably
2. ✅ Capa de datos: países/ciudades, categorías, Hotmart URL builder, SEO/schema helpers
3. ✅ Header (mega-menú 3 columnas + drawer mobile), Footer, GeoDialog, WhatsApp float
4. ✅ CRO: PromoBanner + countdown, LeadModal, StickyCta, ExitIntent
5. ✅ Páginas: home país, city landing, catálogo, categoría, categoría-ciudad, curso, blog, legales, 404
6. ✅ SEO técnico: Schema.org (Course, FAQPage, BreadcrumbList, Organization, Article), sitemap, robots, canonical, hreflang
7. 🔄 Workflow multi-agente: 24 cursos + 3 posts blog + 40 testimonios + QA editorial
8. ⏳ Build final + QA visual + Lighthouse
9. ⏳ Deploy Cloudflare Pages + GSC (add_site + sitemap)
10. ⏳ Graphify + AgentMemory sync

## Riesgos

- **Números de WhatsApp y URLs Hotmart son placeholders** — bloquean conversión real hasta que JP los provea.
- **Fuente Surgena del logo pendiente** — wordmark temporal con Outfit.
- **GTM container sin ID** — medición inactiva hasta configurar `PUBLIC_GTM_ID`.
- Testimonios/stats de lanzamiento son ficticios → reemplazar con datos Hotmart reales (Fase 2) antes de escalar Ads.

## Resultado esperado

Sitio estático ~600 páginas, Lighthouse ≥95, listo para indexación (GSC) y campañas.
