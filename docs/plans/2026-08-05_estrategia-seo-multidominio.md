# Estrategia SEO Multi-Dominio y Geo-Posicionamiento — Fase 1 (Investigación)

**Fecha:** 2026-08-05 · **Fuente de datos:** Google Ads API (Keyword Planner), cuenta 816-164-1862, CPCs en COP.
**Datasets:** `docs/data/auditoria-cursos-co.json` (87 cursos), `filiales-{co,mx,es}.json`, `mercado-es.json`, `expansion-nuevas-categorias-co.json`, `keywords-co.json` (3.186 kw).

---

## 1. Auditoría del catálogo actual (87 cursos, Colombia)

| Veredicto | Cursos | Lectura |
|---|---|---|
| **MANTENER** (≥500/mes) | 8 | inglés 9.900 · excel 5.400 · primeros auxilios 1.600 · electricista 880 · contabilidad/francés/portugués/rep. celulares 590 |
| **OPTIMIZAR** (100–499) | 19 | carpintería, fotografía, guitarra, tatuaje, barista, globos, modistería… |
| **LONG-TAIL** (<100) | 59 | La cola larga es deliberada: competencia LOW casi en pleno y suma volumen agregado + conversión geo |

**Insight clave:** el catálogo tiene pocos head terms porque los de mayor volumen (barbería 1.300, uñas 1.300, maquillaje 1.000) están **reservados a la filial de belleza**. Ver §3 para revertir esto con splitting.

## 2. España (nuevo mercado del prompt maestro)

Volúmenes sólidos pero **competencia HIGH en todo**: inglés 5.400, electricidad 2.900, soldadura 2.400, excel 1.900, primeros auxilios/fotografía 1.300. **Decisión:** España entra en Fase 2 vía long-tail + geo-páginas (Madrid, Barcelona, Valencia, Sevilla, Málaga, Bilbao), nunca por head terms. LATAM sigue siendo la playa de aterrizaje.

## 3. Multi-dominio: ¿deben competir sably.co, academiadebelleza, cursodeglobosonline y terapiadpareja? → **SÍ, con splitting**

Google muestra máx. ~2 resultados por dominio en page 1. Dominios propios adicionales son **la única vía** a 3+ posiciones. Pero la regla de oro es **keyword splitting, no clashing**: si dos dominios propios atacan el mismo head term con landings transaccionales equivalentes, Google elige uno y ahoga al otro.

### Matriz de asignación por cluster

| Cluster | Head term (dueño) | Variante online/certificado | Variante GEO ciudad | Informacional (blog) |
|---|---|---|---|---|
| Belleza (uñas, barbería, maquillaje…) | **academiadebelleza.edu.co** (autoridad + .edu.co + historial GSC) | **sably.co** ("curso de uñas online con certificado") | **sably.co** ("curso de uñas en Bucaramanga") | academiadebelleza (ya rankea informacionales) |
| Globos/decoración | **cursodeglobosonline.com** (EMD) | sably.co | sably.co | cursodeglobosonline.com |
| Terapia de pareja/relaciones | **terapiadpareja.com** (EMD) | terapiadpareja.com (sably NO publica este vertical: ver nota Ads) | terapiadpareja.com | terapiadpareja.com |
| Resto del catálogo (oficios, idiomas, música…) | **sably.co** | sably.co | sably.co | blog sably |

**Reglas anti-canibalización (obligatorias):**
1. Contenido 100% único por dominio — el mismo curso reescrito con ángulo distinto (filial = especialista/profundidad; sably = marketplace/comparativo/geo). Jamás parafrasear.
2. Title/H1 diferenciados por variante del cluster (head vs "online con certificado" vs ciudad).
3. Enlazado: filial → sably dofollow editorial; sably → filial contextual selectivo; **filial ↔ filial nunca**.
4. Canonical siempre self, nunca cruzado.
5. Monitoreo mensual GSC: misma query con URLs propias alternando posiciones = señal de clashing → consolidar en el dominio dueño + 301.

**Acción concreta derivada:** los **18 cursos de belleza curados** (hoy en reserva) SÍ se publican en sably.co, pero con slugs/títulos de variante: `curso-de-unas-acrilicas-online-certificado` estilo "online + certificado" y las geo-páginas ciudad — dejando los head terms limpios para academiadebelleza.

### Datos de las filiales (validación)

| Keyword | CO | MX | ES | Lectura |
|---|---|---|---|---|
| decoración con globos | 2.400 MEDIUM | **14.800 MEDIUM** | 1.000 HIGH | 🔥 cursodeglobosonline.com debe priorizar **México** |
| curso de decoración con globos | 260 LOW | 590 LOW | 90 | Transaccional viable en MX/CO |
| curso de barbería | 1.300 LOW | 3.600 LOW | 880 MEDIUM | Belleza: MX es el doble que CO |
| curso de maquillaje | 1.000 MEDIUM | 1.600 LOW | 1.000 HIGH | Ídem |
| terapia de pareja / online | **0 (bloqueado)** | 0 | 0 | Google **restringe la categoría en Ads** (dificultades personales): terapiadpareja.com es jugada 100% SEO-contenido, sin pauta search. Presupuesto de Ads → globos/belleza |

