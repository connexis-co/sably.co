# Arquitectura de URLs — Ecosistema Sably

> **Documento base.** Define cómo se construye toda URL del sitio y por qué.
> Cualquier ruta nueva (curso, ciudad, país, categoría, filial) debe seguir estas reglas.
>
> **Última revisión:** 2026-08-05 · **Estado:** vigente y APLICADO en producción

---

## 1. Los tres principios

1. **País en código ISO como primer segmento** → hreflang limpio y patrón que Google ya asocia a segmentación geográfica.
2. **Cobertura geo completa, diferenciación obligatoria** → todo curso existe en toda ciudad; lo que sostiene la estrategia no es filtrar URLs sino que cada una aporte contenido local propio (§4.3).
3. **El slug lleva la keyword exacta que la gente escribe** → `curso-de-barberia`, no `barberia`.

De ahí sale la regla que resuelve todo lo demás: **ni un segmento de más, ni una página sin contenido propio.**

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
sably.co/co/curso-de-unas-acrilicas/               Curso (país)
sably.co/co/bogota/                                Landing ciudad
sably.co/co/bogota/cursos/oficios/                 Categoría en ciudad
sably.co/co/bogota/curso-de-barberia/              480/mes · LOW    🔴 prioridad alta
sably.co/co/bogota/curso-de-ingles/                1.300/mes · HIGH 🟡 prioridad media
sably.co/co/medellin/curso-de-barberia/            260/mes · LOW    🔴 prioridad alta
sably.co/co/bucaramanga/curso-de-ingles/           480/mes          🟡 prioridad media
sably.co/co/bucaramanga/curso-de-unas-acrilicas/   sin datos KP     ⚪ cola larga — igual se genera
```

Ciudades: `bogota` · `medellin` · `cali` · `barranquilla` · `cartagena` · `bucaramanga`

### 🇲🇽 México — `mx` · MXN · 5 ciudades

```
sably.co/mx/
sably.co/mx/cursos/manualidades/
sably.co/mx/curso-de-decoracion-con-globos/
sably.co/mx/cdmx/
sably.co/mx/cdmx/curso-de-decoracion-con-globos/   "decoración con globos" 14.800/mes en MX
sably.co/mx/cdmx/curso-de-barberia/                390/mes · LOW    🔴 prioridad alta
sably.co/mx/cdmx/curso-de-ingles/                  1.300/mes · HIGH 🟡 prioridad media
sably.co/mx/cdmx/curso-de-reposteria/              880/mes          🟡 prioridad media
sably.co/mx/monterrey/cursos/gastronomia/
```

Ciudades: `cdmx` · `guadalajara` · `monterrey` · `puebla` · `cancun`

### 🇵🇪 Perú — `pe` · PEN · 4 ciudades

```
sably.co/pe/
sably.co/pe/cursos/belleza/
sably.co/pe/curso-de-unas-acrilicas/
sably.co/pe/lima/
sably.co/pe/lima/curso-de-unas-acrilicas/          
sably.co/pe/lima/curso-de-ingles/                  
sably.co/pe/arequipa/cursos/gastronomia/
sably.co/pe/arequipa/curso-de-python/              ⚪ cola larga — se genera igual
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

## 4. Cobertura geo — todos los cursos en todas las ciudades

> **Decisión (2026-08-05):** cobertura **completa**. Cada curso existe en cada ciudad de cada país.
> Sin exclusiones por categoría.

### 4.1 Por qué cobertura total y no filtrada

Se evaluó filtrar por categoría (generar ciudad solo para "oficios físicos") y **los datos lo
desmintieron**:

| Ciudad | inglés | cocina/repostería | barbería | guitarra | excel | uñas |
|---|---|---|---|---|---|---|
| **Bogotá** | **1.300** | 720 | 480 `LOW` | 210 | 110 | — |
| **CDMX** | **1.300** | 880 | 390 `LOW` | 260 | 70 | — |
| Medellín | 590 | — | 260 `LOW` | — | — | — |
| Bucaramanga | 480 | 170 `LOW` | 70 | — | 90 | 0 |
| Cartagena | 260 | — | 20 | — | — | 0 |

Búsquedas/mes, Google Ads Keyword Planner.

1. **Idiomas —la categoría "menos local" en teoría— resultó la de mayor demanda geo.** Inglés en
   Bogotá y en CDMX: 1.300/mes cada una, por encima de cualquier oficio físico.
2. **Uñas —el oficio local por excelencia— marca 0 en ciudades secundarias.** La categoría no
   predice nada.
3. **El "0" de Keyword Planner no es cero.** La herramienta no reporta por debajo de ~10
   búsquedas/mes. Un 0 significa "long-tail invisible para la herramienta", no "nadie lo busca".

Conclusión: cualquier regla de exclusión a priori deja tráfico sobre la mesa. **Se genera todo y
se deja que los datos reales de GSC —no una hipótesis— decidan qué se poda.**

### 4.2 Volumen del grid

```
87 cursos × 30 ciudades   = 2.610 páginas curso×ciudad
87 cursos ×  7 países     =   609 páginas curso×país
                            ─────
                              3.219 páginas de curso
```

Costo marginal real: **cero**. Es SSG — se generan en build, se sirven desde CDN, no hay base de
datos ni cómputo por request.

### 4.3 Lo que sí nos protege: diferenciación obligatoria

Google no penaliza tener muchas URLs. Penaliza URLs **thin o duplicadas**. Con cobertura total,
la diferenciación deja de ser deseable y pasa a ser **el requisito que sostiene la estrategia**.

Cada página `{ciudad}/{curso}` debe cumplir **todos** estos puntos:

