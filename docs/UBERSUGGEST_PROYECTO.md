# Proyecto Ubersuggest — sably.co

**Creado:** 2026-08-05 · **Cuenta:** innovamos.co@gmail.com (tier3)
**Project ID:** `b68cb9d427b695d3c888c14b0d357a006058f9347f2e94160d62bdcfbc7aa0d9`

---

## 1. Qué quedó configurado por API

| Elemento | Estado | Uso del plan |
|---|---|---|
| Keywords de tracking | **39 keywords** / 73 pares keyword×ubicación | 73 / 300 |
| Ubicaciones | **7** (4 países + 3 ciudades) | 7 / 100 |
| Competidores | **8 dominios** / 15 pares | **15 / 15 (tope)** |
| Frecuencia de actualización | Semanal | — |

### Ubicaciones activas

| Ubicación | loc_id | Por qué |
|---|---|---|
| Colombia | 2170 | Mercado principal |
| México | 2484 | Mayor volumen del catálogo (barbería 3.600, globos 14.800) |
| Perú | 2604 | Tercer mercado |
| España | 2724 | Solo head terms de alto volumen (soldadura 2.400, electricidad 2.900) |
| Bogotá | 1003659 | Geo real medido: inglés 1.300, cocina 720, barbería 480 |
| Medellín | 1003654 | Geo real: inglés 590, barbería 260 `LOW` |
| CDMX | 1010043 | Geo real: inglés 1.300, repostería 880, barbería 390 `LOW` |

> Chile, Argentina y Ecuador quedaron fuera del tracking inicial: sin keywords asignadas,
> la API no los conserva. Se agregan cuando GSC muestre impresiones desde esos países.

### Lógica de asignación de keywords

No todas las keywords se rastrean en todas las ubicaciones — eso desperdicia cupo. El criterio:

| Grupo | Ubicaciones | Ejemplos |
|---|---|---|
| **Head terms comerciales** | CO + MX (+PE si hay demanda) | curso de barbería · curso de uñas · curso de electricidad |
| **Transaccionales de conversión** | CO + MX | curso de barbería online con certificado · cursos online con certificado |
| **Head terms fuertes en España** | + ES | curso de soldadura · curso de electricidad · curso de repostería |
| **Geo hiperlocal** | Solo su ciudad | curso de barbería bogotá · curso de repostería cdmx |
| **Homologaciones** (solo CO) | CO | homologar curso de barbería · validación de saberes previos |
| **Marca** | CO + MX | sably · sably cursos |

### Competidores (15/15 — tope del plan)

| Dominio | Mercados | Por qué |
|---|---|---|
| aprende.com | CO, MX | Referente directo · **-86% tráfico en 24m** |
| platzi.com | CO, MX | DA 72 · **-85% en 24m** · fuerte en tech |
| crehana.com | CO, PE | Competidor regional |
| domestika.org | CO, MX | Marketplace creativo |
| hotmart.com | CO, MX | Nuestra propia plataforma de venta compite en SERP |
| udemy.com | CO, MX | Global, débil en local |
| **academiadebelleza.edu.co** | CO | 🔍 **Filial propia — monitoreo de canibalización** |
| **cursodeglobosonline.com** | MX, CO | 🔍 **Filial propia — monitoreo de canibalización** |

> Las dos filiales se rastrean **como competidores a propósito**: es el mecanismo para detectar
> canibalización mensual que exige `docs/ARQUITECTURA_URLS.md` §8. Si sably y una filial alternan
> posiciones en la misma query, hay que consolidar en el dominio dueño.

---

## 2. Pendiente de JP en la interfaz (no expuesto por la API)

La API de Ubersuggest es de **solo lectura** para estos ajustes. Son 4 toggles:

### 2.1 Pixel tracking y mobile → 2 clics

**Proyecto sably.co → ⚙️ Settings**

- [ ] **Pixel Rank Tracking** → ON *(hoy `false`)*
- [ ] **Mobile Rank Tracking** → ON *(hoy `false`; los otros proyectos ya lo tienen)*
- [ ] **Alerts** → ON *(hoy `false`; avisa de caídas de posición)*

### 2.2 AI Search Visibility (brand) → configurar desde cero

**Proyecto sably.co → AI Search Visibility → Set up brand**

Hoy `has_brand: false`. El plan tiene **20 tracked prompts** disponibles
(`2026_addon_trackedprompts`) sin usar. Configuración sugerida:

**Marca:** Sably · **Alias:** sably.co, Sably Cursos
**Competidores AISV:** aprende.com, platzi.com, crehana.com, domestika.org, hotmart.com

**Los 20 prompts a rastrear** (preguntas reales que la gente hace a ChatGPT/Gemini,
alineadas con nuestro catálogo y su intención de compra):

| # | Prompt | Intención |
|---|---|---|
| 1 | ¿Dónde puedo estudiar barbería online con certificado? | Transaccional |
| 2 | ¿Cuál es el mejor curso de uñas acrílicas online? | Comparativa |
| 3 | Mejores plataformas de cursos online en Colombia | Marca/categoría |
| 4 | ¿Qué oficio puedo aprender online para trabajar por mi cuenta? | Descubrimiento |
| 5 | Cursos online baratos con certificado en Latinoamérica | Transaccional |
| 6 | ¿Dónde aprender electricidad residencial online? | Transaccional |
| 7 | ¿Cómo puedo certificar mi experiencia si no tengo título? | Homologaciones |
| 8 | Cursos de repostería online que valgan la pena | Comparativa |
| 9 | ¿Qué habilidades no puede reemplazar la inteligencia artificial? | Posicionamiento de marca |
| 10 | Mejores cursos de decoración con globos en México | Filial globos |
| 11 | ¿Dónde estudiar peluquería canina online? | Transaccional |
| 12 | Cursos de cocina online con certificado en Colombia | Transaccional |
| 13 | ¿Vale la pena un curso de Hotmart? | Objeción/confianza |
| 14 | ¿Cómo emprender con un oficio desde casa? | Descubrimiento |
| 15 | Alternativas a Platzi para cursos de oficios | Competencia directa |
| 16 | ¿Dónde estudiar maquillaje profesional online? | Transaccional |
| 17 | Cursos de soldadura online certificados | Transaccional |
| 18 | ¿Qué es la validación de saberes previos en Colombia? | Homologaciones |
| 19 | Cursos online para aprender un oficio en México | Geo + categoría |
| 20 | ¿Cuánto cuesta un curso de barbería online? | Precio/conversión |

> Estos prompts están diseñados para medir si Sably aparece cuando alguien le pregunta a una IA
> por nuestros temas. Es el equivalente moderno de rastrear posiciones en Google — y hoy tenemos
> `llms.txt` y `llms-full.txt` publicados justamente para alimentar esas respuestas.

---

## 3. Auditoría del sitio

Lanzada el 2026-08-05 sobre las 4.415 páginas (`site_audit`, límite 500 en esa corrida).
Consultar resultados con `site_audit_status` / `site_audit_results`.

## 4. Ritmo de revisión sugerido

| Cadencia | Qué revisar |
|---|---|
| **Semanal** | `project_position_info` — posiciones de las 39 keywords |
| **Mensual** | Canibalización: ¿sably y una filial alternan en la misma query? |
| **Mensual** | `brand_visibility_overview` — visibilidad en IA vs competidores |
| **Trimestral** | Rotar keywords de bajo rendimiento; quedan 227 slots libres de 300 |
