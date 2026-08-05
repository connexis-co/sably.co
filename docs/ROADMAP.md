# ROADMAP — Ecosistema Sably

## Fase 1 — Frontend SSG sably.co (en curso)

- [x] Design system (tokens Tailwind v4, paleta Sably, Inter + Outfit)
- [x] Arquitectura multi-país (7) / multi-ciudad (29) / rutas SEO
- [x] Mega-menú desktop + drawer mobile + selector país/ciudad
- [x] Páginas: home, city landing, catálogo, categoría, categoría×ciudad, curso, blog, legales, 404
- [x] SEO: Schema.org, hreflang, sitemap, robots, meta/OG
- [x] CRO: sticky CTA, exit-intent, countdown, lead modal, WhatsApp flotante
- [x] Eventos GA4 vía dataLayer (view_course, click_cta_hotmart, submit_lead_form, etc.)
- [ ] Catálogo completo ~25 cursos + blog + testimonios (workflow en curso)
- [ ] QA visual + Lighthouse ≥95
- [ ] Deploy Cloudflare Pages
- [ ] GSC: verificación sably.co + sitemap
- [ ] GA4: crear property sably.co (requiere OK de JP)

### Pendientes que dependen de JP
- [ ] Números de WhatsApp reales por país (`src/lib/countries.ts`)
- [ ] URLs de checkout Hotmart reales por curso (frontmatter `hotmartUrl`)
- [ ] Fuente Surgena (woff2) para el wordmark
- [ ] ID de contenedor GTM (`PUBLIC_GTM_ID` en Cloudflare Pages)
- [ ] Autorizar MCP Ubersuggest (OAuth interactivo: `/mcp`)
- [ ] Rotar tokens compartidos por chat (Gemini, Cloudflare)

## Fase 1.5 — Mejoras frontend
- [ ] Inglés (`/en/…`) + hreflang en-US
- [ ] Imágenes hiperrealistas por categoría/curso (Gemini API) + astro:assets + OG images
- [ ] Búsqueda con cmd+K (isla React + fuzzy)
- [ ] Edge Function: geo-detección por IP (`request.cf.country`) en `/`
- [ ] Quiz de orientación "¿Qué curso es para ti?"

## Fase 2 — Backend Laravel (Herd local / Docker Hetzner prod)
- [ ] Laravel 13 + Octane (FrankenPHP) + Filament v5 + PostgreSQL 17 + Redis
- [ ] Desarrollo local con **Laravel Herd** (o Sail si se necesitan contenedores)
- [ ] Modelos + Actions + RouteRegistry + i18n (patrones expotur-backend)
- [ ] API `/api/v1` (courses, leads, banners, testimonials, hotmart redirect)
- [ ] Integración Hotmart: OAuth, Products/Coupons/Sales sync, webhooks
- [ ] Dashboard ventas por país/ciudad
- [ ] Migrar Content Collections → API
- [ ] Deploy Docker + Dockge en Hetzner

## Filial — academiadebelleza.edu.co
- [ ] Reutilizar design system con tema belleza (override de tokens `--color-*`)
- [ ] Migración WordPress → Astro (0 páginas indexadas = lanzamiento limpio)
- [ ] Aplicar fix del funnel roto (ver memoria auditoría ago-2026)
