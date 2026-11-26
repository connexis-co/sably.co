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
    label: 'Caja de compra · Mostrar quién dicta el curso',
    description: '«Lo dicta …» en la cabeza de la ficha y en la caja. Apagado no deja hueco. Por defecto: encendido.',
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
export const PORTADA_CLAVES: ClaveAjuste[] = ['portadaOrden', 'portadaOcultos', 'portadaHeroeVariante', 'portadaHeroeFondo', 'portadaHeroeBotones', 'portadaHeroeTachado', 'portadaHeroeRota', 'portadaHeroeIntervalo', 'portadaHeroeOrden', 'portadaHeroeOficios', 'portadaHeroeAB', 'portadaHeroeABVariantes', 'portadaHeroeABReparto', 'portadaHeroeABInicio', 'portadaCategoriasVariante', 'portadaComoFuncionaAnimado', 'portadaEscenasVariante', 'portadaEscenasAtenuar', 'portadaValoradosMinimo'];

/** Pestañas de «Ajustes del sitio», en orden, con los ajustes guardados que muestra cada una. */
export const PESTANAS: { id: IdPestana; titulo: string; resumen: string; claves: ClaveAjuste[] }[] = [
  { id: 'sitio', titulo: 'Sitio y tema', resumen: 'El diseño que ven todos y el estilo de los formularios.', claves: ['temaPorDefecto', 'estiloCampo'] },
  { id: 'campanas', titulo: 'Campañas y cupones', resumen: 'Calendario de campañas, cupón, países y cursos incluidos, y la barra de arriba.', claves: ['barraCampanaCierre', 'barraCampanaFicha'] },
  { id: 'caja', titulo: 'Caja de compra', resumen: 'Cómo se ve la caja de la ficha y el aviso de prueba social.', claves: ['cajaVariante', 'cajaContador', 'cajaTitulo', 'cajaSubtitulo', 'mostrarCreador', 'mostrarDocente', 'mostrarCiudades'] },
  { id: 'portada', titulo: 'Portada', resumen: 'Orden y visibilidad de los bloques de la portada de cada país, y el movimiento del héroe. Los textos nuevos se editan en «Secciones».', claves: PORTADA_CLAVES },
  { id: 'contenido', titulo: 'Cursos y contenido', resumen: 'Accesos a las colecciones y a la moderación.', claves: [] },
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
