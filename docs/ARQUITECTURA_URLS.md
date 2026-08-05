# Arquitectura de URLs — Ecosistema Sably

> **Documento base.** Define cómo se construye toda URL del sitio y por qué.
> Cualquier ruta nueva (curso, ciudad, país, categoría, filial) debe seguir estas reglas.
>
> **Última revisión:** 2026-08-05 · **Estado:** vigente

---

## 1. Los tres principios

1. **País en código ISO como primer segmento** → hreflang limpio y patrón que Google ya asocia a segmentación geográfica.
2. **Ciudad solo donde existe intención local real** → una URL por búsqueda que existe, no por combinación posible.
3. **El slug lleva la keyword exacta que la gente escribe** → `curso-de-barberia`, no `barberia`.

De ahí sale la regla que resuelve todo lo demás: **ni un segmento de más, ni una página sin demanda detrás.**

---

## 2. Mapa completo de URLs

```
sably.co/
│
├── {cc}/                                    Home país
│   ├── cursos/                              Catálogo del país
│   │   └── {categoria}/                     Categoría en el país
│   │
│   ├── {curso-slug}/                        ⭐ Curso a nivel país
│   │
│   └── {ciudad}/                            Landing de ciudad
│       ├── cursos/
│       │   └── {categoria}/                 Categoría en la ciudad
│       └── {curso-slug}/                    ⭐ Curso hiperlocal
│
├── blog/
│   └── {post-slug}/                         Sin país: contenido editorial global
│
├── homologaciones/
│   └── {programa}/                          Solo Colombia (servicio local)
│
├── nosotros/
└── legal/{terminos|privacidad}/
```

**Profundidad máxima: 4 segmentos.** Ninguna página del sitio está a más de 4 clicks estructurales de la raíz.

---

## 3. Ejemplos por país

### 🇨🇴 Colombia — `co` · COP · 6 ciudades

```
sably.co/co/                                       Home
sably.co/co/cursos/                                Catálogo
sably.co/co/cursos/oficios/                        Categoría
sably.co/co/curso-de-barberia/                     Curso (país)
sably.co/co/curso-de-excel/                        Curso (país) — sin versión ciudad
sably.co/co/bogota/                                Landing ciudad
sably.co/co/bogota/cursos/oficios/                 Categoría en ciudad
sably.co/co/bogota/curso-de-barberia/              Curso hiperlocal ✅
sably.co/co/bucaramanga/curso-de-unas-acrilicas/   Curso hiperlocal ✅
sably.co/co/medellin/curso-de-panaderia/           Curso hiperlocal ✅
```

Ciudades: `bogota` · `medellin` · `cali` · `barranquilla` · `cartagena` · `bucaramanga`

### 🇲🇽 México — `mx` · MXN · 5 ciudades

```
sably.co/mx/
sably.co/mx/cursos/manualidades/
sably.co/mx/curso-de-decoracion-con-globos/
sably.co/mx/cdmx/
sably.co/mx/cdmx/curso-de-decoracion-con-globos/   ✅ 14.800 búsquedas/mes en MX
sably.co/mx/guadalajara/curso-de-barberia/         ✅ 3.600/mes, competencia LOW
sably.co/mx/monterrey/cursos/gastronomia/
sably.co/mx/curso-de-ingles/                       ✗ sin ciudad (búsqueda no es geo)
```

Ciudades: `cdmx` · `guadalajara` · `monterrey` · `puebla` · `cancun`

### 🇵🇪 Perú — `pe` · PEN · 4 ciudades

```
sably.co/pe/
sably.co/pe/cursos/belleza/
sably.co/pe/curso-de-unas-acrilicas/
sably.co/pe/lima/
sably.co/pe/lima/curso-de-unas-acrilicas/          ✅
sably.co/pe/arequipa/cursos/gastronomia/
sably.co/pe/curso-de-python/                       ✗ sin ciudad
```

Ciudades: `lima` · `arequipa` · `trujillo` · `cusco`

### Resto de países

| País | Código | Moneda | Ciudades |
|---|---|---|---|
| 🇪🇨 Ecuador | `ec` | USD | quito · guayaquil · cuenca |
| 🇨🇱 Chile | `cl` | CLP | santiago · valparaiso · concepcion |
| 🇦🇷 Argentina | `ar` | ARS | buenosaires · cordoba · rosario · mendoza |
| 🇺🇸 US-Hispano | `us` | USD | miami · houston · losangeles · newyork · chicago |

---

