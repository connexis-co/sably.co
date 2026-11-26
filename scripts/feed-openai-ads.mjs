#!/usr/bin/env node
/**
 * Feed de productos de OpenAI Ads (anuncios de ChatGPT) con los cursos de Sably en Colombia.
 *
 * La fuente es la ficha pública tal como la sirve el sitio (no el catálogo interno): título y
 * categoría del JSON-LD, descripción de la meta description, portada de og:image y precio del
 * panel de compra (`data-purchase-panel`), que es lo que ve quien entra. Un curso sin precio en
 * COP o sin botón de pago no entra.
 *
 * Uso:
 *   node scripts/feed-openai-ads.mjs [--out=archivo.csv] [--limit=N] [--upload] [--min-rows=N]
 *
 * Con --upload sube el CSV por SFTP al feed (OpenAI no lee URLs: solo SFTP). Necesita
 *   OPENAI_FEED_SFTP_URI       sftp://usuario@host:puerto/ (lo devolvió POST /v1/feeds/{id}/sftp_access)
 *   OPENAI_FEED_SFTP_KEY_FILE  clave privada SSH (RSA: el SFTP de OpenAI no acepta ed25519)
 *   OPENAI_FEED_ID, OPENAI_ADS_API_KEY  opcionales: marcan agotados los cursos que ya no salen
 * y se niega a subir si salen menos de --min-rows filas (por defecto 20), para no publicar un
 * feed a medias si el sitio falla.
 * Documentación: docs/equipo/2026-11-25/chatgpt/FEED.md.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { allowedHotmartUrl } from '../src/lib/hotmart-catalog.mjs';

export const SITE = 'https://sably.co';
export const COUNTRY = 'co';
export const FILE_NAME = 'sably-cursos-co.csv';
export const UTM = 'utm_source=chatgpt_ads&utm_medium=cpc&utm_campaign=co_feed';
/** Único creador que honra el cupón de la promoción de anuncios (`?promo=ads50`, offDiscount=031016). */
export const PROVEEDOR_CON_CUPON = 'masterclasses';
const UA = 'SablyFeedBot/1.0 (+https://sably.co/; feed de OpenAI Ads)';

export const COLUMNS = [
  'item_id', 'title', 'description', 'url', 'brand', 'seller_name', 'seller_url', 'image_url',
  'price', 'sale_price', 'availability', 'condition', 'product_category',
  'target_countries', 'store_country', 'is_eligible_search', 'is_eligible_checkout', 'is_ads_eligible',
  'ads_metadata',
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function attributesOf(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/\s([a-zA-Z_:][-\w:.]*)(?:="([^"]*)")?/g)) attrs[m[1]] = m[2] === undefined ? '' : decodeEntities(m[2]);
  return attrs;
}

/** Atributos de la primera etiqueta que contiene `marker` (p. ej. `data-purchase-panel`). */
export function tagAttributes(html, marker) {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const start = html.lastIndexOf('<', i);
  return attributesOf(html.slice(start, html.indexOf('>', i) + 1));
}

function meta(html, key) {
  const tag = html.match(new RegExp(`<meta[^>]*(?:name|property)="${key}"[^>]*>`, 'i'))?.[0];
  const content = tag?.match(/content="([^"]*)"/)?.[1];
  return content === undefined ? null : decodeEntities(content);
}

function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch { /* bloque roto: se ignora */ }
  }
  return out.flatMap((n) => (Array.isArray(n?.['@graph']) ? n['@graph'] : [n]));
}
const isType = (node, t) => [].concat(node?.['@type'] ?? []).includes(t);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Vocabulario de Sably: sin «afiliado» ni «catálogo» y sin el nombre del creador; se quitan las
 * frases que los contienen. «Certificado» se deja como lo dice la ficha (JP, 26-nov-2026).
 */
export function sanitize(text, creatorNames = []) {
  const t = text.replace(/\s+/g, ' ').trim();
  const prohibido = [
    /afiliad/i, /cat[aá]logo/i,
    ...creatorNames.filter(Boolean).map((n) => n.replace(/[®™©]/g, '').trim()).filter((n) => n.length > 2)
      .map((n) => new RegExp(escapeRe(n), 'i')),
  ];
  return t.split(/(?<=[.!?])\s+/).filter((f) => !prohibido.some((re) => re.test(f))).join(' ').trim();
}

/** Frases de llamada a la acción o de medios de pago: no describen el curso. */
const CTA = /\b(?:PSE|Nequi|Daviplata|Bancolombia|Efecty|en COP)\b|inscr[ií]bete|(?:inicia|comienza|empieza|accede|aprende) hoy|ahora mismo/i;

