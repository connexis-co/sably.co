/**
 * Módulo de promociones y countdown.
 *
 * Reglas de diseño (por qué es así):
 *
 * 1. **El calendario no tiene promociones perpetuas.** Una campaña solo existe dentro
 *    de su ventana [startsAt, endsAt). Fuera de ella `resolvePromo()` devuelve `null`
 *    y la web no promete ningún descuento.
 *
 *    Aparte del calendario está el override manual del panel (`/admin/promociones`),
 *    que sí admite un descuento sin fecha de fin, porque a veces hace falta vender
 *    hoy y eso lo decide quien vende. Lo único que el modo perpetuo NO hace es
 *    enseñar cuenta atrás: un reloj que se reinicia solo es lo que quema la
 *    credibilidad de las campañas que sí terminan de verdad.
 *
 * 2. **Se resuelve en cliente, no en build.** El sitio es SSG (5.955 páginas): si la
 *    promo se calculara al construir, quedaría horneada la fecha del build y el
 *    countdown sería falso a los dos días. El HTML estático NO promete descuento;
 *    `initPromo()` lo activa en el navegador contra la hora real del visitante.
 *
 * 3. **El descuento es real y verificable.** `couponCode` viaja al checkout como
 *    `?offDiscount=<code>`. Verificado contra Hotmart el 2026-08-10:
 *    P58716037X 165.752 COP → 82.876 COP («¡Has recibido un cupón de 50%!»).
 *    Nunca declarar aquí un porcentaje que el cupón no aplique de verdad.
 *
 * 4. **Segmentable.** Por país, por rango de fechas y por URL (campañas de ads).
 */

/** Códigos de país soportados por el sitio. */
export type CountryCode = 'co' | 'mx' | 'es' | 'ar' | 'cl' | 'pe' | 'ec' | 'us';

/**
 * Aspecto del banner. La campaña decide su tema para que Black Friday no se vea
 * igual que Navidad: un banner que nunca cambia deja de mirarse a las dos
 * semanas. Los valores son clases de Tailwind resueltas en tiempo de build.
 */
export interface PromoTheme {
  /** Fondo de la barra. */
  fondo: string;
  /** Color del texto sobre ese fondo. */
  texto: string;
  /** Fondo de las cajas del contador y del cupón. */
  caja: string;
  /** Botón y badge del porcentaje: el único punto de color saturado. */
  acento: string;
  /** Filete superior de 2 px. Es lo que separa esto de un rectángulo de color. */
  filete: string;
}

export interface PromoCampaign {
  /** Identificador estable; se usa en analítica. */
  id: string;
  /**
   * Rótulo en versalitas sobre el titular. Debe ser honesto sobre el motivo.
   *
   * Va aquí y no en el tema porque los temas se comparten —El Buen Fin reusa el
   * de Black Friday— y con el rótulo dentro del tema el banner mexicano acababa
   * anunciando «BLACK FRIDAY».
   */
  label: string;
  /** Gancho del titular. Corto: compite con el contenido de la página. */
  titular?: string;
  /** Aspecto del banner; si falta se usa el de marca. */
  theme?: PromoTheme;
  /** Código que Hotmart recibe en `?offDiscount=`. */
  couponCode: string;
  /** Porcentaje real que aplica el cupón. Debe coincidir con el checkout. */
  discountPct: number;
  /** Inicio inclusive, ISO 8601 con offset. */
  startsAt: string;
  /** Fin exclusive, ISO 8601 con offset. */
  endsAt: string;
  /** `null` = todos los países. Si no, solo estos. */
  countries: readonly CountryCode[] | null;
  /**
   * Si está presente, la campaña NO se activa sola: requiere `?promo=<urlKey>`.
   * Sirve para campañas de ads, donde el descuento solo existe para quien
   * llega por el anuncio. Sigue respetando startsAt/endsAt.
   */
  urlKey?: string;
  /** Mayor gana cuando dos campañas se solapan. */
  priority: number;
}

/** Viernes siguiente al 4.º jueves de noviembre (Black Friday). */
function blackFriday(year: number): Date {
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const firstThu = 1 + ((4 - nov1.getUTCDay() + 7) % 7);
  return new Date(Date.UTC(year, 10, firstThu + 21 + 1));
}

function iso(d: Date): string {
  return d.toISOString();
}

