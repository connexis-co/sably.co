# Plan — Expansión de catálogo (MasterClasses.La) + GEO hiperlocal

**Fecha:** 2026-08-05 (misma jornada, fase 2 del día)
**Estado:** En ejecución

## Objetivo

1. Poblar sably.co con los mejores cursos REALES del catálogo del productor **MasterClasses LA**
   (afiliación vía Hotmart), seleccionados por demanda SEO/SEM real (≤100).
2. Convertir el sitio en hiperlocal: páginas de curso por ciudad (`/co/medellin/curso/{slug}/`).
3. Portadas fotorrealistas generadas con Gemini (`gemini-3.1-flash-image`).

## Fuentes de datos (sin login)

| Fuente | Método | Resultado |
|---|---|---|
| Wayback Machine CDX API | `web.archive.org/cdx/search/cdx?url=masterclasses.la/*` | 8.205 URLs → **1.388 cursos únicos** (`/portfolio/{slug}`) + **26 categorías** (`/project-type/`) |
| Marketplace Hotmart público | HTML del perfil `masterclasses-la/BAAUKFVQS4` | Contexto del productor |
| Hotmart Club (con login) | **Bloqueado**: no puedo usar credenciales. JP debe loguearse en su Chrome para que yo navegue su sesión | Pendiente |

## Selección (workflow multi-agente)

- 10 agentes de scoring → 456 candidatos con score ≥60 (criterios: demanda "curso de X" LATAM,
  intención transaccional, fit anti-IA, exclusión YMYL/espiritualidad/motivacionales).
- Curador final → **top 100**: belleza 17 (→ filial), oficios 16, manualidades 11, panadería 9,
  gastronomía 8, moda 7, emprendimiento 7, bienestar 6, **idiomas 6 (nueva)**, cuidado-animal 5,
  hospitalidad 4, **música 4 (nueva)**.
- Datos en `docs/data/seleccion-cursos.json`.

## Cambios técnicos

- **Bucaramanga** agregada a Colombia (6 ciudades CO, 30 total).
- **Ruta hiperlocal** `[country]/[city]/curso/[slug]/` — refactor a `CourseLanding.astro`
  parametrizado por ciudad: H1/meta/breadcrumb/FAQ/testimonios/social-proof/UTM dinámicos por GEO.
  Country-level = hub canónico con hreflang; city-level = canonical propio sin hreflang + malla
  de enlaces internos entre ciudades.
- **Fix menú mobile**: el drawer vivía dentro del `<header>` con `backdrop-blur`; el
  `backdrop-filter` crea containing block y rompía `position:fixed`. Drawer movido fuera del
  header + animación slide + hamburger↔X.
- **WhatsApp real** +57 311 457 4788 en todos los países + botón estilo **whatsbuilder**
  (círculo #00E676 con 3 ondas expansivas, mensaje contextual por página) replicado del plugin
  de JP en academiadebelleza.edu.co.
- **Portadas Gemini**: 12 categorías × (hero 800px + card 480px) en `public/covers/`.

## Riesgos

- Los `hotmartUrl` de los 100 cursos requieren los links de afiliado reales (dashboard Hotmart de JP).
- Páginas ciudad×curso (~3.000 al escalar): contenido diferenciado por GEO (intro, FAQ, social proof)
  para mitigar thin content; monitorear en GSC tras indexación.
- 2 lotes de scoring devolvieron vacío (~280 slugs sin evaluar) — re-barrido pendiente si se
  quieren más candidatos.