/** Descripción breve fiel a la ficha: la meta description sin sus frases de llamada a la acción. */
export function shortDescription(text) {
  const frases = text.split(/(?<=[.!?])\s+/);
  // Las metas recortadas acaban en «…»: esa última frase a medias tampoco describe nada.
  const utiles = frases.filter((f, i) => !CTA.test(f) && !(i > 0 && i === frases.length - 1 && /…$|\.\.\.$/.test(f)));
  return (utiles.length ? utiles : frases).join(' ').trim();
}

/** El título del anuncio admite 50 caracteres: si el nombre los pasa, se queda con lo previo a «:». */
export function shortTitle(name) {
  if (name.length <= 50 || !name.includes(':')) return name;
  return name.slice(0, name.indexOf(':')).trim();
}

export function withParams(url, params) {
  const u = new URL(url);
  for (const [k, v] of new URLSearchParams(params)) u.searchParams.set(k, v);
  return u.toString();
}

export function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function hasCheckout(html) {
  for (const m of html.matchAll(/<a\b[^>]*>/g)) {
    const a = attributesOf(m[0]);
    if (a['data-cta-hotmart'] === 'true' && allowedHotmartUrl(a.href ?? '')) return true;
  }
  return false;
}

/** Lee una ficha y devuelve `{ row }` o `{ skip: motivo }`. El precio sale de su panel de compra. */
export function parseFicha(html, slug) {
  const body = tagAttributes(html, '<body') ?? {};
  if (body['data-page-type'] !== 'course') return { skip: 'no es una ficha de curso' };
  const nodes = jsonLd(html);
  const course = nodes.find((n) => isType(n, 'Course'));
  if (!course?.name) return { skip: 'sin JSON-LD de curso' };
  const offer = [].concat(course.offers ?? [])[0];
  if (offer?.availability && !/InStock/i.test(offer.availability)) return { skip: `no disponible (${offer.availability})` };

  const panel = tagAttributes(html, 'data-purchase-panel');
  if (!panel) return { skip: 'sin panel de compra' };
  const currency = panel['data-currency'];
  const base = Number(panel['data-base-amount']);
  const reduced = Number(panel['data-reduced-amount']);
  if (currency !== 'COP' || !Number.isInteger(base) || base <= 0) return { skip: `sin precio en COP (${currency ?? '—'} ${panel['data-base-amount'] ?? '—'})` };
  if (!hasCheckout(html)) return { skip: 'sin botón de pago' };

  const conCupon = body['data-proveedor'] === PROVEEDOR_CON_CUPON;
  const creadores = [course.creator?.name, ...[].concat(course.author ?? []).map((a) => a?.name)].filter(Boolean);
  const title = shortTitle(sanitize(course.name, creadores));
  // La meta description es el resumen que escribe el panel; si viene recortada («…»), la del curso.
  const metaDesc = meta(html, 'description') ?? '';
  const fuente = metaDesc && !/(…|\.\.\.)$/.test(metaDesc.trim()) ? metaDesc : (course.description ?? metaDesc);
  const description = shortDescription(sanitize(fuente, creadores));
  const image = meta(html, 'og:image') ?? [].concat(course.image ?? [])[0];
  const crumbs = nodes.find((n) => isType(n, 'BreadcrumbList'))?.itemListElement ?? [];
  const category = (typeof course.about === 'string' ? course.about : course.about?.name) ?? crumbs.at(-2)?.name ?? '';
  const url = withParams(`${SITE}/${COUNTRY}/${slug}/`, `${conCupon ? 'promo=ads50&' : ''}${UTM}`);
  const enOferta = panel['data-cupon'] === 'aplicado' && Number.isInteger(reduced) && reduced > 0 && reduced < base;
  if (!title || !description || !image) return { skip: 'falta título, descripción o portada' };

  return {
    row: {
      item_id: `co-${slug}`,
      title,
      description,
      url,
      brand: 'Sably',
      seller_name: 'Sably',
      seller_url: `${SITE}/${COUNTRY}/`,
      image_url: image,
      price: `${base} COP`,
      sale_price: enOferta ? `${reduced} COP` : '',
      availability: 'in_stock',
      condition: 'new',
      product_category: category ? `Cursos online > ${category}` : 'Cursos online',
      target_countries: 'CO',
      store_country: 'CO',
      is_eligible_search: 'true',
      is_eligible_checkout: 'false',
      is_ads_eligible: 'true',
      ads_metadata: JSON.stringify({ custom_label_0: conCupon ? 'con_cupon' : 'sin_cupon', custom_label_1: slugify(category) }),
    },
  };
}

