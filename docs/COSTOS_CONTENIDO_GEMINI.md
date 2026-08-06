# Costo real de generar el contenido SEO con Gemini API

> **Medido, no estimado**: el piloto generó 3 páginas reales con la API
> (2026-08-06), registró los tokens exactos de `usageMetadata` y validó el
> resultado contra el checklist SEO. Script: `scripts/generar-contenido.py` ·
> muestras: `docs/data/pilotos/`.

---

## 1. Precios verificados (2026-08-06)

Contrastados contra `ai.google.dev/gemini-api/docs/pricing`. Los del prompt
eran correctos salvo un matiz: 3.5 Flash cobra $9,00 el output, así que el
"Flash" del plan debe ser **3.6 Flash**, que mantiene $7,50 y es más nuevo.

| Modelo (ID real) | Input /1M | Output /1M | Batch (−50%) | Uso |
|---|---|---|---|---|
| `gemini-3.1-flash-lite` | $0,25 | $1,50 | $0,125 / $0,75 | Secciones template |
| `gemini-3.6-flash` | $1,50 | $7,50 | $0,75 / $3,75 | Contenido creativo + SEO |
| `gemini-3.1-pro-preview` | $2,00 | $12,00 | $1,00 / $6,00 | Solo blog largo |

Los 5 modelos del plan existen y responden con esta key (verificado contra
`ListModels`). Context caching: $0,15/1M en 3.6 Flash (~90% de descuento sobre
el input cacheado) — relevante solo si el system prompt creciera mucho; con el
actual (~250 tokens) no mueve la aguja.

---

## 2. Lo que midió el piloto

| Página generada | Llamadas | Tokens in/out | Costo | Batch |
|---|---|---|---|---|
| Globoflexia × MX (página país completa) | Flash + Flash-Lite | 717 / 1.813 | **$0,0119** | $0,0059 |
| Globoflexia × CO (ángulo distinto) | Flash + Flash-Lite | 719 / 1.728 | **$0,0114** | $0,0057 |
| Barbería × CO × Medellín (país + bloque local) | 2× Flash + Flash-Lite | 1.131 / 2.538 | **$0,0176** | $0,0088 |
| Solo el bloque ciudad (contexto + FAQs geo) | Flash | 371 / 603 | **$0,0051** | $0,0025 |

Cada página país incluye: meta title/description, H1, subtítulo, descripción
de ~450-500 palabras en markdown, 8 FAQs con pagos locales, 6 beneficios,
para quién, requisitos, certificado y garantía.

### Calidad medida, no supuesta

- **Similitud MX vs CO: 7% en la descripción, 8% en FAQs** (el umbral
  anti-doorway era <60%). No son la misma página con el país cambiado: el
  ángulo "emprendimiento" produjo una página de negocio y el ángulo "hobby"
  una de tiempo libre.
- Las FAQs localizan de verdad: SPEI y OXXO en MX, cupón y PSE en CO,
  y el trato peninsular se activa para ES.
- El contexto de Medellín nombra Manrique, Aranjuez, Belén, Laureles y
  El Poblado **sin inventar una sola cifra** — la instrucción "si no hay dato,
  omite la afirmación" funcionó.
- Cero frases de la lista negra de IA en las 3 páginas.

### El factor de regeneración es real

2 de 3 páginas fallaron la primera validación por descripción corta (426 y
432 palabras contra 450 de mínimo). El modelo se queda ~15% corto de lo
pedido: la corrección es pedir 600-800 para obtener 500-700, pero el
presupuesto igualmente debe asumir **+30% de regeneraciones** en la sección
creativa hasta calibrar el prompt.

---

## 3. Escenarios con el inventario real

El inventario del prompt (~570-640 páginas) asumía ~25-30 cursos. El repo
real: **121 cursos, 8 países, 36 ciudades, 13 categorías** — 5.918 URLs ya
construidas. Lo que falta no es crear páginas: es darles contenido propio.

### Escenario A — El plan anti-doorway (recomendado)

Es la Fase 2-4 de `GESTION_CATALOGO_BACKEND.md`: diferenciar lo que existe,
no multiplicarlo.

| Bloque | Unidades | Costo unit. medido | Estándar | Batch |
|---|---|---|---|---|
| Variante país por curso (121 × 8) | 968 | $0,0116 | $11,23 | $5,62 |
| Bloques ciudad con demanda (top 20 × ~10) | 200 | $0,0051 | $1,02 | $0,51 |
| Categorías × país (13 × 8) | 104 | ~$0,007 | $0,73 | $0,36 |
| Landing Ads (cursos top) | 30 | $0,0119 | $0,36 | $0,18 |
| Blog (Pro, ~5K tokens out) | 25 | $0,064 | $1,60 | $0,80 |
| **Subtotal** | **1.327** | | **$14,94** | **$7,47** |
| Regeneraciones (+30% del tramo creativo) | | | +$3,60 | +$1,80 |
| **TOTAL** | | | **≈ $18,50** | **≈ $9,30** |