/** Ventana de Black Friday → Cyber Monday del año dado. */
function blackFridayWindow(year: number): { startsAt: string; endsAt: string } {
  const bf = blackFriday(year);
  const start = new Date(bf);
  start.setUTCDate(bf.getUTCDate() - 1);
  const end = new Date(bf);
  end.setUTCDate(bf.getUTCDate() + 4);
  return { startsAt: iso(start), endsAt: iso(end) };
}

/**
 * Paleta por tipo de campaña.
 *
 * Tres reglas, y las tres nacen de lo que hacía mal la primera versión:
 *
 * 1. **Un solo tono de fondo, oscuro y desaturado.** Los degradados de tres
 *    paradas cruzando medio círculo cromático (morado → violeta → cian) son
 *    justo lo que hace que un banner se lea como plantilla y no como marca.
 * 2. **El color saturado, solo en el botón y en el porcentaje.** Si todo grita,
 *    no hay jerarquía y la vista no sabe dónde ir.
 * 3. **Filete de 2 px arriba.** Es lo que separa una franja de color de algo
 *    compuesto. Cuesta dos píxeles y cambia el registro entero.
 *
 * Los tonos van en hexadecimal literal en vez de la rampa de Tailwind: `red-700`
 * y `emerald-700` son colores de utilidad, no una paleta de marca, y se notan.
 */
export const TEMA = {
  blackFriday: {
    fondo: 'bg-[#0c0c10]',
    texto: 'text-[#e8e4dc]',
    caja: 'bg-[#1a1a20] ring-1 ring-[#3a3730]',
    acento: 'bg-[#d4a655] text-[#0c0c10]',
    filete: 'bg-[#d4a655]',
  },
  navidad: {
    fondo: 'bg-[#0e3226]',
    texto: 'text-[#f2ede0]',
    caja: 'bg-[#144234] ring-1 ring-[#2a5c48]',
    acento: 'bg-[#c8553d] text-[#f7f3e8]',
    filete: 'bg-[#c8553d]',
  },
  amor: {
    fondo: 'bg-[#4a1028]',
    texto: 'text-[#fbe9ef]',
    caja: 'bg-[#5f1734] ring-1 ring-[#7d2a4b]',
    acento: 'bg-[#e8456b] text-white',
    filete: 'bg-[#e8456b]',
  },
  cyber: {
    fondo: 'bg-[#0a1024]',
    texto: 'text-[#dbe6f5]',
    caja: 'bg-[#141c38] ring-1 ring-[#28345c]',
    acento: 'bg-[#4dd4e8] text-[#0a1024]',
    filete: 'bg-[#4dd4e8]',
  },
  clases: {
    fondo: 'bg-[#2c1810]',
    texto: 'text-[#f5e9df]',
    caja: 'bg-[#3d2418] ring-1 ring-[#5c3a26]',
    acento: 'bg-[#e07a3f] text-[#2c1810]',
    filete: 'bg-[#e07a3f]',
  },
  anoNuevo: {
    fondo: 'bg-[#0c2b2e]',
    texto: 'text-[#e4f1f0]',
    caja: 'bg-[#123b3f] ring-1 ring-[#1f5a5e]',
    acento: 'bg-[#5ec9b8] text-[#0c2b2e]',
    filete: 'bg-[#5ec9b8]',
  },
  madre: {
    fondo: 'bg-[#3d1332]',
    texto: 'text-[#f9e8f3]',
    caja: 'bg-[#4f1a42] ring-1 ring-[#6e2a5c]',
    acento: 'bg-[#d4568f] text-white',
    filete: 'bg-[#d4568f]',
  },
  /** El de marca: para las campañas de anuncios y el override al 25 %. */
  medio: {
    fondo: 'bg-primary',
    texto: 'text-[#e6e3f0]',
    caja: 'bg-[#2a2a52] ring-1 ring-[#3d3d6e]',
    acento: 'bg-accent text-white',
    filete: 'bg-accent',
  },
  /** El del override al 50 %: mismo esqueleto, más peso. */
  maximo: {
    fondo: 'bg-[#14061c]',
    texto: 'text-[#f0e6f5]',
    caja: 'bg-[#220d2e] ring-1 ring-[#3d1a4f]',
    acento: 'bg-accent text-white',
    filete: 'bg-accent',
  },
} as const satisfies Record<string, PromoTheme>;

/**
 * Los dos únicos cupones que Hotmart reconoce hoy. Verificados en el checkout
 * de G46888691K el 2026-08-11: 165.814 COP sin cupón → 124.360 con MEDIO
 * (−25 %) → 82.907 con MAXIMO (−50 %).
 *
 * Dar de alta una campaña aquí exige desplegar. Para abrir un descuento sin
 * esperar al build está `/admin/promociones`, que escribe en D1 y manda sobre
 * este calendario mientras esté activo.
 */
