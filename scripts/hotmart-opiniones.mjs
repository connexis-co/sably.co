#!/usr/bin/env node
/**
 * Recoge las evaluaciones PÚBLICAS de cada curso en Hotmart y elige 3–4 extractos literales para la ficha.
 *
 * Fuente: la página pública del producto en el marketplace de Hotmart
 * (`hotmart.com/es/marketplace/productos/<slug>/<código>`) carga sus evaluaciones desde
 * `api-ask.hotmart.com/api/v1/survey/product/<id>/answers` sin sesión: nombre como lo publicó el comprador, nota de
 * 1 a 5, fecha y texto completo. Es lo mismo que cualquiera ve en esa página; nada se deduce ni se completa.
 *
 * La captura anterior (`public-data-seed.sql`) salía del checkout y guardaba como mucho 120 caracteres, por eso la
 * ficha cortaba las citas. Aquí el texto llega entero y el extracto se corta solo en una frase o palabra completa.
 *
 * Uso:
 *   node scripts/hotmart-opiniones.mjs --cursos <cursos.csv> --salida <carpeta>
 *     cursos.csv: columnas `curso`, `estado_cms` y `producto` (código de Hotmart, p. ej. I50503819I).
 *   Escribe en <carpeta>: opiniones-hotmart.csv (todas, con la elegida marcada y el motivo), recuento-opiniones.csv,
 *   carga-opiniones.json (las elegidas, para `cargar-opiniones.py`) y crudo/<curso>.json (respuesta de la API).
 *   Con --desde-crudo no pide nada a Hotmart: vuelve a elegir a partir de crudo/ (p. ej. tras cambiar los criterios).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36' };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Extractos por curso: JP pidió 3–4 (26-nov). */
export const MAX_ELEGIDAS = 4;
/** Largo máximo de un extracto. Uno más largo se corta en su última frase (o palabra) completa. */
export const LARGO_EXTRACTO = 240;
const LARGO_MINIMO = 25;

export const limpiar = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

/**
 * Por qué una evaluación no se cita en la ficha, o '' si se puede citar. No se cita lo que no habla del curso
 * (acceso, descargas, la app), lo que nombra precios (chocaría con el precio de la caja, que cambia por país y
 * campaña), lo que trae datos de contacto, ni lo demasiado corto para decir algo. La nota pública de Hotmart, con
 * TODAS sus calificaciones, va siempre al lado de los extractos.
 */
export function motivoDescarte(texto, nota) {
  if (texto.length < LARGO_MINIMO) return 'texto demasiado corto';
  if (!(nota >= 4)) return 'nota menor que 4 (cuenta en la nota pública de Hotmart)';
  if (/https?:|www\.|@|\d[\d\s-]{6,}\d/i.test(texto)) return 'datos de contacto o enlaces';
  if (/\$|\bpesos\b|d[oó]lares|\busd\b|\bcop\b|precio|cost[oó]|barato|caro\b/i.test(texto)) return 'habla de precios';
  if (/no (me )?(deja|dej[oó]|puedo|pude|pued[eo]|abre|carga)|acceder|acceso|descargar|la app|aplicaci[oó]n|contrase[nñ]a|reembolso|estafa/i.test(texto)) return 'habla del acceso o de la plataforma, no del curso';
  if (/espero (me|que me) (den|respondan|contesten)|sin respuesta|no (me )?(han )?(respond|contest)|soporte|dudas sin/i.test(texto)) return 'reclama atención o respuesta, no opina del curso';
  if (texto === texto.toLocaleUpperCase('es') && /[A-ZÁÉÍÓÚÑ]{6}/.test(texto)) return 'todo en mayúsculas';
  return '';
}

