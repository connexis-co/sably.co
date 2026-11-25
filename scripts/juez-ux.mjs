#!/usr/bin/env node
/**
 * Juez de UX y UI de sably.co. SOLO LEE: no envía formularios, no acepta cookies, no pulsa enlaces de pago
 * (solo lee su href) y bloquea en la página cualquier clic de pago/WhatsApp o envío por si acaso.
 *
 *   node scripts/juez-ux.mjs --base https://sably.co --salida docs/equipo/2026-11-25/ux/linea-base
 *        [--paises co,mx,...] [--vistas 390,768,1440] [--solo portada,listado,...] [--pausa 1500]
 *        [--sin-enlaces] [--max-enlaces 1500] [--completas co,mx] [--reanudar]
 *
 * Escribe en <salida>: resultados.json (todo, por página×vista), resumen.md (legible, agrupado), capturas/*.jpg
 * (una por defecto distinto, con el elemento enmarcado en rojo) y completas/*.jpg (páginas enteras de ojo).
 * Código de salida 1 si hay defectos graves. Una página a la vez: el servidor vive al límite de memoria.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const puppeteer = require('puppeteer-core');

const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const bandera = (n) => args.includes(`--${n}`);
const BASE = opcion('base', 'https://sably.co').replace(/\/$/, '');
const SALIDA = opcion('salida', 'juez-ux-salida');
const CHROME = opcion('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
// Solo códigos de país de dos letras: el país entra en una expresión regular (CodeQL, inyección de RegExp).
const PAISES = opcion('paises', 'co,mx,pe,ec,cl,ar,es,us').split(',').filter((p) => /^[a-z]{2}$/.test(p));
const escaparRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VISTAS = { 390: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 768: { width: 768, height: 1024, hasTouch: true, deviceScaleFactor: 1 }, 1440: { width: 1440, height: 900 } };
const vistas = opcion('vistas', '390,768,1440').split(',');
const SOLO = opcion('solo', '') ? opcion('solo', '').split(',') : null;
const PAUSA = Number(opcion('pausa', '1500'));
const MAX_ENLACES = Number(opcion('max-enlaces', '1500'));
const COMPLETAS = opcion('completas', 'co,mx').split(',');
const UA_ESCRITORIO = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const UA_MOVIL = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const ahora = () => new Date().toISOString();
const HOST = new URL(BASE).hostname;
const aleatorio = () => Math.random().toString(36).slice(2, 10);
const conT = (ruta) => `${BASE}${ruta}${ruta.includes('?') ? '&' : '?'}t=${aleatorio()}`;
mkdirSync(join(SALIDA, 'capturas'), { recursive: true });
mkdirSync(join(SALIDA, 'completas'), { recursive: true });

async function leer(ruta) {
  const r = await fetch(conT(ruta), { headers: { 'user-agent': UA_ESCRITORIO }, redirect: 'follow' });
  return r.ok ? await r.text() : '';
}
const hrefs = (html, re) => [...new Set([...html.matchAll(/href="([^"#?]+)"/g)].map((m) => m[1]).filter((h) => re.test(h)))];

/* ---------- Descubrimiento de URL (una lectura por país, con pausa) ---------- */
async function plan() {
  const paginas = [];
  const mapa = [];
  for (const [i, c] of PAISES.entries()) {
    const listado = await leer(`/${c}/cursos/`); await espera(PAUSA);
    const fichas = hrefs(listado, new RegExp(`^/${escaparRe(c)}/curso-de-[^/]+/$`));
    const cats = hrefs(listado, new RegExp(`^/${escaparRe(c)}/cursos/[^/]+/$`));
    const categoria = cats.find((h) => h.includes('/oficios/')) ?? cats[0] ?? `/${c}/cursos/oficios/`;
    const masajes = fichas.find((h) => h.includes('masajes-terapeuticos')) ?? fichas[0];
    let pago = null;
    const candidatas = fichas.filter((h) => h !== masajes);
    for (let k = 0; k < Math.min(8, candidatas.length) && !pago; k++) {
      const h = candidatas[(i * 7 + 3 + k) % candidatas.length];
      const html = await leer(h); await espera(700);
      if (/href="https:\/\/(go\.hotmart\.com|hotm\.(io|art)|pay\.hotmart\.com)/.test(html)) pago = h;
    }
    paginas.push({ pais: c, id: `${c}-portada`, tipo: 'portada', ruta: `/${c}/` });
    paginas.push({ pais: c, id: `${c}-listado`, tipo: 'listado', ruta: `/${c}/cursos/` });
    paginas.push({ pais: c, id: `${c}-categoria`, tipo: 'categoria', ruta: categoria });
    if (masajes) paginas.push({ pais: c, id: `${c}-ficha-masajes`, tipo: 'ficha', ruta: masajes, exigePago: true });
    if (pago) paginas.push({ pais: c, id: `${c}-ficha-pago`, tipo: 'ficha', ruta: pago, exigePago: true });
    else mapa.push(`${c}: no se halló una segunda ficha con pago entre ${candidatas.length} candidatas`);
    if (c === PAISES[0]) {
      const creador = hrefs(listado, new RegExp(`^/${c}/creadores/[^/]+/$`))[0] ?? `/${c}/creadores/mauricio-duque/`;
      const blog = await leer('/blog/'); await espera(PAUSA);
      const arts = hrefs(blog, /^\/blog\/[^/]+\/$/).filter((h) => h !== '/blog/');
      const vids = await leer('/videos/'); await espera(PAUSA);
      const vid = hrefs(vids, /^\/videos\/[^/]+\/$/)[0];
      const comunes = [['blog', 'blog', '/blog/'], ['articulo-1', 'articulo', arts[0]], ['articulo-2', 'articulo', arts[Math.floor(arts.length / 2)] ?? arts[1]],
        ['nosotros', 'comun', '/nosotros/'], ['contacto', 'comun', '/contacto/'], ['legal', 'comun', '/legal/privacidad/'], ['creador', 'comun', creador],
        ['videos', 'comun', '/videos/'], ['video', 'comun', vid], ['mapa-html', 'comun', '/sitemap/'], ['404', 'error404', `/${c}/pagina-que-no-existe-juez-ux/`]];
      for (const [id, tipo, ruta] of comunes) if (ruta) paginas.push({ pais: 'comun', id, tipo, ruta });
    }
  }
  return { paginas, mapa };
}

/* ---------- Auditoría dentro de la página ---------- */
function AUDITAR({ vista, tipo, ancho }) {
  const out = [];
  const add = (t, o) => out.push({ tipo: t, ...o });
  const vw = innerWidth, vh = innerHeight;
  const esc = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const sel = (el) => {
    const partes = [];
    let n = el;
    for (let d = 0; n && n.nodeType === 1 && d < 5 && n !== document.documentElement; d++, n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id && !/^\d|[:.]/.test(n.id)) { partes.unshift(`${s}#${n.id}`); break; }
      const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/).filter((c) => c && !/[:\[\]\/%!]/.test(c) && !/^(w|h|p|m|px|py|mt|mb|ml|mr|gap|flex|grid|text|bg|rounded|font|items|justify|min|max|size|inline|block|hidden|relative|absolute|overflow|z|top|left|right|bottom|col|row|space)-/.test(c) && !['flex', 'grid', 'block', 'hidden', 'relative', 'absolute', 'fixed', 'sticky', 'truncate', 'contents', 'inline'].includes(c)).slice(0, 2) : [];
      s += cls.map((c) => `.${c}`).join('');
      const data = [...n.attributes].find((a) => /^data-(?!astro|cms)/.test(a.name));
      if (!cls.length && data) s += `[${data.name}]`;
      const hermanos = n.parentElement ? [...n.parentElement.children].filter((h) => h.tagName === n.tagName) : [];
      if (hermanos.length > 1 && !cls.length) s += `:nth-of-type(${hermanos.indexOf(n) + 1})`;
      partes.unshift(s);
    }
    return partes.join(' > ');
  };
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  const oculto = (el) => !!el.closest('[hidden],[inert],[aria-hidden="true"]:not(svg *)') ;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    if (el.closest('[hidden],[inert]')) return false;
    return true;
  };
  const srOnly = (el, r) => (r.width <= 2 || r.height <= 2) || /sr-only/.test(el.className?.toString?.() ?? '');
  const conTexto = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const todos = [...document.body.querySelectorAll('*')].filter((e) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'LINK', 'META', 'BR', 'TEMPLATE'].includes(e.tagName.toUpperCase()) && !(e instanceof SVGElement && e.tagName !== 'svg'));
  const sig = (el) => { const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((x) => x.startsWith('v2-')).slice(0, 2).join('.') : ''; return el.tagName.toLowerCase() + (c ? '.' + c : '') ; };

  /* 1 · Desbordamiento horizontal del documento y elementos que se salen */
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1) add('desborde-documento', { gravedad: 'grave', sel: 'html', detalle: `scrollWidth ${Math.max(de.scrollWidth, document.body.scrollWidth)} > ventana ${vw}` });
  const recortado = (el) => { for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) { const o = getComputedStyle(a); if (/(hidden|clip|auto|scroll)/.test(o.overflowX)) return true; if (o.position === 'fixed') return false; } return false; };
  const fuera = [];
  for (const el of todos) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || (r.right <= vw + 1 && r.left >= -1)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('[hidden],[inert]') || srOnly(el, r)) continue;
    if (cs.position === 'fixed' && (r.left >= vw || r.right <= 0)) continue;
    if (recortado(el)) continue;
    if (fuera.some((f) => f.contains(el))) continue;
    fuera.push(el);
  }
  fuera.slice(0, 15).forEach((el) => add('fuera-de-ventana', { gravedad: 'grave', sel: sel(el), r: rect(el), detalle: `x ${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)} con ventana ${vw}`, texto: esc(el.textContent).slice(0, 60) }));

  /* 2 · Texto cortado o desbordado */
  const PRECIO = /(\$|€|S\/|US\$)\s?\d|\d[\d., ]*\s?(COP|MXN|PEN|USD|CLP|ARS|EUR)/;
  const textoFuera = (el, clipX, clipY) => { const b = el.getBoundingClientRect(); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, i = 0; while ((n = w.nextNode()) && i++ < 40) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) { if (r.width < 1) continue; if ((clipX && r.right > b.right + 1.5) || (clipY && r.bottom > b.bottom + 1.5)) return true; } } return false; };
  const cortes = [];
  for (const el of todos) {
    const cs = getComputedStyle(el);
    if (cs.display === 'inline' || cs.display === 'contents' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3 || srOnly(el, r) || el.clientWidth <= 2 || el.clientHeight <= 2) continue;
    const t = esc(el.textContent);
    if (!t || t.length > 600) continue;
    if (el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) <= 2 || el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) <= 2) continue; // bloque colapsado a propósito
    const dx = el.scrollWidth - el.clientWidth, dy = el.scrollHeight - el.clientHeight;
    if (dx <= 1 && dy <= 1) continue;
    if (el.closest('[hidden],[inert]') || cs.visibility === 'hidden') continue;
    const clipX = /(hidden|clip)/.test(cs.overflowX), clipY = /(hidden|clip)/.test(cs.overflowY);
    const scrollable = /(auto|scroll)/.test(cs.overflowX) && dx > 1;
    if (scrollable) continue;
    if (!textoFuera(el, clipX || dx > 1, clipY || dy > 1)) continue;
    const puntos = cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
    const importante = /^h[1-6]$/i.test(el.tagName) || !!el.closest('h1,h2,h3,h4,[class*="titulo"],[class*="title"],[class*="precio"],[class*="price"],[data-base]') || PRECIO.test(t) || el.matches('a,button,summary') || (+cs.fontWeight >= 600 && cs.webkitLineClamp === 'none');
    if (puntos && ((clipX && dx > 1) || (clipY && dy > 1) || cs.webkitLineClamp !== 'none')) { cortes.push({ el, k: 'truncado', imp: importante, dx, dy, t }); continue; }
    if ((clipX && dx > 1 && conTexto(el)) || (clipY && dy > 1 && (conTexto(el) || el.children.length < 4))) cortes.push({ el, k: 'cortado', imp: importante, dx, dy, t });
    else if (!clipX && dx > 2 && conTexto(el) && !/(auto|scroll)/.test(cs.overflowX)) cortes.push({ el, k: 'desbordado', imp: importante, dx, dy, t });
  }
  for (const c of cortes.slice(0, 40)) {
    const base = { sel: sel(c.el), r: rect(c.el), texto: c.t.slice(0, 90), detalle: `scrollW ${c.el.scrollWidth}/clientW ${c.el.clientWidth}, scrollH ${c.el.scrollHeight}/clientH ${c.el.clientHeight}` };
    if (c.k === 'truncado') add('texto-puntos-suspensivos', { ...base, gravedad: c.imp ? 'medio' : 'leve', importante: c.imp });
    else add(c.k === 'cortado' ? 'texto-cortado' : 'texto-desbordado', { ...base, gravedad: c.imp || c.k === 'cortado' ? 'medio' : 'leve', importante: c.imp });
  }
  /* Se sale de su contenedor (texto que sobrepasa a su padre visible) */
  let fc = 0;
  for (const el of todos) {
    if (fc > 15) break;
    if (!conTexto(el) || !el.parentElement) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'absolute' || cs.position === 'fixed' || cs.display === 'inline' || cs.display === 'contents') continue;
    const p = el.parentElement, ps = getComputedStyle(p);
    if (/(auto|scroll)/.test(ps.overflowX) || ps.display === 'contents' || ps.display === 'inline') continue;
    const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect();
    if (r.width < 4 || pr.width < 4 || r.right > vw + 1 || r.left < -1) continue;
    if (/(flex|grid)/.test(ps.display) && /(row|^)/.test(ps.flexDirection) && el.matches('[class*="sr-only"]')) continue;
    if (r.right > pr.right + 3 && ps.overflowX === 'visible' && cs.visibility !== 'hidden' && +cs.opacity > 0 && !p.closest('[hidden],[inert]')) { fc++; add('fuera-de-contenedor', { gravedad: 'medio', sel: sel(el), r: rect(el), texto: esc(el.textContent).slice(0, 60), detalle: `derecha ${Math.round(r.right)} > padre ${Math.round(pr.right)} (${sel(p)})` }); }
  }

  /* 3 · Piezas fijas o pegajosas */
  const fijos = todos.filter((el) => { const cs = getComputedStyle(el); if (!/^(fixed|sticky)$/.test(cs.position)) return false; const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || cs.visibility === 'hidden' || +cs.opacity === 0 || cs.display === 'none') return false; if (el.closest('[inert],[hidden]')) return false; if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return false; if (cs.pointerEvents === 'none' && !el.textContent.trim()) return false; return true; })
    .filter((el, i, arr) => !arr.some((o) => o !== el && o.contains(el)));
  const caja = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: Math.max(r.top, 0), r: Math.min(r.right, vw), b: Math.min(r.bottom, vh) }; };
  const piezas = fijos.map((el) => ({ sel: sel(el), z: getComputedStyle(el).zIndex, ...caja(el), pos: getComputedStyle(el).position }));
  const solapes = [];
  for (let i = 0; i < fijos.length; i++) for (let j = i + 1; j < fijos.length; j++) {
    if (fijos[i].contains(fijos[j]) || fijos[j].contains(fijos[i])) continue;
    const sale = (e) => { if (getComputedStyle(e).position !== 'sticky' || !e.parentElement) return false; return e.parentElement.getBoundingClientRect().bottom <= e.getBoundingClientRect().bottom + 1; }; // pegajoso que se va con el final de su contenedor: es el comportamiento normal
    if (sale(fijos[i]) || sale(fijos[j])) continue;
    if (fijos[i].matches(':popover-open,dialog[open]') || fijos[j].matches(':popover-open,dialog[open]')) continue; // capa superior: tapar el resto es lo esperado
    const a = caja(fijos[i]), b = caja(fijos[j]);
    const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    if (w > 3 && h > 3) solapes.push({ a: piezas[i], b: piezas[j], w: Math.round(w), h: Math.round(h) });
  }
  solapes.forEach((s) => add('solape-fijos', { gravedad: s.w * s.h > 1500 ? 'medio' : 'leve', sel: `${s.a.sel}  ×  ${s.b.sel}`, detalle: `solape ${s.w}×${s.h}px entre ${s.a.sel} (z ${s.a.z}, ${s.a.pos}) y ${s.b.sel} (z ${s.b.z}, ${s.b.pos}), scroll ${Math.round(scrollY)}`, scrollY: Math.round(scrollY), selA: s.a.sel, selB: s.b.sel }));
  /* Una pieza fija que tapa el botón de compra o el campo activo */
  const compra = [...document.querySelectorAll('a[href*="hotmart"],a[href*="hotm."],a[data-pago],a[data-cta-hotmart]')].filter(vis);
  for (const c of compra) { const cr = c.getBoundingClientRect(); if (cr.bottom < 0 || cr.top > vh) continue; const cx = cr.left + cr.width / 2, cy = cr.top + Math.min(cr.height / 2, 20); const top = document.elementFromPoint(cx, cy); if (top && !c.contains(top) && !top.contains(c) && fijos.some((f) => f.contains(top)) && !top.closest(':popover-open,dialog[open],#v2-megamenu,[popover]')) add('fijo-tapa-compra', { gravedad: top.closest('#sbc') ? 'medio' : 'grave', sel: sel(c), r: rect(c), detalle: `${sel(top)} cubre el botón de compra con scroll ${Math.round(scrollY)}` }); }

  /* 4 · Imágenes */
  const imgs = [...document.images];
  const grupoImg = new Map();
  for (const im of imgs) {
    const r = im.getBoundingClientRect(), cs = getComputedStyle(im);
    if (cs.display === 'none' || im.closest('[hidden],[inert]')) continue;
    const src = im.currentSrc || im.src;
    if (!src) continue;
    if (im.complete && im.naturalWidth === 0 && !/\.svg(\?|$)/i.test(src)) { add('imagen-rota', { gravedad: 'grave', sel: sel(im), r: rect(im), detalle: `no carga: ${src.slice(0, 120)}` }); continue; }
    if (r.width < 2 || r.height < 2 || !im.naturalWidth) continue;
    const alt = im.getAttribute('alt');
    if (alt === null) add('imagen-sin-alt', { gravedad: 'medio', sel: sel(im), r: rect(im), detalle: `sin atributo alt: ${src.slice(0, 100)}` });
    else if (alt.trim() === '' && im.getAttribute('role') !== 'presentation' && !im.closest('[aria-hidden="true"]')) {
      const enc = im.closest('a,button');
      if (enc && !esc(enc.textContent) && !enc.getAttribute('aria-label') && !enc.title) add('imagen-alt-vacio-funcional', { gravedad: 'medio', sel: sel(im), r: rect(im), detalle: `enlace/botón sin texto cuyo único contenido es una imagen con alt vacío: ${src.slice(0, 100)}` });
      else if (r.width >= 160 && r.height >= 120) { const k = sig(im); const g = grupoImg.get(k) ?? { n: 0, im, src }; g.n++; grupoImg.set(k, g); }
    }
    if (cs.objectFit === 'fill' && im.naturalHeight > 0 && r.height > 0) {
      const dif = Math.abs((r.width / r.height) / (im.naturalWidth / im.naturalHeight) - 1);
      if (dif > 0.03 && !/\.svg(\?|$)/i.test(src)) add('imagen-deformada', { gravedad: 'medio', sel: sel(im), r: rect(im), detalle: `proporción mostrada ${(r.width / r.height).toFixed(3)} vs natural ${(im.naturalWidth / im.naturalHeight).toFixed(3)} (+${(dif * 100).toFixed(1)} %): ${src.slice(0, 100)}` });
    }
    if ((!im.hasAttribute('width') || !im.hasAttribute('height')) && cs.aspectRatio === 'auto' && r.width > 40 && !/\.svg(\?|$)/i.test(src)) add('imagen-sin-dimensiones', { gravedad: 'leve', sel: sel(im), r: rect(im), detalle: `sin width/height ni aspect-ratio (riesgo de salto de maquetación): ${src.slice(0, 100)}` });
  }
  for (const [k, g] of grupoImg) add('imagen-alt-vacio-grande', { gravedad: 'leve', sel: sel(g.im), r: rect(g.im), detalle: `${g.n} imagen(es) grandes ${k} con alt="" (válido solo si son decorativas)` });

  /* 5 · Marcadores sin resolver, precios, fechas */
  const cuerpo = document.body.innerText || '';
  const MARC = /\{[a-zA-Z_]+\}|\{\{|\}\}|%\{|\bundefined\b|\bnull\b|\bNaN\b|\[object|\blorem\b|\bipsum\b|\$\{/gi;
  let m, c = 0;
  while ((m = MARC.exec(cuerpo)) && c++ < 8) add('marcador-sin-resolver', { gravedad: 'grave', sel: 'body', texto: esc(cuerpo.slice(Math.max(0, m.index - 40), m.index + 50)), detalle: `«${m[0]}» visible en el texto` });
  for (const el of document.querySelectorAll('[alt],[title],[aria-label],[placeholder]')) for (const a of ['alt', 'title', 'aria-label', 'placeholder']) { const v = el.getAttribute(a); if (v && /\{[a-zA-Z_]+\}|\bundefined\b|\bnull\b|\bNaN\b|\[object|lorem ipsum/i.test(v)) add('marcador-sin-resolver', { gravedad: 'medio', sel: sel(el), texto: v.slice(0, 80), detalle: `marcador en atributo ${a}` }); }
  const MONEDAS = /(COP|MXN|PEN|USD|CLP|ARS|EUR)/;
  const precios = new Set();
  const hojas = todos.filter((el) => !el.children.length && el.textContent.trim());
  for (const el of hojas) {
    const t = el.textContent.replace(/ /g, ' ').trim();
    if (t.length > 120 || !vis(el)) continue;
    const num = /(\d{1,3}([.,]\d{3})+|\d+[.,]\d{2})\b/.test(t) || /(\$|€|S\/)\s?\d/.test(t);
    const contexto = el.closest('[class*="precio"],[class*="price"],[data-base],[data-reduced],[data-precio]');
    if (!num || (!contexto && !/(\$|€|S\/|COP|MXN|PEN|USD|CLP|ARS|EUR)/.test(t))) continue;
    if (/^\d{1,2}[./]\d{1,2}([./]\d{2,4})?$/.test(t) || /\b(20\d\d)\b/.test(t) && !/[$€]/.test(t)) continue;
    const alrededor = esc((el.parentElement?.textContent ?? t)).replace(/ /g, ' ').slice(0, 160);
    const simbolo = /(\$|€|S\/)/.test(t) || /(\$|€|S\/)/.test(alrededor);
    const codigo = MONEDAS.test(t) || MONEDAS.test(alrededor);
    if (!/\d{3}|\d[.,]\d/.test(t)) continue;
    const k = t + sig(el);
    if (precios.has(k)) continue; precios.add(k);
    if (/dólares|pesos|soles|euros/i.test(t) && el.closest('.sr-only,[class*="sr-only"]')) continue;
    if (!simbolo) add('precio-sin-simbolo', { gravedad: codigo ? 'leve' : 'medio', sel: sel(el), r: rect(el), texto: t.slice(0, 80), detalle: `precio sin símbolo de moneda: «${t.slice(0, 60)}»` });
    else if (!codigo) add('precio-sin-codigo', { gravedad: 'leve', sel: sel(el), r: rect(el), texto: t.slice(0, 80), detalle: `precio sin código de moneda (COP/MXN…): «${t.slice(0, 60)}»` });
  }
  const ahora = Date.now();
  for (const el of document.querySelectorAll('[data-hasta],[data-promo-hasta],[data-promo-fin],[data-fin],[data-ends],[data-promo-hasta-ms]')) for (const a of el.attributes) { if (!/hasta|fin|ends/.test(a.name)) continue; const n = Number(a.value); if (n > 1e11 && n < ahora) add('fecha-campana-pasada', { gravedad: 'grave', sel: sel(el), detalle: `${a.name}=${a.value} (${new Date(n).toISOString()}) ya pasó; hoy ${new Date().toISOString()}` }); }
  const MESES = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
  for (const el of document.querySelectorAll('[data-promo-fecha],[data-promo-ssr],[data-promo-fin],[data-promo-v]')) { if (!vis(el)) continue; const t = esc(el.textContent); const mm = /(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{4}))?/i.exec(t); if (mm && mm[2].toLowerCase() in MESES) { const y = mm[3] ? +mm[3] : new Date().getFullYear(); const d = new Date(y, MESES[mm[2].toLowerCase()], +mm[1], 23, 59, 59); if (d.getTime() < ahora) add('fecha-campana-pasada', { gravedad: 'grave', sel: sel(el), texto: t.slice(0, 100), detalle: `la campaña anuncia «${mm[0]}», que ya pasó` }); } }
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { for (const mm of s.textContent.matchAll(/"priceValidUntil"\s*:\s*"(\d{4}-\d\d-\d\d)/g)) if (Date.parse(mm[1] + 'T23:59:59Z') < ahora) add('fecha-campana-pasada', { gravedad: 'medio', sel: 'script[ld+json]', detalle: `priceValidUntil ${mm[1]} ya pasó (JSON-LD)` }); }

  /* 6 · Tamaños, texto pequeño, contraste, nombre accesible */
  const lienzo = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); lienzo.canvas.width = lienzo.canvas.height = 1;
  const cache = new Map();
  const rgba = (css) => { if (cache.has(css)) return cache.get(css); lienzo.clearRect(0, 0, 1, 1); lienzo.fillStyle = '#000'; lienzo.fillStyle = css; lienzo.fillRect(0, 0, 1, 1); const d = lienzo.getImageData(0, 0, 1, 1).data; const v = [d[0], d[1], d[2], d[3] / 255]; cache.set(css, v); return v; };
  const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mezcla = (f, b) => [f[0] * f[3] + b[0] * (1 - f[3]), f[1] * f[3] + b[1] * (1 - f[3]), f[2] * f[3] + b[2] * (1 - f[3])];
  const fondo = (el) => { let capas = []; for (let a = el; a && a.nodeType === 1; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.backgroundImage !== 'none') return null; const bg = rgba(cs.backgroundColor); if (bg[3] > 0) { capas.push(bg); if (bg[3] >= 0.99) break; } } let base = [255, 255, 255]; for (const bg of capas.reverse()) base = mezcla(bg, base); return base; };
  const peq = new Map(), tap = new Map(), con = new Map();
  const interactivos = [];
  for (const el of todos) {
    if (!conTexto(el) && !el.matches('a,button,input,select,textarea,summary,[role="button"],[role="tab"],[role="link"]')) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || el.closest('[hidden],[inert]') || srOnly(el, r)) continue;
    const esInter = el.matches('a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="tab"],[role="link"],[tabindex]:not([tabindex="-1"])');
    if (esInter) interactivos.push(el);
    if (conTexto(el)) {
      const fs = parseFloat(cs.fontSize);
      if (fs < 12 && !el.closest('svg')) { const k = sig(el) + '|' + fs; const g = peq.get(k) ?? { n: 0, el, fs, t: esc(el.textContent).slice(0, 50) }; g.n++; peq.set(k, g); }
      if (cs.webkitTextFillColor !== undefined && !el.closest('svg,[aria-hidden="true"]') && !el.disabled) {
        const fg = rgba(cs.color); const bgc = fondo(el);
        if (bgc && fg[3] > 0.05 && !/(transparent)/.test(cs.webkitTextFillColor)) {
          const fgm = mezcla(fg, bgc), L1 = lum(fgm), L2 = lum(bgc);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const grande = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
          const min = grande ? 3 : 4.5;
          if (ratio < min && ratio > 1.05) { // ratio≈1: el fondo real es una imagen o un pseudo-elemento que no se puede leer; se descarta
 const k = sig(el) + '|' + cs.color + '|' + cs.backgroundColor; const g = con.get(k) ?? { n: 0, el, ratio, min, color: cs.color, t: esc(el.textContent).slice(0, 50) }; g.n++; con.set(k, g); }
        }
      }
    }
    if (ancho < 500 && esInter && !el.matches('input[type="checkbox"],input[type="radio"]')) {
      const zona = el.matches('input:not([type="hidden"]),textarea,select') && el.closest('label') ? el.closest('label').getBoundingClientRect() : r; // en un campo con etiqueta, tocar la etiqueta enfoca el campo
      if (zona.width < 44 || zona.height < 44) {
        const p = el.parentElement; const enLinea = cs.display === 'inline' && p && esc(p.textContent).length > esc(el.textContent).length + 8;
        if (!enLinea && !(el.matches('a') && el.closest('p,li') && cs.display === 'inline')) { const k = sig(el); const g = tap.get(k) ?? { n: 0, el, w: r.width, h: r.height, t: esc(el.textContent || el.getAttribute('aria-label')).slice(0, 40) }; g.n++; tap.set(k, g); }
      }
    }
  }
  for (const g of peq.values()) add('texto-menor-12px', { gravedad: g.fs < 10 ? 'medio' : 'leve', sel: sel(g.el), r: rect(g.el), texto: g.t, n: g.n, detalle: `${g.fs}px en ${g.n} elemento(s)` });
  for (const g of con.values()) add('contraste-insuficiente', { gravedad: g.ratio < 3 ? 'medio' : 'leve', sel: sel(g.el), r: rect(g.el), texto: g.t, n: g.n, detalle: `contraste ${g.ratio.toFixed(2)}:1 (mínimo ${g.min}:1) con color ${g.color}, ${g.n} elemento(s)` });
  for (const g of tap.values()) add('objetivo-tactil-menor-44', { gravedad: Math.min(g.w, g.h) < 24 ? 'medio' : 'leve', sel: sel(g.el), r: rect(g.el), texto: g.t, n: g.n, detalle: `${Math.round(g.w)}×${Math.round(g.h)}px en ${g.n} elemento(s)` });

  const nombre = (el) => {
    const l = el.getAttribute('aria-label'); if (l && l.trim()) return l.trim();
    const lb = el.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\s+/).map((i) => document.getElementById(i)?.textContent ?? '').join(' ').trim(); if (t) return t; }
    if (el.matches('input[type="submit"],input[type="button"]')) return el.value;
    if (el.labels && [...el.labels].some((x) => x.textContent.trim())) return 'label';
    const t = esc(el.textContent); if (t) return t;
    if (el.getAttribute('title')) return el.getAttribute('title');
    const im = el.querySelector('img[alt]:not([alt=""]),svg title,[aria-label]'); if (im) return 'interno';
    if (el.matches('input,textarea')) return el.getAttribute('placeholder') || '';
    return '';
  };
  const sinNombre = new Map();
  for (const el of interactivos) { if (el.matches('[tabindex]') && !el.matches('a[href],button,input,select,textarea,summary,[role]')) continue; if (!nombre(el)) { const k = sig(el); const g = sinNombre.get(k) ?? { n: 0, el }; g.n++; sinNombre.set(k, g); } }
  for (const g of sinNombre.values()) add('interactivo-sin-nombre', { gravedad: 'medio', sel: sel(g.el), r: rect(g.el), n: g.n, detalle: `${g.n} elemento(s) interactivos sin nombre accesible (${g.el.outerHTML.slice(0, 110).replace(/\s+/g, ' ')})` });

  const h1s = [...document.querySelectorAll('h1')].filter(vis);
  if (h1s.length !== 1) add('h1', { gravedad: 'medio', sel: h1s[0] ? sel(h1s[0]) : 'body', detalle: h1s.length === 0 ? 'la página no tiene H1 visible' : `${h1s.length} H1 visibles: ${h1s.map((h) => esc(h.textContent).slice(0, 40)).join(' | ')}` });
  for (const a of document.querySelectorAll('a[href^="#"]')) { const id = decodeURIComponent(a.getAttribute('href').slice(1)); if (id && !document.getElementById(id) && !document.querySelector(`[name="${CSS.escape(id)}"]`) && vis(a)) add('ancla-rota', { gravedad: 'leve', sel: sel(a), detalle: `#${id} no existe en la página` }); }
  const fuentes = [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family);
  if (fuentes.length) add('fuente-no-carga', { gravedad: 'medio', sel: 'document.fonts', detalle: `fuentes con error: ${[...new Set(fuentes)].join(', ')}` });

  /* 7 · Ficha: botón de compra */
  let ficha = null;
  if (tipo === 'ficha') {
    const bs = [...document.querySelectorAll('a[href*="hotmart"],a[href*="hotm.io"],a[href*="hotm.art"],a[data-pago],a[data-cta-hotmart]')];
    const infos = bs.map((b) => { let u; try { u = new URL(b.href); } catch { u = null; } const r = b.getBoundingClientRect(); return { sel: sel(b), host: u?.hostname, src: u?.searchParams.get('src'), visible: vis(b), arriba: vis(b) && r.top >= 0 && r.top < vh && r.bottom <= vh + 1, enPantallaTrasScroll: vis(b) && r.bottom > 0 && r.top < vh, href: b.href.slice(0, 200) }; });
    const barra = document.querySelector('[data-barra-fija]'); const bcs = barra && getComputedStyle(barra); const br = barra?.getBoundingClientRect();
    ficha = { botones: infos, barraFijaVisibleAlCargar: !!barra && !barra.hasAttribute('data-oculta') && !barra.hasAttribute('inert') && br.height > 0 && br.top < vh && br.bottom > 0 && bcs.visibility !== 'hidden' };
  }
  return { defectos: out, ficha, piezas, titulo: document.title, h1: esc(h1s[0]?.textContent).slice(0, 100), altoDocumento: de.scrollHeight, enlaces: [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))].filter((h) => h && !/^(mailto:|tel:|javascript:|#)/.test(h)) };
}

/* ---------- Ejecución ---------- */
const GRAV = { grave: 0, medio: 1, leve: 2 };
const resultados = [];
const capturasHechas = new Map();
let nCap = 0;
const archivoRes = join(SALIDA, 'resultados.json');
const previos = bandera('reanudar') && existsSync(archivoRes) ? JSON.parse(readFileSync(archivoRes, 'utf8')) : null;
const hechos = new Set((previos?.paginas ?? []).map((p) => `${p.id}@${p.vista}`));
if (previos) resultados.push(...previos.paginas);
const cola = new Map(); // enlaces internos → primera página
const esPropio = (u) => { try { const h = new URL(u).hostname; return h === HOST || h.endsWith('.' + HOST.replace(/^www\./, '')) || h === 'cdn.sably.co'; } catch { return false; } };

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--lang=es-CO'] });

async function destacar(page, d, estado, base) {
  const firma = `${d.tipo}|${d.sel}`;
  if (capturasHechas.has(firma) || nCap >= 220 || d.gravedad === 'leve' && !/solape/.test(d.tipo)) return;
  if (!d.sel || d.sel === 'body' || d.sel === 'html' || d.sel === 'document.fonts' || d.sel.includes('script')) return;
  const archivo = `${base}-${d.tipo}-${nCap}.jpg`;
  try {
    const ok = await page.evaluate((s, sa, sb) => { const q = (x) => { try { return document.querySelector(x); } catch { return null; } }; const els = [q(s), q(sa), q(sb)].filter(Boolean); if (!els.length) return false; if (!els[0].closest('[popover]') && getComputedStyle(els[0]).position !== 'fixed') { els[0].scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); for (let a = els[0]; a; a = a.parentElement) a.scrollLeft = 0; scrollTo(0, scrollY); } els.forEach((e) => { e.dataset.juezPrev = e.style.outline; e.style.outline = '3px solid #ff0033'; e.style.outlineOffset = '2px'; }); return true; }, d.sel.split('  ×  ')[0], d.selA ?? '', d.selB ?? '');
    if (!ok) return;
    await espera(250);
    await page.screenshot({ path: join(SALIDA, 'capturas', archivo), type: 'jpeg', quality: 55 });
    await page.evaluate(() => document.querySelectorAll('[data-juez-prev]').forEach((e) => { e.style.outline = e.dataset.juezPrev; delete e.dataset.juezPrev; }));
    d.captura = `capturas/${archivo}`; capturasHechas.set(firma, archivo); nCap++;
  } catch {}
}