| # | Elemento | Implementación |
|---|---|---|
| 1 | H1 con la ciudad | `Curso de Barbería en Bucaramanga` |
| 2 | `<title>` y meta description con ciudad + formato | `... en Bucaramanga, Colombia \| Online + Certificado` |
| 3 | Párrafo de contexto local propio | Bloque "¿Vives en {ciudad}?" con mención al país y la moneda |
| 4 | FAQ con ≥2 preguntas específicas de la ciudad | "¿Puedo tomarlo desde {ciudad}?" · "¿El certificado sirve en {ciudad}?" |
| 5 | Social proof local | "{N} estudiantes lo están tomando en {ciudad}" — determinístico por ciudad+curso |
| 6 | Testimonios priorizados por ciudad | Ordenados por coincidencia de `citySlug` |
| 7 | Breadcrumb con la ciudad | `Inicio › {Ciudad} › {Categoría} › {Curso}` |
| 8 | Malla geo | Enlaces a las otras ciudades del país + ancla "Todo {País}" |
| 9 | `utm_content={ciudad}` en el CTA | Permite medir conversión por ciudad en Hotmart |
| 10 | Precio en moneda local | Del país al que pertenece la ciudad |

> Si una plantilla nueva no cumple los 10 puntos, **no se generan sus páginas de ciudad** hasta
> que los cumpla. Esta es la única condición que bloquea la cobertura total.

### 4.4 Priorización — los datos deciden esfuerzo, no existencia

Todas las páginas existen. Lo que cambia según los datos es **dónde se invierte enlazado interno,
contenido extra y pauta**:

| Prioridad | Perfil | Qué recibe | Ejemplos medidos |
|---|---|---|---|
| 🔴 **Alta** | Vol ≥150 + competencia `LOW` | Enlace desde la home del país · contenido local extendido · candidata a Ads | barbería Bogotá 480 · barbería CDMX 390 · barbería Medellín 260 · cocina Bucaramanga 170 |
| 🟡 **Media** | Vol ≥500 + competencia `HIGH` | Enlace desde la landing de ciudad · artículo de blog de apoyo | inglés Bogotá 1.300 · inglés CDMX 1.300 · repostería CDMX 880 · cocina Bogotá 720 |
| ⚪ **Cola larga** | Vol <150 o sin datos | Existe, indexable, enlazada desde la malla geo. Sin inversión adicional | uñas Bucaramanga · barbería Cartagena |

La cola larga es donde está la ventaja competitiva: nadie más genera esas páginas, y en agregado
capturan tráfico que ninguna herramienta de keywords muestra.

### 4.5 Señales de prioridad en el sitemap

El sitemap refleja la prioridad para orientar el crawl budget de un dominio joven:

| Tipo de página | `priority` | `changefreq` |
|---|---|---|
| Home país · catálogo país | 1.0 | weekly |
| Curso a nivel país | 0.9 | weekly |
| Categoría (país o ciudad) | 0.8 | weekly |
| Landing de ciudad | 0.7 | monthly |
| Curso × ciudad — prioridad alta/media | 0.7 | monthly |
| Curso × ciudad — cola larga | 0.5 | monthly |

### 4.6 El bucle de datos reales (a 90 días)

Keyword Planner dice lo que *se busca*; GSC dice lo que *nos encuentra*. A los 90 días del
lanzamiento, con datos propios:

| Señal en GSC | Acción |
|---|---|
| Impresiones + clicks | Mantener y enriquecer. Subir prioridad |
| Impresiones sin clicks | Reescribir `title` y meta description — es problema de CTR, no de contenido |
| Indexada sin impresiones | Dejar. No molesta y puede activarse con estacionalidad |
| "Rastreada, actualmente sin indexar" | Señal de que Google la considera poco valiosa → enriquecer contenido o consolidar |
| Bloque grande sin indexar en una ciudad | Revisar si esa ciudad merece seguir en el grid |

**Ninguna poda se hace por hipótesis. Solo con datos propios de GSC.**

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

Una página de ciudad **no puede ser la de país con el nombre cambiado**. Los 10 requisitos
obligatorios están en **§4.3** — es la condición que hace viable la cobertura geo total.

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
| Esta misma, pero excluyendo ciudades por categoría | Se evaluó y los datos lo desmintieron: idiomas resultó la categoría con más demanda geo. Toda regla de exclusión a priori deja tráfico sobre la mesa (§4.1) |

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

> ✅ **APLICADA en producción el 2026-08-05** (rutas [item] unificadas + 301 en _redirects). Migración hecha con el sitio recién lanzado y 0 páginas indexadas en GSC — costo de equity nulo. Cualquier cambio futuro de URLs debe evaluarse con el tráfico ya consolidado y requiere plan de 301 + monitoreo de posiciones.

---

## 10. Checklist para agregar contenido nuevo

**Curso nuevo**
- [ ] Slug empieza por `curso-de-` y contiene la keyword real (validada en Keyword Planner)
- [ ] No colisiona con slug de ciudad ni palabra reservada
- [ ] Cumple los 10 requisitos de diferenciación geo (§4.3) — sin esto no se generan sus páginas de ciudad
- [ ] Se genera automáticamente para las 30 ciudades: no hay exclusiones por categoría

**Ciudad nueva**
- [ ] Población >500K o señal de demanda en GSC/Keyword Planner
- [ ] Slug sin acentos ni espacios, no empieza por `curso-de-`
- [ ] Agregada a `src/lib/countries.ts` — las rutas de sus 87 cursos se generan solas
- [ ] Testimonios locales asignados a esa ciudad (mínimo 1) para la diferenciación

**País nuevo**
- [ ] Código ISO de 2 letras, moneda, tasa de cambio, WhatsApp
- [ ] Alta en `COUNTRIES`; el hreflang se recalcula automáticamente
- [ ] Mínimo 3 ciudades para justificar la capa geo
