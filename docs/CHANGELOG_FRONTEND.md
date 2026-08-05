# CHANGELOG — Frontend sably.co

## 2026-08-05 — Expansión catálogo + GEO hiperlocal (fase 2 del día)

- **Catálogo real**: extracción del catálogo de MasterClasses.La vía Wayback CDX API
  (1.388 cursos, 26 categorías) + curación multi-agente → top 100 por demanda SEO/SEM
  (`docs/data/seleccion-cursos.json`).
- **Rutas hiperlocales**: `/{país}/{ciudad}/curso/{slug}/` con H1/meta/FAQ/testimonios/UTM
  dinámicos por GEO (refactor a `CourseLanding.astro`). Bucaramanga agregada (30 ciudades).
- **Fix menú mobile**: drawer fuera del header (el `backdrop-filter` del header rompía
  `position:fixed`), animación slide + hamburger↔X.
- **WhatsApp**: número real +57 311 457 4788 y botón estilo whatsbuilder (ondas expansivas,
  mensaje contextual), replicado del plugin de JP.
- **Categorías nuevas**: Idiomas y Música (justificadas por demanda del catálogo real).
- **Portadas fotorrealistas**: 12 categorías generadas con Gemini (`gemini-3.1-flash-image`),
  hero 800px + card 480px, integradas en cards, héroes, mega-menú y landing de curso.
- MCP Ubersuggest registrado a nivel usuario (pendiente OAuth de JP).

## 2026-08-05 — Fase 1: scaffold completo del hub

- Proyecto Astro 7.1.6 + React 19 + Tailwind CSS v4 (@tailwindcss/vite) + TypeScript estricto.
- Design system Sably como tokens `@theme` (paleta navy/coral, Inter + Outfit, radios, animaciones).
- Capa de datos: 7 países × 29 ciudades (moneda, tasa, WhatsApp), 10 categorías (Belleza → filial externa),
  builder de URLs Hotmart con cupón `SABLY40` + UTMs por ciudad.
- Content Collections (zod): `courses` (MDX), `testimonials` (JSON), `blog` (MDX).
- Componentes: Header con mega-menú 3 columnas + drawer mobile multi-nivel, GeoDialog país→ciudad
  (persistencia nanostores/localStorage), Footer, CourseCard, Rating, FaqAccordion, TestimonialCard,
  TrustBar, PromoBanner con countdown, LeadModal, StickyCta, ExitIntent, WhatsAppFloat.
- Páginas SSG: home país, city landing, catálogo, categoría, categoría×ciudad, curso (landing de
  conversión completa), blog, legales, 404. ~600 páginas en build.
- SEO: Schema.org (Organization, Course, FAQPage, BreadcrumbList, Article), hreflang es-* + x-default,
  sitemap-index, robots.txt, canonical, OG/Twitter.
- Medición: eventos GA4 vía dataLayer (view_course, click_cta_hotmart, submit_lead_form, click_whatsapp,
  select_country, mega_menu_interact, scroll_depth, exit_intent_*). GTM condicional a `PUBLIC_GTM_ID`.
- Interactividad en vanilla TS para respetar el performance budget (<50KB JS) — React reservado para islas futuras.
- Workflow multi-agente generó el catálogo inicial (~25 cursos), 3 posts de blog y 40 testimonios.
- Graphify instalado (AST + semántica) para contexto de agentes en sesiones futuras.
