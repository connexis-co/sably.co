# sably.co — Frontend

Hub del ecosistema **Sably**: marketplace de cursos online de oficios prácticos y habilidades
anti-IA para Latinoamérica. Modelo de afiliación Hotmart con cupones inyectados.

## Stack

- **Astro 7** (SSG) + TypeScript estricto
- **Tailwind CSS v4** (`@tailwindcss/vite`, tokens en `@theme`)
- **Nanostores** (preferencia país/ciudad persistente)
- Interactividad en **vanilla TS** (mega-menú, drawer, geo-selector, CRO) — presupuesto JS < 50KB
- Contenido en **Content Collections** (MDX + zod) — Fase 2 migra a API Laravel (`sably-core`)
- Deploy: **Cloudflare Pages** (producción `main` → sably.co, staging `develop`)

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:4321
npm run check      # type-check (astro check)
npm run build      # build SSG → dist/ (~600 páginas)
npm run preview    # servir dist/ localmente
```

Copia `.env.example` a `.env` para las variables locales. Los secretos nunca se commitean.

## Estructura

```
src/
├── components/    # UI + CRO (Header/mega-menú, CourseCard, StickyCta, ExitIntent...)
├── content/       # courses/*.mdx · blog/*.mdx · testimonials.json (zod en content.config.ts)
├── layouts/       # BaseLayout (SEO, GTM, hreflang, Schema.org)
├── lib/           # countries, categories, hotmart, seo, analytics, site
├── pages/         # [country]/ · [country]/[city]/ · cursos/ · curso/[slug]/ · blog/
├── stores/        # nanostores (geo)
└── styles/        # global.css (design tokens Tailwind v4)
```

## Multi-país

7 países (`/co/ /mx/ /pe/ /ec/ /cl/ /ar/ /us/`) × 29 ciudades con landing pages SEO locales,
precios en moneda local, WhatsApp por país y hreflang `es-*` + `x-default`.

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) — Git Flow, Conventional Commits (commitlint + husky),
CI/CD con GitHub Actions. Documentación viva en [docs/](docs/).
