# Contenido de fichas de curso · método (25-nov-2026)

Un archivo por curso en `contenido/cursos/<slug>.json`: **un texto base** y, por país, solo lo que cambia de verdad
(nombre del país, vocabulario medido, `<title>` y meta description). Nada de ocho textos parafraseados.
`scripts/contenido-cursos.mjs` lo valida, lo convierte al formato del CMS y lo carga con copia de seguridad.

## Fuentes de hechos (y solo estas)

1. **Descripción oficial del producto en Hotmart** («¿Qué vas a lograr?»): `sably.co/docs/equipo/2026-11-25/contenido/fuentes-hotmart/<slug>.txt`
   (checkout público, 25-nov). Todo lo que el texto presente como *contenido del curso* tiene que estar ahí o deducirse
   sin duda de ahí. Garantía: 7 días (medido en los 20). Creador: MasterClasses.La (Seminarios Online).
2. **Horas** (`durationHours` del `.mdx`/CMS): se citan como «unas N horas de video» (no cotejadas en Hotmart). **No** se
   da número de lecciones (en 21 cursos no cuadra con el temario).
3. **Conocimiento general del oficio** que cualquier profesional confirmaría, siempre como consejo («en el oficio…»,
   «conviene…»), nunca atribuido al curso.
4. **No es fuente:** el temario del `.mdx` (parte se redactó sin copiar de Hotmart), las variantes de país de agosto, los
   nombres de instructor (relleno), cifras de mercado o de ingresos.

## Palabras clave

- `sably.co/docs/equipo/2026-11-25/seo/datos/clusteres.csv`, filtrado por `slug`: `principal` va en H1, title, primer
  párrafo y 1–2 veces más; cada `variación` una vez donde encaje sola; las `complementarias` (preguntas, términos de
  guía) como subtítulo o pregunta frecuente, nunca en serie. Prohibido «mucha gente busca…» y frases para meter la palabra.
- `seo/canibalizacion.md`: lo que es de otra ficha no va en title/H1 (ej. C07: «relajante» es de masajes terapéuticos;
  C06: «reductor» es de masaje reductor; C01: «curso de uñas» es de curso-de-unas). Se enlaza a la ficha dueña con ancla
  descriptiva.
- `seo/datos/faq-nuevas.csv` (PAA reales por país) y `seo/datos/titulos-por-pais.csv` (H1 y vocabulario por país).

## Qué se escribe por curso

| Campo | Regla |
|---|---|
| `h1` | «{principal} online en {pais}», ≤ 70 |
| `subtitulo` | una frase: qué sabrás hacer, con verbos del oficio; sin ingresos |
| `beneficios` (Qué aprenderás) | 6 viñetas ≤ 12 palabras, de la lista de Hotmart, cada una empieza distinto; también van a `learning_items` del curso (`teaches` del JSON-LD) |
| `para_quien` | 4; la última dice para quién **no** es |
| `requisitos` (Qué necesitas) | 4; materiales reales del oficio |
| `cuerpo` | 400–600 palabras en markdown, `##` subtítulos propios del oficio, enlaces internos `[ancla](/{cc}/…/)` |
| `faqs` | 6–7, respuesta directa de 40–70 palabras; una «¿El curso de X da certificado?» que responde **constancia** (avalada por Hotmart y Seminarios Online; no es título oficial); sin medios de pago ni importes (la plantilla añade la de pago con datos verificados); **obligatoria** la de compra «¿El curso de X es gratis o tiene mensualidades?» con pago único, acceso por correo sin fecha de vencimiento y reembolso en 7 días (no se quita ninguna respuesta de compra que la ficha dé hoy) |
| `paises.<cc>` | `meta_title` 30–60 distinto por país, `meta_description` 130–158 con la moneda; `vocabulario` para huecos `{computador}`, `{tapabocas}`… |
| `base.curso` | `short_description` ≤ 158 y `meta_title` del curso (sin «certificado») |
| `fuentes`, `dudas` | de dónde sale cada hecho y qué no cuadra (temario frente a Hotmart, etc.) |

Vocabulario por país comprobado: CO «computador», MX «computadora»; CO «tapabocas», MX «cubrebocas»; «destornilladores
(desarmadores)» cuando el texto es neutro.

## Reglas de JP y de estilo

«Constancia», nunca «certificado» (solo dentro de la pregunta que capta esa búsqueda). «Creador», nunca «productor» ni
«afiliado». Nada inventado. Sin urgencia ni promesas de dinero o de resultados en el cuerpo o la salud. Estilo de la
skill `humanizar-es`: de tú, dato antes que adjetivo, sin «no solo… sino», sin cierres de moraleja, sin tríos, sin guion
largo, sin vocabulario de folleto. Sin orden de lecciones que Hotmart no da («primero…, después…»).
El validador (`node scripts/contenido-cursos.mjs validar`) comprueba largos, frases vetadas, instructores de relleno,
viñetas y densidad de la principal; la revisión adversaria (subagente) busca lo que el validador no ve.

## Países sin variante

Si `course_locales/<slug>--<cc>` no existe, ese país pinta la ficha con el documento del curso (cabecera
`X-Sably-Locale-Source: emdash-generic`). El guion escribe siempre en el curso una versión neutra (sin enlaces; la plantilla le suma cuatro preguntas fijas) y salta con aviso las variantes que no existen.
`"variantes": false` marca un curso sin ninguna variante.

## Carga

```bash
node scripts/contenido-cursos.mjs validar
node scripts/contenido-cursos.mjs cargar --url https://dev.sably.co --cursos a,b --paises co,mx            # simulación
node scripts/contenido-cursos.mjs cargar --url https://dev.sably.co --cursos a,b --paises co,mx --aplicar  # escribe
node scripts/contenido-cursos.mjs revertir --url https://dev.sably.co --respaldo contenido/respaldos/<host>/<sello> --aplicar
```

Cada carga deja en `contenido/respaldos/<host>/<sello>/` el documento entero de antes (con `_rev`) y `registro.json`
con qué cambió. Es idempotente: si el CMS ya tiene esos campos, no escribe. Necesita sesión de la CLI de EmDash en ese
host (`npx emdash whoami --url …`).
