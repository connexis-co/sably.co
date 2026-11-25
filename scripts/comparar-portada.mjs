#!/usr/bin/env node
/**
 * Compara la portada de cada país entre dos sitios: H1, palabras del <main> y enlaces internos únicos.
 * Sirve para comprobar que una mejora de la portada no quita texto ni enlaces que ya leen ChatGPT y Bing.
 *
 *   node scripts/comparar-portada.mjs --base http://localhost:4391 --referencia https://sably.co
 *   node scripts/comparar-portada.mjs --base http://localhost:4391 --referencia https://sably.co --pais co --json salida.json
 *
 * Pide cada página con un parámetro nuevo (Cloudflare sirve a veces una copia vieja) y un agente de Chrome
 * normal (nginx de producción responde 403 a `HeadlessChrome`). Sale con código 1 si en algún país la nueva
 * tiene más de un H1, pierde un enlace interno o tiene menos palabras.
 */
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const opciones = n => args.flatMap((a, i) => (a === `--${n}` ? [args[i + 1]] : []));
const BASE = opcion('base', 'http://localhost:4321').replace(/\/$/, '');
const REF = opcion('referencia', 'https://sably.co').replace(/\/$/, '');
const PAISES = opciones('pais').length ? opciones('pais') : ['co', 'mx', 'ar', 'cl', 'pe', 'ec', 'us', 'es'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const sinEtiquetas = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<template[\s\S]*?<\/template>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');

export function medir(html, origen) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const h1 = [...html.matchAll(/<h1[\s>][\s\S]*?<\/h1>/gi)].map(m => sinEtiquetas(m[0]).replace(/\s+/g, ' ').trim());
  const palabras = sinEtiquetas(main).split(/\s+/).filter(p => /\p{L}/u.test(p)).length;
  const enlaces = new Set();
  for (const [, href] of main.matchAll(/<a\b[^>]*?\shref="([^"#][^"]*)"/gi)) {
    try {
      const u = new URL(href.replace(/&amp;/g, '&'), origen);
      if (u.origin !== new URL(origen).origin) continue;
      u.searchParams.delete('tema');
      enlaces.add(u.pathname + (u.search || ''));
    } catch { /* href raro: se ignora */ }
  }
  return { h1, palabras, enlaces };
}

async function pedir(base, pais) {
  const url = `${base}/${pais}/?cmp=${Date.now().toString(36)}`;
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return medir(await r.text(), base);
}

let fallo = false;
const informe = [];
for (const pais of PAISES) {
  const [antes, despues] = await Promise.all([pedir(REF, pais), pedir(BASE, pais)]);
  const perdidos = [...antes.enlaces].filter(e => !despues.enlaces.has(e));
  const nuevos = [...despues.enlaces].filter(e => !antes.enlaces.has(e));
  const ok = despues.h1.length === 1 && perdidos.length === 0 && despues.palabras >= antes.palabras;
  if (!ok) fallo = true;
  informe.push({ pais, ok, h1: despues.h1, palabras: [antes.palabras, despues.palabras], enlaces: [antes.enlaces.size, despues.enlaces.size], perdidos, nuevos });
  console.log(`${ok ? 'OK ' : 'MAL'} /${pais}/  H1 ${despues.h1.length}  palabras ${antes.palabras} → ${despues.palabras}  enlaces ${antes.enlaces.size} → ${despues.enlaces.size}${perdidos.length ? `  perdidos: ${perdidos.join(' ')}` : ''}`);
}
const json = opcion('json');
if (json) writeFileSync(json, JSON.stringify(informe, null, 2));
process.exit(fallo ? 1 : 0);