### Escenario B — El inventario del prompt (globos + arranque)

~610 páginas (200 país + 175 ciudad + 180 categoría + 30 ads + 25 blog) con
los costos medidos: **$8,60 estándar · $4,30 batch** (+regen ≈ $11 / $5,60).
El prompt estimaba $8-15: la medición lo confirma y lo baja.

### Escenario C — Techo absoluto (referencia, no recomendado)

Las 4.356 páginas curso × ciudad completas: 4.356 × $0,0176 ≈ **$77** ($38
batch). Es barato en dólares y carísimo en riesgo: sin datos locales reales
por ciudad se vuelve exactamente el doorway a escala que el sitio ya sufre.
El límite no es el presupuesto, es la regla de las 250 palabras propias.

### Comparativa

| Alternativa | Costo del Escenario A |
|---|---|
| Copywriter ($3-5/página × 1.327) | $4.000 – $6.600 |
| Agencia | $5.000 – $10.000+ |
| **Gemini API (batch)** | **≈ $9,30** |

Recurrente: regenerar 20 páginas/mes ≈ $0,25 · curso nuevo (8 países + 2
ciudades) ≈ $0,10 · artículo semanal de blog ≈ $0,26/mes.

---

## 4. Ajustes al plan original (importantes)

1. **Testimonios: NO se generan con IA.** El plan los marcaba como generables
   "con nombres y contextos plausibles" — eso es fabricar reseñas falsas:
   viola la política de spam de Google (fake reviews), es sancionable como
   práctica comercial engañosa, y el `AggregateRating` del schema quedaría
   respaldado por reseñas inventadas justo cuando el sitio ya está en zona de
   riesgo por doorway pages. **Hotmart tiene valoraciones reales de
   compradores de estos mismos productos: importar esas.** El pipeline las
   trata como dato fijo (❌ NO generar), igual que el precio.

2. **"Flash" = `gemini-3.6-flash`**, no 3.5 (mismo input, output 17% más
   barato, modelo más reciente).

3. **Pedir 600-800 palabras para obtener 500-700** — el modelo entrega ~15%
   menos de lo pedido, medido en 2 de 3 pilotos.

4. **Los "skills" del §8 no existen como herramientas invocables aquí**: sus
   reglas (anti-IA, humanización) van embebidas en el system prompt del
   script, que ya pasó la validación de frases-firma con cero incidencias.

5. **Batch API**: el −50% es real pero asíncrono (hasta 24 h de espera). Para
   la generación masiva inicial es perfecto; para regenerar una página suelta
   desde Filament, usar la API estándar ($0,01 la página — irrelevante).

---

## 5. Cómo se ejecuta

**Hoy (sin backend)** — el script ya existe y es el mismo del piloto:

```bash
python3 scripts/generar-contenido.py --curso curso-de-globoflexia --pais mx
python3 scripts/generar-contenido.py --curso curso-de-barberia --pais co --ciudad medellin
```

Genera el JSON estructurado (responseSchema, sin parsing frágil), valida el
checklist SEO (longitudes, keyword en primeras 100 palabras, densidad ≤3%,
frases de IA, similitud <30% contra el contenido existente) y registra
tokens + costo por página en `docs/data/pilotos/`.

**Con el backend Laravel** — el pipeline del prompt (§7) encaja tal cual con
la arquitectura de `GESTION_CATALOGO_BACKEND.md`, con tres candados que ya
quedaron definidos allí y aquí se confirman:

- El job de generación **aborta si no hay ≥3 fuentes de datos locales reales**
  (el modelo redacta sobre datos, no los inventa — el piloto demuestra que
  obedece).
- Todo sale a **`review`, nunca a `published`**: el observer de las 250
  palabras propias es quien decide si la URL existe.
- Los tokens de cada llamada se guardan con el contenido (`medidas` en el
  JSON): el dashboard de costos del §7 sale gratis de ahí.

---

## Resumen ejecutivo

| Pregunta | Respuesta medida |
|---|---|
| ¿Cuánto cuesta una página país completa? | **$0,012** ($0,006 batch) |
| ¿Y el bloque de diferenciación por ciudad? | **$0,005** ($0,0025 batch) |
| ¿Todo el plan anti-doorway de Sably (1.327 piezas)? | **≈ $18,50** (≈ $9,30 batch) |
| ¿El inventario del prompt (~610 págs)? | ≈ $11 (≈ $5,60 batch) |
| ¿Se distinguen las variantes entre países? | Sí: 7% de similitud medida |
| ¿Inventa datos locales? | No en el piloto (instrucción de omisión funciona) |
| ¿Qué NO se genera? | Testimonios — se importan los reales de Hotmart |
| ¿Cuál es el cuello de botella? | No el costo: los datos locales reales por ciudad |