/** Problemas que harían rechazar la fila o romper las reglas de Sably. */
export function validateRow(row) {
  const problems = [];
  for (const k of ['item_id', 'title', 'description', 'url', 'brand', 'seller_name', 'image_url', 'availability', 'price', 'target_countries', 'store_country']) {
    if (!row[k]) problems.push(`falta ${k}`);
  }
  if ((row.title ?? '').length > 150) problems.push('título de más de 150 caracteres');
  if (!/^\d+ COP$/.test(row.price ?? '')) problems.push('precio mal formado');
  if (row.sale_price && !/^\d+ COP$/.test(row.sale_price)) problems.push('precio de oferta mal formado');
  for (const k of ['url', 'image_url']) if (!/^https:\/\//.test(row[k] ?? '')) problems.push(`${k} no es https`);
  const texto = `${row.title} ${row.description}`;
  if (/afiliad|cat[aá]logo|masterclasses/i.test(texto)) problems.push('vocabulario prohibido');
  if (/[?&]promo=ads50/.test(row.url ?? '') !== (row.ads_metadata ?? '').includes('"con_cupon"')) problems.push('promo en curso sin cupón');
  return problems;
}

export function toCsv(rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/json' }, redirect: 'manual' });
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

async function imageOk(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, range: 'bytes=0-0' } });
    await res.body?.cancel();
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
  } catch { return false; }
}

export async function buildFeed({ limit = Infinity, log = console.error } = {}) {
  const res = await get(`${SITE}/search-index.json`);
  if (!res.ok) throw new Error(`search-index.json respondió ${res.status}`);
  const slugs = [...new Set((await res.json()).map((c) => c.s).filter(Boolean))].slice(0, limit);
  const rows = [];
  const skipped = [];
  const queue = [...slugs];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const slug = queue.shift();
      const r = await get(`${SITE}/${COUNTRY}/${slug}/`);
      if (r.status !== 200) { await r.body?.cancel(); skipped.push({ slug, motivo: `HTTP ${r.status}` }); continue; }
      const out = parseFicha(await r.text(), slug);
      if (out.skip) { skipped.push({ slug, motivo: out.skip }); continue; }
      const problems = validateRow(out.row);
      if (!(await imageOk(out.row.image_url))) problems.push('la portada no responde como imagen');
      if (problems.length) { skipped.push({ slug, motivo: problems.join('; ') }); continue; }
      rows.push(out.row);
    }
  }));
  rows.sort((a, b) => a.item_id.localeCompare(b.item_id));
  skipped.sort((a, b) => a.slug.localeCompare(b.slug));
  log(`Feed CO: ${rows.length} cursos dentro, ${skipped.length} fuera (de ${slugs.length}).`);
  for (const s of skipped) log(`  fuera: ${s.slug} — ${s.motivo}`);
  return { rows, skipped };
}

