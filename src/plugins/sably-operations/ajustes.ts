/**
 * Ajustes del plugin sably-operations y su orden en el panel («Ajustes del sitio»).
 *
 * Las CLAVES son contrato: se guardan en `options` como `plugin:sably-operations:settings:<clave>` y las lee
 * `src/lib/ajustes-tema.ts`. Se puede cambiar rótulo, ayuda y orden; nunca la clave ni el `value` de una opción
 * (lo comprueba `tests/ajustes-panel.test.ts`).
 */
import type { SettingField } from 'emdash';

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
  // Integraciones
  notificationEmail: {
    type: 'email',
    label: 'Integraciones · Correo del equipo',
    description: 'Destinatario de nuevas solicitudes y dirección de respuesta para recuperación. Vacío: no se envían correos operativos. El remitente y la clave se configuran en «Medición y conversiones» → Correo con Brevo. Por defecto: vacío.',
  },
} satisfies Record<string, SettingField>;

export type ClaveAjuste = keyof typeof settingsSchema;
export type ValorAjuste = string | boolean;

export type IdPestana = 'sitio' | 'campanas' | 'caja' | 'contenido' | 'medios' | 'seo' | 'integraciones' | 'avanzado';

/** Pestañas de «Ajustes del sitio», en orden, con los ajustes guardados que muestra cada una. */
export const PESTANAS: { id: IdPestana; titulo: string; resumen: string; claves: ClaveAjuste[] }[] = [
  { id: 'sitio', titulo: 'Sitio y tema', resumen: 'El diseño que ven todos y el estilo de los formularios.', claves: ['temaPorDefecto', 'estiloCampo'] },
  { id: 'campanas', titulo: 'Campañas y cupones', resumen: 'Calendario de campañas, cupón, países y cursos incluidos.', claves: [] },
  { id: 'caja', titulo: 'Caja de compra', resumen: 'Cómo se ve la caja de la ficha y el aviso de prueba social.', claves: ['cajaVariante', 'cajaContador', 'cajaTitulo', 'cajaSubtitulo', 'mostrarCreador', 'mostrarDocente'] },
  { id: 'contenido', titulo: 'Cursos y contenido', resumen: 'Accesos a las colecciones y a la moderación.', claves: [] },
  { id: 'medios', titulo: 'Medios: audio y vídeo', resumen: 'Vídeo de presentación; narraciones y reproductor, cuando lleguen.', claves: [] },
  { id: 'seo', titulo: 'SEO y medición', resumen: 'Medición, conversiones y auditoría SEO.', claves: [] },
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
