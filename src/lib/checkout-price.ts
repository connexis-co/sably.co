import sources from '../data/fuentes-precios.json';
import { currencies, readAmount } from './hotmart-evidencia.mjs';

interface Source {url:string; product:string; codigo:string; ofertaSha256:string}
interface Row {product:string; market:string; currency:string; coupon:string | null}
type Load = (row:Row, source:Source, coupon:string | null) => Promise<unknown>;

/** Lo que la ficha pinta: el total con tarjeta que Hotmart enseña por defecto en el país. */
export interface CheckoutQuote {
  currency: string;
  base: number;
  reduced: number | null;
  /** Momento (ms) en que se leyó la cotización en Hotmart. */
  at: number;
  /** Momento (ms) hasta el que la ficha puede seguir mostrando estos importes. */
  validUntil: number;
  /** `hotmart`: leída ahora. `guardada`: la última buena, porque Hotmart no respondió a tiempo. */
  fuente: 'hotmart' | 'guardada';
  /**
   * ¿Se sabe qué hace Hotmart con el cupón pedido? `false` solo en una cotización guardada
   * sin lectura con ese cupón: el enlace lleva el cupón igual, pero no se anuncia importe rebajado.
   */
  reducedKnown: boolean;
}

/** Última cotización buena de un curso en un país, con el cupón con el que se leyó (`null` = sin cupón). */
export interface CotizacionGuardada {
  currency: string;
  base: number;
  reduced: number | null;
  cupon: string | null;
  at: number;
}

/**
 * Dónde sobrevive la última cotización buena a un reinicio del proceso (src/lib/cotizaciones-guardadas.ts).
 * `leer` devuelve la del cupón pedido o, si no la hay, la que se leyó sin cupón.
 */
export interface AlmacenCotizaciones {
  leer(slug: string, market: string, coupon: string | null): Promise<CotizacionGuardada | null>;
  guardar(slug: string, market: string, cotizacion: CotizacionGuardada): Promise<void>;
}

/**
 * Vida de una cotización. Hotmart convierte el precio a la moneda del país con
 * una tasa que cambia sin aviso: el 24-nov-2026 masajes pasó en Colombia de
 * 186.134 a 191.012 COP de un minuto a otro. La página que pinta el importe no
 * puede vivir más que esto (ver `validUntil` y `freshUntil` en el layout): antes
 * la cotización caducaba a la hora, pero el HTML ya renderizado seguía un día
 * entero en caché con la cifra vieja.
 */
export const QUOTE_TTL_MS = 3_600_000;
/** Tras un fallo de Hotmart: ni se le vuelve a preguntar ni se conserva la página más que esto. */
export const QUOTE_RETRY_MS = 300_000;
/** Lo que se espera a Hotmart en el render cuando ya hay una cotización guardada que enseñar. */
export const QUOTE_WAIT_WITH_SAVED_MS = 600;
/** Lo que se espera a Hotmart en el render sin cotización guardada; la lectura sigue después. */
export const QUOTE_WAIT_WITHOUT_SAVED_MS = 1500;
/** Tiempo máximo de cada petición a Hotmart. */
export const QUOTE_FETCH_TIMEOUT_MS = 2500;

async function loadFromHotmart(row:Row, source:Source, coupon:string | null) {
  const response = await fetch('https://pay.hotmart.com/api/next/load', {
    method:'POST', redirect:'error', signal:AbortSignal.timeout(QUOTE_FETCH_TIMEOUT_MS),
    headers:{'content-type':'application/json',origin:'https://pay.hotmart.com',referer:'https://pay.hotmart.com/'+source.codigo},
    body:JSON.stringify({items:[{affiliation:source.codigo,quantity:1,...(coupon ? {coupon} : {})}],countryIsoCode:row.market,device:'DESKTOP'})
  });
  if (!response.ok) throw new Error(`Cotización no disponible (${response.status})`);
  return response.json();
}

interface Entry {at:number; expires:number; base:number; reduced:Map<string, number | null>}

