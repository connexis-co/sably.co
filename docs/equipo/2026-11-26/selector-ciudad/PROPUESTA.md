# Ciudad en el selector «País y moneda» — propuesta (26-nov-2026)

Encargo: `docs/ENCARGO-PULIDO-V2-RONDA-3.md`, punto F. JP: «selecciona el país y puede seleccionar alguna de las
ciudades que están incluidas en la plataforma; puede seleccionar solo el país o una ciudad específica… analízalo bien:
si va en el mismo selector o es uno adicional».

Contexto que manda: `docs/equipo/2026-11-25/seo/ciudades.md` y `docs/equipo/2026-11-26/seo/404.md`. Las ~1.700 URL de
ciudad responden 301 al curso o al país desde el 12-oct, porque las páginas por ciudad (≈4.800, al 94–97 % de
similitud) fueron el patrón que Google castigó el 18-ago. ChatGPT sigue trayendo un tercio de sus visitas por esas URL
(47 de cada 8 días) y todas acaban, tras el 301, en la ficha correcta, pero **sin ciudad**: el 301 no conserva nada.

## 1. Qué ciudades hay

Las de `src/lib/countries.ts` (`country.cities`), las mismas que pinta «Disponible online en {país}» en la ficha V2
(`CiudadesPais.astro`) y la «malla geo» del clásico. 36 en total:

| País | Ciudades |
|---|---|
| Colombia (6) | Bogotá, Medellín, Cali, Barranquilla, Cartagena, Bucaramanga |
| México (5) | Ciudad de México, Guadalajara, Monterrey, Puebla, Cancún |
| Perú (4) | Lima, Arequipa, Trujillo, Cusco |
| Ecuador (3) | Quito, Guayaquil, Cuenca |
| Chile (3) | Santiago, Valparaíso, Concepción |
| Argentina (4) | Buenos Aires, Córdoba, Rosario, Mendoza |
| España (6) | Madrid, Barcelona, Valencia, Sevilla, Málaga, Bilbao |
| Estados Unidos (5) | Miami, Houston, Los Ángeles, Nueva York, Chicago |

No se añade ni se quita ninguna: la lista es la del catálogo y ya está en el HTML de todas las fichas.

## 2. ¿Mismo selector o uno aparte?

**En el mismo diálogo, como segundo paso opcional.** País y ciudad son una sola decisión («desde dónde me lo
vendes»); un segundo selector en la cabecera duplicaría un control que ya ocupa sitio en móvil y obligaría a explicar
dos botones. Dentro de «País y moneda», debajo del país marcado, aparece «Tu ciudad (opcional)» con sus ciudades y
«Solo el país» (marcado de fábrica). El país sigue siendo un enlace a `/{país}/…` como hoy (funciona sin JS); la ciudad
es una elección del navegador que no navega.

Como elegir un país lleva a otra página, al volver a cargar con el país nuevo el diálogo se reabre una sola vez,
con el foco en «Tu ciudad», para cerrar la elección donde quedó. Solo si la persona acaba de pulsar un país en ese
mismo diálogo (marca en `sessionStorage`); nunca se abre solo en una visita.

## 3. Qué gana el visitante (y qué gana Sably)

Lo que se puede dar **sin inventar nada** (el curso es online e igual en todo el país):

1. **WhatsApp con la ciudad escrita.** El mensaje de los enlaces a WhatsApp de Sably (`wa.me/<número>?text=…`) añade
   «Escribo desde Medellín, Colombia.». Es lo único con valor comercial claro: quien atiende sabe de dónde escriben
   (horario, medios de pago, si es de los que llegan por las URL de ciudad de ChatGPT) sin preguntar.
2. **Su ciudad marcada en «Disponible online en {país}»** de la ficha: la pastilla de su ciudad resaltada con «Tu
   ciudad» para el lector de pantalla. Confirma, en su propio idioma, que el curso le sirve donde vive.
3. **El botón del país dice la ciudad** (hoja del menú móvil y nombre accesible del botón de la cabecera: «Colombia ·
   Medellín · COP»), para que vea qué eligió.
4. **Medición:** el evento `select_country` que ya existe lleva un campo `city` que hoy siempre vale `all`; pasa a
   llevar la ciudad elegida. Así se sabe si la ciudad importa antes de hacer nada más.

Teléfono: `phoneDisplay` de los ocho países pasa a ser la línea real de Sably (+57 311 457 4788), que es la del
WhatsApp de todos; los de México, Perú, Ecuador, Chile, Argentina y Estados Unidos eran números de relleno.

Lo que **no** gana: precio, moneda, medios de pago y fichas son por país; no hay nada por ciudad que mostrar.
«Medios de pago locales» por ciudad no existe (PSE y Nequi son de toda Colombia). Tampoco hay sedes, docentes ni
horarios por ciudad: cualquier texto que lo sugiera sería falso.

## 4. Cómo, sin URL nuevas ni contenido distinto para buscadores

- **HTML inicial idéntico para todos**: las ciudades del país ya están en el HTML de cada página de ese país; el
  diálogo las pinta igual para todo el mundo. Nada depende de cookies ni del servidor (las páginas se cachean en el
  borde sin `Vary: Cookie`).
- **Preferencia en el navegador**: `localStorage['sably:ciudad'] = {"p":"co","c":"medellin"}`. Solo vale para su país:
  si cambia de país, la ciudad se ignora hasta que elija otra.
