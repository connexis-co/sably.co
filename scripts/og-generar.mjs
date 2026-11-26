#!/usr/bin/env node
/**
 * Genera las imágenes para compartir (Open Graph) de las páginas principales.
 * Coste cero: compone una plantilla HTML con las fotos que ya tiene el sitio y
 * el logo real, la captura con Chrome (puppeteer-core) y la comprime con sharp.
 *
 *   node scripts/og-generar.mjs [--solo portada-co,nosotros] [--hoja ruta/hoja.jpg]
 *
 * La lista de imágenes, sus textos y sus fotos viven en src/lib/og-imagenes.json
 * (la misma que lee src/lib/og.ts para declarar la etiqueta og:image). Para
 * cambiar una imagen: edita el JSON, sube `version` y vuelve a ejecutar; el
 * nombre del archivo lleva la versión para que WhatsApp, Facebook, X y LinkedIn
 * no reutilicen la copia guardada de la URL anterior.
 *
 * Fuentes de foto en el JSON:
 *   «v2:foto-barberia-1»  (añade «@70» para centrar el recorte en el sujeto, al 70 % del ancho de la foto) public/v2/fotos/foto-barberia-1-960.webp (o -1600 si existe)
 *   «cms:<id>»            /_emdash/api/media/file/<id> de producción (lectura pública), cacheada en scripts/.og-cache/
 *
 * Diseño: 1200×630, zona segura central de 700 px (el texto no pasa de 600) (las plataformas que recortan
 * a cuadrado conservan logo y texto); las fotos van en los laterales.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SOLO = arg('solo', '')?.split(',').filter(Boolean);
const catalogo = JSON.parse(readFileSync(resolve(RAIZ, 'src/lib/og-imagenes.json'), 'utf8'));
const CACHE = resolve(RAIZ, 'scripts/.og-cache');
const SALIDA = resolve(RAIZ, 'public/og');
mkdirSync(CACHE, { recursive: true }); mkdirSync(SALIDA, { recursive: true });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

async function rutaFoto(refCompleta) {
  const ref = refCompleta.split('@')[0];
  const [tipo, nombre] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
  if (tipo === 'v2') {
    for (const a of ['1600', '960']) { const p = resolve(RAIZ, `public/v2/fotos/${nombre}-${a}.webp`); if (existsSync(p)) return p; }
    throw new Error(`No existe la foto ${ref}`);
  }
  if (tipo === 'cms') {
    const p = resolve(CACHE, `${nombre}.img`);
    if (!existsSync(p)) {
      const r = await fetch(`https://sably.co/_emdash/api/media/file/${nombre}`, { headers: { 'user-agent': UA } });
      if (!r.ok) throw new Error(`No se pudo bajar ${ref}: ${r.status}`);
      writeFileSync(p, Buffer.from(await r.arrayBuffer()));
    }
    return p;
  }
  throw new Error(`Fuente desconocida: ${ref}`);
}
const dataUri = async (p) => `data:image/jpeg;base64,${(await sharp(p).rotate().jpeg({ quality: 92 }).toBuffer()).toString('base64')}`;
const fuente = (f) => `data:font/woff2;base64,${readFileSync(resolve(RAIZ, `node_modules/@fontsource-variable/${f}`)).toString('base64')}`;
const logo = `data:image/png;base64,${readFileSync(resolve(RAIZ, 'brand/sably-logo-white.png')).toString('base64')}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* Tamaño del titular según su longitud: legible en la miniatura de WhatsApp (~300 px). */
function tamano(titulo) {
  const largo = Math.max(...titulo.split('|').map((l) => l.length));
  const lineas = titulo.split('|').length;
  const porAncho = 600 / (largo * 0.5);
  const porAlto = (lineas > 2 ? 230 : 250) / (lineas * 1.08);
  return Math.floor(Math.min(84, porAncho, porAlto));
}