/**
 * Una sola cotización por curso y país. La clave no lleva el cupón: antes había
 * una entrada por (curso, país, cupón), cada una leída a su hora, y dos visitas
 * a la misma ficha (con y sin `?promo=`) podían ver precios base distintos. El
 * importe con cupón se guarda dentro de la misma entrada y caduca con ella; si
 * al pedir un cupón nuevo el precio base ya cambió, se sustituye la entrada
 * completa.
 */
export function createCheckoutPrice(options: {
  sources: Record<string, Source>;
  load: Load;
  now?: () => number;
  /** Almacén persistente de la última cotización buena (puede faltar: entonces solo vive en memoria). */
  almacen?: () => AlmacenCotizaciones | null;
  /** Espera máxima a Hotmart en el render cuando ya hay una cotización guardada. */
  esperaConGuardada?: number;
  /** Espera máxima a Hotmart en el render cuando no hay ninguna guardada. */
  esperaSinGuardada?: number;
  /** Aviso en el registro cuando Hotmart falla (para medir con qué frecuencia pasa). */
  avisar?: (mensaje: string) => void;
}) {
  const now = options.now ?? Date.now;
  const espera = options.esperaConGuardada ?? QUOTE_WAIT_WITH_SAVED_MS;
  const esperaSin = options.esperaSinGuardada ?? QUOTE_WAIT_WITHOUT_SAVED_MS;
  /** Espera al trabajo como mucho `ms`: si no llega, la lectura sigue en segundo plano. */
  const hasta = async (job: Promise<void>, ms: number) => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([job, new Promise<void>((ok) => { temporizador = setTimeout(ok, ms); })]);
    clearTimeout(temporizador);
  };
  const quotes = new Map<string, Entry>();
  /* Última cotización buena por curso y país, también después de caducar: es lo que se
     enseña (con su fecha) si Hotmart falla o tarda, en vez de caer a otra moneda. */
  const ultimas = new Map<string, Entry>();
  const retryAfter = new Map<string, number>();
  const pending = new Map<string, Promise<void>>();

  async function refresh(key:string, id:string, row:Row, source:Source) {
    // Las dos lecturas salen a la vez: son el mismo instante de la tasa de cambio.
    const motivos: string[] = [];
    const leer = (cupon: string | null) => options.load(row, source, cupon).catch((e: unknown) => { motivos.push(e instanceof Error ? e.message : String(e)); return null; });
    const [plain, discounted] = await Promise.all([leer(null), row.coupon ? leer(row.coupon) : null]);
    const at = now();
    const base = plain ? readAmount(plain, row, source, false) : null;
    if (!base || (row.coupon && !discounted)) {
      retryAfter.set(id, at + QUOTE_RETRY_MS);
      options.avisar?.(`[cotizacion] sin respuesta de Hotmart: ${id} · ${motivos.join(' · ') || 'respuesta ilegible'}`);
      return;
    }
    retryAfter.delete(id);
    // Hotmart respondió: si no aplica el cupón, eso también es un dato (null).
    const amount = row.coupon ? readAmount(discounted, row, source, true) : null;
    const reduced = amount && amount < base ? amount : null;
    const current = quotes.get(key);
    if (current && current.expires > at && current.base === base) {
      if (row.coupon) current.reduced.set(row.coupon, reduced);
    } else {
      quotes.set(key, {at, expires:at + QUOTE_TTL_MS, base, reduced:new Map(row.coupon ? [[row.coupon, reduced]] : [])});
    }
    ultimas.set(key, quotes.get(key)!);
    const almacen = options.almacen?.();
    if (almacen) {
      const [slug, market] = JSON.parse(key) as [string, string];
      const guardar = (c: CotizacionGuardada) => almacen.guardar(slug, market, c).catch(() => { /* sin almacén: queda en memoria */ });
      void guardar({currency: row.currency, base, reduced: null, cupon: null, at});
      if (row.coupon) void guardar({currency: row.currency, base, reduced, cupon: row.coupon, at});
    }
  }

  /** La última cotización buena (memoria o almacén) como respuesta de respaldo, con vida corta. */
  async function guardada(slug:string, market:string, currency:string, coupon:string | null): Promise<CheckoutQuote | null> {
    const key = JSON.stringify([slug, market]);
    const enMemoria = ultimas.get(key);
    let c: CotizacionGuardada | null = enMemoria
      ? {currency, base:enMemoria.base, at:enMemoria.at, cupon: coupon && enMemoria.reduced.has(coupon) ? coupon : null, reduced: coupon ? enMemoria.reduced.get(coupon) ?? null : null}
      : null;
    if (!c) c = await options.almacen?.()?.leer(slug, market, coupon).catch(() => null) ?? null;
    if (!c || c.currency !== currency || !(c.base > 0)) return null;
    const conocido = !coupon || c.cupon === coupon;
    return {currency, base:c.base, reduced: conocido && coupon ? c.reduced : null, at:c.at, validUntil: now() + QUOTE_RETRY_MS, fuente:'guardada', reducedKnown: conocido};
  }

  /** ¿Hay una fuente comprobada para cotizar este curso en este país? */
  function quotable(slug:string, url:string, country:string): boolean {
    return options.sources[slug]?.url === url && country.toUpperCase() in currencies;
  }

  async function checkoutPrice(slug:string, url:string, country:string, coupon:string | null): Promise<CheckoutQuote | null> {
    const source = options.sources[slug];
    const market = country.toUpperCase();
    const currency = (currencies as Record<string,string>)[market];
    if (!source || !currency || !quotable(slug, url, country)) return null;
    const key = JSON.stringify([slug, market]);
    const id = JSON.stringify([slug, market, coupon]);
    const read = (): CheckoutQuote | null => {
      const entry = quotes.get(key);
      if (!entry || entry.expires <= now()) return null;
      if (coupon && !entry.reduced.has(coupon)) return null;
      return {currency, base:entry.base, reduced:coupon ? entry.reduced.get(coupon) ?? null : null, at:entry.at, validUntil:entry.expires, fuente:'hotmart', reducedKnown:true};
    };
    const known = read();
    if (known) return known;
    if ((retryAfter.get(id) ?? 0) > now()) return guardada(slug, market, currency, coupon);
    let job = pending.get(id);
    if (!job) {
      job = refresh(key, id, {product:source.product, market, currency, coupon}, source).finally(() => pending.delete(id));
      pending.set(id, job);
    }
    /* Con una cotización guardada, el render no espera a Hotmart más que un instante: si no
       llega, sale la guardada (con su fecha) y la lectura sigue en segundo plano para la próxima. */
    const respaldo = await guardada(slug, market, currency, coupon);
    if (respaldo) {
      await hasta(job, espera);
      return read() ?? respaldo;
    }
    await hasta(job, esperaSin);
    return read();
  }

  return {checkoutPrice, quotable};
}

let almacenPorDefecto: AlmacenCotizaciones | null = null;
/** Lo fija src/lib/precio-hoy.ts con el almacén de sably.db (aquí no se importa el runtime). */
export function fijarAlmacenCotizaciones(almacen: AlmacenCotizaciones | null): void { almacenPorDefecto = almacen; }

export const {checkoutPrice, quotable} = createCheckoutPrice({
  sources: sources as Record<string, Source>, load: loadFromHotmart,
  almacen: () => almacenPorDefecto,
  avisar: (mensaje) => console.warn(mensaje),
});

/**
 * Hasta cuándo (ms) puede vivir en caché la ficha que pinta esta cotización.
 * Con cotización, lo que le quede a ella; si Hotmart no respondió, el plazo de
 * reintento, para que la ficha no se quede un día con el precio de respaldo.
 * `null` cuando el curso no se cotiza (sin producto o sin fuente comprobada):
 * ahí no hay importe que caduque.
 */
export function quoteFreshUntil(quote: CheckoutQuote | null, canQuote: boolean, now = Date.now()): number | null {
  if (quote) return quote.validUntil;
  return canQuote ? now + QUOTE_RETRY_MS : null;
}