- **Se aplica en el cliente sobre puntos marcados** (`data-ciudad-*`) y solo en lo que no mueve nada: atributos,
  `href` de WhatsApp, el estilo de una pastilla y textos dentro del diálogo (que no está visible al cargar). Ningún
  texto visible al cargar cambia de largo: CLS 0.
- Google y ChatGPT leen el HTML sin preferencia guardada: ven exactamente lo de hoy.
- Sin URL nuevas, sin parámetros, sin cambios en canónicas, sitemaps, datos estructurados ni redirecciones.
- Interruptor en el panel: «Ajustes del sitio → Cabecera → Ciudad en «País y moneda»» (`selectorCiudad`). Apagado no
  deja HTML, CSS ni JS en la página.

## 5. Qué no conviene (con franqueza)

- **Nada que parezca página de ciudad**: ni H1, títulos, metadescripción ni encabezados «Cursos online en Medellín»,
  aunque sea en el cliente. Google ejecuta JS; si algún día viera textos por ciudad, sería el mismo patrón castigado.
  Y para la persona tampoco aporta: el curso es el mismo.
- **Ciudad en el saludo o en el héroe**: cambiaría un texto visible al cargar (salto de maquetación, CLS) para decir
  algo que no es cierto en ningún sentido útil («para Medellín» de un curso online). Descartado.
- **Guardar la ciudad en cookie o leerla en el servidor**: rompería la caché del borde o abriría variantes por ciudad.
- **Volver a dar 200 a las URL de ciudad** para «aprovechar» la elección: ver opción B de `seo/ciudades.md`. No.
- **Pedir la ciudad con un aviso emergente**: es un dato que nadie necesita dar para comprar; debe ser opcional y
  estar donde ya se elige el país.

## 6. La ciudad en el 301 de las URL de ciudad (aprobado por JP el 26-nov, incluido)

El 301 de las URL de ciudad podría llevar la ciudad en el fragmento: `Location: /co/curso-de-velas/#ciudad=medellin`.
Los buscadores ignoran el fragmento (no hay URL nueva ni cambia la canónica) y el navegador sí lo conserva, así que
quien llega desde ChatGPT por «velas en Medellín» tendría su ciudad elegida sin tocar nada. Toca las redirecciones,
que el encargo prohibía cambiar; JP lo aprobó el 26-nov y va en este PR (`city-redirect.ts`, `market-item.ts`).
Comprobado: `/co/medellin/curso-de-automaquillaje/?utm_source=chatgpt.com` → 301 a
`/co/curso-de-automaquillaje/?utm_source=chatgpt.com#ciudad=medellin`; la página guarda Medellín, quita el fragmento
de la barra y la canónica sigue siendo `https://sably.co/co/curso-de-automaquillaje/`. Mismo número de saltos (uno).

## 7. Recomendación sobre el interruptor

**Encendido de fábrica.** Lo sostiene que: (a) es opcional y está dentro de un diálogo que solo abre quien quiere
cambiar de país; (b) no añade riesgo SEO (HTML idéntico, ninguna URL); (c) cuesta poco (unas 6 pastillas por página,
el guion va con el del diálogo); (d) el único beneficio comercial claro, WhatsApp con la ciudad, solo funciona si está
encendido. Si en dos semanas el evento `select_country` muestra que casi nadie elige ciudad, se apaga desde el panel
sin dejar rastro.

## 8. Versión mínima implementada (PR de esta rama)

1. «Tu ciudad (opcional)» en el diálogo «País y moneda», con «Solo el país» y las ciudades del país actual, como
   grupo de opciones (`role="radiogroup"`, flechas, Inicio/Fin) y aviso en `role="status"`.
2. Reapertura única del diálogo tras elegir un país.
3. WhatsApp con la ciudad, pastilla marcada en «Disponible online en {país}», botón del país con la ciudad,
   `select_country` con `city`.
4. Interruptor `selectorCiudad` en el panel.

## 9. Verificación (compilación Node de producción con copia de datos)

- Ficha de automaquillaje CO a 390 y 1440: con el teclado (flechas) se elige Cartagena; aviso «Ciudad: Cartagena…»
  en `role="status"`; el botón del país pasa a «País: Colombia, Cartagena. Precios en COP. Cambiar país»; el WhatsApp
  flotante añade «Escribo desde Cartagena, Colombia.» al mensaje; la pastilla de Cartagena queda marcada con
  «(tu ciudad)» para el lector. Tras recargar sigue igual, con CLS 0.
- Al pulsar México en el diálogo, `/mx/curso-de-automaquillaje/` abre el diálogo una vez con el foco en «Solo el
  país»; la ciudad de Colombia no se arrastra.
- Con `selectorCiudad` apagado la página no lleva ni el bloque ni el guion.
- 0 desbordes, 0 errores de JS; hoja común idéntica byte a byte a la base (los estilos los pone el guion).
- LCP base/candidato alternados (390, CPU ×4, mediana de 3 rondas): ficha 2.644 → 2.644 ms, `/co/` 2.516 → 2.516 ms;
  CLS 0 en todas las cargas del candidato.
- `astro check` 0 errores, `test:migration` 505/505, `seo-test` local 96 errores = base.

Capturas: `antes-*-dialogo.png` (producción de `develop`) y `despues-*` (diálogo, ciudad elegida, pastilla de la ficha
y México reabierto).
