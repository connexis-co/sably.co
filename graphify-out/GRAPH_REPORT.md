# Graph Report - .  (2026-08-05)

## Corpus Check
- Corpus is ~18,631 words - fits in a single context window. You may not need a graph.

## Summary
- 214 nodes · 407 edges · 10 communities
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.91)
- Token cost: 13,500 input · 7,200 output

## Community Hubs (Navigation)
- Componentes UI y Contenido
- Plan Fase 1 y Decisiones
- CRO y Medición
- Dependencias del Stack
- Navegación y Layout
- Rutas Multi-País
- Tooling y Dev Deps
- Configuración TypeScript
- Marca Sably (Favicon)

## God Nodes (most connected - your core abstractions)
1. `COUNTRIES` - 14 edges
2. `getCountry()` - 13 edges
3. `SITE` - 12 edges
4. `Afiliación Hotmart con cupón SABLY40` - 11 edges
5. `Plan Fase 1: Frontend SSG sably.co (2026-08-05)` - 10 edges
6. `Decisión: Content Collections (MDX + zod)` - 10 edges
7. `INTERNAL_CATEGORIES` - 8 edges
8. `DEFAULT_COUNTRY` - 8 edges
9. `getCategory()` - 7 edges
10. `breadcrumbSchema()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `sably.co README` --conceptually_related_to--> `ROADMAP — Ecosistema Sably`  [INFERRED]
  README.md → docs/ROADMAP.md
- `robots.txt de sably.co` --implements--> `Fase 1 — Frontend SSG sably.co`  [INFERRED]
  public/robots.txt → docs/ROADMAP.md
- `robots.txt de sably.co` --implements--> `Plan Fase 1: Frontend SSG sably.co (2026-08-05)`  [INFERRED]
  public/robots.txt → docs/plans/2026-08-05_fase1-frontend-sably.md
- `Curso de Cocina: de Cero a Profesional` --implements--> `Decisión: Content Collections (MDX + zod)`  [INFERRED]
  src/content/courses/curso-de-cocina-desde-cero-a-profesional.mdx → docs/plans/2026-08-05_fase1-frontend-sably.md
- `Curso de Corte y Confección desde Cero` --implements--> `Decisión: Content Collections (MDX + zod)`  [INFERRED]
  src/content/courses/curso-de-corte-y-confeccion-desde-cero.mdx → docs/plans/2026-08-05_fase1-frontend-sably.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Patrón módulo final de monetización (vive del oficio, precios y clientes por WhatsApp)** — src_content_courses_curso_de_cocina_desde_cero_a_profesional, src_content_courses_curso_de_corte_y_confeccion_desde_cero, src_content_courses_curso_de_marketing_digital_para_emprendedores, src_content_courses_curso_de_masajes_terapeuticos_y_relajantes, src_content_courses_curso_de_panaderia_artesanal_y_masa_madre, src_content_courses_curso_de_peluqueria_canina_profesional, src_content_courses_curso_de_reposteria_fina_y_postres_gourmet, src_content_courses_curso_de_tortas_decoradas_desde_cero [INFERRED 0.85]
- **Narrativa compartida: oficio que la IA no puede reemplazar** — src_content_courses_curso_de_cocina_desde_cero_a_profesional, src_content_courses_curso_de_corte_y_confeccion_desde_cero, src_content_courses_curso_de_marketing_digital_para_emprendedores, src_content_courses_curso_de_masajes_terapeuticos_y_relajantes, src_content_courses_curso_de_panaderia_artesanal_y_masa_madre, src_content_courses_curso_de_peluqueria_canina_profesional, src_content_courses_curso_de_reposteria_fina_y_postres_gourmet, src_content_courses_curso_de_tortas_decoradas_desde_cero [INFERRED 0.85]
- **Categoría panadería-y-pastelería** — src_content_courses_curso_de_panaderia_artesanal_y_masa_madre, src_content_courses_curso_de_reposteria_fina_y_postres_gourmet, src_content_courses_curso_de_tortas_decoradas_desde_cero [EXTRACTED 1.00]

## Communities (10 total, 0 thin omitted)

### Community 0 - "Componentes UI y Contenido"
Cohesion: 0.08
Nodes (23): items, blog, categorySlugs, collections, courses, testimonials, CATEGORIES, Category (+15 more)

### Community 1 - "Plan Fase 1 y Decisiones"
Cohesion: 0.10
Nodes (32): Decisión: Content Collections (MDX + zod), Decisión: covers como gradientes CSS por categoría, Afiliación Hotmart con cupón SABLY40, Decisión: hreflang solo en páginas equivalentes entre países, Plan Fase 1: Frontend SSG sably.co (2026-08-05), Decisión: precios base USD × tasa estática por país, Decisión: rutas país estáticas (/co/, /mx/…), Decisión: testimonios ficticios de lanzamiento (+24 more)

### Community 2 - "CRO y Medición"
Cohesion: 0.12
Nodes (18): url, EventParams, Window, buildHotmartUrl(), buildWhatsAppUrl(), HotmartUrlParams, BreadcrumbItem, breadcrumbSchema() (+10 more)

### Community 3 - "Dependencias del Stack"
Cohesion: 0.07
Nodes (29): astro, @astrojs/mdx, @astrojs/react, @astrojs/sitemap, @fontsource-variable/inter, @fontsource-variable/outfit, lucide-react, nanostores (+21 more)

### Community 4 - "Navegación y Layout"
Cohesion: 0.14
Nodes (12): cat, rounded, sentinel, City, Country, DEFAULT_COUNTRY, formatPrice(), getCountry() (+4 more)

### Community 5 - "Rutas Multi-País"
Cohesion: 0.10
Nodes (20): COUNTRIES, getCity(), category, city, country, courses, faqs, getStaticPaths() (+12 more)

### Community 6 - "Tooling y Dev Deps"
Cohesion: 0.11
Nodes (18): @astrojs/check, devDependencies, @astrojs/check, @types/react, @types/react-dom, typescript, name, private (+10 more)

### Community 7 - "Configuración TypeScript"
Cohesion: 0.13
Nodes (14): astro/tsconfigs/strict, .astro/types.d.ts, dist, src/**/*, compilerOptions, baseUrl, jsx, jsxImportSource (+6 more)

### Community 8 - "Marca Sably (Favicon)"
Cohesion: 0.83
Nodes (4): Coral dot #E8456B with small white accent circle, Navy rounded square background #1B1B3A (rx 14), Sably brand identity (navy + coral color palette), Sably favicon brand mark (64x64 SVG icon)

## Ambiguous Edges - Review These
- `Marcela Quintero (masajista terapéutica, instructora)` → `Marcela Quintero (estilista canina, instructora)`  [AMBIGUOUS]
  src/content/courses/curso-de-peluqueria-canina-profesional.mdx · relation: semantically_similar_to

## Knowledge Gaps
- **85 isolated node(s):** `name`, `type`, `version`, `private`, `dev` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Marcela Quintero (masajista terapéutica, instructora)` and `Marcela Quintero (estilista canina, instructora)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `dependencies` connect `Dependencias del Stack` to `Tooling y Dev Deps`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `COUNTRIES` connect `Rutas Multi-País` to `Componentes UI y Contenido`, `CRO y Medición`, `Navegación y Layout`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `Afiliación Hotmart con cupón SABLY40` (e.g. with `Fase 2 — Backend Laravel` and `Curso de Cocina: de Cero a Profesional`) actually correct?**
  _`Afiliación Hotmart con cupón SABLY40` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `type`, `version` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Componentes UI y Contenido` be split into smaller, more focused modules?**
  _Cohesion score 0.08199643493761141 - nodes in this community are weakly interconnected._
- **Should `Plan Fase 1 y Decisiones` be split into smaller, more focused modules?**
  _Cohesion score 0.10080645161290322 - nodes in this community are weakly interconnected._