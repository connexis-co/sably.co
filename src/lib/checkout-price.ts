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

async function loadFromHotmart(row:Row, source:Source, coupon:string | null) {
  const response = await fetch('https://pay.hotmart.com/api/next/load', {
    method:'POST', redirect:'error', signal:AbortSignal.timeout(3000),
    headers:{'content-type':'application/json',origin:'https://pay.hotmart.com',referer:'https://pay.hotmart.com/'+source.codigo},
    body:JSON.stringify({items:[{affiliation:source.codigo,quantity:1,...(coupon ? {coupon} : {})}],countryIsoCode:row.market,device:'DESKTOP'})
  });
  if (!response.ok) throw new Error('Cotización no disponible');
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
}) {
  const now = options.now ?? Date.now;
  const quotes = new Map<string, Entry>();
  const retryAfter = new Map<string, number>();
  const pending = new Map<string, Promise<void>>();

  async function refresh(key:string, id:string, row:Row, source:Source) {
    // Las dos lecturas salen a la vez: son el mismo instante de la tasa de cambio.
    const [plain, discounted] = await Promise.all([
      options.load(row, source, null).catch(() => null),
      row.coupon ? options.load(row, source, row.coupon).catch(() => null) : null,
    ]);
    const at = now();
    const base = plain ? readAmount(plain, row, source, false) : null;
    if (!base || (row.coupon && !discounted)) {
      retryAfter.set(id, at + QUOTE_RETRY_MS);
      return;
    }
    retryAfter.delete(id);
    // Hotmart respondió: si no aplica el cupón, eso también es un dato (null).
    const amount = row.coupon ? readAmount(discounted, row, source, true) : null;
    const reduced = amount && amount < base ? amount : null;
    const current = quotes.get(key);
    if (current && current.expires > at && current.base === base) {
      if (row.coupon) current.reduced.set(row.coupon, reduced);
      return;
    }
    quotes.set(key, {at, expires:at + QUOTE_TTL_MS, base, reduced:new Map(row.coupon ? [[row.coupon, reduced]] : [])});
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
      return {currency, base:entry.base, reduced:coupon ? entry.reduced.get(coupon) ?? null : null, at:entry.at, validUntil:entry.expires};
    };
    const known = read();
    if (known) return known;
    if ((retryAfter.get(id) ?? 0) > now()) return null;
    let job = pending.get(id);
    if (!job) {
      job = refresh(key, id, {product:source.product, market, currency, coupon}, source).finally(() => pending.delete(id));
      pending.set(id, job);
    }
    await job;
    return read();
  }

  return {checkoutPrice, quotable};
}

export const {checkoutPrice, quotable} = createCheckoutPrice({sources: sources as Record<string, Source>, load: loadFromHotmart});

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
