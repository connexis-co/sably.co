/**
 * Ajustes del plugin sably-operations y su orden en el panel («Ajustes del sitio»).
 *
 * Las CLAVES son contrato: se guardan en `options` como `plugin:sably-operations:settings:<clave>` y las lee
 * `src/lib/ajustes-tema.ts`. Se puede cambiar rótulo, ayuda y orden; nunca la clave ni el `value` de una opción
 * (lo comprueba `tests/ajustes-panel.test.ts`).
 */
import type { SettingField } from 'emdash';
import { BLOG_CLAVES, BLOG_SETTINGS } from './ajustes-blog';

export const settingsSchema = {
  // Sitio y tema
  temaPorDefecto: {
    type: 'select',
    label: 'Tema del sitio (cambia lo que ven todos)',
    description:
      'Cuidado: es el diseño que ven todos los visitantes. «Clásico» es el de siempre; «V2» es el rediseño. Para revisar sin cambiárselo a nadie, añade ?tema=v2 o ?tema=clasico a cualquier URL (esa vista no se indexa ni se guarda en caché). Si nunca se guardó, manda la variable SABLY_TEMA_POR_DEFECTO del servidor. El cambio llega al público en unos minutos. Por defecto: Clásico.',
    options: [{ value: 'clasico', label: 'Clásico' }, { value: 'v2', label: 'V2 (rediseño)' }],
    default: 'clasico',
  },
  estiloCampo: {
    type: 'select',
    label: 'Sitio y tema · Estilo de los campos de formulario',
    description: 'Cómo se dibujan los campos de contacto, búsqueda y cuenta en el diseño V2. Por defecto: Contorno.',
    options: [{ value: 'outlined', label: 'Contorno' }, { value: 'filled', label: 'Relleno' }, { value: 'underline', label: 'Subrayado' }],
    default: 'outlined',
  },
  // Tarjetas de cursos entre 1024 y 1279 px (26-nov-2026, decisión de JP: «lo más elegante»)
  pieBorde: {
    type: 'select',
    label: 'Pie · Reborde coral sobre el corte redondeado',
    description: 'Bandas planas de coral que asoman por encima del pie con su mismo radio, como capas detrás de él (estilo visitvalle). «Escalonado»: tres bandas, la más fuerte pegada al pie. «Inverso»: tres bandas, la más clara pegada al pie. «Dos anchas»: dos bandas gruesas. «Cuatro finas»: cuatro bandas delgadas. «Tenue»: una sola franja rosada clara (la de antes). «Sin reborde»: nada. Por defecto: Escalonado.',
    options: [{ value: 'escalonado', label: 'Escalonado' }, { value: 'inverso', label: 'Inverso' }, { value: 'anchas', label: 'Dos anchas' }, { value: 'finas', label: 'Cuatro finas' }, { value: 'tenue', label: 'Tenue' }, { value: 'ninguno', label: 'Sin reborde' }],
    default: 'escalonado',
  },
  tarjetasColumnasMedio: {
    type: 'select',
    label: 'Sitio y tema · Tarjetas de cursos entre 1024 y 1279 px',
    description: 'Columnas de las rejillas de cursos de la portada (destacados y mejor valorados) y de la ficha (especializaciones y relacionados) en pantallas medianas. Con 4 la tarjeta queda tan estrecha que el precio tachado se monta sobre el precio. «3, filas completas»: 3 columnas y, solo en ese tramo, sin la última fila a medias (8 tarjetas → 6, 4 → 3; desde 1280 px se ven todas). «3, todas»: 3 columnas con todas las tarjetas. «4»: como antes. El listado de cursos ya va a 3 en ese tramo. Por defecto: 3, filas completas.',
    options: [{ value: 'tres-completas', label: '3, filas completas' }, { value: 'tres', label: '3, todas' }, { value: 'cuatro', label: '4' }],
    default: 'tres-completas',
  },
  // Barra de campaña V2 (26-nov-2026, ronda 2 de JP: C7)
  barraCampanaCierre: {
    type: 'select',
    label: 'Campañas · Al cerrar la barra de campaña',
    description: 'Qué pasa cuando alguien toca la × de la barra de arriba. «Durante la sesión»: no vuelve a salir hasta que cierre la pestaña. «Solo en esa página»: vuelve en la página siguiente. Por defecto: Durante la sesión.',
    options: [{ value: 'sesion', label: 'Durante la sesión' }, { value: 'vista', label: 'Solo en esa página' }],
    default: 'sesion',
  },
  barraCampanaFicha: {
    type: 'boolean',
    label: 'Campañas · Barra de campaña en la ficha del curso',
    description: 'Solo en los cursos cuyo creador acepta el cupón de la campaña (en los demás nunca sale, para no anunciar un descuento que el pago no aplica). La caja de compra sigue llevando su propio cupón. Por defecto: encendido.',
    default: true,
  },
  barraCampanaFija: {
    type: 'boolean',
    label: 'Campañas · Barra de campaña fija al desplazarse',
    description: 'La barra de arriba se queda pegada encima de la cabecera mientras se baja por la página, hasta que alguien la cierre con la ×. Apagado: se va con el resto de la página al bajar. Por defecto: encendido.',
    default: true,
  },
  barraCampanaBoton: {
    type: 'boolean',
    label: 'Campañas · Botón «Ver cursos» en la barra',
    description: 'Un botón en la barra de arriba que lleva a los cursos a los que aplica la campaña vigente, en el listado del país del visitante. En escritorio va en la misma línea que el contador; en móvil, debajo del nombre de la campaña junto al contador (a 360 px, debajo a todo el ancho). El clic se mide en GA4 como select_promotion. Por defecto: encendido.',
    default: true,
  },
  barraCampanaBotonTexto: {
    type: 'string',
    label: 'Campañas · Texto del botón de la barra',
    description: 'Variable {pct}: el porcentaje de la campaña vigente (sale de la campaña, nunca va fijo). Hasta 32 caracteres; si se pasa o va vacío, se usa el de fábrica. Por defecto: «Ver cursos con {pct}».',
    default: 'Ver cursos con {pct}',
  },
  barraCampanaBotonDestino: {
    type: 'string',
    label: 'Campañas · Destino del botón de la barra',
    description: 'Ruta del sitio que empieza por / (nada de dominios externos). Variable {pais}: el país de la página (co, mx…). Si la página trae ?promo=<clave> se conserva. Vacío: el listado del país filtrado a los cursos de la campaña, /{pais}/cursos/?oferta=1 (no se indexa y su canónica es el listado normal). Por defecto: vacío.',
    default: '',
  },
  barraCampanaBotonFicha: {
    type: 'select',
    label: 'Campañas · Botón de la barra en la ficha del curso',
    description: 'En la ficha el botón de pago manda: llevar a otros cursos le quita foco. «Nada»: la barra de la ficha no lleva botón. «Enlace discreto»: un enlace de texto pequeño, sin forma de botón (solo desde 640 px: en el celular no sale). Por defecto: Nada.',
    options: [{ value: 'nada', label: 'Nada' }, { value: 'enlace', label: 'Enlace discreto' }],
    default: 'nada',
  },
  // Caja de compra
  cajaVariante: {
    type: 'select',
    label: 'Caja de compra · Variante',
    description: '«Cuenta clara» enseña la cuenta que verá Hotmart (precio normal, cupón y lo que pagas hoy). «Cabecera oscura» pone la campaña arriba, para los picos del año. Por defecto: Cuenta clara.',
    options: [{ value: 'cuenta-clara', label: 'Cuenta clara' }, { value: 'cabecera-oscura', label: 'Cabecera oscura' }],
    default: 'cuenta-clara',
  },
  cajaContador: {
    type: 'select',
    label: 'Caja de compra · Contador de la campaña',
    description: 'Solo aparece con una campaña con fecha de fin; usa esa fecha y nunca se reinicia. Por defecto: Barra que recorre la campaña.',
    options: [{ value: 'barra', label: 'Barra que recorre la campaña' }, { value: 'casillas', label: 'Casillas (días, horas, minutos)' }, { value: 'linea', label: 'Una línea de texto' }, { value: 'tique', label: 'Dentro del tique del cupón' }],
    default: 'barra',
  },
  cajaTitulo: {
    type: 'string',
    label: 'Caja de compra · Título',
    description: 'Variables {curso} y {escuela} (quien dicta el curso). Hasta 40 caracteres, sin cifras, sin «certificado» ni urgencia: si no pasa, se usa el de fábrica. Vacío: sin título. Por defecto: «Empieza {curso}».',
    default: 'Empieza {curso}',
  },
  cajaSubtitulo: {
    type: 'string',
    label: 'Caja de compra · Subtítulo',
    description: 'Mismas reglas que el título, hasta 90 caracteres. Vacío: sin subtítulo. Por defecto: «Lecciones en vídeo, a tu ritmo.».',
    default: 'Lecciones en vídeo, a tu ritmo.',
  },
  mostrarCreador: {
    type: 'boolean',
    label: 'Ficha · Mostrar el creador del curso',
    description: 'La marca con que el curso figura en Hotmart: una línea junto al pago («En Hotmart el curso figura a nombre de …») y su tarjeta en «Creador y opiniones». Con docente real, la ficha y la caja presentan al docente. Apagado no deja hueco. Por defecto: encendido.',
    default: true,
  },
  mostrarDocente: {
    type: 'boolean',
    label: 'Caja de compra · Mostrar el docente del curso',
    description: 'Nombre, foto, trayectoria y acreditaciones de quien imparte el curso, solo en los cursos con un docente real con fuente. Apagado no deja hueco. Por defecto: encendido.',
    default: true,
  },
  mostrarCiudades: {
    type: 'boolean',
    label: 'Ficha · Mostrar «Disponible online en {país}»',
    description: 'Las ciudades del país en texto, sin enlaces ni páginas propias, dentro de «Cómo funciona Sably». Ayuda a ChatGPT a ver que el curso se estudia desde cualquier ciudad. Apagado no deja hueco. Por defecto: encendido.',
    default: true,
  },
  cajaResaltada: {
    type: 'boolean',
    label: 'Caja de compra · Resaltar la caja',
    description: 'Contorno, sombra más honda y un filete coral arriba para que el pago destaque del fondo, sobre todo en el celular. Sirve con las dos variantes. Apagado: la caja blanca con sombra suave de antes. Por defecto: encendido.',
    default: true,
  },
  // Caja de compra (26-nov-2026, añadido de JP a la ronda 2: C8 a C11)
  cajaTituloCentrado: {
    type: 'boolean',
    label: 'Caja de compra · Título centrado con línea',
    description: 'Título y subtítulo de la caja centrados, con una línea corta y centrada debajo (en computador; en el celular el título ya está arriba). Apagado: alineados a la izquierda y sin línea. Por defecto: encendido.',
    default: true,
  },
  cajaPrecioNormal: {
    type: 'select',
    label: 'Caja de compra · «Precio normal» con campaña',
    description: 'Cómo se ve el precio de antes cuando hay campaña con cupón: tachado (se nota el descuento) o sin tachar. Al quitar el cupón nunca va tachado. Por defecto: tachado.',
    options: [{ value: 'tachado', label: 'Tachado' }, { value: 'sin-tachar', label: 'Sin tachar' }],
    default: 'tachado',
  },
  cajaPais: {
    type: 'boolean',
    label: 'Caja de compra · Fila «Precio para {país}»',
    description: 'La bandera y «Precio para Colombia» encima del precio. El país y la moneda siguen en el pie de la caja («País y moneda») y en la cabecera. Por defecto: oculta.',
    default: false,
  },
  cajaMovimiento: {
    type: 'boolean',
    label: 'Caja de compra · Movimiento en el reloj de la promoción',
    description: 'El reloj late, el segundero corre y la barra de la campaña tiene un brillo que avanza. Siempre con la fecha real de fin del panel. Nadie lo ve si pidió menos movimiento en su equipo. Apagado: el reloj quieto de antes. Por defecto: encendido.',
    default: true,
  },
  // Movimiento de la ficha (26-nov-2026, ronda 2 de JP: C6)
  fichaMovimiento: {
    type: 'select',
    label: 'Ficha · Movimiento al bajar',
    description: '«Sobrio»: los bloques aparecen al llegar a ellos y las listas (qué aprenderás, temario) entran en cascada. «Mínimo»: solo los bloques. «Ninguno»: todo quieto. Nadie lo ve si pidió menos movimiento en su equipo. Por defecto: Sobrio.',
    options: [{ value: 'sobrio', label: 'Sobrio' }, { value: 'minimo', label: 'Mínimo' }, { value: 'ninguno', label: 'Ninguno' }],
    default: 'sobrio',
  },
  certificadoAnimacion: {
    type: 'select',
    label: 'Ficha · Animación del certificado',
    description: '«Destello»: al bajar, el certificado de ejemplo se endereza, un brillo lo cruza y el código de verificación entra como un sello. «Entrada»: solo sube con suavidad. «Ninguna»: quieto. Nadie lo ve si pidió menos movimiento. Por defecto: Destello.',
    options: [{ value: 'destello', label: 'Destello' }, { value: 'entrada', label: 'Entrada' }, { value: 'ninguna', label: 'Ninguna' }],
    default: 'destello',
  },
  // Temario y bloques de la ficha (26-nov-2026, paquete 2 del pulido: C7, C10a, C10b)
  temarioEnfoque: {
    type: 'select',
    label: 'Ficha · Temario al abrir un módulo',
    description: '«Enfoca»: al abrir un módulo se cierra el que estaba abierto y la página se desplaza lo justo para que el módulo quede a la vista bajo la cabecera. «Solo encuadra»: se desplaza, pero los demás siguen abiertos. «Nada»: acordeón libre, sin desplazamiento. Con «reducir movimiento» el encuadre es directo, sin animación. Por defecto: Enfoca.',
    options: [{ value: 'enfoca', label: 'Enfoca' }, { value: 'encuadra', label: 'Solo encuadra' }, { value: 'nada', label: 'Nada' }],
    default: 'enfoca',
  },
  fichaQueIncluye: {
    type: 'boolean',
    label: 'Ficha · Bloque «Qué incluye el curso»',
    description: 'Cifras reales de la ficha como titular: lecciones, horas y módulos (con su lista desplegable), junto a una foto del oficio. Va antes del temario. Por defecto: encendido.',
    default: true,
  },
  relacionadosTarjeta: {
    type: 'select',
    label: 'Ficha · Tarjeta de «Cursos relacionados»',
    description: '«Placa»: foto alta con una placa blanca (título y creador) que crece al pasar el cursor o con el foco y muestra la promesa, los datos y «Ver el curso»; en el celular sale abierta. No lleva precio: el precio vive en la ficha de cada curso. «Con precio»: la tarjeta del listado. Por defecto: Placa.',
    options: [{ value: 'placa', label: 'Placa' }, { value: 'precio', label: 'Con precio' }],
    default: 'placa',
  },
  sobreFotosPestanas: {
    type: 'boolean',
    label: 'Ficha · Foto distinta en cada pestaña de «Sobre este curso»',
    description: 'Al cambiar de pestaña (Qué aprenderás, Para quién es, Qué necesitas, Cómo se estudia) la foto cambia con un fundido corto. Apagado: queda la portada del curso en las cuatro. Por defecto: encendido.',
    default: true,
  },
  // Opiniones de la ficha V2 (26-nov-2026, ronda 2 de JP: C1 y C3)
  opinionesEstilo: {
    type: 'select',
    label: 'Ficha · Estilo del bloque de opiniones',
    description: '«Lista editorial»: la nota de Hotmart en grande y, al lado, extractos reales de opiniones publicadas en Hotmart con el nombre de quien las escribió. «Compacto»: una sola fila con la nota. Las estrellas de la cabeza de la ficha llevan a este bloque. Por defecto: Lista editorial.',
    options: [{ value: 'lista', label: 'Lista editorial' }, { value: 'compacto', label: 'Compacto' }],
    default: 'lista',
  },
  opinionesExtractosMinimo: {
    type: 'select',
    label: 'Ficha · Extractos de Hotmart para enseñar la lista',
    description: 'Cuántos extractos reales hacen falta para enseñarlos. Con menos, el bloque dice que aún no hay opiniones escritas que citar. Por defecto: 1.',
    options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }],
    default: '1',
  },
  opinionesExtractosMaximo: {
    type: 'select',
    label: 'Ficha · Extractos de Hotmart como máximo',
    description: 'Cuántos extractos reales enseña la lista como mucho. Salen de las evaluaciones públicas de cada curso en Hotmart, con el texto literal y el nombre con que se publicaron. Por defecto: 4.',
    options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }],
    default: '4',
  },
  opinionesPerfilNombre: {
    type: 'string',
    label: 'Ficha · Opiniones: nombre del perfil público',
    description: 'Por ejemplo «Google». Con nombre y URL, el bloque de opiniones enlaza a ese perfil («Ver las opiniones en Google»). No cambia la nota, que sigue siendo la de Hotmart. Vacío = sin enlace.',
    default: '',
  },
  opinionesPerfilUrl: {
    type: 'string',
    label: 'Ficha · Opiniones: URL del perfil público',
    description: 'Dirección https del perfil (ficha de Google Business u otra). Sin nombre o sin https no se enseña.',
    default: '',
  },
  // Cuenta (src/lib/cuenta): claves nuevas del 25-nov-2026, encendidas de fábrica.
  cuentaActiva: {
    type: 'boolean',
    label: 'Cuenta · Cuentas de usuario',
    description: 'Botón «Entrar» en la cabecera V2, «Mi cuenta» y las rutas /ingresar/ y /mi-cuenta/. Comprar nunca exige cuenta. Apagado, el sitio queda como sin cuentas: sin botón y esas rutas dan 404; las cuentas guardadas no se borran. Necesita SABLY_AUTH_SECRET en el servidor. Por defecto: encendido.',
    default: true,
  },
  cuentaGoogle: {
    type: 'boolean',
    label: 'Cuenta · Entrar con Google',
    description: 'Botón «Continuar con Google» en el acceso. Apagado, solo queda el correo con código (si está encendido); con los dos apagados el botón «Ingresar» desaparece. Necesita SABLY_GOOGLE_ID y SABLY_GOOGLE_SECRET en el servidor (el cliente OAuth de Google). Por defecto: encendido.',
    default: true,
  },
  // Clave nueva del 26-nov-2026.
  cuentaCorreo: {
    type: 'boolean',
    label: 'Cuenta · Entrar con el correo (código)',
    description: 'Entrar o crear la cuenta con un código de 6 dígitos que llega al correo, sin contraseña. Solo se ofrece si el correo del sitio está listo: proveedor elegido en Ajustes → Correo y, con «Sably · Brevo», su clave API y el remitente en los ajustes del plugin. Sin eso no aparece aunque esté encendido. Por defecto: encendido.',
    default: true,
  },
  // Clave nueva del 26-nov-2026.
  cuentaClave: {
    type: 'boolean',
    label: 'Cuenta · Entrar con correo y contraseña',
    description: 'Entrar con correo y contraseña, crear la cuenta con contraseña, «¿Olvidaste tu contraseña?» y cambiarla en Mi cuenta. El alta y el olvido se confirman con un código al correo, así que necesita lo mismo que el acceso con código (y ese interruptor encendido). Contraseñas con Argon2id, de 10 caracteres o más y comprobadas contra filtraciones públicas. Apagado, nadie entra con contraseña, pero las guardadas no se borran. Por defecto: encendido.',
    default: true,
  },
  cuentaAcceso: {
    type: 'select',
    label: 'Cuenta · Cómo se abre «Entrar»',
    description: '«Ventana» abre el acceso encima de la página, sin salir de ella (en móvil, una hoja que sube desde abajo). «Página» lleva a /ingresar/. Las dos funcionan siempre: los enlaces directos, los avisos y los navegadores sin JavaScript usan la página. Por defecto: Ventana.',
    options: [{ value: 'ventana', label: 'Ventana emergente' }, { value: 'pagina', label: 'Página /ingresar/' }],
    default: 'ventana',
  },
  // Portada
  portadaOrden: {
    type: 'string',
    label: 'Portada · Orden de los bloques',
    description: 'Ids de los bloques separados por comas, de arriba abajo (el héroe va siempre primero). Un bloque que falte entra en su sitio de fábrica. Mejor ordénalos con las flechas de la pestaña «Portada». Por defecto: vacío (orden de fábrica).',
    default: '',
  },
  portadaOcultos: {
    type: 'string',
    label: 'Portada · Bloques apagados',
    description: 'Ids de los bloques que no se muestran, separados por comas. Apagar un bloque quita su texto y sus enlaces de la portada: ojo con lo que leen ChatGPT y Google. Por defecto: vacío (todos encendidos).',
    default: '',
  },
  campanaBarra: {
    type: 'select',
    label: 'Campaña · Barra de arriba',
    description: 'Qué enseña la barra de arriba de todas las páginas durante una campaña. «Contador»: cuánto falta hasta la fecha de fin real de la campaña, con segundero; sin fecha de fin no sale. «Cupón»: el código con el botón «Copiar» (el cupón ya va puesto en los enlaces de pago, así que no hace falta copiarlo para tener el descuento). «Solo la fecha»: como antes. Por defecto: Contador.',
    options: [{ value: 'contador', label: 'Contador (días, horas, minutos y segundos)' }, { value: 'cupon', label: 'Cupón para copiar' }, { value: 'ambos', label: 'Contador y cupón' }, { value: 'fecha', label: 'Solo la fecha de fin en texto' }],
    default: 'contador',
  },
  campanaBanda: {
    type: 'select',
    label: 'Campaña · Banda de la portada',
    description: 'Qué enseña la banda de la campaña en la portada durante una campaña. «Contador»: cuánto falta hasta la fecha de fin real de la campaña, con segundero; sin fecha de fin no sale. «Cupón»: el código con el botón «Copiar» (el cupón ya va puesto en los enlaces de pago, así que no hace falta copiarlo para tener el descuento). «Solo la fecha»: como antes. Por defecto: Contador.',
    options: [{ value: 'contador', label: 'Contador (días, horas, minutos y segundos)' }, { value: 'cupon', label: 'Cupón para copiar' }, { value: 'ambos', label: 'Contador y cupón' }, { value: 'fecha', label: 'Solo la fecha de fin en texto' }],
    default: 'contador',
  },
  campanaMegamenu: {
    type: 'select',
    label: 'Campaña · Tarjeta del megamenú',
    description: 'Qué enseña la tarjeta de la campaña del menú «Cursos» durante una campaña. «Contador»: cuánto falta hasta la fecha de fin real de la campaña, con segundero; sin fecha de fin no sale. «Cupón»: el código con el botón «Copiar» (el cupón ya va puesto en los enlaces de pago, así que no hace falta copiarlo para tener el descuento). «Solo la fecha»: como antes. Por defecto: Contador.',
    options: [{ value: 'contador', label: 'Contador (días, horas, minutos y segundos)' }, { value: 'cupon', label: 'Cupón para copiar' }, { value: 'ambos', label: 'Contador y cupón' }, { value: 'fecha', label: 'Solo la fecha de fin en texto' }],
    default: 'contador',
  },
  campanaListado: {
    type: 'select',
    label: 'Campaña · Franja del listado',
    description: 'Qué enseña la franja de la campaña entre las tarjetas del listado de cursos durante una campaña. «Contador»: cuánto falta hasta la fecha de fin real de la campaña, con segundero; sin fecha de fin no sale. «Cupón»: el código con el botón «Copiar» (el cupón ya va puesto en los enlaces de pago, así que no hace falta copiarlo para tener el descuento). «Solo la fecha»: como antes. Por defecto: Contador.',
    options: [{ value: 'contador', label: 'Contador (días, horas, minutos y segundos)' }, { value: 'cupon', label: 'Cupón para copiar' }, { value: 'ambos', label: 'Contador y cupón' }, { value: 'fecha', label: 'Solo la fecha de fin en texto' }],
    default: 'contador',
  },
  portadaHeroeVariante: {
    type: 'select',
    label: 'Portada · Variante del héroe',
    description: 'Solo cambia el escaparate de cursos junto al titular: el H1, el buscador con sugerencias, los botones y los 12 cursos enlazados son los mismos en todas (lo que leen Google y ChatGPT no cambia). «Collage»: recortes de foto con cinta y pegatina de precio sobre fondo arena; se dispersan al bajar. «Muro inclinado»: cuatro filas de tarjetas que se deslizan; al pasar el cursor la tarjeta se endereza con su precio (idea de gurwi.com). «Cintas»: dos cintas diagonales con los oficios. «Órbita»: el buscador al centro y los oficios girando alrededor, con fondo aurora. «Anillo 3D»: cilindro de cursos en 3D (en móvil, carril plano). «Vitrina viva», «Buscador primero», «Abanico» y «Mosaico»: las de la ronda anterior. Todas se quedan quietas con «reducir movimiento» y llevan botón de pausa. Si la prueba A/B del héroe está encendida, manda la prueba. Por defecto: Muro inclinado (elegido el 25-nov en la tercera ronda: el más cercano a gurwi.com y con el precio a la vista).',
    options: [
      { value: 'muro', label: 'Muro inclinado interactivo' },
      { value: 'collage', label: 'Collage (cuaderno del oficio)' },
      { value: 'cintas', label: 'Cintas cinéticas' },
      { value: 'orbita', label: 'Órbita alrededor del buscador (fondo aurora)' },
      { value: 'anillo3d', label: 'Anillo 3D' },
      { value: 'vitrina', label: 'Vitrina viva de 12 oficios' },
      { value: 'buscador', label: 'Buscador primero y oficio de hoy' },
      { value: 'abanico', label: 'Abanico de cursos' },
      { value: 'mosaico', label: 'Mosaico de tres fotos' },
    ],
    default: 'muro',
  },
  portadaHeroeFondo: {
    type: 'select',
    label: 'Portada · Fondo del héroe',
    description: '«Liso»: azul noche (o arena en el collage). «Aurora»: tres manchas de color que se mueven despacio detrás del texto; solo en las variantes de fondo oscuro, se para con la pausa y queda quieta con «reducir movimiento». La variante «Órbita» la lleva siempre. Por defecto: Liso.',
    options: [{ value: 'liso', label: 'Liso' }, { value: 'aurora', label: 'Aurora animada' }],
    default: 'liso',
  },
  portadaHeroeBotones: {
    type: 'select',
    label: 'Portada · Botones del héroe',
    description: '«Dos»: «Ver cursos» (texto de Secciones → sably-home-hero) y «Homologaciones». «Uno»: solo «Ver cursos»; el buscador hace de segunda llamada. No aplica a la variante «Mosaico». Por defecto: Dos.',
    options: [{ value: 'dos', label: 'Dos: cursos y homologaciones' }, { value: 'uno', label: 'Uno: solo cursos' }],
    default: 'dos',
  },
  portadaHeroeTachado: {
    type: 'boolean',
    label: 'Portada · Tachar el precio normal en el héroe',
    description: 'Cuando la campaña aplica a un curso, junto al precio de hoy se ve el normal tachado (los dos reales, de la misma fuente que la ficha). Por defecto: encendido.',
    default: true,
  },
  portadaHeroeRota: {
    type: 'boolean',
    label: 'Portada · Los cursos del héroe cambian solos',
    description: 'Cambia una foto del mosaico cada pocos segundos, con fundido. Se para al pasar el cursor, con el teclado, con el botón de pausa y fuera de pantalla; nunca con «reducir movimiento». Apagado: tres oficios fijos. Por defecto: encendido.',
    default: true,
  },
  portadaHeroeIntervalo: {
    type: 'select',
    label: 'Portada · Cada cuánto cambia una foto del héroe',
    description: 'Tiempo entre un cambio y el siguiente (cambia una celda cada vez). Por defecto: 4,5 segundos.',
    options: [{ value: '3500', label: '3,5 segundos' }, { value: '4500', label: '4,5 segundos' }, { value: '6000', label: '6 segundos' }],
    default: '4500',
  },
  portadaHeroeOrden: {
    type: 'select',
    label: 'Portada · Orden de los oficios del héroe',
    description: '«Aleatorio» no repite un oficio hasta haber enseñado los demás de su celda. «Fijo» sigue el orden de la lista. Por defecto: Aleatorio.',
    options: [{ value: 'aleatorio', label: 'Aleatorio' }, { value: 'fijo', label: 'Fijo' }],
    default: 'aleatorio',
  },
  portadaHeroeOficios: {
    type: 'string',
    label: 'Portada · Cursos del mosaico del héroe',
    description: 'Slugs de los cursos separados por comas (hasta 12; solo cuentan los que tienen inscripción abierta y foto de su oficio). El primero ocupa la foto grande al cargar. Vacío: los 12 que eligió JP (HEROES-X §10.1: repostería para mascotas, cejas y pestañas, drenaje linfático, decoración con globos, macramé, mecánica de motos y de bicicletas, masajes, desayunos sorpresa, barbería, electricista y pastelería), completados con los destacados si alguno cierra inscripción. Por defecto: vacío.',
    default: '',
  },
  portadaHeroeAB: {
    type: 'boolean',
    label: 'Portada · Prueba A/B del héroe',
    description: 'Encendida: cada visitante nuevo ve una de las variantes de la lista de abajo según el reparto y la conserva 30 días (cookie sably_ab_heroe, sin datos personales). Los buscadores y bots ven siempre la primera de la lista. GA4 recibe experiment_impression y variant_id en las búsquedas y clics. Mínimo 14 días sin mirar el resultado antes de tiempo. Apagada: manda «Variante del héroe». Por defecto: apagada.',
    default: false,
  },
  portadaHeroeABVariantes: {
    type: 'string',
    label: 'Portada · Variantes de la prueba A/B',
    description: 'Dos o tres valores separados por comas, de entre: collage, muro, cintas, orbita, anillo3d, vitrina, buscador, abanico (el mosaico no entra: cambia los botones). La primera es la de control y la que ven bots y navegadores sin JavaScript. Por defecto: muro, buscador (el muro de fábrica contra el buscador, el mejor del juez en móvil).',
    default: 'muro, buscador',
  },
  portadaHeroeABReparto: {
    type: 'select',
    label: 'Portada · Reparto de la prueba A/B',
    description: '«A partes iguales»: 50/50 o 34/33/33. «Prudente»: la primera variante se lleva el 70 % y el resto se reparte. Por defecto: A partes iguales.',
    options: [{ value: 'iguales', label: 'A partes iguales' }, { value: '70', label: 'Prudente: 70 % para la primera' }],
    default: 'iguales',
  },
  portadaHeroeABInicio: {
    type: 'string',
    label: 'Portada · Inicio de la prueba A/B',
    description: 'Fecha AAAA-MM-DD en que empezó la prueba. La pone el panel al encenderla si está vacía; cambiarla reinicia la cuenta de días (y la medición, que se filtra por fecha en GA4). Por defecto: vacía.',
    default: '',
  },
  portadaCategoriasVariante: {
    type: 'select',
    label: 'Portada · Cómo se ven las categorías',
    description: '«Fotos»: tarjetas de cada área con su foto y sus cursos (la de siempre). «Pila de tarjetas»: una tarjeta de color por área que se queda pegada arriba y la siguiente sube por encima. «Filas que se cruzan»: dos filas que pasan en sentidos contrarios con pastillas de acceso rápido debajo. Las tres llevan los mismos enlaces. Por defecto: Fotos.',
    options: [{ value: 'fotos', label: 'Fotos (la de siempre)' }, { value: 'pila', label: 'Pila de tarjetas de color' }, { value: 'filas', label: 'Filas que se cruzan' }],
    default: 'fotos',
  },
  portadaComoFuncionaAnimado: {
    type: 'boolean',
    label: 'Portada · «Cómo funciona» animado',
    description: 'Los números de los pasos se encienden al bajar y un carril coral avanza hasta el paso que lees. Con «reducir movimiento», sin desplazamientos. Apagado: los cuatro pasos encendidos y quietos. Por defecto: encendido.',
    default: true,
  },
  portadaAparicion: {
    type: 'boolean',
    label: 'Portada · Bloques que entran al bajar',
    description: 'Las cifras, las áreas, los cursos destacados y mejor valorados, las ventajas, los vídeos, las guías y las preguntas entran escalonados (fundido y 22 px hacia arriba) la primera vez que aparecen; lo que ya se ve al cargar no se mueve. Al abrir una pregunta, la respuesta entra con fundido. Con «reducir movimiento» o sin JavaScript, todo quieto y visible. Por defecto: encendido.',
    default: true,
  },
  portadaCifrasCuentan: {
    type: 'boolean',
    label: 'Portada · Cifras que cuentan',
    description: 'Los cursos con inscripción abierta y las valoraciones de Hotmart cuentan desde 0 hasta la cifra real una sola vez, al entrar en pantalla (1,1 s). En el HTML va la cifra final. Con «reducir movimiento», quietas. Por defecto: encendido.',
    default: true,
  },
  portadaParalaje: {
    type: 'boolean',
    label: 'Portada · Paralaje suave',
    description: 'Las dos fotos de «¿Por qué Sably?» se desplazan a distinta velocidad al bajar (24 y 40 px). Solo `translate`; con «reducir movimiento» o sin soporte, quietos. Por defecto: encendido.',
    default: true,
  },
  portadaHeroeMovil: {
    type: 'select',
    label: 'Portada · Muro del héroe en el celular',
    description: '«Tras los botones»: en el celular el muro (dos filas más bajas) va justo debajo de «Explorar cursos», antes de la línea de valoraciones, para que asome en la primera pantalla sin tapar el titular ni el buscador. «Al final»: debajo de todo el texto, como estaba. Solo afecta al muro y por debajo de 1024 px. Por defecto: Tras los botones.',
    options: [{ value: 'tras-botones', label: 'Tras los botones (asoma en la primera pantalla)' }, { value: 'final', label: 'Al final del héroe' }],
    default: 'tras-botones',
  },
  portadaOficioModo: {
    type: 'select',
    label: 'Portada · «Oficio destacado»: ¿rueda solo?',
    description: '«Automático»: cada cierto tiempo la tarjeta cae y entra la siguiente, muy suave, con un botón visible para pausar o seguir; se para al pasar el cursor, con el foco dentro, fuera de pantalla o con la pestaña oculta, y nunca rueda con «reducir movimiento». «Estático»: solo cambia con las flechas, el teclado o el dedo. Por defecto: Automático (lo pidió JP el 26-nov).',
    options: [{ value: 'automatico', label: 'Automático' }, { value: 'estatico', label: 'Estático (solo flechas)' }],
    default: 'automatico',
  },
  portadaOficioIntervalo: {
    type: 'select',
    label: 'Portada · «Oficio destacado»: cada cuánto cambia',
    description: 'Solo en modo automático. Da tiempo a leer el título y el texto de la tarjeta (unas 40 palabras). Por defecto: 9 segundos.',
    options: [{ value: '7000', label: '7 segundos' }, { value: '9000', label: '9 segundos' }, { value: '12000', label: '12 segundos' }],
    default: '9000',
  },
  portadaBeneficiosModo: {
    type: 'select',
    label: 'Portada · «¿Por qué Sably?»: ¿avanza solo?',
    description: '«Automático»: los cuatro puntos se encienden uno tras otro (una barra coral marca el tiempo, 6 s cada uno) y las dos fotos cambian con el punto activo; se para al pasar el cursor, con el foco dentro, fuera de pantalla o con la pestaña oculta, y nunca avanza con «reducir movimiento». Siempre se puede elegir un punto a mano. «Estático»: solo cambia al pulsar un punto. Los textos son los de Secciones → sably-home-benefits. Por defecto: Automático.',
    options: [{ value: 'automatico', label: 'Automático' }, { value: 'estatico', label: 'Estático (solo al pulsar)' }],
    default: 'automatico',
  },
  nosotrosDiseno: {
    type: 'select',
    label: 'Nosotros · Diseño de la página',
    description: '«Narrativo»: cabecera propia con fotos y borde en arco, cifras reales del catálogo, «Cómo funciona» en tarjetas apiladas que se quedan pegadas al bajar, una franja de fotos de oficios y bloques que entran escalonados. «Sencillo»: la cabecera y los bloques de las demás páginas. El texto es el mismo en los dos (Contenido → Páginas → nosotros). Por defecto: Narrativo.',
    options: [{ value: 'narrativo', label: 'Narrativo' }, { value: 'sencillo', label: 'Sencillo' }],
    default: 'narrativo',
  },
  nosotrosCifras: {
    type: 'boolean',
    label: 'Nosotros · Cifras reales del catálogo',
    description: 'Cursos con inscripción abierta, áreas, países y guías publicadas, contados en cada render desde el catálogo (nunca escritos a mano), con la fecha. Van junto al bloque «Sably en datos» o, si no está, bajo la cabecera. Solo en el diseño narrativo. Por defecto: encendido.',
    default: true,
  },
  nosotrosMovimiento: {
    type: 'boolean',
    label: 'Nosotros · Movimiento',
    description: 'Bloques que entran escalonados al bajar, cifras que cuentan desde 0 una vez, fotos de la cabecera que entran y franja de fotos con paralaje. Solo opacity y translate; con «reducir movimiento», sin JavaScript o apagado, todo quieto y visible (las tarjetas apiladas se siguen pegando). Por defecto: encendido.',
    default: true,
  },
  portadaGuiasVariante: {
    type: 'select',
    label: 'Portada · Bloque de guías del blog',
    description: '«Tarjetas»: las guías destacadas con su foto, la categoría con su color y «Escúchalo» si tienen narración; el resto, en lista. «Lista»: solo texto, como antes. Los enlaces son los mismos en las dos. Por defecto: Tarjetas.',
    options: [{ value: 'tarjetas', label: 'Tarjetas con foto' }, { value: 'lista', label: 'Lista de texto' }],
    default: 'tarjetas',
  },
  portadaEscenasVariante: {
    type: 'select',
    label: 'Portada · Cómo se recorre «De la primera clase a tu primer encargo»',
    description: '«Tarjetas apiladas»: cada capítulo es una tarjeta que se queda pegada arriba y la siguiente sube por encima (como visitvalle.travel/pueblos-magicos). «Foto fija»: los capítulos pasan a la izquierda y una foto fija cambia a la derecha (como platzi.com). Por defecto: Tarjetas apiladas.',
    options: [{ value: 'apiladas', label: 'Tarjetas apiladas' }, { value: 'foto-fija', label: 'Foto fija' }],
    default: 'apiladas',
  },
  portadaEscenasAtenuar: {
    type: 'boolean',
    label: 'Portada · Atenuar los capítulos que no se leen en el scroll narrativo',
    description: 'Solo con la variante «Foto fija». En escritorio, mientras la foto fija acompaña al capítulo que lees, los demás bajan de tono (el texto sigue entero). Los textos se editan en Secciones → sably-home-escenas. Por defecto: encendido.',
    default: true,
  },
  portadaValoradosMinimo: {
    type: 'select',
    label: 'Portada · Mínimo de valoraciones para «Los mejor valorados»',
    description: 'Solo entran los cursos con al menos este número de valoraciones en Hotmart; si no llegan a tres cursos, el bloque no sale. Más alto = ranking más fiable. Por defecto: 20.',
    options: [{ value: '10', label: '10 valoraciones' }, { value: '20', label: '20 valoraciones' }, { value: '50', label: '50 valoraciones' }],
    default: '20',
  },
  // Blog (ajustes-blog.ts)
  ...BLOG_SETTINGS,
  // Integraciones
  notificationEmail: {
    type: 'email',
    label: 'Integraciones · Correo del equipo',
    description: 'Destinatario de nuevas solicitudes y dirección de respuesta para recuperación. Vacío: no se envían correos operativos. El remitente y la clave se configuran en «Medición y conversiones» → Correo con Brevo. Por defecto: vacío.',
  },
} satisfies Record<string, SettingField>;

