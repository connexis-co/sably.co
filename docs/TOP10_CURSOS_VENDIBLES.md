# Top 10 cursos más vendibles por SEO

> Datos: Google Keyword Planner (API v24), 8 mercados, agosto 2026.
> Crudos: `docs/data/sondeo-belleza.json`, `sondeo-oficios-8paises.json`, `localismos.json`.
> Scripts: `scripts/sondeo-belleza.py`, `scripts/localismos.py`.

## Metodología

Se cruzaron dos catálogos:

1. **academiadebelleza.edu.co** — 17 cursos extraídos del sitemap. No son hipótesis: son
   cursos que la filial lleva años vendiendo presencialmente en 6 ciudades de Colombia.
   Demanda validada con dinero.
2. **Catálogo de Sably** — los 105 cursos publicados.

Cada keyword se midió en **CO, MX, PE, EC, CL, AR, ES, US**, incluyendo sus variantes
regionales. El score pondera volumen por competencia (`LOW ×1.0`, `MEDIUM ×0.55`,
`HIGH ×0.25`): 3.000 búsquedas con competencia alta valen menos que 1.500 con baja.

---

## Los 4 hallazgos que cambian la estrategia

### 1. Argentina y Chile estaban fuera de todos los análisis previos — y son los mercados #1

Las mediciones anteriores solo cubrían CO, MX y ES. Al abrir los 8 países, **Argentina
aparece primero o segundo en casi todas las keywords**:

| Curso | AR | vs. Colombia |
|---|---|---|
| curso de electricista | **5.400** | 6,1× |
| curso de reparación de celulares | **4.400** | 7,5× |
| curso de peluquería | **2.900** | 6,0× |
| curso de barista | **2.900** | 9,1× |
| curso de uñas | **2.900** | 2,2× |

Chile suma otro tanto: soldadura 2.900, barbería 2.400, peluquería 1.600. Toda la
personalización del sitio (testimonios, ciudades, precios) está sesgada a Colombia,
que resulta ser el mercado más pequeño de los ocho.

### 2. El catálogo de la filial es terreno libre fuera de Colombia

academiadebelleza.edu.co es una academia **presencial** con sedes en Bogotá, Medellín,
Cali, Barranquilla, Bucaramanga y Villavicencio. Solo vende en Colombia.

Los 17 cursos de belleza —demanda ya validada— se pueden atacar en MX, AR, CL, PE, ES y US
**sin ningún riesgo de canibalización**: 40.000+ búsquedas/mes de un catálogo que ya
sabemos que convierte. Dentro de Colombia se respeta el reparto: head terms para la filial,
variantes `online` + `certificado` para Sably.

### 3. Los localismos parten el mercado en pedazos

Mismo curso, distinta palabra según el país. Publicar una sola versión pierde el resto:

| Familia | Con un solo término | Localizado | Ganancia | Reparto |
|---|---|---|---|---|
| **Plomería** | 3.180 | **6.140** | **+93 %** | `plomería` MX·AR·US · `gasfíter` CL·PE · `fontanería` ES |
| Depilación | 990 | 1.230 | +24 % | `depilación láser` MX·AR·ES · `con cera` CL |
| Estética | 4.950 | 5.780 | +16 % | `cosmetología` en 7 países · `estética` ES |
| Repostería | 7.880 | 8.900 | +12 % | `repostería` en 7 · `pastelería` AR |
| Peluquería | 6.950 | 7.780 | +11 % | `peluquería` CO·CL·AR·ES·US · `corte de cabello` MX |
| Mecánica | 9.740 | 10.480 | +7 % | `mecánica automotriz` en 6 · `de motos` CO |

Los casos más marcados:

- **Plomería** no tiene un término dominante: son tres mercados separados. Es el único
  caso donde publicar mal cuesta la mitad del tráfico.
- **México no dice "peluquería"** (210/mes) sino `corte de cabello` (1.000) y
  `estilismo` (720). Un H1 que diga "peluquería" es invisible en el segundo mercado.
- **España invierte "cosmetología" (170) por "estética" (1.000)** — 6× de diferencia con
  el resto de LATAM, que hace justo lo contrario.
- **España usa `móviles`, no `celulares`** (260 vs 40) y `mecánica de coches`, no
  `automotriz` (880 vs 260).
- Términos que solo existen en un país: `modistería` (CO 260), `uñas esculpidas` (AR 210),
  `quiromasaje` (ES 390), `cosmiatría` (AR 320), `gasfíter` (CL 1.300).

Y los que **no** hay que localizar, porque el término es idéntico en los 8 países:
electricista, barbería, uñas, masajes. Ahí una sola versión sirve.

> ⚠️ La `ñ` importa: `curso de unas` (10/mes) y `curso de uñas` (4.400/mes en MX) son
> keywords distintas para Google. Los slugs van sin ñ por ASCII, pero el H1, el `<title>`
> y las keywords del frontmatter deben llevarla.

