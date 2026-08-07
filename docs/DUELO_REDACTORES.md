# ¿Gemini o Claude para el contenido SEO?

> Duelo a ciegas sobre las mismas 3 páginas, juzgado por 4 evaluadores
> independientes con criterios distintos. 2026-08-06.
> Muestras en `/tmp/duelo`, veredictos completos en el transcript del workflow.

---

## Montaje

Tres páginas —barbería×México (ángulo pasatiempo), peluquería×España
(emprendimiento), globoflexia×Argentina (carrera)— redactadas por Gemini 3.6
Flash y por Claude con **los mismos datos, el mismo ángulo y el mismo brief**.
Se anonimizaron como A/B y las juzgaron cuatro agentes: naturalidad, eficacia
SEO, conversión y rigor factual.

> **Falla de método, declarada**: la etiqueta debía sortearse por par, pero mi
> hash asignó Claude = B en los tres. Un juez lo detectó solo («los tres
> archivos B comparten una huella estilística inconfundible»). Los jueces
> puntuaron cada par por separado y con razones concretas, así que el resultado
> se sostiene, pero el ciego fue más débil de lo previsto.

## Resultado

| Par | Gemini | Claude |
|---|---|---|
| Barbería × MX | 3,8 · 4,0 · 5,0 | **8,5 · 8,5 · 7,5** |
| Peluquería × ES | 4,5 · 5,0 · 5,5 | **7,8 · 8,0 · 6,5** |
| Globoflexia × AR | 3,5 · 4,0 · 5,5 | **8,4 · 8,0 · 5,5** (empate en rigor) |

Claude gana los tres pares. **Pero el margen se desploma en el criterio de
rigor** (7,5 / 6,5 / empate), y ahí está la lección real.

### La prueba que mejor separa a los dos

Un juez la formuló así: cambia «globos» por «catering» en el texto de Gemini y
**sigue funcionando entero**. Cambia «peluquería» por «uñas» y tampoco se rompe.
Ninguno de los tres textos de Claude sobrevive a esa sustitución — que es
exactamente lo que se pedía.

### Dónde falla cada uno

**Gemini escribe como quien leyó sobre el oficio.**
- Relleno vetado que reincide: «adquieres las competencias técnicas
  necesarias», «El sector del cuidado personal no se detiene».
- **Palabras inexistentes en la lista de materiales**: pide comprar «bocios»
  (bocio es una enfermedad de la tiroides; el utensilio es un cepillo de cuello)
  y «un bledo». Se publicó así.
- **Cero voseo en Argentina**: ni una sola forma de podés/tenés en todo el
  archivo. La localización era decorativa.
- Esquiva las preguntas incómodas y no pone techo a las expectativas.

**Claude escribe mejor y fabrica más.**
- **Inventa la biografía de instructores reales**: «Carolina Restrepo, que lleva
  quince años detrás del sillón y tres abriendo locales» — el dato no existe en
  la ficha.
- Inventa prueba social: «Es la lección que más se repite entre los alumnos».
- Convierte moneda por su cuenta: «¿Los 59 euros…?» cuando el precio es USD 59.
- Duplica lo que la plantilla ya muestra: recorre el temario módulo a módulo.

El veredicto del panel, literal: *«A no se arregla editando: habría que
reescribirlo»*. De Claude, en cambio: *«con esas cuatro correcciones queda en 9;
sin ellas es texto bueno con pasivos legales y de credibilidad»*.

---

## Decisión: Gemini, con el prompt reescrito a partir del duelo

**No hay clave de API de Anthropic en el proyecto.** Usar Claude a escala
significaría generarlo dentro de una sesión de chat: ni reproducible para el
backend, ni paralelizable, ni medible. Así que la pregunta práctica no era
«¿quién escribe mejor?» sino «¿se puede llevar a Gemini a donde escribe Claude?».

Se puede, en buena parte, porque **casi todo lo que separaba a los dos era
instrucción ausente, no capacidad del modelo**. Lo que se portó al prompt:

| Patrón que ganó | Ahora en el prompt |
|---|---|
| Abrir por el problema concreto, no por el sector | Regla explícita con ejemplo |
| Nombrar dónde se atora la gente | Regla explícita |
| Beneficios como verbos ejecutables | Regla explícita |
| Responder de frente lo incómodo | Regla explícita |
| Una anti-promesa por página | Regla explícita |
| Registro local sostenido | Tabla `REGISTRO` por país |

Y lo que perdió Claude se convirtió en prohibiciones duras: nada de biografías
del instructor, prueba social, cifras de mercado ni plazos de retorno que no
estén en el contexto.

### Medido, antes y después

| | Prompt viejo | Prompt nuevo |
|---|---|---|
| Voseo en Argentina | 0 formas | 7 formas, 0 de tuteo |
| Léxico peninsular en España | mezclado | 5 formas, 0 latinas |
| Beneficios como verbos | pocos | 6 de 6 |
| Anti-promesa presente | no | sí |
| Biografía inventada del instructor | — | ninguna |
| Cifras de mercado inventadas | — | ninguna |

La causa del cero absoluto de voseo resultó ser una línea del contexto que decía
«Trato de tú» **para los ocho países**, Argentina incluida. Ninguna cantidad de
instrucción estilística lo iba a arreglar mientras esa línea siguiera ahí.

### Cuándo sí valdría la pena Claude

Si se añade `ANTHROPIC_API_KEY`, el reparto con mejor relación calidad/costo
sería:

- **Claude** para `descripcion` y `faqs` de los ~40 cursos pilares y de los
  mercados de CPC alto (MX, ES, US) — donde la diferencia de naturalidad se
  traduce en conversión.
- **Gemini Flash-Lite** para `beneficios`, `para_quien`, `requisitos`,
  `certificado` y `garantia`, donde el duelo no encontró diferencia relevante.
- **Gemini 3.6 Flash** para la cola larga de cursos y mercados pequeños.

Con las prohibiciones de fabricación ya escritas en el prompt, que es lo que le
faltaba a Claude para ser publicable sin revisión.

---

## Resumen

| Pregunta | Respuesta |
|---|---|
| ¿Quién escribe mejor? | Claude, 3 de 3 pares, con margen amplio |
| ¿Quién es más fiable con los datos? | Empate técnico: Gemini es vago, Claude inventa concreto |
| ¿Qué se usa? | Gemini con el prompt reescrito a partir del duelo |
| ¿Por qué no Claude? | No hay clave de API; a escala no sería reproducible |
| ¿Cuánto mejoró Gemini? | Voseo 0→7, verbos 6/6, cero fabricaciones detectadas |
| ¿Cuándo reconsiderar? | Al añadir ANTHROPIC_API_KEY, para pilares y mercados de CPC alto |
