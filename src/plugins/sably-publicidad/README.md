# Publicidad de Sably (Google AdSense)

Plugin nativo de EmDash 1.1, **apagado por defecto**. Sin configuración guardada, o con el interruptor apagado, no añade nada al HTML. La única excepción es `/ads.txt`, que responde 404 como hasta ahora.

El panel está en **Publicidad** y exige el permiso `settings:manage`. La configuración se guarda en `options` como `plugin:sably-publicidad:config`. Al guardar se invalida la caché de páginas.

- **Panel**:
  - interruptor general y modo «huecos de muestra»;
  - identificador de editor;
  - exigir el permiso «Publicidad» del aviso de cookies (activado por defecto);
  - meta `google-adsense-account`;
  - rótulo: solo «Anuncios» o «Enlaces patrocinados», que son los que admite la política de AdSense en español;
  - tope de anuncios por página y dispositivo;
  - mínimo de palabras;
  - anuncios automáticos por dispositivo y ancla solo abajo;
  - cinco posiciones, cada una con formato, unidad, dispositivo y tamaños;
  - tipos de página permitidos: por defecto solo el blog. Las fichas, la caja, las portadas, los listados y los creadores exigen una confirmación expresa;
  - exclusiones por ruta;
  - `ads.txt`;
  - vista previa.
- **Posiciones**: `articulo-arriba`, `articulo-texto`, `articulo-lateral`, `articulo-final` y `blog-rejilla`. Las plantillas las colocan con `src/components/publicidad/HuecoPublicidad.astro`. El cuerpo se envuelve con `PublicidadEnTexto.astro`, que va dentro del contenedor de la prosa. Ninguno pinta nada si su posición no toca.
- **Página**: cada hueco reserva el alto exacto de la creatividad y lleva el rótulo encima. Mientras no hay permiso, el hueco tiene `display:none` desde el primer pintado. `adsbygoogle.js` se carga una vez, tras la primera interacción o en el tiempo ocioso del navegador, y solo en `sably.co`. Cada `<ins>` se crea cuando su hueco se acerca a la pantalla.
- **Pruebas**:
  - `node --import tsx --test tests/sably-publicidad.test.ts`;
  - medición de CLS: `node scripts/medir-cls-publicidad.mjs --base <url> --url /blog/<slug>/?tema=v2 --consentimiento si|no|aceptar`.
