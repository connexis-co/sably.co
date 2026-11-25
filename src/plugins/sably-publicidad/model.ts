/**
 * Publicidad de Sably (Google AdSense): tipos, valores por defecto, validación y reglas puras.
 *
 * Todo arranca APAGADO. Con `enabled: false` (o sin configuración guardada) ni el hook ni los componentes pintan
 * nada: el HTML queda idéntico al de un sitio sin el módulo. Base: el motor de anuncios de certificadossena.net
 * (mu-plugin `cs-sitio/anuncios.php` y plan 25), llevado a EmDash y a un panel.
 *
 * Sin dependencias: lo leen el plugin (servidor), los componentes de Astro, la ruta de ads.txt y las pruebas.
 */

export type Dispositivo = 'movil' | 'escritorio' | 'ambos';
export type Formato = 'display-fijo' | 'display-adaptable' | 'in-article' | 'in-feed' | 'multiplex';

export const FORMATOS: { id: Formato; label: string; ayuda: string }[] = [
  { id: 'display-fijo', label: 'Display de tamaño fijo', ayuda: 'El que mejor guarda el hueco: el anuncio nunca es más alto que lo reservado. Recomendado.' },
  { id: 'display-adaptable', label: 'Display adaptable al ancho', ayuda: 'Ocupa el ancho del hueco con el alto reservado.' },
  { id: 'in-article', label: 'En el artículo (fluido)', ayuda: 'Puede salir más alto que lo reservado y mover lo que hay debajo.' },
  { id: 'in-feed', label: 'En el feed (fluido)', ayuda: 'Para rejillas o listas. Necesita la «clave de diseño» que da AdSense.' },
  { id: 'multiplex', label: 'Multiplex (rejilla de anuncios)', ayuda: 'Varios anuncios en rejilla, al final del artículo.' },
];

/** Tipos de página tal como los declara BaseLayout (`pageType`). */
export const TIPOS_PAGINA: { id: string; label: string; protegido: boolean }[] = [
  { id: 'article', label: 'Artículo del blog (guía)', protegido: false },
  { id: 'blog', label: 'Portada del blog', protegido: false },
  { id: 'page', label: 'Páginas sueltas (nosotros, legales…)', protegido: false },
  { id: 'video', label: 'Vídeo', protegido: false },
  { id: 'video_library', label: 'Videoteca', protegido: false },
  { id: 'homologaciones', label: 'Homologaciones', protegido: false },
  { id: 'homologacion_programa', label: 'Programa de homologación', protegido: false },
  { id: 'creador', label: 'Perfil de creador', protegido: true },
  { id: 'course', label: 'Ficha de curso (y su caja de compra)', protegido: true },
  { id: 'course_city', label: 'Ficha de curso por ciudad', protegido: true },
  { id: 'home', label: 'Portada de país', protegido: true },
  { id: 'catalog', label: 'Listado de cursos', protegido: true },
  { id: 'category', label: 'Categoría de cursos', protegido: true },
];
const PROTEGIDOS = new Set(TIPOS_PAGINA.filter(t => t.protegido).map(t => t.id));

export interface Tamano { ancho: number; alto: number }

export interface Posicion {
  activa: boolean;
  formato: Formato;
  /** ID de la unidad de anuncio (data-ad-slot). Vacío: la posición no pide anuncios reales. */
  unidad: string;
  dispositivo: Dispositivo;
  movil: Tamano;
  escritorio: Tamano;
  /** Solo in-feed: data-ad-layout-key que da AdSense al crear la unidad. */
  claveDiseno: string;
  /** Dentro del texto: un anuncio cada N párrafos. Rejilla: cada N tarjetas. */
  cada: number;
  /** Dentro del texto y rejilla: máximo de anuncios de esta posición. */
  maximo: number;
}

