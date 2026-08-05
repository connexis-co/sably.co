# Graph Report - sably-online-courses-64463a  (2026-08-05)

## Corpus Check
- 86 files · ~103,656 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 363 nodes · 539 edges · 40 communities (17 shown, 23 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7b5c3b10`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- CourseLanding.astro
- Afiliación Hotmart con cupón SABLY40
- site.ts
- dependencies
- countries.ts
- El ranking
- devDependencies
- compilerOptions
- Sably brand identity (navy + coral color palette)
- rules
- como-emprender-con-un-oficio-en-2026.mdx
- cuanto-cuesta-aprender-un-oficio-online.mdx
- Guía de Contribución — sably.co (Frontend)
- Plan — Expansión de catálogo (MasterClasses.La) + GEO hiperlocal
- fix-content-qa.mjs
- PULL_REQUEST_TEMPLATE.md
- CHANGELOG — Frontend sably.co
- deploy-pages.sh
- curso-de-adiestramiento-canino-en-positivo.mdx
- curso-de-barismo-y-cafe-de-especialidad.mdx
- curso-de-bartending-y-cocteleria-profesional.mdx
- curso-de-electricidad-residencial-certificado.mdx
- curso-de-finanzas-para-tu-negocio.mdx
- curso-de-instructor-de-yoga-desde-cero.mdx
- curso-de-jabones-artesanales-para-vender.mdx
- curso-de-lenceria-y-ropa-interior-a-medida.mdx
- curso-de-mecanica-de-motos-desde-cero.mdx
- curso-de-nutricion-practica-para-la-familia.mdx
- curso-de-parrilla-y-asados-como-un-maestro.mdx
- curso-de-patronaje-profesional-de-ropa.mdx
- curso-de-resina-epoxica-paso-a-paso.mdx
- curso-de-soldadura-mig-tig-y-arco-electrico.mdx
- curso-de-velas-artesanales-y-aromaticas.mdx
- curso-de-ventas-por-whatsapp-y-redes.mdx
- curso-de-wedding-planner-y-eventos.mdx
- CHANGELOG.md
- CLAUDE.md
- connect-domain.sh
- generate-covers.py

## God Nodes (most connected - your core abstractions)
1. `COUNTRIES` - 16 edges
2. `getCountry()` - 14 edges
3. `SITE` - 12 edges
4. `El ranking` - 11 edges
5. `Afiliación Hotmart con cupón SABLY40` - 11 edges
6. `Plan Fase 1: Frontend SSG sably.co (2026-08-05)` - 10 edges
7. `Decisión: Content Collections (MDX + zod)` - 10 edges
8. `DEFAULT_COUNTRY` - 8 edges
9. `INTERNAL_CATEGORIES` - 7 edges
10. `Country` - 7 edges

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

## Communities (40 total, 23 thin omitted)

### Community 0 - "CourseLanding.astro"
Cohesion: 0.08
Nodes (31): cat, rounded, sentinel, blog, categorySlugs, collections, courses, testimonials (+23 more)

### Community 1 - "Afiliación Hotmart con cupón SABLY40"
Cohesion: 0.10
Nodes (32): Decisión: Content Collections (MDX + zod), Decisión: covers como gradientes CSS por categoría, Afiliación Hotmart con cupón SABLY40, Decisión: hreflang solo en páginas equivalentes entre países, Plan Fase 1: Frontend SSG sably.co (2026-08-05), Decisión: precios base USD × tasa estática por país, Decisión: rutas país estáticas (/co/, /mx/…), Decisión: testimonios ficticios de lanzamiento (+24 more)

### Community 2 - "site.ts"
Cohesion: 0.15
Nodes (10): items, url, EventParams, Window, buildHotmartUrl(), buildWhatsAppUrl(), HotmartUrlParams, GTM_ID (+2 more)

### Community 3 - "dependencies"
Cohesion: 0.07
Nodes (29): astro, @astrojs/mdx, @astrojs/react, @astrojs/sitemap, @fontsource-variable/inter, @fontsource-variable/outfit, lucide-react, nanostores (+21 more)

### Community 4 - "countries.ts"
Cohesion: 0.07
Nodes (37): City, COUNTRIES, Country, DEFAULT_COUNTRY, getCity(), getCountry(), BreadcrumbItem, breadcrumbSchema() (+29 more)

### Community 5 - "El ranking"
Cohesion: 0.13
Nodes (14): 10. Jabones, velas y productos artesanales, 1. Electricidad residencial, 2. Soldadura, 3. Panadería y pastelería, 4. Mecánica de motos, 5. Corte y confección, 6. Barismo y café de especialidad, 7. Masajes terapéuticos (+6 more)

### Community 6 - "devDependencies"
Cohesion: 0.08
Nodes (25): @astrojs/check, @commitlint/cli, @commitlint/config-conventional, husky, devDependencies, @astrojs/check, @commitlint/cli, @commitlint/config-conventional (+17 more)

### Community 7 - "compilerOptions"
Cohesion: 0.13
Nodes (14): astro/tsconfigs/strict, .astro/types.d.ts, dist, src/**/*, compilerOptions, baseUrl, jsx, jsxImportSource (+6 more)

### Community 8 - "Sably brand identity (navy + coral color palette)"
Cohesion: 0.83
Nodes (4): Coral dot #E8456B with small white accent circle, Navy rounded square background #1B1B3A (rx 14), Sably brand identity (navy + coral color palette), Sably favicon brand mark (64x64 SVG icon)

### Community 10 - "rules"
Cohesion: 0.24
Nodes (9): extends, rules, body-max-line-length, subject-case, subject-max-length, type-enum, always, @commitlint/config-conventional (+1 more)

### Community 11 - "como-emprender-con-un-oficio-en-2026.mdx"
Cohesion: 0.22
Nodes (8): El mejor momento sigue siendo ahora, Oficios con buena relación inversión/retorno, Paso 1: elige el oficio correcto (para ti), Paso 2: fórmate bien, pero no eternamente, Paso 3: consigue tus primeros 10 clientes, Paso 4: ordena la plata desde el día uno, Paso 5: escala cuando el trabajo te desborde, Por qué un oficio es un buen negocio en 2026

### Community 12 - "cuanto-cuesta-aprender-un-oficio-online.mdx"
Cohesion: 0.22
Nodes (8): Cinco señales de que un curso barato vale la pena (y cuándo no), Cursos online: $15 a $80 USD por curso, El costo que sí importa: herramientas y materiales, Entonces, ¿cuánto necesitas en total?, Institutos y academias presenciales: $300 a $2.000 USD, La cuenta completa, con ejemplo real, Lo que cuesta la formación, opción por opción, YouTube: gratis (con trampa)

### Community 13 - "Guía de Contribución — sably.co (Frontend)"
Cohesion: 0.29
Nodes (6): Branching (Git Flow), Deploy manual (si el pipeline falla), Flujo rápido, Guía de Contribución — sably.co (Frontend), Reglas fundamentales, Tipos de commit

### Community 14 - "Plan — Expansión de catálogo (MasterClasses.La) + GEO hiperlocal"
Cohesion: 0.29
Nodes (6): Cambios técnicos, Fuentes de datos (sin login), Objetivo, Plan — Expansión de catálogo (MasterClasses.La) + GEO hiperlocal, Riesgos, Selección (workflow multi-agente)

### Community 15 - "fix-content-qa.mjs"
Cohesion: 0.29
Nodes (6): dir, files, PRIMES, seenInstructors, seenRatingCount, seenStudents

### Community 16 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.33
Nodes (5): Checklist, Descripción, Issue relacionado, Screenshots / Capturas (si aplica), Tipo de cambio

## Ambiguous Edges - Review These
- `Marcela Quintero (masajista terapéutica, instructora)` → `Marcela Quintero (estilista canina, instructora)`  [AMBIGUOUS]
  src/content/courses/curso-de-peluqueria-canina-profesional.mdx · relation: semantically_similar_to

## Knowledge Gaps
- **182 isolated node(s):** `@commitlint/config-conventional`, `never`, `name`, `type`, `version` (+177 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Marcela Quintero (masajista terapéutica, instructora)` and `Marcela Quintero (estilista canina, instructora)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `COUNTRIES` connect `countries.ts` to `CourseLanding.astro`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `@commitlint/config-conventional`, `never`, `name` to the rest of the system?**
  _182 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CourseLanding.astro` be split into smaller, more focused modules?**
  _Cohesion score 0.07549361207897794 - nodes in this community are weakly interconnected._
- **Should `Afiliación Hotmart con cupón SABLY40` be split into smaller, more focused modules?**
  _Cohesion score 0.10080645161290322 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._