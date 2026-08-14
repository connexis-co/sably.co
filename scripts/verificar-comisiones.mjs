/**
 * Guardián de comisiones: ningún curso puede publicarse con un enlace de compra
 * que no acredite comisión de afiliado.
 *
 * Resuelve el `hotmartUrl` de cada curso siguiendo las redirecciones reales y
 * exige que el destino final lleve `ref=`. Un acortador puede estar vivo, llevar
 * al producto correcto y aun así no pagar comisión: solo el `ref` del destino
 * final lo garantiza, así que se comprueba ahí y no en la URL publicada.
 *
 * Uso:
 *   node scripts/verificar-comisiones.mjs            # todos los cursos
 *   node scripts/verificar-comisiones.mjs --json     # salida para otros scripts
 *   node scripts/verificar-comisiones.mjs curso-de-barberia curso-de-unas
 *
 * Sale con código 1 si algún curso publicable no acredita comisión, para poder
 * usarlo como puerta en CI o antes de reactivar campañas.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CURSOS = join(RAIZ, 'src/content/courses');
const JSON_OUT = process.argv.includes('--json');
const filtro = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const log = (...a) => { if (!JSON_OUT) console.log(...a); };

/**
 * Cursos que NO bloquean aunque publiquen sin comisión, porque están esperando
 * una decisión de negocio y no un arreglo de código.
 *
 * Es una lista corta y a mano a propósito: cada entrada obliga a escribir por
 * qué. Si esto se llenara, el guardián dejaría de guardar nada.
 *
 * Sin la lista, un solo curso bloqueado tumbaría TODOS los PR del repo —
 * incluido el que viniera a resolverlo.
 *
 * Ahora mismo está vacía, y ese es el estado sano: significa que ningún curso
 * publicado se vende sin acreditar comisión.
 *
 * Tuvo una entrada, `curso-de-maquillaje`, con el diagnóstico equivocado de que
 * JP no estaba afiliado a N41531652U. Sí lo estaba: lo que faltaba era un
 * acortador que llevara el ref dentro. Con él, el mismo producto acredita
 * comisión y el cupón sigue llegando. La lección es que «sin ref en la URL» no
 * prueba «sin afiliación».
 */
const EXCEPCIONES = {};

/** El frontmatter se lee a mano para no depender del runtime de Astro. */
function leerCursos() {
  return readdirSync(CURSOS)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => {
      const slug = f.replace(/\.mdx$/, '');
      const txt = readFileSync(join(CURSOS, f), 'utf8');
      const url = txt.match(/^hotmartUrl:\s*(\S+)/m)?.[1]?.replace(/^["']|["']$/g, '') ?? '';
      return { slug, url };
    })
    .filter((c) => !filtro.length || filtro.includes(c.slug));
}

async function resolver(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
    return { final: r.url, status: r.status };
  } catch (e) {
    return { final: '', status: 0, error: e.message.slice(0, 60) };
  }
}

const cursos = leerCursos();
log(`Verificando ${cursos.length} cursos…\n`);

/* De 8 en 8: Hotmart corta las ráfagas y una redirección fallida se confundiría
   con un enlace roto. */
const resultados = [];
for (let i = 0; i < cursos.length; i += 8) {
  const lote = cursos.slice(i, i + 8);
  const res = await Promise.all(lote.map(async (c) => {
    if (!c.url || /PENDIENTE/i.test(c.url)) return { ...c, estado: 'SIN_ENLACE' };
    const { final, status, error } = await resolver(c.url);
    if (error || !status) return { ...c, estado: 'ERROR', detalle: error };
    const ref = final.match(/[?&]ref=([A-Z0-9]+)/i)?.[1] ?? null;
    const prod = final.match(/pay\.hotmart\.com\/([A-Z0-9]+)/i)?.[1] ?? null;
    if (!prod) return { ...c, estado: 'NO_LLEGA_A_CHECKOUT', final };
    return { ...c, estado: ref ? 'OK' : 'SIN_REF', ref, producto: prod, final };
  }));
  resultados.push(...res);
  if (!JSON_OUT) process.stdout.write(`\r  ${Math.min(i + 8, cursos.length)}/${cursos.length}`);
}
log('\n');

const por = (e) => resultados.filter((r) => r.estado === e);
const sinRef = por('SIN_REF');
const noCheckout = por('NO_LLEGA_A_CHECKOUT');
const errores = por('ERROR');
const sinEnlace = por('SIN_ENLACE');

if (JSON_OUT) {
  console.log(JSON.stringify({
    ok: por('OK').map((r) => ({ slug: r.slug, ref: r.ref, producto: r.producto })),
    sin_ref: sinRef.map((r) => ({ slug: r.slug, producto: r.producto, url: r.url })),
    sin_enlace: sinEnlace.map((r) => r.slug),
    no_checkout: noCheckout.map((r) => ({ slug: r.slug, final: r.final })),
    errores: errores.map((r) => ({ slug: r.slug, detalle: r.detalle })),
  }, null, 2));
} else {
  log(`✅ Con comisión:      ${por('OK').length}`);
  log(`🔴 SIN comisión:      ${sinRef.length}${sinRef.length ? '  ← NO PUBLICITAR' : ''}`);
  log(`⚪ Sin enlace aún:    ${sinEnlace.length}`);
  log(`⚠️  No llegan a checkout: ${noCheckout.length}`);
  log(`⚠️  Error de red:      ${errores.length}`);
  for (const r of sinRef) log(`\n  🔴 ${r.slug}\n     publica ${r.url}\n     llega a pay.hotmart.com/${r.producto} SIN ref → la venta la cobra el productor`);
  for (const r of noCheckout) log(`\n  ⚠️  ${r.slug} → ${r.final?.slice(0, 90)}`);
  for (const r of errores) log(`\n  ⚠️  ${r.slug}: ${r.detalle}`);
}

/* Solo los que ya tienen enlace bloquean: un curso sin publicar todavía no es un
   fallo. Y los que esperan una decisión de negocio se avisan, no frenan. */
const bloquean = sinRef.filter((r) => !EXCEPCIONES[r.slug]);
for (const r of sinRef.filter((r) => EXCEPCIONES[r.slug])) {
  log(`\n  🟡 ${r.slug} — sin comisión, tolerado por excepción documentada`);
  log(`     ${EXCEPCIONES[r.slug]}`);
}
if (bloquean.length || noCheckout.length) {
  log(`\n❌ ${bloquean.length + noCheckout.length} curso(s) publicables sin comisión. No se despliega así.`);
}
process.exit(bloquean.length || noCheckout.length ? 1 : 0);