## 4. Arquitectura de URLs — evaluación de las 3 opciones

| Criterio (peso) | A `/{cc}/{ciudad}/curso/{slug}` | B `/cursos/{país}/{ciudad}/{slug}` | C `/{cc}/{ciudad}/cursos/{slug}` |
|---|---|---|---|
| SEO geo-local (30%) | 9 — geo al inicio, patrón país ISO estándar hreflang | 7 — geo enterrado tras /cursos/ | 9 |
| Keyword en URL (20%) | 9 — slug contiene "curso-de-{kw}" | 8 | 6 — pierde "curso" en el slug |
| Escalabilidad (15%) | 9 — ya probado con 3.684 págs | 8 | 8 |
| Profundidad (15%) | 8 — 4 niveles | 7 — 4-5 niveles | 8 |
| UX/Legibilidad (10%) | 8 | 9 — país en palabra completa | 7 |
| Implementación (10%) | **10 — ya está en producción** | 3 — migración con 301 masivos | 4 — migración |
| **Total ponderado** | **8,9** | 7,1 | 7,4 |

**Veredicto: mantener la Opción A** (la actual). Migrar ahora destruiría el crawl equity inicial sin ganancia. Únicos añadidos pendientes de la jerarquía del prompt: ya existen todos los niveles (raíz, categoría, país, categoría+país, ciudad, categoría+ciudad, curso+país, curso+ciudad) ✓.

## 5. Expansión del catálogo — candidatos validados con datos

**Nuevas categorías (tech/profesional) — CO:** programación 1.300 HIGH · IA 1.000 HIGH · diseño gráfico 880 HIGH · python 880 HIGH · atención al cliente 480 MEDIUM · RRHH 260 HIGH · gestión de proyectos 210 HIGH · cejas 170 LOW · aux. contable 140 MEDIUM · drywall 110 LOW.

**Recomendación de 50 nuevos (en 3 tandas):**
1. **Tanda 1 (15) — LOW/MEDIUM primero:** atención al cliente, cejas (diseño/laminado como variante online), aux. contable, drywall, depilación láser, uñas semipermanentes*, lifting de pestañas*, alisados*, manicure rusa* (*variantes online-certificado según matriz §3), cerrajería, tapicería, vidriería, motocarros/mototaxis, lavado de muebles, instalación de pisos.
2. **Tanda 2 (20) — tech con ángulo oficio-digital:** programación desde cero, python, IA práctica para negocios, diseño gráfico, edición de video, TikTok para negocios, YouTube, podcast, Canva, WordPress, Shopify/dropshipping, trafficker digital, copywriting, UGC creator, community manager avanzado, fotografía de producto, ilustración digital, animación, no-code, ciberseguridad básica.
3. **Tanda 3 (15) — profesional/certificaciones:** RRHH, gestión de proyectos, asistente administrativo, servicio al cliente call center, mercadeo, logística, seguridad y salud en el trabajo (SG-SST — enorme en CO, validar), manipulación de alimentos (validar — alto volumen CO), inglés para trabajo, ofimática, secretariado, ventas B2B, liderazgo, oratoria, negociación.

Cada tanda pasa por el pipeline probado: validación Keyword Planner → curación → workflow de redacción → QA determinístico.

## 6. Priorización de ciudades (escala progresiva)

Ya en producción: 30 ciudades × 87 cursos. El prompt maestro añade: CO (Cúcuta, Pereira), PE (Chiclayo, Piura, Huancayo), MX (Tijuana, León, Mérida), EC (Ambato, Manta, Sto. Domingo), CL (Temuco, Antofagasta), AR (Tucumán, Mar del Plata), ES (6 ciudades). **Regla del prompt respetada: medir 90 días antes de escalar.** GSC dirá qué ciudades generan impresiones; se agregan solo las que muestren demanda + las nuevas de CO (Cúcuta/Pereira) que por población ya se justifican.

## 7. Próximos pasos (Fase 2 del prompt maestro)

1. JP conecta dominio sably.co → enviar sitemap GSC → baseline de indexación.
2. Publicar los 18 de belleza en sably con splitting (§3) — requiere re-redacción con ángulo variante.
3. Filial cursodeglobosonline.com: replantilla Astro (reutiliza design system con tema propio), 10 artículos + landings, foco MX.
4. Filial terapiadpareja.com: contenido editorial SEO (sin Ads — categoría restringida).
5. Tanda 1 de expansión (15 cursos LOW/MEDIUM).
6. Monitoreo mensual de canibalización en GSC.