async function revisar(pg, vistaId) {
  const cfg = VISTAS[vistaId];
  const clave = `${pg.id}@${vistaId}`;
  if (hechos.has(clave)) return;
  const url = conT(pg.ruta);
  const res = { id: pg.id, pais: pg.pais, tipo: pg.tipo, ruta: pg.ruta, url: `${BASE}${pg.ruta}`, vista: vistaId, inicio: ahora(), defectos: [], estados: [], consola: [], red: [], terceros: [] };
  const page = await navegador.newPage();
  try {
    await page.setUserAgent(cfg.isMobile ? UA_MOVIL : UA_ESCRITORIO);
    await page.setViewport(cfg);
    await page.evaluateOnNewDocument(() => {
      addEventListener('click', (e) => { const a = e.target?.closest?.('a[data-pago], a[data-cta-hotmart], a[href*="hotmart"], a[href*="hotm."], a[href*="wa.me"], a[href*="whatsapp"]'); if (a) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
      addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
    });
    page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (/Failed to load resource/.test(t) && pg.tipo === 'error404') return; res.consola.push(t.slice(0, 240) + (m.location()?.url ? `  @ ${m.location().url.slice(0, 100)}` : '')); } });
    page.on('pageerror', (e) => res.consola.push(`excepción: ${String(e.message).slice(0, 240)}`));
    page.on('requestfailed', (r) => { const f = r.failure()?.errorText ?? ''; if (/ERR_ABORTED/.test(f)) return; (esPropio(r.url()) ? res.red : res.terceros).push(`${f} ${r.url().slice(0, 140)}`); });
    page.on('response', (r) => { if (r.status() >= 500) { const h = r.headers(); (res.cabeceras5xx ??= []).push({ estado: r.status(), url: r.url().slice(0, 120), tipo: r.request().resourceType(), inicia: r.request().headers()['purpose'] || r.request().headers()['sec-purpose'] || '', server: h.server, cfRay: h['cf-ray'], cfCache: h['cf-cache-status'], tipoContenido: h['content-type'], t: new Date().toISOString() }); r.text().then((b) => { const x = res.cabeceras5xx.find((c) => c.url === r.url().slice(0, 120) && !c.cuerpo); if (x) x.cuerpo = b.replace(/\s+/g, ' ').slice(0, 160); }).catch(() => {}); }
      if (r.request().resourceType() === 'prefetch') { res.prefetchRechazado = (res.prefetchRechazado ?? 0) + (r.status() >= 400 ? 1 : 0); return; } // Cloudflare responde 503 a Sec-Purpose: prefetch a propósito; no lo ve ningún visitante
      if (r.status() >= 400 && !(r.request().isNavigationRequest() && r.url().split('?')[0] === `${BASE}${pg.ruta}` && pg.tipo === 'error404')) (esPropio(r.url()) ? res.red : res.terceros).push(`${r.status()} ${r.url().slice(0, 140)}`); });
    const t0 = Date.now();
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    res.status = resp?.status();
    res.msCarga = Date.now() - t0;
    await espera(1800);
    const base = `${pg.id}-${vistaId}`;
    const vh = cfg.height;
    const instantaneas = [];
    const tomar = async (etiqueta) => { const o = await page.evaluate(AUDITAR, { vista: vistaId, tipo: pg.tipo, ancho: cfg.width }); instantaneas.push({ etiqueta, scrollY: await page.evaluate(() => Math.round(scrollY)), solapes: o.defectos.filter((d) => d.tipo === 'solape-fijos' || d.tipo === 'fijo-tapa-compra'), piezas: o.piezas }); return o; };
    // fijos: al cargar, a mitad, al final y al volver arriba (la auditoría completa va en el estado «base»)
    const iniciales = await tomar('carga');
    const alto = iniciales.altoDocumento;
    const pasos = Math.min(24, Math.max(1, Math.ceil(alto / vh)));
    let mitad = null;
    for (let i = 1; i <= pasos; i++) {
      await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), Math.min(i * vh * 0.9, alto));
      await espera(120);
      if (!mitad && i * vh * 0.9 >= alto / 2) { await espera(500); mitad = await tomar('mitad'); }
    }
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await espera(900);
    await tomar('final');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await espera(900);
    const baseA = await tomar('vuelta-arriba');
    // los defectos de solape se toman de todas las instantáneas
    const vistos = new Set();
    const pegar = (lista, estado) => { for (const d of lista) { const k = `${d.tipo}|${d.sel}|${d.detalle}`; if (vistos.has(k)) continue; vistos.add(k); res.defectos.push({ ...d, estado }); } };
    pegar(baseA.defectos, 'base');
    for (const s of instantaneas) pegar(s.solapes, `scroll ${s.etiqueta} (${s.scrollY}px)`);
    res.titulo = baseA.titulo; res.h1 = baseA.h1; res.altoDocumento = baseA.altoDocumento;
    res.piezasFijas = baseA.piezas.map((p) => p.sel);
    for (const e of baseA.enlaces) { try { const u = new URL(e, `${BASE}${pg.ruta}`); if (u.hostname === HOST) { u.hash = ''; u.search = ''; if (!/^\/(cdn-cgi|_astro|_emdash|api)\//.test(u.pathname) && !/\.(jpg|png|webp|svg|js|css|xml|woff2?)$/i.test(u.pathname) && !cola.has(u.pathname)) cola.set(u.pathname, `${pg.ruta} (${vistaId})`); } } catch {} }
    // Ficha
    if (pg.tipo === 'ficha' && baseA.ficha) {
      const f = baseA.ficha; res.ficha = f;
      const ok = f.botones.filter((b) => /(^|\.)(hotm\.io|hotm\.art|go\.hotmart\.com|pay\.hotmart\.com|hotmart\.com)$/.test(b.host ?? ''));
      if (!f.botones.length) res.defectos.push({ tipo: 'ficha-sin-boton-compra', gravedad: pg.exigePago ? 'grave' : 'leve', sel: 'main', detalle: 'no existe ningún enlace de compra (Hotmart) en la ficha', estado: 'base' });
      else {
        if (!ok.length) res.defectos.push({ tipo: 'ficha-compra-destino', gravedad: 'grave', sel: f.botones[0].sel, detalle: `el botón no va a hotm.io/hotm.art/go.hotmart.com: ${f.botones[0].href}`, estado: 'base' });
        for (const b of f.botones) if (b.src !== 'sably') res.defectos.push({ tipo: 'ficha-compra-sin-src', gravedad: 'grave', sel: b.sel, detalle: `href sin src=sably (src=${b.src}): ${b.href}`, estado: 'base' });
        if (!f.botones.some((b) => b.visible)) res.defectos.push({ tipo: 'ficha-compra-oculto', gravedad: 'grave', sel: f.botones[0].sel, detalle: 'ningún botón de compra es visible', estado: 'base' });
        else if (cfg.isMobile && !f.botones.some((b) => b.arriba) && !f.barraFijaVisibleAlCargar) res.defectos.push({ tipo: 'ficha-compra-bajo-el-pliegue', gravedad: 'medio', sel: f.botones[0].sel, detalle: `en ${cfg.width}×${cfg.height} ningún botón de compra ni barra fija es visible al cargar sin desplazar`, estado: 'base' });
      }
    }
    if (pg.tipo === 'error404' && !(await page.evaluate(() => !!document.querySelector('header,nav,main h1')))) res.defectos.push({ tipo: 'pagina-404-sin-diseno', gravedad: 'grave', sel: 'body > pre', detalle: 'la página de error es texto plano sin cabecera, menú ni enlace de vuelta: «' + (await page.evaluate(() => document.body.innerText.slice(0, 40))) + '»', estado: 'base' });
    if (pg.tipo === 'error404') { if (res.status !== 404) res.defectos.push({ tipo: '404-estado-incorrecto', gravedad: 'grave', sel: 'html', detalle: `la página de error responde ${res.status} (debería ser 404)`, estado: 'base' }); }
    else if (res.status >= 400) res.defectos.push({ tipo: 'pagina-estado-incorrecto', gravedad: 'grave', sel: 'html', detalle: `responde ${res.status}`, estado: 'base' });

    /* Interacciones (portada, listado, ficha) */
    const interactivas = ['portada', 'listado', 'ficha'].includes(pg.tipo);
    const nuevos = async (estado, extra = {}) => { const o = await page.evaluate(AUDITAR, { vista: vistaId, tipo: pg.tipo, ancho: cfg.width }); const baseKeys = new Set(res.defectos.map((d) => `${d.tipo}|${d.sel}`)); const n = o.defectos.filter((d) => !baseKeys.has(`${d.tipo}|${d.sel}`)).map((d) => ({ ...d, estado })); res.defectos.push(...n); res.estados.push({ estado, nuevos: n.length, ...extra }); return n; };
    const cerrar = async () => { await page.keyboard.press('Escape'); await espera(400); await page.evaluate(() => { document.querySelectorAll('[popover]:popover-open').forEach((p) => p.hidePopover?.()); scrollTo({ top: 0, behavior: 'instant' }); }); await espera(300); };
    const visible = (sel) => page.evaluate((s) => { for (const e of document.querySelectorAll(s)) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden],[inert]')) { e.dataset.juezObj = '1'; return true; } } return false; }, sel);
    const clic = async (sel, estado, espMs = 700) => { if (!(await visible(sel))) { res.estados.push({ estado, omitido: `no hay ${sel} visible` }); return false; } const h = await page.$('[data-juez-obj="1"]'); await page.evaluate(() => document.querySelectorAll('[data-juez-obj]').forEach((e) => e.removeAttribute('data-juez-obj'))); if (!h) return false; const antes = new URL(page.url()).pathname; await h.click().catch(() => {}); await espera(espMs); if (new URL(page.url()).pathname !== antes) { res.estados.push({ estado, navego: page.url() }); await page.goto(url, { waitUntil: 'load' }); await espera(1200); return false; } return true; };
    if (interactivas) {
      if (cfg.width >= 1024) { if (await clic('[data-mega-boton]', 'megamenu')) { const n = await nuevos('megamenú abierto'); for (const d of n) await destacar(page, d, 'megamenú', base); await cerrar(); } }
      else { if (await clic('button[popovertarget="v2-menu-movil"]', 'menu-movil', 900)) { const n = await nuevos('menú móvil abierto'); for (const d of n) await destacar(page, d, 'menú móvil', base); await cerrar(); } }
      if (await clic('[data-buscar-abrir]', 'buscador', 900)) {
        const campo = await page.evaluateHandle(() => [...document.querySelectorAll('#v2-buscador-campo,#v2-buscar-movil,input[type="search"]')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && !e.closest('[hidden],[inert]'); }) ?? null);
        const el = campo.asElement();
        if (el) { await el.focus(); await page.keyboard.type('masajes', { delay: 40 }); await espera(1400); const info = await page.evaluate(() => ({ resultados: document.querySelectorAll('[data-buscador-lista] a, [data-buscador-resultados] a, [role="listbox"] [role="option"]').length, cuenta: document.querySelector('[data-buscador-cuenta]')?.textContent?.trim().slice(0, 80) })); const n = await nuevos('buscador con «masajes»', info); if (!info.resultados) res.defectos.push({ tipo: 'buscador-sin-resultados', gravedad: 'medio', sel: '[data-buscador-lista]', detalle: `escribir «masajes» no muestra resultados (${info.cuenta ?? 'sin contador'})`, estado: 'buscador' }); for (const d of n) await destacar(page, d, 'buscador', base); }
        else res.estados.push({ estado: 'buscador', omitido: 'no apareció el campo' });
        await cerrar();
      }
      if (await clic('button[popovertarget="v2-pais"]', 'pais', 900)) {
        const info = await page.evaluate(() => ({ paises: document.querySelectorAll('#v2-pais a[href]').length }));
        const n = await nuevos('selector de país abierto', info); if (info.paises < 8) res.defectos.push({ tipo: 'selector-pais-incompleto', gravedad: 'medio', sel: '#v2-pais', detalle: `el selector lista ${info.paises} países (se esperan 8)`, estado: 'país' }); for (const d of n) await destacar(page, d, 'país', base); await cerrar();
      }
      if (pg.tipo === 'ficha') {
        const hay = await page.evaluate(() => { const s = [...document.querySelectorAll('main details:not([open]) > summary, details:not([open]) > summary')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && !e.closest('[popover],[hidden],[inert]') && !e.closest('header,footer'); }); if (!s) return false; s.scrollIntoView({ block: 'center', behavior: 'instant' }); s.dataset.juezObj = '1'; return true; });
        if (hay) { await page.click('[data-juez-obj="1"]').catch(() => {}); await espera(700); const n = await nuevos('acordeón abierto'); for (const d of n) await destacar(page, d, 'acordeón', base); await page.evaluate(() => document.querySelectorAll('[data-juez-obj]').forEach((e) => e.removeAttribute('data-juez-obj'))); }
        else res.estados.push({ estado: 'acordeón', omitido: 'no hay <details> cerrado visible' });
      }
    }
    // Capturas de los defectos de la base (una por firma) y de página completa para el juicio a ojo
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await espera(300);
    for (const d of res.defectos.filter((x) => x.estado === 'base' || x.estado.startsWith('scroll')).sort((a, b) => GRAV[a.gravedad] - GRAV[b.gravedad]).slice(0, 12)) await destacar(page, d, d.estado, base);
    if (COMPLETAS.includes(pg.pais) && ['portada', 'listado', 'ficha'].includes(pg.tipo) && pg.id.endsWith(pg.tipo === 'ficha' ? 'masajes' : pg.tipo) && vistaId !== '768') {
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await espera(300);
      await page.screenshot({ path: join(SALIDA, 'completas', `${base}.jpg`), type: 'jpeg', quality: 50, captureBeyondViewport: true, clip: { x: 0, y: 0, width: cfg.width, height: Math.min(res.altoDocumento, vistaId === '390' ? 7000 : 5000) } }).catch(() => {});
      res.completa = `completas/${base}.jpg`;
    }
    if (res.consola.length) res.defectos.push({ tipo: 'consola-error', gravedad: 'medio', sel: 'console', detalle: `${res.consola.length} error(es) de consola: ${[...new Set(res.consola)].slice(0, 3).join(' || ')}`, estado: 'carga' });
    for (const r of [...new Set(res.red)]) {
      let intermitente = false; const m = /^(\d{3}) (\S+)/.exec(r);
      if (m) { await espera(1500); try { const rr = await fetch(m[2], { headers: { 'user-agent': UA_ESCRITORIO } }); intermitente = rr.status < 400; } catch {} }
      res.defectos.push({ tipo: intermitente ? 'red-intermitente' : 'red-recurso-propio-falla', gravedad: intermitente ? 'medio' : (/^5|ERR_/.test(r) || /\.(woff2?|js|css)\b/.test(r) ? 'grave' : 'medio'), sel: 'red', detalle: intermitente ? `${r} (respondió así al cargar y bien al reintentar: servidor saturado)` : r, estado: 'carga' });
    }
  } catch (e) {
    res.defectos.push({ tipo: 'error-del-juez', gravedad: 'medio', sel: 'juez', detalle: `no se pudo auditar: ${String(e.message).slice(0, 200)}`, estado: 'juez' });
  } finally {
    await page.close().catch(() => {});
  }
  res.fin = ahora();
  res.defectos.sort((a, b) => GRAV[a.gravedad] - GRAV[b.gravedad]);
  resultados.push(res);
  guardar(false);
  const c = (g) => res.defectos.filter((d) => d.gravedad === g).length;
  console.log(`${res.id.padEnd(22)} ${String(vistaId).padStart(4)}  ${res.status}  graves ${c('grave')}  medios ${c('medio')}  leves ${c('leve')}  (${res.msCarga} ms)`);
}

function guardar(final) {
  writeFileSync(archivoRes, JSON.stringify({ base: BASE, generado: ahora(), vistas, paises: PAISES, paginas: resultados, enlaces: enlacesRes }, null, 1));
  if (final) writeFileSync(join(SALIDA, 'resumen.md'), resumen());
}
let enlacesRes = [];

function resumen() {
  const por = new Map();
  for (const p of resultados) for (const d of p.defectos) { const k = `${d.gravedad}|${d.tipo}|${d.sel}|${(d.detalle ?? '').replace(/\d+(\.\d+)?/g, '#').slice(0, 70)}`; const g = por.get(k) ?? { d, paginas: new Set(), vistas: new Set(), n: 0, ej: p }; g.paginas.add(p.id); g.vistas.add(p.vista); g.n++; por.set(k, g); }
  const lista = [...por.values()].sort((a, b) => GRAV[a.d.gravedad] - GRAV[b.d.gravedad] || b.paginas.size - a.paginas.size);
  const cuenta = (g) => resultados.reduce((n, p) => n + p.defectos.filter((d) => d.gravedad === g).length, 0);
  let md = `# Resumen del juez de UX · ${BASE}\n\nGenerado ${ahora()} · ${resultados.length} página×vista · defectos brutos: ${cuenta('grave')} graves, ${cuenta('medio')} medios, ${cuenta('leve')} leves · distintos (agrupados): ${lista.length}\n\n`;
  for (const g of ['grave', 'medio', 'leve']) {
    md += `## ${g.toUpperCase()}\n\n`;
    for (const x of lista.filter((y) => y.d.gravedad === g)) md += `- **${x.d.tipo}** · \`${x.d.sel}\` · ${x.paginas.size} pág. / vistas ${[...x.vistas].join(',')}\n  - ${x.d.detalle}${x.d.texto ? ` — «${x.d.texto}»` : ''}\n  - ej.: ${x.ej.url} (${x.ej.vista}) [${x.d.estado}]${x.d.captura ? ` · captura ${x.d.captura}` : ''}\n`;
    md += '\n';
  }
  if (enlacesRes.length) { md += `## Enlaces internos revisados\n\n${enlacesRes.length} destinos; rotos: ${enlacesRes.filter((e) => e.estado >= 400 || !e.estado).length}\n\n`; for (const e of enlacesRes.filter((e) => e.estado >= 400 || !e.estado)) md += `- ${e.estado || 'sin respuesta'} ${e.ruta} ← ${e.desde}\n`; }
  return md;
}

const { paginas, mapa } = await plan();
console.log(`Plan: ${paginas.length} páginas × ${vistas.length} vistas. ${mapa.join(' | ')}`);
writeFileSync(join(SALIDA, 'plan.json'), JSON.stringify({ paginas, avisos: mapa }, null, 1));
for (const pg of paginas) {
  if (SOLO && !SOLO.includes(pg.tipo) && !SOLO.includes(pg.id)) continue;
  for (const v of vistas) { await revisar(pg, v); await espera(PAUSA); }
}

/* Enlaces internos: HEAD con pausa, cada destino una sola vez */
if (!bandera('sin-enlaces')) {
  const rutas = [...cola.entries()].slice(0, MAX_ENLACES);
  console.log(`Enlaces internos únicos: ${cola.size}${cola.size > MAX_ENLACES ? ` (se revisan ${MAX_ENLACES})` : ''}`);
  for (const [ruta, desde] of rutas) {
    let estado = 0;
    try { let r = await fetch(`${BASE}${ruta}`, { method: 'HEAD', headers: { 'user-agent': UA_ESCRITORIO }, redirect: 'follow' }); if ([403, 405, 501].includes(r.status)) r = await fetch(`${BASE}${ruta}`, { headers: { 'user-agent': UA_ESCRITORIO }, redirect: 'follow' }); estado = r.status; } catch { estado = 0; }
    enlacesRes.push({ ruta, desde, estado });
    if (estado >= 400 || !estado) { console.log(`ENLACE ROTO ${estado} ${ruta} ← ${desde}`); const p = resultados.find((x) => `${x.ruta} (${x.vista})` === desde); p?.defectos.push({ tipo: 'enlace-interno-roto', gravedad: 'grave', sel: `a[href="${ruta}"]`, detalle: `${ruta} responde ${estado || 'sin respuesta'}`, estado: 'enlaces' }); }
    await espera(450);
  }
}
guardar(true);
await navegador.close();
const graves = resultados.reduce((n, p) => n + p.defectos.filter((d) => d.gravedad === 'grave').length, 0);
console.log(`Listo. Resultados en ${SALIDA}. Defectos graves: ${graves}`);
process.exit(graves ? 1 : 0);
