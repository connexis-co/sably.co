/**
 * Módulo de promociones y countdown.
 *
 * Reglas de diseño (por qué es así):
 *
 * 1. **Nada de promociones perpetuas.** Una campaña solo existe dentro de una ventana
 *    [startsAt, endsAt). Fuera de ella `resolvePromo()` devuelve `null` y la web no
 *    promete ningún descuento. Si mañana no hay campaña, el sitio no miente.
 *
 * 2. **Se resuelve en cliente, no en build.** El sitio es SSG (4.388 páginas): si la
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

export interface PromoCampaign {
  /** Identificador estable; se usa en analítica. */
  id: string;
  /** Texto corto para el badge. Debe ser honesto sobre el motivo. */
  label: string;
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
 * Catálogo de campañas.
 *
 * Mantener corto y auditable. Cada entrada es una promesa al usuario: si está
 * aquí, el cupón tiene que funcionar en el checkout.
 */
export const CAMPAIGNS: readonly PromoCampaign[] = [
  {
    id: 'bf-2026',
    label: 'Black Friday',
    couponCode: '031016',
    discountPct: 50,
    ...blackFridayWindow(2026),
    countries: null,
    priority: 100,
  },
  {
    id: 'navidad-2026',
    label: 'Navidad',
    couponCode: '031016',
    discountPct: 50,
    startsAt: '2026-12-15T00:00:00-05:00',
    endsAt: '2026-12-26T00:00:00-05:00',
    countries: null,
    priority: 90,
  },
  {
    id: 'amor-amistad-co-2026',
    label: 'Amor y Amistad',
    couponCode: '031016',
    discountPct: 50,
    startsAt: '2026-09-14T00:00:00-05:00',
    endsAt: '2026-09-20T00:00:00-05:00',
    countries: ['co'],
    priority: 80,
  },
  {
    id: 'buen-fin-mx-2026',
    label: 'El Buen Fin',
    couponCode: '031016',
    discountPct: 50,
    startsAt: '2026-11-13T00:00:00-06:00',
    endsAt: '2026-11-17T00:00:00-06:00',
    countries: ['mx'],
    priority: 80,
  },
  {
    id: 'ads-evergreen',
    label: 'Oferta de lanzamiento',
    couponCode: '031016',
    discountPct: 50,
    startsAt: '2026-08-01T00:00:00-05:00',
    endsAt: '2026-12-31T23:59:59-05:00',
    countries: null,
    // Solo se activa con ?promo=ads en la URL → campañas de Meta/Google Ads.
    urlKey: 'ads',
    priority: 10,
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

/** Milisegundos que faltan para que termine la campaña (0 si ya terminó). */
export function msRestantes(campaign: PromoCampaign, now: Date): number {
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
