import sources from '../data/fuentes-precios.json';
import { currencies, verify } from './hotmart-evidencia.mjs';

interface Source {url:string; product:string; codigo:string; ofertaSha256:string}
interface Row {product:string; market:string; currency:string; coupon:string | null}
interface Quote {amount:number; coupon_amount:number | null}
const sourcesBySlug: Record<string,Source> = sources;
const markets: Record<string,string> = currencies;
const cache = new Map<string,{expires:number; quote:Promise<Quote | null>}>();

async function load(row:Row, source:Source, coupon:string | null) {
  const response = await fetch('https://pay.hotmart.com/api/next/load', {
    method:'POST', redirect:'error', signal:AbortSignal.timeout(3000),
    headers:{'content-type':'application/json',origin:'https://pay.hotmart.com',referer:'https://pay.hotmart.com/'+source.codigo},
    body:JSON.stringify({items:[{affiliation:source.codigo,quantity:1,...(coupon ? {coupon} : {})}],countryIsoCode:row.market,device:'DESKTOP'})
  });
  if (!response.ok) throw new Error('Cotización no disponible');
  return response.json();
}

export async function checkoutPrice(slug:string, url:string, country:string, coupon:string | null) {
  const source = sourcesBySlug[slug];
  const market = country.toUpperCase();
  const currency = markets[market];
  if (!source || source.url !== url || !currency) return null;
  const key = JSON.stringify([slug,market,coupon]);
  let entry = cache.get(key);
  if (!entry || entry.expires <= Date.now()) {
    const row = {product:source.product, market, currency, coupon};
    entry = {expires:Date.now()+60_000, quote:verify(row,source,load).catch(()=>null)};
    cache.set(key,entry);
    const value = await entry.quote;
    if (value) entry.expires = Date.now()+3_600_000;
  }
  const result = await entry.quote;
  return result ? {currency,base:result.amount,reduced:result.coupon_amount} : null;
}
