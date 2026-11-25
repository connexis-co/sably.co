#!/usr/bin/env node
/**
 * Enlaces internos de la ficha: tema clásico frente a V2 (?tema=v2), en cinco fichas.
 *   node scripts/comparar-enlaces-ficha.mjs https://sably.co
 *   node scripts/comparar-enlaces-ficha.mjs https://dev.sably.co   (con SABLY_DEV_PASSWORD)
 * «faltanEnV2»: enlaces del <main> clásico que no aparecen en ninguna parte de la página V2.
 */
import puppeteer from 'puppeteer-core';
const BASE = process.argv[2] ?? 'https://sably.co';
const FICHAS = ['co/curso-de-masajes','mx/curso-de-unas-acrilicas','ec/curso-de-pasteleria','co/curso-de-soldadura','co/curso-de-tatuaje'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const nav = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const cred = process.env.SABLY_DEV_PASSWORD && !BASE.includes('//sably.co') ? { username: 'sably', password: process.env.SABLY_DEV_PASSWORD } : null;
const enlaces = async (url) => {
  const p = await nav.newPage(); if (cred) await p.authenticate(cred); await p.setUserAgent(UA); await p.setViewport({ width: 1440, height: 900 });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  const r = await p.evaluate(() => {
    const limpia = (h) => { const u = new URL(h); u.searchParams.delete('tema'); u.searchParams.delete('verif'); return u.pathname + (u.search || ''); };
    const int = (root) => [...root.querySelectorAll('a[href]')].filter((a) => { try { const u = new URL(a.href); return u.host === location.host && !(u.pathname === location.pathname && u.hash); } catch { return false; } }).map((a) => limpia(a.href));
    const main = document.querySelector('main');
    return { pagina: int(document), main: main ? int(main) : [] };
  });
  await p.close(); return r;
};
const out = {};
for (const f of FICHAS) {
  // Con V2 como tema por defecto, sin ?tema=clasico esto comparaba V2 consigo mismo.
  const c = await enlaces(`${BASE}/${f}/?tema=clasico&verif=${Date.now()}`);
  const v = await enlaces(`${BASE}/${f}/?tema=v2`);
  const set = (a) => new Set(a);
  const faltan = [...set(c.main)].filter((h) => !set(v.pagina).has(h));
  const nuevos = [...set(v.main)].filter((h) => !set(c.pagina).has(h));
  out[f] = { clasico: { pagina: c.pagina.length, main: c.main.length, mainUnicos: set(c.main).size }, v2: { pagina: v.pagina.length, main: v.main.length, mainUnicos: set(v.main).size }, faltanEnV2: faltan, soloEnV2: nuevos };
  console.log(f, JSON.stringify(out[f]));
}
await nav.close();