## 4. Geo escalonado — qué cursos llevan página de ciudad

La regla es una sola pregunta: **¿el egresado presta un servicio en su ciudad?**

| Nivel | Categorías | Ciudades por país | Razón |
|---|---|---|---|
| **A** — servicio local fuerte | `oficios` · `gastronomia` · `panaderia-y-pasteleria` · `cuidado-animal` · `hospitalidad` · `bienestar` · `belleza`* | Todas (3-6) | El graduado atiende clientes físicos en su ciudad. Evidencia: "curso de uñas barranquilla" genera clicks reales en GSC |
| **B** — local moderado | `moda-y-confeccion` · `manualidades` | Top 3 | Vende por encargo y en ferias locales, pero también online |
| **C** — digital / transversal | `idiomas` · `musica` · `emprendimiento` | Ninguna | "curso de excel en CDMX" no se busca. Se busca "curso de excel online" |

\* Belleza en sably.co solo como variantes "online + certificado" y geo; los head terms son de `academiadebelleza.edu.co` (ver §8).

**Impacto:** de ~2.600 páginas de ciudad posibles a ~800 con demanda verificable. Google no premia cantidad de URLs, premia que cada URL responda a una búsqueda que existe.

**Regla de escalamiento:** una ciudad nueva entra solo si (a) GSC muestra impresiones para ese geo, o (b) supera 500K habitantes. Medir 90 días antes de ampliar.

---

## 5. Reglas técnicas

### 5.1 Namespace de slugs (evita colisiones)

En el mismo nivel conviven ciudades y cursos (`/co/bogota/` vs `/co/curso-de-barberia/`). Se resuelve con dos invariantes:

| Regla | Detalle |
|---|---|
| **Todo slug de curso empieza por `curso-de-`** | Validado en `content.config.ts`. Ninguna ciudad puede empezar así |
| **Palabras reservadas** | `cursos` · `curso` · `blog` · `homologaciones` · `nosotros` · `legal` no pueden ser slug de ciudad ni de curso |

Astro prioriza segmentos estáticos sobre dinámicos, así que `/mx/cursos/` nunca se resuelve como curso.

### 5.2 Canonical y hreflang por tipo de página

| Tipo | Canonical | hreflang |
|---|---|---|
| Home país | self | Todos los países + `x-default` |
| Categoría país | self | Todos los países + `x-default` |
| **Curso país** | self | **Todos los países + `x-default`** |
| Landing ciudad | self | ✗ ninguno |
| Categoría ciudad | self | ✗ ninguno |
| **Curso ciudad** | **self** | **✗ ninguno** |
| Blog / legal / nosotros | self | ✗ ninguno |

**Por qué las páginas de ciudad no llevan hreflang:** no mapean 1:1 entre países (Bucaramanga no tiene equivalente en Perú). Un hreflang incoherente es peor que ninguno. Cada página de ciudad es canónica de sí misma y se diferencia por contenido, no por señal técnica.

### 5.3 Diferenciación de contenido en páginas de ciudad

Una página de ciudad **no puede ser la de país con el nombre cambiado**. Mínimo obligatorio:

- H1 y `<title>` con la ciudad
- Párrafo de contexto local propio
- FAQ específica de la ciudad (≥2 preguntas)
- Social proof local ("X estudiantes en {ciudad}")
- Testimonios priorizados por ciudad
- `utm_content={ciudad}` en el CTA a Hotmart
- Malla de enlaces a las otras ciudades del país + al curso a nivel país

### 5.4 Trailing slash

Siempre **con** barra final (`trailingSlash: 'always'` en `astro.config.mjs`). Cloudflare Pages redirige 301 la variante sin barra.

---

## 6. Por qué esta arquitectura y no otra

| Alternativa | Por qué se descartó |
|---|---|
| `/co/curso/curso-de-barberia/` | Redundancia: "curso" dos veces. Un nivel de más multiplicado por miles de páginas |
| `/cursos/colombia/bogota/curso-de-barberia/` | Entierra el geo tras `/cursos/`. País en palabra completa rompe el patrón ISO que Google asocia con hreflang |
| `/co/bogota/cursos/barberia/` | El slug pierde `curso-de-`, que es literalmente lo que la gente escribe en Google |
| `/curso-de-barberia-en-bogota/` (todo plano) | Match perfecto con la query pero mata el hreflang y no escala: ¿de qué país es `/curso-de-barberia/`? |
| `/co/cursos/oficios/curso-de-barberia/` | Nivel extra + URL frágil: cambiar la categoría de un curso rompe su URL. Los silos se construyen con **enlazado interno**, no con carpetas |
| `co.sably.co/curso-de-barberia/` | Los subdominios fragmentan la autoridad. Subcarpeta gana para multi-país en un dominio joven |
| Esta misma, pero **sin** geo escalonado | Estructura correcta, pero ~1.800 páginas de ciudad sin ninguna búsqueda detrás = riesgo de thin content |

