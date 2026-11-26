# Reproductor de audio del blog · rediseño (26-nov-2026)

Encargo: `docs/ENCARGO-PULIDO-V2-RONDA-3.md`, punto G (y de A3, el minirreproductor sobre el icono de cookies).
Capturas `antes-*` de https://sably.co (producción `f8e0ef9`) y `despues-*` de la compilación Node de producción con
copia de datos; `1` = «Cómo emprender con un oficio en 2026», `2` = «Cuánto cuesta aprender un oficio online», `3` =
«Cómo hacer sushi en casa», a 390, 768 y 1440 px.

## Qué cambia

- **Tarjeta en dos filas** (escritorio): botón principal grande a la izquierda; arriba «Escucha este artículo · N min»
  con las ondas, velocidad y sonido; abajo −15 s, barra con el tiempo transcurrido y el total **a los lados** (columna
  propia, nunca encima del tirador) y +15 s. En móvil, tres filas: título, botones (−15, +15, velocidad, silencio) y
  la barra a todo el ancho. Alto reservado igual que antes (CLS 0): 128 px escritorio, 162 px móvil.
- **Velocidad propia**: botón «1×» que abre un menú (`role="menu"`, `menuitemradio`, flechas, Inicio, Fin, Intro,
  Escape, Tab) con 0,75× · 1× · 1,25× · 1,5× · 2×; nombre accesible «Velocidad: normal / 1,25 veces». La elección se
  recuerda en el navegador (`sably:medio:velocidad`). Ya no hay `<select>` nativo.
- **Animación de reproducción**: cuatro barras (ondas) junto al título que solo se mueven mientras suena; paso de
  reproducir a pausar con fundido y giro corto. Solo `transform` y `opacity`; nada con «reducir movimiento».
- **−15 / +15** con icono de flecha circular y «15» dentro; tirador con borde blanco y sombra.
- **Volumen** solo con ratón y pantalla ancha; en móvil queda el silencio (el volumen lo lleva el sistema).
- **Minirreproductor fijo** (al bajar mientras suena): en móvil, barra acoplada abajo en dos filas (botón, ondas y
  título, velocidad, silencio, cerrar / −15, barra, +15) que **escribe `--fijo-inferior`** con su alto real; la cookie
  y WhatsApp suben con ella (y «Volver arriba» la cuenta como obstáculo). En escritorio, cápsula centrada abajo, lejos
  de la cookie (izquierda) y de WhatsApp y «Volver arriba» (derecha), con el cerrar dentro de la cápsula; el índice y
  los avisos suben por `--fijo-inferior`.
- **«Seguir escuchando»**: ondas junto al minuto mientras suena.
- **Arreglo de paso**: `articulo.ts` medía el `<style>` en línea (primer hijo) en lugar del reproductor, así que
  `--fijo-inferior` valía siempre 0 y la barra del móvil tapaba la cookie (captura 34). Ahora mide `.v2-medio`, y solo
  quita la variable si la puso él.
- El vídeo comparte las piezas (`medios.css`): sigue igual (capturas `despues-video-*`).

## Verificación

- 3 artículos × 390/768/1440: 0 desbordes, 0 errores de JS.
- Teclado (escritorio, con «reducir movimiento»): flecha abajo abre el menú con el foco en la velocidad marcada;
  abajo/arriba con vuelta, Inicio, Fin; Intro elige (1,25×) y devuelve el foco al botón; Escape cierra; tras recargar
  sigue en 1,25×. K reproduce; ondas sin animación con `reduce`.
- Nombres accesibles del reproductor: región «Escucha este artículo · 6 min»; botones «Reproducir la narración»
  (luego «Pausar la narración»), «Retroceder 15 segundos», «Avanzar 15 segundos», «Velocidad: 1,25 veces»,
  «Silenciar»; deslizadores «Posición de la narración» (con `aria-valuetext` en palabras) y «Volumen de la
  narración». Los avisos siguen en `role="status"`.
- Hoja común (`BaseLayout.*.css`) idéntica byte a byte a la base; el CSS del reproductor sigue en línea y solo en
  artículos con narración; `blog-hoja` 9.808 → 10.274 B gzip (+466, el minirreproductor; solo en el blog).
- LCP y CLS (compilación de producción, 390 con CPU ×4 y red lenta, base `2a0aabc` y candidato alternados, mediana de
  5 rondas de 3 cargas): emprender 2.684 → 2.672 ms, cuánto cuesta 2.680 → 2.672 ms; sushi a 1440 2.640–2.804 →
  2.672 ms. LCP es la entradilla o el H1 (el reproductor va después). CLS 0,000 en todas las cargas.
- `astro check` 0 errores; `test:migration` 505/505; `seo-test` local 96 errores = base (los 2 del blog de siempre).