export type ClaveAjuste = keyof typeof settingsSchema;
export type ValorAjuste = string | boolean;

export type IdPestana = 'sitio' | 'campanas' | 'caja' | 'portada' | 'contenido' | 'blog' | 'medios' | 'seo' | 'cuenta' | 'integraciones' | 'avanzado';

/** Ajustes de la pestaña «Portada», en el orden en que se ven. */
export const CAMPANA_CLAVES: ClaveAjuste[] = ['campanaBarra', 'campanaBanda', 'campanaMegamenu', 'campanaListado'];
export const PORTADA_CLAVES: ClaveAjuste[] = ['portadaOrden', 'portadaOcultos', 'portadaHeroeVariante', 'portadaHeroeFondo', 'portadaHeroeBotones', 'portadaHeroeTachado', 'portadaHeroeRota', 'portadaHeroeIntervalo', 'portadaHeroeOrden', 'portadaHeroeOficios', 'portadaHeroeAB', 'portadaHeroeABVariantes', 'portadaHeroeABReparto', 'portadaHeroeABInicio', 'portadaCategoriasVariante', 'portadaHeroeMovil', 'portadaOficioModo', 'portadaOficioIntervalo', 'portadaBeneficiosModo', 'portadaGuiasVariante', 'portadaComoFuncionaAnimado', 'portadaAparicion', 'portadaCifrasCuentan', 'portadaParalaje', 'portadaEscenasVariante', 'portadaEscenasAtenuar', 'portadaValoradosMinimo'];

