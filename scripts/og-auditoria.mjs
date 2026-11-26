#!/usr/bin/env node
/**
 * Auditoría de las etiquetas de imagen para compartir (Open Graph y Twitter) de
 * todas las URL de los sitemaps. Solo lectura contra el sitio.
 *
 *   node scripts/og-auditoria.mjs [--base https://sably.co] [--salida auditoria.csv] [--concurrencia 6]
 *
 * Saca por URL: og:image, twitter:image, ancho/alto/alt/tipo declarados, si la
 * imagen responde 200, sus dimensiones y peso reales, y si es la genérica
 * (/covers/oficios.jpg o cualquier /og/ propia del sitio).
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'https://sably.co').replace(/\/$/, '');
const SALIDA = arg('salida', 'auditoria.csv');
const CONC = Number(arg('concurrencia', '6'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const get = (u, o = {}) => fetch(u, { ...o, headers: { 'user-agent': UA, ...(o.headers ?? {}) }, redirect: 'follow' });
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

async function urlsDelSitio() {
  const indice = locs(await (await get(`${BASE}/sitemap-index.xml`)).text());
  const todas = [];
  for (const s of indice) {
    const u = s.replace('https://sably.co', BASE);
    for (const l of locs(await (await get(u)).text())) todas.push({ url: l.replace('https://sably.co', BASE), mapa: s.split('/').pop() });
  }
  return todas;
}

function meta(html, clave) {
  const re = new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${clave.replace(/[:]/g, '\\:')}["'][^>]*>`, 'i');
  const m = html.match(re);
  if (!m) return '';
  const c = m[0].match(/content=["']([^"']*)["']/i);
  return c ? c[1].replace(/&amp;/g, '&') : '';
}

const cacheImg = new Map();
async function imagen(url) {
  if (!url) return { estado: '', ancho: '', alto: '', kb: '' };
  if (cacheImg.has(url)) return cacheImg.get(url);
  const p = (async () => {
    try {
      const r = await get(url);
      if (!r.ok) return { estado: String(r.status), ancho: '', alto: '', kb: '' };
      const buf = Buffer.from(await r.arrayBuffer());
      const m = await sharp(buf).metadata();
      return { estado: '200', ancho: m.width ?? '', alto: m.height ?? '', kb: Math.round(buf.length / 1024) };
    } catch (e) { return { estado: 'error', ancho: '', alto: '', kb: '' }; }
  })();
  cacheImg.set(url, p);
  return p;
}

const tipo = (u) => {
  const p = new URL(u).pathname;
  if (/^\/blog\/[^/]+\/?$/.test(p) || /^\/[a-z]{2}\/blog\/.+/.test(p)) return 'articulo';
  if (/^\/[a-z]{2}\/curso-/.test(p) || /^\/[a-z]{2}\/[^/]+\/curso-/.test(p)) return 'ficha';
  if (/^\/[a-z]{2}\/cursos\/[^/]+\/?$/.test(p)) return 'categoria';
  if (/^\/[a-z]{2}\/cursos\/?$/.test(p)) return 'listado';
  if (/^\/[a-z]{2}\/?$/.test(p)) return 'portada';
  if (/^\/blog\/?$/.test(p)) return 'blog-indice';
  if (/videos/.test(p)) return 'video';
  if (/homologaci/.test(p)) return 'homologacion';
  return 'otra';
};

const cab = ['url', 'mapa', 'tipo', 'http', 'og_image', 'twitter_image', 'og_width', 'og_height', 'og_type', 'og_alt', 'tw_alt', 'twitter_card',
  'img_http', 'img_ancho', 'img_alto', 'img_kb', 'generica', 'og_igual_twitter'];
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const lista = await urlsDelSitio();
console.error(`${lista.length} URL en los sitemaps`);
const filas = new Array(lista.length);
let i = 0, hechas = 0;
async function trabajador() {
  while (true) {
    const k = i++;
    if (k >= lista.length) return;
    const { url, mapa } = lista[k];
    let html = '', http = '';
    try { const r = await get(url); http = r.status; html = await r.text(); } catch { http = 'error'; }
    const og = meta(html, 'og:image');
    const im = await imagen(og ? new URL(og, url).href : '');
    filas[k] = {
      url, mapa, tipo: tipo(url), http, og_image: og, twitter_image: meta(html, 'twitter:image'),
      og_width: meta(html, 'og:image:width'), og_height: meta(html, 'og:image:height'), og_type: meta(html, 'og:image:type'),
      og_alt: meta(html, 'og:image:alt'), tw_alt: meta(html, 'twitter:image:alt'), twitter_card: meta(html, 'twitter:card'),
      img_http: im.estado, img_ancho: im.ancho, img_alto: im.alto, img_kb: im.kb,
      generica: /\/covers\/oficios\.jpg|\/og\/(?!cursos\/)/.test(og) ? 'si' : 'no',
      og_igual_twitter: og && og === meta(html, 'twitter:image') ? 'si' : 'no',
    };
    if (++hechas % 100 === 0) console.error(`${hechas}/${lista.length}`);
  }
}
await Promise.all(Array.from({ length: CONC }, trabajador));
writeFileSync(SALIDA, [cab.join(','), ...filas.map((f) => cab.map((c) => esc(f[c])).join(','))].join('\n') + '\n');
console.error(`escrito ${SALIDA}`);
