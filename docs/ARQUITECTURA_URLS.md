# Arquitectura de URLs — Ecosistema Sably

> **Documento base.** Define cómo se construye toda URL del sitio y por qué.
> Cualquier ruta nueva (curso, ciudad, país, categoría, filial) debe seguir estas reglas.
>
> **Última revisión:** 2026-08-05 · **Estado:** vigente

---

## 1. Los tres principios

1. **País en código ISO como primer segmento** → hreflang limpio y patrón que Google ya asocia a segmentación geográfica.
2. **Ciudad solo donde Keyword Planner confirma demanda** → una URL por búsqueda que existe, no por combinación posible. Verificado, nunca supuesto (§4).
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
sably.co/co/curso-de-unas-acrilicas/               Curso (país)
sably.co/co/bogota/                                Landing ciudad
sably.co/co/bogota/cursos/oficios/                 Categoría en ciudad
sably.co/co/bogota/curso-de-barberia/              ✅ 480/mes · LOW → prioridad alta
sably.co/co/bogota/curso-de-ingles/                ✅ 1.300/mes · HIGH → prioridad media
sably.co/co/medellin/curso-de-barberia/            ✅ 260/mes · LOW
sably.co/co/bucaramanga/curso-de-ingles/           ✅ 480/mes
sably.co/co/bucaramanga/curso-de-unas-acrilicas/   ❌ NO se genera — 0 búsquedas/mes
```

Ciudades: `bogota` · `medellin` · `cali` · `barranquilla` · `cartagena` · `bucaramanga`

### 🇲🇽 México — `mx` · MXN · 5 ciudades

```
sably.co/mx/
sably.co/mx/cursos/manualidades/
sably.co/mx/curso-de-decoracion-con-globos/
sably.co/mx/cdmx/
sably.co/mx/cdmx/curso-de-decoracion-con-globos/   ✅ "decoración con globos" 14.800/mes en MX
sably.co/mx/cdmx/curso-de-barberia/                ✅ 390/mes · LOW → prioridad alta
sably.co/mx/cdmx/curso-de-ingles/                  ✅ 1.300/mes · HIGH
sably.co/mx/cdmx/curso-de-reposteria/              ✅ 880/mes
sably.co/mx/monterrey/cursos/gastronomia/
```

Ciudades: `cdmx` · `guadalajara` · `monterrey` · `puebla` · `cancun`

### 🇵🇪 Perú — `pe` · PEN · 4 ciudades

```
sably.co/pe/
sably.co/pe/cursos/belleza/
sably.co/pe/curso-de-unas-acrilicas/
sably.co/pe/lima/
sably.co/pe/lima/curso-de-unas-acrilicas/          ✅ Lima = metrópolis → todas las categorías
sably.co/pe/lima/curso-de-ingles/                  ✅
sably.co/pe/arequipa/cursos/gastronomia/
sably.co/pe/arequipa/curso-de-python/              ❌ validar antes: ciudad media + categoría digital
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

> **Corregido 2026-08-05 con datos de Keyword Planner.** La hipótesis inicial ("solo oficios
> físicos tienen intención local") resultó **falsa**. El eje predictivo real es el **tamaño de
> la ciudad**, no la categoría del curso.

### 4.1 Lo que muestran los datos

| Ciudad | inglés | cocina/repostería | barbería | guitarra | excel | uñas |
|---|---|---|---|---|---|---|
| **Bogotá** | **1.300** | 720 | 480 `LOW` | 210 | 110 | — |
| **CDMX** | **1.300** | 880 | 390 `LOW` | 260 | 70 | — |
| Medellín | 590 | — | 260 `LOW` | — | — | — |
| Bucaramanga | 480 | 170 `LOW` | 70 | — | 90 | **0** |
| Cartagena | 260 | — | 20 | — | — | **0** |

Búsquedas/mes, Google Ads Keyword Planner.

Tres conclusiones que invierten el modelo anterior:

1. **Idiomas es la categoría con MÁS demanda geo**, no la que menos. "curso de inglés bogotá"
   (1.300) y "curso de inglés cdmx" (1.300) superan a cualquier oficio físico. Excluirla habría
   sido el error más caro.
2. **Hasta Excel tiene volumen geo** en metrópolis (110 en Bogotá, 90 en Bucaramanga).
3. **Uñas — categoría "de servicio local" por excelencia — da 0 en ciudades secundarias.**
   La categoría no predice; el tamaño de la ciudad sí.

### 4.2 Modelo corregido: la ciudad manda

| Nivel de ciudad | Ejemplos | Qué se genera |
|---|---|---|
| **Metrópolis** | Bogotá, CDMX, Lima, Buenos Aires, Santiago, Guadalajara, Medellín, Monterrey | **Todas** las categorías, incluidas idiomas, música y tecnología |
| **Ciudad media** | Bucaramanga, Cartagena, Cali, Barranquilla, Arequipa, Puebla, Cancún… | Solo categorías con volumen verificado para esa ciudad (§4.3) |
| **Ciudad pequeña** | El resto | Solo landing de ciudad. Sin páginas curso×ciudad |

### 4.3 Regla operativa (data-driven, sin adivinar)

Una página `{ciudad}/{curso}` se genera **solo si Keyword Planner reporta ≥50 búsquedas/mes**
para la combinación categoría×ciudad. Validación batch antes de cada expansión:

```bash
python3 scripts/seo-audit.py --country CO \
  --seeds "curso de {categoria} {ciudad}" ... \
  --out docs/data/geo-{cc}.json
```

12 categorías × ciudades del país ≈ 3-4 llamadas por país. Barato y elimina el juicio subjetivo.

### 4.4 Volumen ≠ oportunidad: cruzar con competencia

`curso de inglés bogotá` tiene 1.300/mes pero competencia **HIGH** — academias presenciales con
años de autoridad. `curso de barbería bogotá` tiene 480 con competencia **LOW**.

**Prioridad de publicación:**

| Prioridad | Perfil | Ejemplos medidos |
|---|---|---|
| 🔴 Alta | Volumen ≥150 + competencia LOW | barbería Bogotá 480 · barbería CDMX 390 · barbería Medellín 260 · cocina Bucaramanga 170 |
| 🟡 Media | Volumen ≥500 + competencia HIGH | inglés Bogotá 1.300 · inglés CDMX 1.300 · repostería CDMX 880 · cocina Bogotá 720 |
| ⚪ Baja | Volumen 50-150 | excel Bogotá 110 · panadería Bogotá 170 |
| ❌ No generar | <50 o sin datos | uñas Bucaramanga 0 · uñas Cartagena 0 · barbería Cartagena 20 |

Las de prioridad alta se atacan primero: mismo esfuerzo, mucha más probabilidad de rankear.

### 4.5 Nota sobre intención presencial

Parte del volumen geo busca formación **presencial** ("cursos de inglés presenciales bogotá" 140,
"escuelas de inglés cdmx" 1.900). En Bogotá medimos ~6.600 búsquedas/mes con intención presencial
explícita frente a ~9.700 neutras.

No se compite por las presenciales. El copy de las páginas de ciudad debe convertir la intención
neutra dejando claro el formato desde el título: *"Curso de Barbería en Bogotá — 100% online,
certificado válido en Colombia"*. Y aquí `/homologaciones/` captura al segmento que sí quiere
presencialidad: se les ofrece certificar su experiencia con instituciones aliadas.

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
| Esta misma, pero con geo indiscriminado (todo curso × toda ciudad) | Estructura correcta, pero cientos de páginas sin ninguna búsqueda detrás ("curso de uñas bucaramanga" = 0/mes) = riesgo de thin content |

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