const CUPON = {
  /** −25 %. Para ventanas frecuentes donde medio precio no se sostiene. */
  MEDIO: { code: '010775', pct: 25 },
  /** −50 %. Reservado a los picos del año, donde el descuentazo es creíble. */
  MAXIMO: { code: '031016', pct: 50 },
} as const;

/**
 * Catálogo de campañas.
 *
 * Mantener corto y auditable. Cada entrada es una promesa al usuario: si está
 * aquí, el cupón tiene que funcionar en el checkout.
 *
 * El reparto entre los dos cupones no es caprichoso: el 50 % se guarda para las
 * cuatro o cinco fechas fuertes del año, y el 25 % cubre las ventanas
 * intermedias. Si el 50 % estuviera disponible siempre dejaría de ser un motivo
 * para comprar hoy, que es justo lo que se busca. Entre campañas NO hay
 * descuento: el hueco es intencionado.
 */
export const CAMPAIGNS: readonly PromoCampaign[] = [
  // ---- 50 %: los picos del año -------------------------------------------
  {
    id: 'bf-2026',
    label: 'Black Friday',
    titular: 'El descuento más grande del año',
    theme: TEMA.blackFriday,
    couponCode: CUPON.MAXIMO.code,
    discountPct: CUPON.MAXIMO.pct,
    ...blackFridayWindow(2026),
    countries: null,
    priority: 100,
  },
  {
    id: 'navidad-2026',
    label: 'Navidad',
    titular: 'Regálate un oficio nuevo',
    theme: TEMA.navidad,
    couponCode: CUPON.MAXIMO.code,
    discountPct: CUPON.MAXIMO.pct,
    startsAt: '2026-12-15T00:00:00-05:00',
    endsAt: '2026-12-26T00:00:00-05:00',
    countries: null,
    priority: 90,
  },
  {
    id: 'buen-fin-mx-2026',
    label: 'El Buen Fin',
    titular: 'El Buen Fin en Sably',
    theme: TEMA.blackFriday,
    couponCode: CUPON.MAXIMO.code,
    discountPct: CUPON.MAXIMO.pct,
    startsAt: '2026-11-13T00:00:00-06:00',
    endsAt: '2026-11-17T00:00:00-06:00',
    countries: ['mx'],
    priority: 85,
  },
  {
    id: 'amor-amistad-co-2026',
    label: 'Amor y Amistad',
    titular: 'Regala algo que dure',
    theme: TEMA.amor,
    couponCode: CUPON.MAXIMO.code,
    discountPct: CUPON.MAXIMO.pct,
    startsAt: '2026-09-14T00:00:00-05:00',
    endsAt: '2026-09-20T00:00:00-05:00',
    countries: ['co'],
    priority: 80,
  },

  // ---- 25 %: ventanas intermedias ----------------------------------------
  {
    id: 'regreso-clases-2026',
    label: 'Vuelta a clases',
    titular: 'Empieza el semestre con un oficio',
    theme: TEMA.clases,
    couponCode: CUPON.MEDIO.code,
    discountPct: CUPON.MEDIO.pct,
    startsAt: '2026-08-15T00:00:00-05:00',
    endsAt: '2026-08-25T00:00:00-05:00',
    countries: null,
    priority: 50,
  },
  {
    id: 'cyber-cl-pe-2026',
    label: 'CyberDay',
    titular: 'Solo durante el CyberDay',
    theme: TEMA.cyber,
    couponCode: CUPON.MEDIO.code,
    discountPct: CUPON.MEDIO.pct,
    startsAt: '2026-10-05T00:00:00-05:00',
    endsAt: '2026-10-09T00:00:00-05:00',
    countries: ['cl', 'pe'],
    priority: 55,
  },
  {
    id: 'ano-nuevo-2027',
    label: 'Propósitos de Año Nuevo',
    titular: 'Este año sí aprendes el oficio',
    theme: TEMA.anoNuevo,
    couponCode: CUPON.MEDIO.code,
    discountPct: CUPON.MEDIO.pct,
    startsAt: '2027-01-02T00:00:00-05:00',
    endsAt: '2027-01-16T00:00:00-05:00',
    countries: null,
    priority: 50,
  },
  {
    id: 'dia-madre-2027',
    label: 'Día de la Madre',
    titular: 'Para ella, algo que le dé ingresos',
    theme: TEMA.madre,
    couponCode: CUPON.MEDIO.code,
    discountPct: CUPON.MEDIO.pct,
    startsAt: '2027-05-05T00:00:00-05:00',
    endsAt: '2027-05-11T00:00:00-05:00',
    countries: ['co', 'mx'],
    priority: 55,
  },
  {
    id: 'hot-sale-2027',
    label: 'Hot Sale',
    titular: 'Hot Sale: los días de más descuento',
    theme: TEMA.cyber,
    couponCode: CUPON.MEDIO.code,
    discountPct: CUPON.MEDIO.pct,
    startsAt: '2027-05-17T00:00:00-05:00',
    endsAt: '2027-05-24T00:00:00-05:00',
    countries: ['ar', 'mx'],
    priority: 55,
  },

  // ---- Campañas de pago ---------------------------------------------------
  /* No se activan solas: exigen `?promo=<urlKey>` en la URL, así que el
     descuento solo existe para quien llega por el anuncio. El de 50 % se
     reserva a campañas puntuales; el de 25 % es el que puede sostenerse
     durante toda una temporada de tráfico pago. */
  {
    id: 'ads-25',
    label: 'Oferta para ti',
    titular: 'Tu descuento está activo',
    theme: TEMA.medio,
    couponCode: CUPON.MEDIO.code,
    discountPct: CUPON.MEDIO.pct,
    startsAt: '2026-08-01T00:00:00-05:00',
    endsAt: '2027-06-30T23:59:59-05:00',
    countries: null,
    urlKey: 'ads',
    priority: 20,
  },
  {
    id: 'ads-50',
    label: 'Oferta especial',
    titular: 'Tu descuento está activo',
    theme: TEMA.maximo,
    couponCode: CUPON.MAXIMO.code,
    discountPct: CUPON.MAXIMO.pct,
    startsAt: '2026-08-01T00:00:00-05:00',
    endsAt: '2027-06-30T23:59:59-05:00',
    countries: null,
    urlKey: 'ads50',
    priority: 25,
  },
];

