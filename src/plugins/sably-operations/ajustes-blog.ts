/**
 * Ajustes del blog V2 (pestaña «Blog» de «Ajustes del sitio»). Claves nuevas del 25-nov-2026, todas con prefijo
 * `blog`; se guardan como las demás (`plugin:sably-operations:settings:<clave>`) y las lee `src/lib/blog-ajustes.ts`.
 * Con los valores de fábrica el blog se ve como las láminas aprobadas (docs/equipo/2026-11-25/blog/DISENO.md §5 y §12).
 * Igual que en ajustes.ts: se puede cambiar rótulo, ayuda y orden; nunca la clave ni el `value` de una opción.
 */
import type { SettingField } from 'emdash';

const sino = (label: string, description: string, def: boolean) => ({ type: 'boolean', label, description, default: def }) as const;
const opciones = <const T extends readonly (readonly [string, string])[]>(label: string, description: string, ops: T, def: T[number][0]) =>
  ({ type: 'select', label, description, options: ops.map(([value, label]) => ({ value, label })) as { value: T[number][0]; label: string }[], default: def }) as const;

export const BLOG_SETTINGS = {
  // Artículo · cabecera y lectura
  blogCabecera: opciones('Blog · Cabecera del artículo',
    '«Automática»: título primero (B) si el artículo tiene portada propia, mínima (D) si no. A = foto a sangre con el título encima; C = banda azul con la foto montada (la de antes, terminada). El orden del HTML no cambia (un solo H1, primero). Por defecto: Automática.',
    [['automatica', 'Automática (B o D)'], ['b', 'B · Título primero'], ['a', 'A · Foto a sangre'], ['c', 'C · Dos columnas'], ['d', 'D · Mínima, sin foto']], 'automatica'),
  blogEntradillaEstilo: opciones('Blog · Estilo de la entradilla', 'La frase de resumen bajo el título. Por defecto: Simple.',
    [['simple', 'Simple'], ['filete', 'Con filete coral a la izquierda']], 'simple'),
  blogTamanoTexto: opciones('Blog · Tamaño del texto del artículo', 'Cuerpo del artículo en escritorio (en móvil, un punto menos). Por defecto: 18.',
    [['17', '17 px'], ['18', '18 px'], ['19', '19 px'], ['20', '20 px']], '18'),
  blogProgreso: sino('Blog · Barra de progreso de lectura', 'Línea coral de 3 px pegada bajo la cabecera que se llena al leer. Solo CSS (con un respaldo de 0,3 KB). Por defecto: encendida.', true),
  blogProgresoMinimo: opciones('Blog · Palabras mínimas para la barra de progreso', 'En artículos más cortos no sale. Por defecto: 300.',
    [['0', 'Siempre'], ['300', '300 palabras'], ['600', '600 palabras'], ['1000', '1.000 palabras']], '300'),
  // Índice
  blogIndiceEscritorio: opciones('Blog · Índice en escritorio',
    '«Lateral fija» acompaña al leer y marca el apartado actual; «Lateral» se queda arriba. Las demás lo ponen dentro del texto, antes del primer párrafo. Por defecto: Lateral fija.',
    [['lateral-fija', 'Lateral fija con el apartado actual'], ['lateral', 'Lateral que no acompaña'], ['plegable', 'Dentro del texto, desplegable cerrado'], ['abierto', 'Dentro del texto, desplegable abierto'], ['tarjeta', 'Dentro del texto, tarjeta numerada'], ['ninguno', 'Sin índice']], 'lateral-fija'),
  blogIndiceProgreso: sino('Blog · Porcentaje leído en el índice lateral', '«38 %» en la cabeza del índice y una línea coral junto a la lista. Por defecto: encendido.', true),
  blogIndiceMovil: opciones('Blog · Índice en móvil',
    '«Plegable y botón flotante»: el índice va cerrado al inicio y, al bajar, una píldora «Índice · 2 de 4» abre la lista en una hoja. Por defecto: Plegable y botón flotante.',
    [['plegable-flotante', 'Plegable y botón flotante'], ['plegable', 'Solo plegable al inicio'], ['abierto', 'Abierto al inicio'], ['ninguno', 'Sin índice']], 'plegable-flotante'),
  blogIndiceNiveles: opciones('Blog · Niveles del índice', 'La hoja del móvil lleva siempre solo los apartados principales. Por defecto: H2 y H3.',
    [['h2-h3', 'Apartados y subapartados (H2 y H3)'], ['h2', 'Solo apartados (H2)']], 'h2-h3'),
  blogIndiceMinimo: opciones('Blog · Apartados mínimos para mostrar el índice', 'Con menos apartados no sale. Por defecto: 3.',
    [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], '3'),
  blogCarrilDerecho: opciones('Blog · Carril derecho del artículo (escritorio)',
    '«Curso»: la tarjeta del curso relacionado fija en lugar del índice (el índice pasa al inicio). «Índice y curso»: la tarjeta debajo del índice. Por defecto: Índice.',
    [['indice', 'Índice'], ['curso', 'Curso relacionado'], ['indice-curso', 'Índice y curso']], 'indice'),
  // Compartir
  blogCompartirRedes: { type: 'string', label: 'Blog · Redes para compartir',
    description: 'Separadas por comas, en orden: whatsapp, facebook, x, linkedin, correo, copiar. Sin scripts de terceros: son enlaces. «Compartir» del móvil sale solo donde existe. Por defecto: whatsapp, facebook, x, correo, copiar.',
    default: 'whatsapp, facebook, x, correo, copiar' },
  blogCompartirPosiciones: { type: 'string', label: 'Blog · Dónde compartir',
    description: 'Separadas por comas: metadatos (fila bajo el título), carril (columna fija a la izquierda, desde 1280 px) y final (bloque de cierre). Vacío: en ningún sitio. Por defecto: metadatos, carril, final.',
    default: 'metadatos, carril, final' },
  // Narración
  blogNarracionFija: sino('Blog · Reproductor de la narración fijo al bajar', 'Mientras suena y el reproductor sale de la pantalla, queda una píldora abajo a la izquierda (barra en móvil) con pausa, tiempo y cerrar. Solo en artículos con narración. Por defecto: encendido.', true),
  // Cursos
  blogCursoMitad: sino('Blog · Curso relacionado a mitad del texto', 'Un solo bloque con foto, precio real del país y botón, tras el apartado que deja atrás el 40 % del texto. El curso es el primero que el artículo enlaza; sin curso enlazado no sale. Por defecto: encendido.', true),
  blogLlamadaFinal: sino('Blog · Llamada final al curso («Siguiente paso»)', 'Bloque azul con la tarjeta del curso relacionado. Sin curso enlazado, lleva a los cursos. Por defecto: encendida.', true),
  blogCursosSugeridos: opciones('Blog · Cursos sugeridos al final del artículo', 'Cursos del mismo grupo que el curso relacionado, con su precio real. Por defecto: 4.',
    [['0', 'Ninguno'], ['2', '2'], ['3', '3'], ['4', '4']], '4'),
  blogArticulosSugeridos: opciones('Blog · Artículos sugeridos («Sigue leyendo»)', 'Primero los que enlazan al mismo curso, luego la misma categoría, luego los más recientes. Por defecto: 3.',
    [['0', 'Ninguno'], ['3', '3'], ['6', '6']], '3'),
  // Tarjetas y etiquetas (artículo y portada)
  blogTarjeta: opciones('Blog · Tarjeta de artículo',
    'Cómo se ven las tarjetas de la portada del blog y de «Sigue leyendo». Toda la tarjeta es un solo enlace. Por defecto: Tarjeta con borde.',
    [['borde', 'Tarjeta con borde'], ['suelta', 'Suelta (foto y texto sin caja)'], ['sombra', 'Tarjeta con sombra'], ['horizontal', 'Horizontal (miniatura a la izquierda)']], 'borde'),
  blogTarjetaMovil: opciones('Blog · Tarjeta de artículo en móvil', 'Por defecto: Horizontal (lista compacta).',
    [['horizontal', 'Horizontal (lista compacta)'], ['igual', 'La misma que en escritorio']], 'horizontal'),
  blogTarjetaLeerMas: sino('Blog · «Leer más →» en la tarjeta', 'Parte del mismo enlace de la tarjeta, no un segundo enlace. Por defecto: encendido.', true),
  blogPortadaSinFoto: opciones('Blog · Portada de un artículo sin foto propia',
    '«Tipográfica»: color de la categoría, trama fina y una frase corta del título (honesta: no finge una foto). «Foto de la categoría»: la foto de archivo de su área. Por defecto: Tipográfica.',
    [['tipografica', 'Tipográfica con trama'], ['foto', 'Foto de la categoría']], 'tipografica'),
  blogEtiquetaEstilo: opciones('Blog · Estilo de la etiqueta de categoría', 'Por defecto: Punto de color.',
    [['punto', 'Punto de color'], ['pastilla', 'Pastilla de color'], ['filete', 'Texto con filete']], 'punto'),
} as const satisfies Record<string, SettingField>;

export type ClaveBlog = keyof typeof BLOG_SETTINGS;
export const BLOG_CLAVES = Object.keys(BLOG_SETTINGS) as ClaveBlog[];
