#!/usr/bin/env node
/**
 * Test SEO on-page contra un sitio vivo.
 *
 *   node scripts/seo-test.mjs                         # producción, todo el sitemap
 *   node scripts/seo-test.mjs --base https://dev.sably.co --muestra 5
 *   node scripts/seo-test.mjs --url /co/curso-de-masajes/ --url /co/
 *   node scripts/seo-test.mjs --json informe.json
 *   node scripts/seo-test.mjs --base http://localhost:4321 --muestra 5 --tema v2
 *
 * `--tema v2` pide cada URL con ?tema=v2 (vista de revisión del rediseño) y
 * aplica además las reglas del tema V2; también la pide con ?tema=clasico y
 * comprueba que la versión V2 no tenga menos enlaces internos que la clásica
 * (`v2-enlaces`, error) y avisa de los que no lleve (`v2-enlace-perdido`). En dev.sably.co la puerta pide
 * credenciales: exporta SABLY_DEV_PASSWORD (de .dev.vars) y se envían solas.
 *
 * Recorre el sitemap, audita cada página con `seo-onpage.mjs` y añade lo que
 * solo se ve comparando páginas (títulos, descripciones y H1 repetidos).
 * Sale con código 1 si hay algún error; los avisos no rompen.
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { auditarOnPage, encabezados, enlacesInternos } from './seo-onpage.mjs';

const args = process.argv.slice(2);
const opcion = (nombre) => { const i = args.indexOf(`--${nombre}`); return i >= 0 ? args[i + 1] : undefined; };
const opciones = (nombre) => args.flatMap((a, i) => (a === `--${nombre}` ? [args[i + 1]] : []));
const BASE = (opcion('base') ?? 'https://sably.co').replace(/\/$/, '');
const MUESTRA = Number(opcion('muestra') ?? 0);
const CONCURRENCIA = Number(opcion('concurrencia') ?? 4);
const UA = 'Mozilla/5.0 (compatible; sably-seo-test/1.0; +https://sably.co)';
const TEMA = opcion('tema');
/** Credenciales de la puerta de dev.sably.co; nunca se mandan a producción. */
export const cabecerasEntorno = (base, env = process.env) =>
  env.SABLY_DEV_PASSWORD && !/^https:\/\/(?:www\.)?sably\.co(?:\/|$)/.test(base)
    ? { authorization: `Basic ${Buffer.from(`sably:${env.SABLY_DEV_PASSWORD}`).toString('base64')}` }
    : {};
const conTema = (url, tema = TEMA) => (tema ? `${url}${url.includes('?') ? '&' : '?'}tema=${encodeURIComponent(tema)}` : url);

/** Compara los enlaces internos de la versión V2 con los de la clásica de la misma URL. */
export function compararEnlaces(ruta, v2, clasico) {
  const perdidos = [...clasico].filter((e) => !v2.has(e));
  const hallazgos = [];
  if (v2.size < clasico.size) hallazgos.push({ url: ruta, regla: 'v2-enlaces', nivel: 'error', detalle: `${v2.size} enlaces internos en V2 frente a ${clasico.size} en el clásico` });
  if (perdidos.length) hallazgos.push({ url: ruta, regla: 'v2-enlace-perdido', nivel: 'aviso', detalle: `${perdidos.length} enlace(s) del clásico que V2 no lleva: ${perdidos.slice(0, 4).join(', ')}` });
  return hallazgos;
}

const leer = async (url) => {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, ...cabecerasEntorno(BASE) }, redirect: 'manual' });
      return { status: r.status, html: r.status === 200 ? await r.text() : '' };
    } catch {
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
  return { status: 0, html: '' };
};

/** Tipo de página por la forma de la ruta: agrupa el informe y permite muestrear. */
export const tipoDeRuta = (ruta) => {
  const s = ruta.split('/').filter(Boolean);
  if (!s.length) return 'portada';
  if (s[0] === 'blog') return s.length === 1 ? 'blog-indice' : 'blog';
  if (s[0] === 'videos') return s.length === 1 ? 'videos-indice' : 'video';
  if (s[0] === 'homologaciones') return 'homologacion';
  if (s[0].length === 2) {
    if (s.length === 1) return 'pais';
    if (s[1] === 'cursos') return s.length === 2 ? 'catalogo' : 'categoria';
    if (s[1] === 'creadores') return 'creador';
    return 'ficha';
  }
  return 'otra';
};