/** Ajustes de la página «Nosotros» (pestaña «Cursos y contenido»). */
export const NOSOTROS_CLAVES: ClaveAjuste[] = ['nosotrosDiseno', 'nosotrosCifras', 'nosotrosMovimiento'];

/** Pestañas de «Ajustes del sitio», en orden, con los ajustes guardados que muestra cada una. */
export const PESTANAS: { id: IdPestana; titulo: string; resumen: string; claves: ClaveAjuste[] }[] = [
  { id: 'sitio', titulo: 'Sitio y tema', resumen: 'El diseño que ven todos y el estilo de los formularios.', claves: ['temaPorDefecto', 'estiloCampo', 'tarjetasColumnasMedio', 'pieBorde'] },
  { id: 'campanas', titulo: 'Campañas y cupones', resumen: 'Calendario de campañas, cupón, países y cursos incluidos, la barra de arriba y qué enseña cada aviso (contador o cupón).', claves: ['barraCampanaCierre', 'barraCampanaFicha', 'barraCampanaFija', 'barraCampanaBoton', 'barraCampanaBotonTexto', 'barraCampanaBotonDestino', 'barraCampanaBotonFicha', ...CAMPANA_CLAVES] },
  { id: 'caja', titulo: 'Caja de compra', resumen: 'Cómo se ve la caja de la ficha y el aviso de prueba social.', claves: ['cajaVariante', 'cajaContador', 'cajaTitulo', 'cajaSubtitulo', 'cajaTituloCentrado', 'cajaResaltada', 'cajaPrecioNormal', 'cajaPais', 'cajaMovimiento', 'mostrarCreador', 'mostrarDocente', 'mostrarCiudades', 'sobreFotosPestanas', 'fichaMovimiento', 'certificadoAnimacion', 'temarioEnfoque', 'fichaQueIncluye', 'relacionadosTarjeta', 'opinionesEstilo', 'opinionesExtractosMinimo', 'opinionesExtractosMaximo', 'opinionesPerfilNombre', 'opinionesPerfilUrl'] },
  { id: 'portada', titulo: 'Portada', resumen: 'Orden y visibilidad de los bloques de la portada de cada país, y el movimiento del héroe. Los textos nuevos se editan en «Secciones».', claves: PORTADA_CLAVES },
  { id: 'contenido', titulo: 'Cursos y contenido', resumen: 'Accesos a las colecciones y a la moderación, y el diseño de la página «Nosotros».', claves: NOSOTROS_CLAVES },
  { id: 'blog', titulo: 'Blog', resumen: 'Cómo se ven la portada del blog y los artículos: cabecera, índice, compartir, cursos y tarjetas.', claves: BLOG_CLAVES },
  { id: 'medios', titulo: 'Medios: audio y vídeo', resumen: 'Vídeo de presentación; narraciones y reproductor, cuando lleguen.', claves: [] },
  { id: 'seo', titulo: 'SEO y medición', resumen: 'Medición, conversiones y auditoría SEO.', claves: [] },
  { id: 'cuenta', titulo: 'Cuenta', resumen: 'Cuentas de usuario y acceso con Google, con código por correo o con contraseña.', claves: ['cuentaActiva', 'cuentaGoogle', 'cuentaCorreo', 'cuentaClave', 'cuentaAcceso'] },
  { id: 'integraciones', titulo: 'Integraciones', resumen: 'Correo del equipo, WhatsApp, Brevo y claves cifradas.', claves: ['notificationEmail'] },
  { id: 'avanzado', titulo: 'Avanzado', resumen: 'Revisar un tema sin cambiarlo, claves técnicas y formulario de respaldo.', claves: [] },
];

