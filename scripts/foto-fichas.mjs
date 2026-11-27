#!/usr/bin/env node
/**
 * Foto de las fichas en producción antes y después de cargar contenido: lo que NO puede cambiar.
 *
 *   node scripts/foto-fichas.mjs tomar    --cursos a,b --salida antes.json [--fresco]
 *   node scripts/foto-fichas.mjs comparar antes.json despues.json
 *
 * Por cada curso y país: estado, <title>, H1, canónica, enlaces de compra, bloque «Disponible online en»,
 * importes visibles y preguntas de precio y de pago.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PAISES = ['co', 'mx', 'pe', 'ec', 'cl', 'ar', 'es', 'us'];
const BASE = 'https://sably.co';
const texto = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export function foto(status, html) {
  const sinScripts = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ');
  const i = sinScripts.indexOf('Disponible online en');
  const bloque = i < 0 ? '' : sinScripts.slice(i, i + sinScripts.slice(i).search(/<\/section>|<\/details>|<footer/));
  const enlaces = [...html.matchAll(/(?:href|data-href|data-url)="([^"]*(?:hotmart\.com|hotm\.io|hotm\.art|src=sably)[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const visible = texto(html);
  return {
    status,
    title: texto(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''),
    h1: texto(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''),
    canonica: html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1] ?? '',
    enlaces: [...new Set(enlaces)].sort(),
    ciudades: texto(bloque),
    importes: [...new Set(visible.match(/(?:\$|€|S\/|US\$)\s?\d[\d.,]*\s?(?:COP|MXN|PEN|USD|CLP|ARS|EUR)|\d[\d.,]*\s?€(?:\s?EUR)?/g) ?? [])].sort(),
    pregunta_precio: /¿Cuánto cuesta el curso\?/.test(visible),
    pregunta_pago: /¿Cómo puedo pagar desde /.test(visible),
  };
}

const [orden, ...resto] = process.argv.slice(2);
const opt = (n) => { const i = resto.indexOf(`--${n}`); return i < 0 ? undefined : resto[i + 1]; };
if (orden === 'tomar') {
  const salida = {};
  for (const slug of opt('cursos').split(',')) {
    for (const cc of PAISES) {
      const url = `${BASE}/${cc}/${slug}/`;
      const q = resto.includes('--fresco') ? `?verif=${Date.now()}` : '';
      let r;
      for (let n = 1; ; n++) {
        r = await fetch(url + q, { headers: { 'user-agent': 'sably-verificar-contenido/1.0' }, signal: AbortSignal.timeout(60000) }).catch((e) => ({ status: 0, text: async () => String(e) }));
        if ((r.status && r.status < 500) || n >= 3) break;
        await new Promise((res) => setTimeout(res, 5000 * n));
      }
      salida[url] = foto(r.status, await r.text());
      await new Promise((res) => setTimeout(res, 150));
    }
  }
  writeFileSync(opt('salida'), JSON.stringify(salida, null, 1));
  const v = Object.values(salida);
  console.log(`${v.length} páginas · 200: ${v.filter((x) => x.status === 200).length} · con ciudades: ${v.filter((x) => x.ciudades).length} · con importe: ${v.filter((x) => x.importes.length).length} · con enlace de compra: ${v.filter((x) => x.enlaces.length).length} · precio: ${v.filter((x) => x.pregunta_precio).length} · pago: ${v.filter((x) => x.pregunta_pago).length}`);
} else if (orden === 'comparar') {
  const [a, b] = resto.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  let fallos = 0;
  for (const [url, d] of Object.entries(b)) {
    const x = a[url]; const p = [];
    if (d.status !== 200) p.push(`HTTP ${d.status}`);
    for (const k of ['title', 'h1', 'canonica', 'ciudades']) if (x[k] !== d[k]) p.push(`${k} cambió: «${String(x[k]).slice(0, 90)}» → «${String(d[k]).slice(0, 90)}»`);
    for (const k of ['enlaces', 'importes']) if (JSON.stringify(x[k]) !== JSON.stringify(d[k])) p.push(`${k} cambió: ${JSON.stringify(x[k].filter((v) => !d[k].includes(v))).slice(0, 200)} → ${JSON.stringify(d[k].filter((v) => !x[k].includes(v))).slice(0, 200)}`);
    for (const k of ['pregunta_precio', 'pregunta_pago']) if (x[k] && !d[k]) p.push(`desapareció la ${k}`);
    if (!d.importes.length) p.push('sin precio visible');
    if (p.length) { fallos++; console.log(`✗ ${url}\n    ${p.join('\n    ')}`); }
  }
  const v = Object.values(b);
  console.log(`${v.length} páginas comparadas, ${fallos} con diferencias · precio: ${v.filter((x) => x.pregunta_precio).length} · pago: ${v.filter((x) => x.pregunta_pago).length}`);
  process.exit(fallos ? 1 : 0);
} else { console.log('uso: tomar --cursos a,b --salida f.json | comparar antes.json despues.json'); process.exit(2); }