export function upload(csvPath, { uri = process.env.OPENAI_FEED_SFTP_URI, keyFile = process.env.OPENAI_FEED_SFTP_KEY_FILE } = {}) {
  if (!uri || !keyFile) throw new Error('Faltan OPENAI_FEED_SFTP_URI u OPENAI_FEED_SFTP_KEY_FILE.');
  const u = new URL(uri);
  const dir = mkdtempSync(join(tmpdir(), 'feed-'));
  const batch = join(dir, 'batch');
  writeFileSync(batch, `put "${csvPath}" ${FILE_NAME}\nls -l\n`);
  try {
    return execFileSync('sftp', [
      '-b', batch, '-i', keyFile, '-P', u.port || '22',
      '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
      `${decodeURIComponent(u.username)}@${u.hostname}`,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const ADS_API = 'https://api.ads.openai.com/v1';
async function adsApi(path, { method = 'GET', body, key = process.env.OPENAI_ADS_API_KEY } = {}) {
  const res = await fetch(`${ADS_API}${path}`, {
    method,
    // Cloudflare de OpenAI responde 1010 a peticiones sin User-Agent.
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'user-agent': UA },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** Artículos que el feed tiene hoy (consulta paginada de OpenAI). */
export async function feedItemIds(feedId, api = adsApi) {
  const ids = [];
  let after;
  for (let page = 0; page < 50; page++) {
    const { status, data } = await api(`/feeds/${feedId}/items/query`, { method: 'POST', body: { filters: [], limit: 500, ...(after ? { after } : {}) } });
    if (status !== 200) throw new Error(`items/query respondió ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    ids.push(...(data.data ?? []).map((i) => i.item_id).filter(Boolean));
    if (!data.has_more || !data.last_id) break;
    after = data.last_id;
  }
  return ids;
}

/** Espera a que OpenAI termine de procesar la última subida del feed (hasta `minutes`). */
export async function waitForUpload(feedId, { api = adsApi, minutes = 20, pause = 20_000, since } = {}) {
  const limite = Date.now() + minutes * 60_000;
  for (;;) {
    const { status, data } = await api('/feeds/uploads');
    const u = status === 200 ? (data.uploads ?? []).find((x) => x.feed_id === feedId && (!since || x.uploaded_at >= since)) : null;
    if (u && !['scanning', 'received', 'processing'].includes(u.status)) return u;
    if (Date.now() > limite) return u ?? null;
    await new Promise((r) => setTimeout(r, pause));
  }
}

/**
 * Envía por el Delta API la disponibilidad de cada curso: los del CSV `in_stock` y los que el
 * feed tiene pero ya no salen del sitio `out_of_stock` (la cuenta no tiene «reemplazo completo»:
 * PATCH settings `is_full_refresh` da 403, y un curso retirado seguiría anunciándose).
 * Además, comprobado el 26-nov-2026: la subida completa queda `completed` pero OpenAI no indexa
 * los productos hasta que reciben una actualización por este API. Ese día el API respondía
 * `503 Product updates are temporarily unavailable` y aun así aplicaba el cambio en < 1 min, así
 * que un 503 no se trata como fallo: se reintenta y, si persiste, se comprueba con items/query.
 */
export async function syncAvailability(feedId, currentIds, api = adsApi) {
  const vigentes = new Set(currentIds);
  const retirados = (await feedItemIds(feedId, api)).filter((id) => !vigentes.has(id));
  const productos = [
    ...currentIds.map((id) => ({ id, variants: [{ id, availability: { status: 'in_stock' } }] })),
    ...retirados.map((id) => ({ id, variants: [{ id, availability: { status: 'out_of_stock' } }] })),
  ];
  let ultimo;
  for (let i = 0; i < productos.length; i += 100) {
    const lote = productos.slice(i, i + 100);
    for (let intento = 1; intento <= 3; intento++) {
      ultimo = await api(`/feeds/${feedId}/products`, { method: 'PATCH', body: { products: lote } });
      if (ultimo.status === 200 && ultimo.data.accepted === true) break;
      if (ultimo.status !== 503) throw new Error(`Delta API respondió ${ultimo.status}: ${JSON.stringify(ultimo.data).slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 2000 * intento));
    }
  }
  return { retirados, status: ultimo?.status ?? 200 };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }));
  const out = args.out ?? join(tmpdir(), FILE_NAME);
  const { rows } = await buildFeed({ limit: args.limit ? Number(args.limit) : Infinity });
  writeFileSync(out, toCsv(rows));
  console.error(`Escrito ${out}`);
  if (args.upload) {
    const min = Number(args['min-rows'] ?? 20);
    if (rows.length < min) throw new Error(`Solo ${rows.length} cursos (< ${min}): no se sube para no vaciar el feed.`);
    const inicio = new Date(Date.now() - 60_000).toISOString().replace(/\.\d+Z$/, 'Z');
    console.error(upload(out));
    const feedId = process.env.OPENAI_FEED_ID;
    if (feedId && process.env.OPENAI_ADS_API_KEY) {
      // La subida ya está hecha: si algo de aquí falla, se avisa en el job sin darlo por fallido.
      try {
        const u = await waitForUpload(feedId, { since: inicio });
        console.error(`Subida ${u?.upload_id ?? '¿?'}: ${u?.status ?? 'sin noticias'}, ${u?.rows_accepted ?? '?'} aceptadas, ${u?.rows_rejected ?? '?'} rechazadas.`);
        if (u?.rows_rejected) console.log(`::warning::OpenAI rechazó ${u.rows_rejected} filas: ${JSON.stringify(u.diagnostics)}`);
        const { retirados, status } = await syncAvailability(feedId, rows.map((r) => r.item_id));
        console.error(`Disponibilidad enviada (HTTP ${status}).${retirados.length ? ` Marcados agotados: ${retirados.join(', ')}` : ''}`);
        await new Promise((r) => setTimeout(r, 90_000));
        const indexados = await feedItemIds(feedId);
        console.error(`Indexados en OpenAI: ${indexados.length} de ${rows.length}.`);
        if (indexados.length < rows.length * 0.9) console.log(`::warning::Solo ${indexados.length} de ${rows.length} cursos indexados en OpenAI.`);
      } catch (e) {
        console.log(`::warning::Feed subido, pero falló la sincronización con OpenAI: ${e.message}`);
      }
    } else {
      console.error('Sin OPENAI_FEED_ID u OPENAI_ADS_API_KEY: no se revisan cursos retirados.');
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