/** Ajustes cuyo cambio exige confirmación expresa en el panel. */
export const AJUSTES_PELIGROSOS: readonly ClaveAjuste[] = ['temaPorDefecto'];

/** Valor de fábrica de una clave, o null si no tiene. */
export function valorDeFabrica(clave: ClaveAjuste): ValorAjuste | null {
  const campo = settingsSchema[clave] as SettingField & { default?: ValorAjuste };
  return campo.default ?? null;
}

/** Texto legible de un valor (la etiqueta de la opción si es un desplegable). */
export function textoDeValor(clave: ClaveAjuste, valor: unknown): string {
  const campo = settingsSchema[clave] as SettingField;
  if (campo.type === 'select') return campo.options.find(o => o.value === valor)?.label ?? String(valor ?? '');
  if (campo.type === 'boolean') return valor === false ? 'Apagado' : 'Encendido';
  return valor === '' || valor === null || valor === undefined ? '(vacío)' : String(valor);
}

/**
 * Valida lo que la página quiere guardar y devuelve solo lo que cambia respecto de `actuales`.
 * Nunca acepta una clave fuera del esquema ni un valor fuera de las opciones; el tema exige `confirmado`.
 */
export function cambiosAGuardar(
  propuestos: Partial<Record<ClaveAjuste, unknown>>,
  actuales: Partial<Record<ClaveAjuste, unknown>>,
  confirmado = false,
): Partial<Record<ClaveAjuste, ValorAjuste>> {
  const salida: Partial<Record<ClaveAjuste, ValorAjuste>> = {};
  for (const [k, valor] of Object.entries(propuestos)) {
    if (!Object.hasOwn(settingsSchema, k)) throw new Error(`«${k}» no es un ajuste de este panel.`);
    const clave = k as ClaveAjuste;
    if (valor === actuales[clave]) continue;
    const campo = settingsSchema[clave] as SettingField;
    if (campo.type === 'boolean') {
      if (typeof valor !== 'boolean') throw new Error(`${campo.label}: elige encendido o apagado.`);
    } else {
      if (typeof valor !== 'string') throw new Error(`${campo.label}: el valor debe ser texto.`);
      if (/[\r\n\u0000]/.test(valor) || valor.length > 500) throw new Error(`${campo.label}: el texto no es válido.`);
      if (campo.type === 'select' && !campo.options.some(o => o.value === valor)) throw new Error(`${campo.label}: elige una de las opciones.`);
      if (campo.type === 'email' && valor && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(valor)) throw new Error(`${campo.label}: revisa el correo.`);
    }
    if (AJUSTES_PELIGROSOS.includes(clave) && !confirmado) throw new Error('Confirma que entiendes que el tema cambia lo que ven todos los visitantes.');
    salida[clave] = valor as ValorAjuste;
  }
  return salida;
}