### Evaluación ponderada (criterios del prompt maestro SEO)

| Criterio | Peso | Puntaje |
|---|---|---|
| SEO geo-local | 30% | 9 — geo al inicio, ISO estándar |
| Keyword en URL | 20% | 10 — slug = query literal, sin redundancia |
| Escalabilidad | 15% | 9 — probado con miles de páginas |
| Profundidad | 15% | 9 — máx. 4 niveles |
| UX / legibilidad | 10% | 9 |
| Implementación | 10% | 8 — requiere 301 desde la estructura previa |
| **Total** | | **9,2 / 10** |

---

## 7. Enlazado interno (jerarquía)

```
/co/cursos/  →  /co/cursos/oficios/  →  /co/curso-de-barberia/
                                              ↓ malla geo
                                    /co/bogota/curso-de-barberia/
                                    /co/medellin/curso-de-barberia/
                                              ↓ ancla de retorno
                                    /co/curso-de-barberia/  ("Todo Colombia")

/co/  →  /co/bogota/  →  /co/bogota/cursos/oficios/  →  /co/bogota/curso-de-barberia/
```

Breadcrumbs visibles + `BreadcrumbList` en JSON-LD reflejando exactamente esta jerarquía.

---

## 8. Multi-dominio — cómo no canibalizarse

Cada dominio del ecosistema ataca una **variante distinta** del mismo cluster:

| Cluster | Head term | "online + certificado" | GEO ciudad | Informacional |
|---|---|---|---|---|
| Belleza | `academiadebelleza.edu.co` | sably.co | sably.co | academiadebelleza |
| Globos | `cursodeglobosonline.com` | sably.co | sably.co | cursodeglobosonline |
| Terapia de pareja | `terapiadpareja.com` | terapiadpareja | terapiadpareja | terapiadpareja |
| Resto del catálogo | **sably.co** | sably.co | sably.co | blog sably |

**Reglas duras:**
- Contenido 100% único por dominio. Nunca parafrasear entre propiedades.
- Canonical **siempre self**, jamás cruzado entre dominios.
- Filial → sably: dofollow editorial. Sably → filial: contextual selectivo. **Filial ↔ filial: nunca.**
- Revisión mensual en GSC: misma query con URLs propias alternando posiciones = canibalización → consolidar en el dominio dueño + 301.

---

## 9. Migración desde la estructura anterior

Estructura previa (vigente hasta 2026-08-05):

```
/co/curso/{slug}/           →  /co/{slug}/
/co/{ciudad}/curso/{slug}/  →  /co/{ciudad}/{slug}/
```

Redirecciones 301 en `public/_redirects` (Cloudflare Pages):

```
/:country/curso/:slug/           /:country/:slug/            301
/:country/:city/curso/:slug/     /:country/:city/:slug/      301
```

> Migración hecha con el sitio recién lanzado y 0 páginas indexadas en GSC — costo de equity nulo. Cualquier cambio futuro de URLs debe evaluarse con el tráfico ya consolidado y requiere plan de 301 + monitoreo de posiciones.

---

## 10. Checklist para agregar contenido nuevo

**Curso nuevo**
- [ ] Slug empieza por `curso-de-` y contiene la keyword real (validada en Keyword Planner)
- [ ] No colisiona con slug de ciudad ni palabra reservada
- [ ] Categoría asignada define su nivel geo (A / B / C, §4)
- [ ] Si es nivel A o B: verificar que las páginas de ciudad aporten contenido diferenciado (§5.3)

**Ciudad nueva**
- [ ] Justificada por GSC (impresiones) o por población >500K
- [ ] Slug sin acentos ni espacios, no empieza por `curso-de-`
- [ ] Agregada a `src/lib/countries.ts` — las rutas se generan solas

**País nuevo**
- [ ] Código ISO de 2 letras, moneda, tasa de cambio, WhatsApp
- [ ] Alta en `COUNTRIES`; el hreflang se recalcula automáticamente
- [ ] Mínimo 3 ciudades para justificar la capa geo