/** Nombres acordados con el diseño del blog (docs/equipo/2026-11-25/publicidad/DISENO.md). */
export const POSICIONES = ['articulo-arriba', 'articulo-texto', 'articulo-lateral', 'articulo-final', 'blog-rejilla'] as const;
export type IdPosicion = (typeof POSICIONES)[number];

export const POSICIONES_INFO: Record<IdPosicion, { label: string; donde: string; tipo: string; usaCada: boolean }> = {
  'articulo-arriba': { label: 'Arriba del artículo', donde: 'Tras la entradilla, antes del cuerpo. Queda cerca del primer pantallazo: úsala con cuidado.', tipo: 'article', usaCada: false },
  'articulo-texto': { label: 'Dentro del texto', donde: 'Entre párrafos del cuerpo, cada N párrafos y después del primer H2; nunca dentro de listas, tablas ni citas, ni a menos de dos párrafos de una lista, tabla, galería, vídeo o del bloque de curso.', tipo: 'article', usaCada: true },
  'articulo-lateral': { label: 'Lateral fija (escritorio)', donde: 'Columna lateral del artículo, bajo el índice, pegada al hacer scroll.', tipo: 'article', usaCada: false },
  'articulo-final': { label: 'Al final del artículo', donde: 'Tras el cuerpo y las preguntas frecuentes, antes de los comentarios.', tipo: 'article', usaCada: false },
  'blog-rejilla': { label: 'En la rejilla del blog', donde: 'Una tarjeta de anuncio cada N artículos de la portada del blog.', tipo: 'blog', usaCada: true },
};

export interface ConfigPublicidad {
  /** Interruptor general. Apagado: nada en el HTML ni en las peticiones. */
  enabled: boolean;
  /** Huecos de muestra (cajas grises) sin cargar Google. Lo ve TODO el que abra la página: para local o staging. */
  muestra: boolean;
  /** Identificador de editor: ca-pub-XXXXXXXXXXXXXXXX. */
  cliente: string;
  /** Exigir el permiso de «Publicidad» del aviso de cookies para pedir anuncios (si no, AdSense sirve anuncios limitados). */
  exigirConsentimiento: boolean;
  /** Meta `google-adsense-account` en todas las páginas (verificación del sitio, no carga anuncios). */
  metaVerificacion: boolean;
  automaticos: {
    activos: boolean;
    dispositivo: Dispositivo;
    /** Solo el ancla inferior (data-overlays="bottom"). */
    anclaSoloAbajo: boolean;
  };
  posiciones: Record<IdPosicion, Posicion>;
  /** Tipos de página donde se permite publicidad. */
  tiposPagina: string[];
  /** Confirmación expresa para permitir fichas, caja, portada, listados o creadores. */
  confirmoProtegidos: boolean;
  /** Rutas sin publicidad, una por línea; admiten `*`. */
  exclusiones: string[];
  /** Tope de anuncios manuales por página y dispositivo. */
  maximoPorPagina: number;
  /** El texto debe tener al menos estas palabras para llevar anuncios dentro. */
  minimoPalabras: number;
  /** Contenido de /ads.txt (una línea por vendedor). Vacío: 404. */
  adsTxt: string;
  /** Rótulo visible sobre cada hueco: la política de AdSense en español solo admite estos dos. */
  rotulo: Rotulo;
}

export const ROTULOS = ['Anuncios', 'Enlaces patrocinados'] as const;
export type Rotulo = (typeof ROTULOS)[number];

const pos = (p: Partial<Posicion>): Posicion => ({
  activa: false, formato: 'display-fijo', unidad: '', dispositivo: 'ambos',
  movil: { ancho: 300, alto: 250 }, escritorio: { ancho: 336, alto: 280 }, claveDiseno: '', cada: 4, maximo: 1, ...p,
});

/** Editor de AdSense de JP (el de certificadossena y los demás sitios de la cuenta). */
export const EDITOR_JP = 'ca-pub-6213862553989716';