export interface ResolveInput {
  countryCode: string;
  /** Momento de evaluación. En cliente, `new Date()`. */
  now: Date;
  /** Valor de `?promo=` si viene en la URL. */
  urlKey?: string | null;
}

/**
 * Devuelve la campaña vigente o `null`.
 *
 * `null` es el caso normal y esperado: la mayor parte del año no hay promoción.
 */
export function resolvePromo({ countryCode, now, urlKey }: ResolveInput): PromoCampaign | null {
  const cc = countryCode.toLowerCase() as CountryCode;
  const t = now.getTime();

  const vigentes = CAMPAIGNS.filter((c) => {
    if (t < Date.parse(c.startsAt) || t >= Date.parse(c.endsAt)) return false;
    if (c.countries && !c.countries.includes(cc)) return false;
    // Las campañas con urlKey exigen que la URL la traiga.
    if (c.urlKey && c.urlKey !== urlKey) return false;
    return true;
  });

  if (vigentes.length === 0) return null;
  return vigentes.reduce((a, b) => (b.priority > a.priority ? b : a));
}

/* ------------------------------------------------------------------------- *
 * Promociones en vivo desde el panel (multi-instancia)
 * ------------------------------------------------------------------------- */

/**
 * Una promoción viva, tal como la sirve `GET /api/v1/promo` dentro de `promos`.
 *
 * El calendario de arriba se hornea en las 5.955 páginas estáticas, así que no
 * puede reaccionar a una decisión de esta tarde. Estas sí: el banner las pide
 * al cargar y aplica la que corresponda a este curso, país y proveedor.
 *
 * A diferencia del viejo override de una sola fila, ahora conviven varias:
 * puede haber un 50 % para los cursos de un proveedor y un 25 % para los de
 * otro, cada uno con su ventana de fechas y sus exclusiones.
 */
export interface Promocion {
  id: string;
  /** Nombre interno del panel; no se muestra al visitante. */
  nombre: string;
  pct: number;
  cupon: string;
  titular: string;
  /** Ids de proveedores objetivo. Vacío = todos. */
  proveedores: string[];
  /** Slugs que entran aunque su proveedor no esté en la lista. */
  incluir: string[];
  /** Slugs que nunca entran, aunque su proveedor sí. Gana sobre todo lo demás. */
  excluir: string[];
  /** Códigos de país. Vacío = todos. */
  paises: string[];
  /** Fin en milisegundos, o `null` si es perpetua (sin cuenta atrás). */
  hasta: number | null;
  /** Mayor gana cuando dos promociones cubren el mismo curso. */
  prioridad: number;
  /** Campañas que requieren ?promo=<clave>. */
  urlKey?: string | null;
  desde?: number | null;
  tema?: string;
  etiqueta?: string;
}

