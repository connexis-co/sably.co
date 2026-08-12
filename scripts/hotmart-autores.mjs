#!/usr/bin/env node
/**
 * Captura el AUTOR REAL de cada producto (bloque `hotmarter` de la página
 * pública) y descarga su avatar.
 *
 * Por qué: las fichas mostraban instructores inventados («Camila Herrera,
 * instructora de yoga…») con biografías fabricadas. Hotmart no publica un
 * instructor individual por producto: el autor público es el PRODUCTOR
 * (p. ej. MasterClasses.La®), con nombre, avatar, biografía y badges
 * verificables en la página del producto. Eso es lo que se muestra.
 *
 * Salida:
 *   - hotmart-live.json → productos[slug].autor = slug del autor
 *                         autores[slugAutor] = { nombre, bio, badges, cursos… }
 *   - public/creadores/<slugAutor>.png (avatar descargado)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = path.join(RAIZ, 'src/data/hotmart-live.json');
const AVATARES = path.join(RAIZ, 'public/creadores');

const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const datos = JSON.parse(readFileSync(LIVE, 'utf8'));
  datos.autores ??= {};
  mkdirSync(AVATARES, { recursive: true });

  const entradas = Object.entries(datos.productos).filter(([, p]) => p.hotlink);
  console.log(`${entradas.length} productos con hotlink`);

  let ok = 0;
  for (const [slug, p] of entradas) {
    try {
      const r = await fetch(`https://go.hotmart.com/${p.hotlink}?dp=1`, {
        headers: UA, redirect: 'follow', signal: AbortSignal.timeout(25000),
      });
      const h = await r.text();
      // Ancla al bloque del AUTOR: la página tiene DOS "hotmarter" — uno de
      // textos de interfaz («{{count}} Años Hotmarter») que aparece antes, y el
      // de datos, que arranca con userId. Ventana fija porque el objeto supera
      // el kilobyte y un lazy-match hasta la llave de cierre se quedaba corto.
      const inicio = h.indexOf('"hotmarter":{"userId"');
      const bloque = inicio >= 0 ? h.slice(inicio, inicio + 2500) : '';
      const campo = (k) => bloque.match(new RegExp(`"${k}":"([^"]*)"`))?.[1] ?? '';
      const nombre = campo('name');
      const slugAutor = campo('slug') || nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (!nombre)
        throw new Error(`sin hotmarter (HTTP ${r.status}, ${h.length}b, ${r.url.slice(0, 70)})`);

      if (!datos.autores[slugAutor]) {
        const badges = [...bloque.matchAll(/"([A-Z_]{4,})"/g)].map((m) => m[1]);
        datos.autores[slugAutor] = {
          nombre,
          bio: campo('biography').replace(/\\n/g, ' ').trim(),
          avatar: campo('avatarFinal').replaceAll('\\u002F', '/'),
          desde: Number(bloque.match(/"userSince":(\d{4})/)?.[1]) || null,
          verificado: badges.includes('VERIFIED_PROFILE'),
          bestSeller: badges.includes('BEST_SELLER'),
        };
        // Avatar a /public: se sirve con el sitio (y el CDN lo recoge en CI).
        const url = datos.autores[slugAutor].avatar;
        if (url) {
          const img = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
          if (img.ok) {
            const ext = url.match(/\.(png|jpe?g|webp)/i)?.[1]?.toLowerCase() ?? 'png';
            const destino = `creadores/${slugAutor}.${ext}`;
            writeFileSync(path.join(RAIZ, 'public', destino), Buffer.from(await img.arrayBuffer()));
            datos.autores[slugAutor].foto = `/${destino}`;
          }
        }
        console.log(`  autor nuevo: ${nombre} (${slugAutor})`);
      }
      datos.productos[slug].autor = slugAutor;
      ok++;
      await dormir(300);
    } catch (e) {
      console.log(`  ${slug.padEnd(46)} FALLO ${e.message.slice(0, 50)}`);
    }
  }

  writeFileSync(LIVE, JSON.stringify(datos, null, 1) + '\n');
  console.log(`\n${ok}/${entradas.length} con autor · ${Object.keys(datos.autores).length} autores distintos`);
  for (const [s, a] of Object.entries(datos.autores)) {
    const n = Object.values(datos.productos).filter((p) => p.autor === s).length;
    console.log(`  ${a.nombre.padEnd(28)} ${n} cursos  ${a.verificado ? '✔ verificado' : ''} ${a.bestSeller ? '· best seller' : ''}`);
  }
}

main();