export const DEFAULT_CONFIG: ConfigPublicidad = {
  enabled: false,
  muestra: false,
  cliente: EDITOR_JP,
  exigirConsentimiento: true,
  metaVerificacion: false,
  automaticos: { activos: false, dispositivo: 'movil', anclaSoloAbajo: true },
  // Unidades display adaptables creadas en AdSense el 25-nov (sably-<posición>); el tamaño lo fija el hueco.
  posiciones: {
    'articulo-arriba': pos({ unidad: '9443193326', movil: { ancho: 320, alto: 100 }, escritorio: { ancho: 728, alto: 90 } }),
    'articulo-texto': pos({ unidad: '7667398026', cada: 4, maximo: 2 }),
    'articulo-lateral': pos({ unidad: '2415071343', dispositivo: 'escritorio', escritorio: { ancho: 300, alto: 600 } }),
    'articulo-final': pos({ unidad: '6354316351' }),
    'blog-rejilla': pos({ unidad: '8784717772', cada: 6, maximo: 2, escritorio: { ancho: 300, alto: 250 } }),
  },
  tiposPagina: ['article', 'blog'],
  confirmoProtegidos: false,
  exclusiones: [],
  maximoPorPagina: 3,
  minimoPalabras: 400,
  // JP añadió sably.co en AdSense (25-nov) y eligió verificar con ads.txt: se sirve aunque no haya anuncios.
  adsTxt: 'google.com, pub-6213862553989716, DIRECT, f08c47fec0942fa0',
  rotulo: 'Anuncios',
};

export const LINEA_ADS_TXT = (cliente: string) => `google.com, ${cliente.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0`;

/* ── Validación ───────────────────────────────────────────────────────── */