/** Extracto literal: el texto entero si cabe; si no, hasta su última frase completa, o última palabra con «…». */
export function extracto(texto, largo = LARGO_EXTRACTO) {
  const t = limpiar(texto);
  if (t.length <= largo) return t;
  const corte = t.slice(0, largo);
  const frase = corte.match(/^.*[.!?…](?=\s|$)/)?.[0];
  if (frase && frase.length >= 80) return frase.trim();
  const palabras = corte.slice(0, corte.lastIndexOf(' ')).replace(/[\s,;:¡¿(«"“-]+$/, '');
  return `${palabras}…`;
}

/**
 * Elige hasta MAX_ELEGIDAS en el orden en que Hotmart las muestra (`sort_by_answers=true`), prefiriendo las que
 * caben enteras (40–240 caracteres) a las que hay que cortar. Devuelve todas con `elegida` y `motivo`.
 */
export function elegir(evaluaciones) {
  const marcadas = evaluaciones.map((e, orden) => ({ ...e, orden, motivo: motivoDescarte(e.texto, e.nota) }));
  const aptas = marcadas.filter((e) => !e.motivo);
  // Primero las que dicen algo y caben enteras; las muy breves y las que hay que cortar, al final.
  const enteras = (e) => { const n = e.texto.length; return n >= 70 && n <= LARGO_EXTRACTO ? 0 : n >= 40 && n < 70 ? 1 : n > LARGO_EXTRACTO ? 2 : 3; };
  const vistos = new Set();
  const elegidas = [...aptas].sort((a, b) => enteras(a) - enteras(b) || a.orden - b.orden).filter((e) => {
    const clave = e.texto.toLocaleLowerCase('es').slice(0, 40);
    if (vistos.has(clave)) return false; // la misma reseña publicada dos veces
    vistos.add(clave);
    return true;
  }).slice(0, MAX_ELEGIDAS);
  const ids = new Set(elegidas.map((e) => e.ucode));
  return marcadas.map((e) => ({
    ...e,
    elegida: ids.has(e.ucode),
    motivo: e.motivo || (ids.has(e.ucode) ? '' : 'apta, fuera del tope de ' + MAX_ELEGIDAS),
  }));
}

/** Lee una tabla CSV sencilla (comillas dobles RFC 4180). */
export function leerCsv(texto) {
  const filas = [];
  let fila = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas;
  return resto.filter((f) => f.length > 1).map((f) => Object.fromEntries(cab.map((k, i) => [k, f[i] ?? ''])));
}

export const csv = (filas, columnas) => [columnas.join(','), ...filas.map((f) => columnas.map((c) => {
  const v = String(f[c] ?? '');
  return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}).join(','))].join('\n') + '\n';

async function json(url) {
  for (let intento = 1; ; intento++) {
    try {
      const r = await fetch(url, { headers: { ...UA, accept: 'application/json', origin: 'https://hotmart.com' }, signal: AbortSignal.timeout(25000) });
      // Un producto sin evaluaciones responde 200 con el cuerpo vacío.
      if (r.ok) { const t = await r.text(); return t.trim() ? JSON.parse(t) : { total: 0, answers: [] }; }
      if (intento >= 4) throw new Error(`${r.status} ${url}`);
    } catch (error) {
      if (intento >= 4) throw error;
    }
    await dormir(3000 * intento);
  }
}

/** Ficha pública del producto: id numérico, URL canónica, nota y total publicados. */
async function ficha(codigo) {
  for (let intento = 1; ; intento++) {
    try { return await fichaUnaVez(codigo); } catch (error) { if (error.sinFicha || intento >= 4) throw error; await dormir(3000 * intento); }
  }
}

async function fichaUnaVez(codigo) {
  const r = await fetch(`https://hotmart.com/es/marketplace/productos/x/${codigo}`, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  if (r.status === 404) throw Object.assign(new Error('sin ficha pública en el marketplace de Hotmart'), { sinFicha: true });
  const html = await r.text();
  const datos = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)?.[1];
  if (!datos) throw new Error(`sin datos de página para ${codigo} (${r.status})`);
  const perfil = JSON.parse(datos).props.pageProps.profile;
  if (!perfil?.product) throw new Error(`página sin producto para ${codigo} (${r.status})`);
  const p = perfil.product;
  return {
    productId: p.productId,
    nombre: p.name,
    url: `https://hotmart.com/es/marketplace/productos/${p.slug}/${codigo}`,
    mostrar: perfil.showReviewsOnProductProfile !== false,
    nota: perfil.customerReview?.rating ?? null,
    total: perfil.customerReview?.totalReviews ?? 0,
  };
}

async function evaluaciones(productId) {
  const todas = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const d = await json(`https://api-ask.hotmart.com/api/v1/survey/product/${productId}/answers?page_size=50&offset=${pagina}&evaluation=ALL&sort_by_answers=true`);
    todas.push(...(d.answers ?? []));
    if (!d.answers?.length || todas.length >= d.total) return { total: d.total, respuestas: todas };
    await dormir(400);
  }
  return { total: todas.length, respuestas: todas };
}

async function main() {
  const arg = (n) => process.argv[process.argv.indexOf(n) + 1];
  const salida = path.resolve(arg('--salida'));
  mkdirSync(path.join(salida, 'crudo'), { recursive: true });
  const cursos = leerCsv(readFileSync(arg('--cursos'), 'utf8')).filter((c) => c.estado_cms === 'published');
  const desdeCrudo = process.argv.includes('--desde-crudo');
  const leidoEl = desdeCrudo ? JSON.parse(readFileSync(path.join(salida, 'carga-opiniones.json'), 'utf8')).leidoEl : new Date().toISOString();
  const todas = [], recuento = [], carga = [];
  for (const c of cursos) {
    const base = { curso: c.curso, producto: c.producto };
    if (!c.producto) { recuento.push({ ...base, estado: 'sin producto en Hotmart', evaluaciones_hotmart: 0, con_texto: 0, elegidas: 0 }); continue; }
    try {
      const crudo = path.join(salida, 'crudo', `${c.curso}.json`);
      let f, total, respuestas, leido = leidoEl;
      if (desdeCrudo) {
        if (!existsSync(crudo)) throw Object.assign(new Error('sin ficha pública en el marketplace de Hotmart'), { sinFicha: true });
        ({ ficha: f, total, respuestas, leidoEl: leido } = JSON.parse(readFileSync(crudo, 'utf8')));
      } else {
        f = await ficha(c.producto);
        ({ total, respuestas } = await evaluaciones(f.productId));
        writeFileSync(crudo, JSON.stringify({ leidoEl, ficha: f, total, respuestas }, null, 1));
      }
      const lista = respuestas.map((a) => ({
        ucode: a.ucode,
        fecha: a.date?.slice(0, 10) ?? '',
        nombre: limpiar(a.userName),
        nota: Number(a.answers?.find((x) => x.type === 'RATING_1_5')?.answer),
        texto: limpiar(a.answers?.find((x) => x.type === 'LONG_ANSWER')?.answer),
      })).filter((e) => e.nombre && e.nota >= 1 && e.nota <= 5);
      const conTexto = lista.filter((e) => e.texto);
      const marcadas = f.mostrar ? elegir(conTexto) : conTexto.map((e) => ({ ...e, elegida: false, motivo: 'el creador oculta las evaluaciones en Hotmart' }));
      for (const e of marcadas) {
        const fila = { ...base, product_id: f.productId, ucode: e.ucode, fecha: e.fecha, nombre: e.nombre, nota: e.nota, texto: e.texto, extracto: e.elegida ? extracto(e.texto) : '', elegida: e.elegida ? 'sí' : 'no', motivo: e.motivo, url_fuente: f.url, leido_el: leido };
        todas.push(fila);
        if (e.elegida) carga.push({ id: `hotmart-ask-${e.ucode}`, slug: c.curso, author_name: e.nombre, rating: e.nota, body: fila.extracto, source_url: f.url, review_date: e.fecha, read_at: leido });
      }
      const n = marcadas.filter((e) => e.elegida).length;
      recuento.push({ ...base, estado: n >= 3 ? '3 o más' : n ? 'menos de 3' : 'sin extractos citables', evaluaciones_hotmart: total, con_texto: conTexto.length, elegidas: n, nota_hotmart: f.nota ?? '', url_fuente: f.url });
      console.log(`${c.curso}: ${total} evaluaciones, ${conTexto.length} con texto, ${n} elegidas`);
    } catch (error) {
      recuento.push({ ...base, estado: error.sinFicha ? error.message : `error: ${error.message}`, evaluaciones_hotmart: '', con_texto: '', elegidas: 0 });
      console.error(`${c.curso}: ${error.message}`);
    }
    if (!desdeCrudo) await dormir(1200);
  }
  writeFileSync(path.join(salida, 'opiniones-hotmart.csv'), csv(todas, ['curso', 'producto', 'product_id', 'ucode', 'fecha', 'nombre', 'nota', 'elegida', 'extracto', 'texto', 'motivo', 'url_fuente', 'leido_el']));
  writeFileSync(path.join(salida, 'recuento-opiniones.csv'), csv(recuento, ['curso', 'producto', 'estado', 'evaluaciones_hotmart', 'con_texto', 'elegidas', 'nota_hotmart', 'url_fuente']));
  writeFileSync(path.join(salida, 'carga-opiniones.json'), JSON.stringify({ leidoEl, fuente: 'api-ask.hotmart.com (evaluaciones públicas de la página del producto)', cursos_leidos: recuento.filter((r) => r.producto && !String(r.estado).startsWith('error')).map((r) => r.curso), opiniones: carga }, null, 1));
  const por = (e) => recuento.filter((r) => r.estado === e).length;
  console.log(`\n${cursos.length} cursos publicados · 3 o más: ${por('3 o más')} · menos de 3: ${por('menos de 3')} · sin extractos: ${por('sin extractos citables')} · sin producto: ${por('sin producto en Hotmart')} · ${carga.length} extractos`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