async function rutas() {
  const manuales = opciones('url');
  if (manuales.length) return manuales;
  const indice = (await leer(`${BASE}/sitemap-index.xml`)).html;
  const mapas = [...indice.matchAll(/<loc>([^<]+)/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, BASE));
  const todas = new Set();
  for (const mapa of mapas)
    for (const m of (await leer(mapa)).html.matchAll(/<url>\s*<loc>([^<]+)/g)) todas.add(m[1].replace(/^https?:\/\/[^/]+/, ''));
  if (!MUESTRA) return [...todas];
  const porTipo = new Map();
  for (const ruta of todas) {
    const lista = porTipo.get(tipoDeRuta(ruta)) ?? [];
    if (lista.length < MUESTRA) porTipo.set(tipoDeRuta(ruta), [...lista, ruta]);
  }
  return [...porTipo.values()].flat();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lista = await rutas();
  if (!lista.length) { console.error(`Sin URL que auditar en ${BASE}`); process.exit(1); }
  const hallazgos = [];
  const paginas = [];
  let siguiente = 0;
  await Promise.all(Array.from({ length: CONCURRENCIA }, async () => {
    while (siguiente < lista.length) {
      const ruta = lista[siguiente++];
      const { status, html } = await leer(conTema(BASE + ruta));
      if (status !== 200) { hallazgos.push({ url: ruta, regla: 'estado', nivel: 'error', detalle: `responde ${status}` }); continue; }
      hallazgos.push(...auditarOnPage(ruta, html));
      if (TEMA === 'v2') {
        const clasico = await leer(conTema(BASE + ruta, 'clasico'));
        if (clasico.status === 200) hallazgos.push(...compararEnlaces(ruta, enlacesInternos(html, BASE), enlacesInternos(clasico.html, BASE)));
      }
      paginas.push({
        ruta,
        titulo: (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1]?.trim() ?? '',
        descripcion: (html.match(/<meta name="description" content="([^"]*)"/i) ?? [])[1] ?? '',
        h1: encabezados(html).find((h) => h.nivel === 1)?.texto ?? '',
      });
    }
  }));

  // Rutas que fabrica Bing al cortar el srcset en las comas: deben responder 301 a la imagen.
  const ficha = paginas.find((p) => tipoDeRuta(p.ruta) === 'ficha')?.ruta ?? '/co/curso-de-masajes/';
  const media = '_emdash/api/media/file/migration/seo-test.jpg';
  const fabricada = await fetch(`${BASE}${ficha}onerror=redirect/${media}`, { headers: { 'user-agent': UA, ...cabecerasEntorno(BASE) }, redirect: 'manual' }).catch(() => null);
  const destino = fabricada?.headers.get('location') ?? '';
  if (fabricada?.status !== 301 || !destino.endsWith(`/${media}`))
    hallazgos.push({ url: `${ficha}onerror=redirect/…`, regla: 'ruta-bing', nivel: 'error', detalle: `la ruta que fabrica Bing responde ${fabricada?.status ?? 'sin conexión'} (debe ser 301 a la imagen)` });

  // Lo que solo se ve entre páginas.
  for (const [campo, regla, nivel] of [['titulo', 'titulo-repetido', 'error'], ['descripcion', 'descripcion-repetida', 'error'], ['h1', 'h1-repetido', 'aviso']]) {
    const grupos = new Map();
    for (const p of paginas) if (p[campo]) grupos.set(p[campo], [...(grupos.get(p[campo]) ?? []), p.ruta]);
    for (const [valor, urls] of grupos)
      if (urls.length > 1) for (const url of urls) hallazgos.push({ url, regla, nivel, detalle: `«${valor.slice(0, 60)}» en ${urls.length} páginas` });
  }

  const resumen = new Map();
  for (const h of hallazgos) {
    const clave = `${h.nivel}  ${h.regla}`;
    const fila = resumen.get(clave) ?? { n: 0, tipos: new Map(), ejemplo: h };
    fila.n++;
    fila.tipos.set(tipoDeRuta(h.url), (fila.tipos.get(tipoDeRuta(h.url)) ?? 0) + 1);
    resumen.set(clave, fila);
  }
  const errores = hallazgos.filter((h) => h.nivel === 'error').length;
  console.log(`Test SEO on-page · ${BASE}${TEMA ? ` · tema ${TEMA}` : ''} · ${paginas.length} páginas leídas de ${lista.length}`);
  for (const [clave, fila] of [...resumen].sort((a, b) => a[0].localeCompare(b[0]) || b[1].n - a[1].n)) {
    console.log(`\n${clave} — ${fila.n} páginas (${[...fila.tipos].map(([t, n]) => `${t} ${n}`).join(', ')})`);
    console.log(`   p. ej. ${fila.ejemplo.url}: ${fila.ejemplo.detalle}`);
  }
  console.log(`\n${errores ? 'FALLA' : 'PASA'}: ${errores} errores, ${hallazgos.length - errores} avisos.`);
  const salida = opcion('json');
  if (salida) writeFileSync(salida, JSON.stringify({ base: BASE, paginas: paginas.length, hallazgos }, null, 1));
  process.exit(errores ? 1 : 0);
}