function texto(v: unknown, nombre: string, max: number): string {
  if (typeof v !== 'string' || v.length > max) throw new Error(`${nombre}: texto de máximo ${max} caracteres.`);
  return v.trim();
}
function bool(v: unknown, nombre: string): boolean {
  if (typeof v !== 'boolean') throw new Error(`${nombre}: valor inválido.`);
  return v;
}
function entero(v: unknown, nombre: string, min: number, max: number): number {
  if (!Number.isInteger(v) || Number(v) < min || Number(v) > max) throw new Error(`${nombre}: usa un entero entre ${min} y ${max}.`);
  return Number(v);
}
function uno<T extends string>(v: unknown, validos: readonly T[], nombre: string): T {
  if (typeof v !== 'string' || !(validos as readonly string[]).includes(v)) throw new Error(`${nombre}: valor inválido.`);
  return v as T;
}
function tamano(v: unknown, nombre: string): Tamano {
  const t = (v ?? {}) as Record<string, unknown>;
  return { ancho: entero(t.ancho, `${nombre} (ancho)`, 50, 1200), alto: entero(t.alto, `${nombre} (alto)`, 50, 1200) };
}
function rutas(v: unknown): string[] {
  if (!Array.isArray(v) || v.length > 200) throw new Error('Exclusiones: lista inválida.');
  const lista = [...new Set(v.map(x => texto(x, 'Exclusiones', 200)).filter(Boolean))];
  if (lista.some(r => !/^\/(?!\/)[^\s?#\\]*$/.test(r))) throw new Error('Exclusiones: usa rutas del sitio desde «/», sin dominio ni parámetros.');
  return lista;
}

export function validarConfig(entrada: unknown): ConfigPublicidad {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new Error('Configuración inválida.');
  const v = entrada as Record<string, unknown>;
  const auto = (v.automaticos ?? {}) as Record<string, unknown>;
  const cliente = texto(v.cliente, 'Identificador de editor', 40);
  if (cliente && !/^ca-pub-\d{16}$/.test(cliente)) throw new Error('Identificador de editor: usa el formato ca-pub- seguido de 16 dígitos.');
  const entradaPos = (v.posiciones ?? {}) as Record<string, unknown>;
  const posiciones = {} as Record<IdPosicion, Posicion>;
  for (const id of POSICIONES) {
    const p = (entradaPos[id] ?? {}) as Record<string, unknown>;
    const nombre = POSICIONES_INFO[id].label;
    const unidad = texto(p.unidad, `${nombre}: unidad`, 20);
    if (unidad && !/^\d{6,12}$/.test(unidad)) throw new Error(`${nombre}: el ID de la unidad son solo dígitos (data-ad-slot).`);
    const claveDiseno = texto(p.claveDiseno, `${nombre}: clave de diseño`, 40);
    if (claveDiseno && !/^[-+\w]{4,40}$/.test(claveDiseno)) throw new Error(`${nombre}: clave de diseño inválida.`);
    posiciones[id] = {
      activa: bool(p.activa, `${nombre}: activa`),
      formato: uno(p.formato, FORMATOS.map(f => f.id), `${nombre}: formato`),
      unidad,
      dispositivo: uno(p.dispositivo, ['movil', 'escritorio', 'ambos'] as const, `${nombre}: dispositivo`),
      movil: tamano(p.movil, `${nombre}: tamaño en móvil`),
      escritorio: tamano(p.escritorio, `${nombre}: tamaño en escritorio`),
      claveDiseno,
      cada: entero(p.cada, `${nombre}: cada`, 2, 20),
      maximo: entero(p.maximo, `${nombre}: máximo`, 1, 5),
    };
    if (posiciones[id].formato === 'in-feed' && posiciones[id].activa && posiciones[id].unidad && !claveDiseno) {
      throw new Error(`${nombre}: el formato in-feed necesita la clave de diseño de AdSense.`);
    }
    if (posiciones[id].movil.ancho > 360) throw new Error(`${nombre}: en móvil el ancho máximo es 360 px.`);
  }
  if (!Array.isArray(v.tiposPagina)) throw new Error('Tipos de página: lista inválida.');
  const conocidos = new Set(TIPOS_PAGINA.map(t => t.id));
  const tiposPagina = [...new Set(v.tiposPagina.map(t => uno(t, [...conocidos], 'Tipo de página')))];
  const confirmoProtegidos = bool(v.confirmoProtegidos, 'Confirmación');
  if (tiposPagina.some(t => PROTEGIDOS.has(t)) && !confirmoProtegidos) {
    throw new Error('Has marcado fichas, portada, listados o creadores: confirma expresamente que aceptas el riesgo para las ventas.');
  }
  const adsTxt = texto(v.adsTxt, 'ads.txt', 5000);
  for (const linea of adsTxt.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))) {
    if (!/^[a-z0-9.-]+\.[a-z]{2,},\s*[\w-]+,\s*(DIRECT|RESELLER)(,\s*[\w]+)?\s*$/i.test(linea) && !/^(contact|subdomain|ownerdomain|managerdomain)=/i.test(linea)) {
      throw new Error(`ads.txt: línea con formato inválido: «${linea.slice(0, 80)}».`);
    }
  }
  const config: ConfigPublicidad = {
    enabled: bool(v.enabled, 'Interruptor general'),
    muestra: bool(v.muestra, 'Huecos de muestra'),
    cliente,
    exigirConsentimiento: bool(v.exigirConsentimiento, 'Exigir consentimiento'),
    metaVerificacion: bool(v.metaVerificacion, 'Meta de verificación'),
    automaticos: {
      activos: bool(auto.activos, 'Anuncios automáticos'),
      dispositivo: uno(auto.dispositivo, ['movil', 'escritorio', 'ambos'] as const, 'Automáticos: dispositivo'),
      anclaSoloAbajo: bool(auto.anclaSoloAbajo, 'Ancla solo abajo'),
    },
    posiciones,
    tiposPagina,
    confirmoProtegidos,
    exclusiones: rutas(v.exclusiones),
    maximoPorPagina: entero(v.maximoPorPagina, 'Tope por página', 1, 6),
    minimoPalabras: entero(v.minimoPalabras, 'Mínimo de palabras', 0, 5000),
    adsTxt,
    rotulo: uno(v.rotulo, ROTULOS, 'Rótulo'),
  };
  if (config.enabled && !config.muestra && !config.cliente) throw new Error('Para pedir anuncios reales hace falta el identificador de editor.');
  if (config.metaVerificacion && !config.cliente) throw new Error('La meta de verificación necesita el identificador de editor.');
  return config;
}

/** Configuración guardada (o nada) → configuración completa. Una guardada que ya no valida se trata como apagada. */
export function normalizarConfig(guardada: unknown): ConfigPublicidad {
  if (!guardada) return DEFAULT_CONFIG;
  try { return validarConfig(guardada); } catch { return DEFAULT_CONFIG; }
}

/* ── Reglas ───────────────────────────────────────────────────────────── */

export function coincideRuta(ruta: string, patron: string): boolean {
  if (!patron.includes('*')) return ruta.replace(/\/$/, '') === patron.replace(/\/$/, '');
  let p = 0, t = 0, estrella = -1, reintento = 0;
  while (t < ruta.length) {
    if (patron[p] === '*') { estrella = p++; reintento = t; }
    else if (patron[p] === ruta[t]) { p++; t++; }
    else if (estrella !== -1) { p = estrella + 1; t = ++reintento; }
    else return false;
  }
  while (patron[p] === '*') p++;
  return p === patron.length;
}

/** ¿Esta página puede llevar publicidad? (interruptor, tipo permitido, exclusiones, rutas internas). */
export function paginaPermitida(config: ConfigPublicidad, tipoPagina: string, ruta: string): boolean {
  if (!config.enabled) return false;
  if (ruta.startsWith('/_emdash') || ruta.startsWith('/admin') || ruta.startsWith('/api/')) return false;
  if (!config.tiposPagina.includes(tipoPagina)) return false;
  if (PROTEGIDOS.has(tipoPagina) && !config.confirmoProtegidos) return false;
  return !config.exclusiones.some(p => coincideRuta(ruta, p));
}

/** Contador de anuncios ya pintados en la petición, por dispositivo. */
export interface Cuenta { movil: number; escritorio: number }
export const cuentaNueva = (): Cuenta => ({ movil: 0, escritorio: 0 });

/**
 * Reserva un hueco respetando el tope por página y dispositivo. Devuelve el dispositivo con el que queda (puede
 * estrecharse a uno solo si en el otro ya se llegó al tope) o null si no cabe.
 */
export function reservar(cuenta: Cuenta, tope: number, dispositivo: Dispositivo): Dispositivo | null {
  const m = dispositivo !== 'escritorio' && cuenta.movil < tope;
  const e = dispositivo !== 'movil' && cuenta.escritorio < tope;
  if (!m && !e) return null;
  if (m) cuenta.movil++;
  if (e) cuenta.escritorio++;
  return m && e ? 'ambos' : m ? 'movil' : 'escritorio';
}

/* ── HTML del hueco ───────────────────────────────────────────────────── */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Alto reservado = creatividad + rótulo (16 px + 8 px de separación). */
export const ALTO_ROTULO = 24;

export function huecoHtml(id: IdPosicion, p: Posicion, dispositivo: Dispositivo, opciones: { muestra: boolean; rotulo: Rotulo; fija?: boolean; etiqueta?: 'div' | 'li' }): string {
  const tag = opciones.etiqueta ?? 'div';
  const estilo = `--sa-wm:${p.movil.ancho}px;--sa-hm:${p.movil.alto}px;--sa-wd:${p.escritorio.ancho}px;--sa-hd:${p.escritorio.alto}px`;
  const datos = [
    `data-hueco="${id}"`, `data-dev="${dispositivo}"`, `data-fmt="${p.formato}"`,
    p.unidad ? `data-unidad="${esc(p.unidad)}"` : '',
    p.claveDiseno ? `data-clave="${esc(p.claveDiseno)}"` : '',
    opciones.muestra ? 'data-muestra' : '',
  ].filter(Boolean).join(' ');
  const clases = `sably-ad${opciones.fija ? ' sably-ad--fija' : ''}`;
  const caja = opciones.muestra
    ? '<div class="sably-ad__caja" aria-hidden="true"><span class="sably-ad__medida"></span></div>'
    : '<div class="sably-ad__caja"></div>';
  return `<${tag} class="${clases}" ${datos} style="${estilo}" aria-label="${opciones.rotulo}"><p class="sably-ad__rotulo">${opciones.rotulo}</p>${caja}</${tag}>`;
}

/* ── Inserción dentro del texto ───────────────────────────────────────── */

export function contarPalabras(texto: string): number {
  return (texto.replace(/<[^>]+>/g, ' ').match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

/**
 * Elección de puntos dentro del texto, en JS plano porque se ejecuta en el navegador (ver PublicidadEnTexto) y las
 * pruebas lo evalúan tal cual. Recibe las etiquetas de los bloques de primer nivel del cuerpo y devuelve los índices
 * de los párrafos tras los que puede ir un anuncio (reglas del diseño del blog, §4.10):
 * - tras un <p> de primer nivel (nunca dentro de listas, tablas, citas, avisos ni pasos) y después del primer H2;
 * - con al menos dos párrafos entre el punto y cualquier bloque que no sea párrafo ni título (lista, tabla, galería,
 *   vídeo, cita, bloque de curso…), por arriba y por abajo; nunca tras el último bloque;
 * - el primero tras `cada` párrafos y los siguientes `cada` párrafos después del anterior, hasta `maximo`.
 * `apto(i)` permite al navegador descartar un punto (por ejemplo, si ya está en pantalla).
 */
export const ELEGIR_PUNTOS_JS = `function(tags,cada,maximo,apto){
var T={h2:1,h3:1,h4:1,h5:1,h6:1};
function seguidos(d,paso){var n=0;for(var j=d;j>=0&&j<tags.length;j+=paso){if(tags[j]==='p')n++;else if(!T[tags[j]])break;if(n>=2)return 2}return n}
var r=[],par=0,h2=false,obj=cada;
for(var i=0;i<tags.length&&r.length<maximo;i++){if(tags[i]==='h2')h2=true;if(tags[i]!=='p')continue;par++;
if(!h2||i===tags.length-1||par<obj)continue;
if(seguidos(i,-1)>=2&&seguidos(i+1,1)>=2&&(!apto||apto(i))){r.push(i);obj=par+cada}}
return r}`;

/** Script en línea que va justo después del cuerpo: intercala copias del hueco del <template> anterior. */
export function textoScript(): string {
  return `(function(s){var t=s.previousElementSibling,c=s.parentElement;if(!t||!c||t.tagName!=='TEMPLATE')return;
var n=+t.getAttribute('data-n'),min=+t.getAttribute('data-min');if(!(n>0))return;
if(((c.textContent||'').match(/[\\p{L}\\p{N}]+/gu)||[]).length<min)return;
var b=[].filter.call(c.children,function(e){return e.tagName!=='TEMPLATE'&&e.tagName!=='SCRIPT'});
var tags=b.map(function(e){return e.tagName.toLowerCase()});
var elegir=${ELEGIR_PUNTOS_JS};
/* Solo por debajo de la pantalla: insertar encima de lo que se ve movería la lectura. */
var i=elegir(tags,+t.getAttribute('data-cada'),n,function(i){return b[i].getBoundingClientRect().bottom>innerHeight});
i.forEach(function(k){b[k].after(t.content.firstElementChild.cloneNode(true))})
})(document.currentScript);`;
}