export interface PromoCtx {
  countryCode: string;
  /** Id del proveedor del curso, ya resuelto (ver proveedores.ts). */
  proveedor: string;
  courseSlug?: string;
  urlKey?: string | null;
  now?: number;
}

/** ¿Esta promoción cubre este curso, país y proveedor? */
function promoAplica(p: Promocion, ctx: PromoCtx): boolean {
  const now = ctx.now ?? Date.now();
  if (p.desde != null && p.desde > now) return false;
  if (p.hasta != null && p.hasta <= now) return false;
  if (p.urlKey && p.urlKey !== ctx.urlKey) return false;
  const cc = ctx.countryCode.toLowerCase();
  if (p.paises.length > 0 && !p.paises.includes(cc)) return false;

  const slug = ctx.courseSlug;
  // Excluir gana sobre cualquier otra regla: es el «este curso no, en particular».
  if (slug && p.excluir.includes(slug)) return false;

  // Entra por proveedor (o promo global) o por inclusión explícita del slug.
  const porProveedor = p.proveedores.length === 0 || p.proveedores.includes(ctx.proveedor);
  const porSlug = slug ? p.incluir.includes(slug) : false;
  return porProveedor || porSlug;
}

/**
 * La promoción de mayor prioridad que cubre este curso, o `null`.
 *
 * `null` es el caso normal: la mayor parte del tiempo no hay promoción viva que
 * afecte a un curso dado.
 */
export function mejorPromocion(promos: Promocion[], ctx: PromoCtx): Promocion | null {
  const aplican = promos.filter((p) => promoAplica(p, ctx));
  if (aplican.length === 0) return null;
  return aplican.reduce((a, b) => (b.prioridad > a.prioridad ? b : a));
}

/**
 * Convierte una promoción en la campaña que pinta el banner, para que este
 * tenga un único tipo que dibujar.
 *
 * En perpetua (`hasta` nulo) `endsAt` queda vacío: sin fin no hay cuenta atrás,
 * y es deliberado. El descuento perpetuo es real y se aplica igual; lo que no
 * se hace es acompañarlo de un reloj que se reinicia solo, porque en cuanto el
 * visitante lo nota deja de creerse también las campañas que sí terminan.
 */
export function campaignDePromocion(
  p: Promocion,
): Omit<PromoCampaign, 'endsAt'> & { endsAt: string | null } {
  return {
    id: `promo-${p.id}`,
    label: p.etiqueta || 'Oferta',
    titular: p.titular,
    theme: p.tema && Object.hasOwn(TEMA,p.tema) ? TEMA[p.tema as keyof typeof TEMA] : p.pct >= 50 ? TEMA.maximo : TEMA.medio,
    couponCode: p.cupon,
    discountPct: p.pct,
    startsAt: new Date(p.desde ?? 0).toISOString(),
    endsAt: p.hasta ? new Date(p.hasta).toISOString() : null,
    countries: null,
    // Por encima de cualquier campaña del calendario, y entre ellas manda su
    // propia prioridad.
    priority: 1000 + p.prioridad,
  };
}

/** Pide las promociones vivas al panel. Devuelve `[]` ante cualquier fallo. */
export async function leerPromos(signal?: AbortSignal): Promise<Promocion[]> {
  try {
    const r = await fetch('/api/v1/promo', { signal });
    if (!r.ok) return [];
    const d = (await r.json()) as { promos?: Promocion[] };
    return Array.isArray(d?.promos) ? d.promos : [];
  } catch {
    // Sin red o sin endpoint el sitio se queda con su calendario. Que el banner
    // dependa de una llamada opcional no puede romper la página.
    return [];
  }
}

/** Milisegundos que faltan para que termine la campaña (0 si ya terminó). */
export function msRestantes(campaign: { endsAt: string | null }, now: Date): number {
  if (!campaign.endsAt) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.parse(campaign.endsAt) - now.getTime());
}

/** Formatea un countdown a `{d, h, m, s}` con relleno de dos dígitos. */
export function formatCountdown(ms: number): { d: string; h: string; m: string; s: string } {
  const total = Math.floor(ms / 1000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return {
    d: pad(Math.floor(total / 86400)),
    h: pad(Math.floor((total % 86400) / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  };
}