### 4. Los slugs largos están diluyendo el volumen principal

Varios cursos publicados no apuntan al término que la gente teclea:

| Slug actual | Head term real | Volumen mal apuntado |
|---|---|---|
| `curso-de-soldadura-mig-tig-y-arco-electrico` | curso de soldadura | 10.810/mes |
| `curso-de-cocina-desde-cero-a-profesional` | curso de cocina | 11.230/mes |
| `curso-de-reposteria-fina-y-postres-gourmet` | curso de repostería | 7.880/mes |
| `curso-de-mecanica-de-motos-desde-cero` | curso de mecánica de motos | 5.460/mes |
| `curso-de-masajes-terapeuticos-y-relajantes` | curso de masajes | 5.270/mes |

El H1 y el slug deben ser el head term; los calificativos van al subtítulo y al cuerpo.
Son ~40.000 búsquedas/mes mal apuntadas, y se corrige sin escribir contenido nuevo.

---

## Top 10

| # | Curso | Total/mes | Competencia | Mercados fuertes | Estado |
|---|---|---|---|---|---|
| 1 | **Soldadura** | 10.810 | `LOW` en 7/8 ⭐ | CL 2.900 · ES 2.400 · AR 1.900 | Slug diluido |
| 2 | **Barbería** | 12.400 | `LOW` en 4/8 ⭐ | MX 3.600 · AR 2.900 · CL 2.400 | ✅ Publicado |
| 3 | **Uñas** | 12.270 | `LOW` ⭐ | MX 4.400 · AR 2.900 · CO 1.300 | ✅ Publicado |
| 4 | **Electricista** | 15.820 | Mixta | AR 5.400 · MX 2.900 · ES 2.900 | ✅ Publicado |
| 5 | **Reparación de celulares** | 8.250 | `LOW` en 4/5 ⭐ | AR 4.400 · MX 1.900 | ✅ Publicado |
| 6 | **Peluquería** (humana) | 7.780 | `LOW` en 4/6 ⭐ | AR 2.900 · CL 1.600 · ES 1.300 | ❌ **Falta** |
| 7 | **Carpintería** | 5.700 | `LOW` en 5/7 ⭐ | MX 1.900 · AR 1.600 | Ampliar |
| 8 | **Primeros auxilios** | 8.660 | Media | MX 2.900 · CO 1.600 · ES 1.300 | ✅ Publicado |
| 9 | **Pestañas** (head) | 5.380 | `LOW` en 3/6 ⭐ | MX 1.900 · AR 1.600 | ❌ **Falta el head** |
| 10 | **Cocina** | 11.230 | Alta | ES 2.900 · AR 2.400 · CO 1.600 | Slug diluido |

**Menciones cercanas:** maquillaje (6.090, CPC $6,8 USD), barista (6.900, AR 2.900),
repostería (8.900 localizado), cosmetología/estética (5.780, el CPC más alto del set con
$7,3 USD), mecánica de motos (5.460), masajes (5.270 `LOW`), plomería (6.140 localizado).

---

## Los 5 huecos del catálogo

Cursos con demanda medida y ya validada por la filial que **Sably no tiene**:

| Curso ausente | Volumen | Nota |
|---|---|---|
| `curso-de-peluqueria` | 7.780 | Solo existe peluquería **canina**. El hueco más caro del catálogo |
| `curso-de-maquillaje` | 6.090 | Solo hay maquillaje permanente y de novias; falta el genérico |
| `curso-de-pestanas` | 5.380 | Solo extensiones y volumen ruso; el head vale 9× más |
| `curso-de-cosmetologia` | 5.780 | Ausente por completo. CPC más alto del set |
| `curso-de-automaquillaje` | 2.410 | Ausente. Público distinto: consumidor final, no profesional |

---

## Plan de ejecución

**Fase 1 — sin crear contenido (1 día).** Corregir los 5 slugs diluidos hacia el head term.
Recupera ~40.000 búsquedas/mes de páginas que ya existen.

**Fase 2 — localización de H1 por país.** Añadir al schema de `courses` un mapa opcional
`localTitles: Record<countryCode, string>` para que `/mx/curso-de-peluqueria/` titule
"Curso de corte de cabello" y `/es/curso-de-plomeria/` titule "Curso de fontanería",
manteniendo un solo MDX por curso. Solo lo necesitan las 6 familias de la tabla de
localismos; el resto usa el título global.

**Fase 3 — cerrar los 5 huecos.** ~27.400 búsquedas/mes adicionales de demanda validada.
Orden: peluquería → maquillaje → pestañas → cosmetología → automaquillaje.

**Fase 4 — reorientar la personalización a AR/MX/CL.** Testimonios, ciudades y precios
priorizando los mercados que concentran la demanda. Colombia queda para la filial.