async function html(it) {
  const [a, b] = await Promise.all(it.fotos.map(async (f) => dataUri(await rutaFoto(f))));
  const posicion = async (f) => {
    if (!f.includes('@')) return '50% 50%';
    const m = await sharp(await rutaFoto(f)).metadata();
    const ancho = (630 * m.width) / m.height;
    if (ancho <= 250) return '50% 50%';
    const p = Math.min(100, Math.max(0, (((Number(f.split('@')[1]) / 100) * ancho - 125) / (ancho - 250)) * 100));
    return `${p.toFixed(1)}% 50%`;
  };
  const [pa, pb] = await Promise.all(it.fotos.map(posicion));
  const lineas = it.titulo.split('|').map(esc);
  const px = tamano(it.titulo);
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Outfit;font-weight:100 900;src:url(${fuente('outfit/files/outfit-latin-wght-normal.woff2')}) format('woff2-variations')}
@font-face{font-family:Inter;font-weight:100 900;src:url(${fuente('inter/files/inter-latin-wght-normal.woff2')}) format('woff2-variations')}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:#1b1b3a;position:relative;font-family:Inter,sans-serif;color:#fff}
.f{position:absolute;top:0;bottom:0;width:250px;background-size:cover}
.f.i{left:0;background-position:${pa};background-image:url(${a});border-right:6px solid #e8456b}
.f.d{right:0;background-image:url(${b});border-left:6px solid #e8456b;background-position:${pb}}
.c{position:absolute;left:250px;right:250px;top:0;bottom:0;padding:40px 50px 40px;display:flex;flex-direction:column;align-items:center;text-align:center;
background:radial-gradient(120% 90% at 50% 0%,#2f2f63 0%,#1b1b3a 62%)}
.logo{height:66px;margin-bottom:auto}
.k{font:700 25px/1 Outfit;letter-spacing:.14em;text-transform:uppercase;color:#fbd9e2;margin-bottom:18px}
h1{font:700 ${px}px/1.08 Outfit;letter-spacing:-.01em;text-wrap:balance}
h1 em{font-style:normal;color:#ff8aa6}
.s{margin-top:22px;font:700 29px/1.2 Inter;color:#fff;background:#c92c52;padding:11px 28px;border-radius:999px}
.base{margin-top:auto;height:6px}
</style>
<div class="f i"></div><div class="f d"></div>
<div class="c"><img class="logo" src="${logo}" alt="">
<div style="margin:auto 0;display:flex;flex-direction:column;align-items:center">
${it.kicker ? `<div class="k">${esc(it.kicker)}</div>` : ''}
<h1>${lineas.map((l, i) => (it.acento === i + 1 ? `<em>${l}</em>` : l)).join('<br>')}</h1>
${it.sub ? `<div class="s">${esc(it.sub)}</div>` : ''}</div><div class="base"></div></div>`;
}

const items = catalogo.imagenes.filter((i) => !SOLO.length || SOLO.includes(i.id));
const nav = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const pag = await nav.newPage();
await pag.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
const hechas = [];
for (const it of items) {
  await pag.setContent(await html(it), { waitUntil: 'load' });
  await pag.evaluate(() => document.fonts.ready);
  const png = await pag.screenshot({ type: 'png' });
  let q = 88, buf;
  do { buf = await sharp(png).jpeg({ quality: q, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer(); q -= 4; } while (buf.length > 280 * 1024 && q > 50);
  const nombre = `${it.id}.v${catalogo.version}.jpg`;
  writeFileSync(resolve(SALIDA, nombre), buf);
  hechas.push({ id: it.id, nombre, kb: Math.round(buf.length / 1024) });
  console.log(`${nombre}  ${Math.round(buf.length / 1024)} KB`);
}
await nav.close();

const hoja = arg('hoja', '');
if (hoja) {
  const cols = 4, w = 400, h = 210, sep = 14;
  const filas = Math.ceil(hechas.length / cols);
  const capas = await Promise.all(hechas.map(async (x, i) => ({
    input: await sharp(resolve(SALIDA, x.nombre)).resize(w, h).toBuffer(), left: sep + (i % cols) * (w + sep), top: sep + Math.floor(i / cols) * (h + 26 + sep) })));
  const rot = hechas.map((x, i) => `<text x="${sep + (i % cols) * (w + sep)}" y="${sep + Math.floor(i / cols) * (h + 26 + sep) + h + 18}" font-size="14" font-family="Helvetica" fill="#333">${x.nombre} · ${x.kb} KB</text>`).join('');
  const W = sep + cols * (w + sep), H = sep + filas * (h + 26 + sep);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#f1f1f4' } })
    .composite([...capas, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rot}</svg>`), left: 0, top: 0 }])
    .jpeg({ quality: 88 }).toFile(resolve(hoja));
  console.log(`hoja: ${hoja}`);
}
