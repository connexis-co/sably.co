/**
 * POST /api/v1/precios/refresca {slug} — refresco de precio DESDE LA COLO DEL
 * VISITANTE.
 *
 * La pieza que hace posible el multi-moneda sin geolocalizar a nadie: Hotmart
 * decide la moneda por la IP de quien consulta el checkout, y una Pages
 * Function corre en la colo más cercana al visitante. Cuando un mexicano abre
 * una ficha, este endpoint consulta el checkout desde su colo y guarda el
 * precio en MXN; el colombiano guarda el COP. Cada país mantiene fresca su
 * propia moneda con su propio tráfico.
 *
 * Devuelve los precios actuales del slug, así que el cliente lo usa también
 * para pintar el dato más fresco que el horneado en el build.
 *
 * Contención de abuso: solo slugs registrados en hotmart_producto, y como
 * mucho UNA consulta al checkout por slug cada 30 min (la marca `capturado`
 * más reciente hace de cerrojo). Todo lo demás responde de D1 sin tocar
 * Hotmart.
 */
import type { Env } from '../_shared';
import { MONEDAS_ISO, error, json } from '../_shared';

/**
 * El payload del checkout (Nuxt, serializado con devalue) aplana los objetos:
 * el precio queda como pares `numero,"XXX"` con la moneda a continuación.
 * Aparecen el precio localizado por IP y el base en USD; se toma la primera
 * aparición de cada moneda. Verificado contra C55918118T:
 * [165450 COP, 49.99 USD].
 *
 * Dos filtros aprendidos a golpes (medidos el 2026-08-18 contra M98302199F):
 *
 * · Solo monedas reales. El regex también atrapaba `"RUT":19` del checkout
 *   chileno (el campo del documento, con el IVA al lado) y ese «RUT» viajó
 *   como divisa hasta quedar horneado en los 102 cursos del JSON.
 * · Si el checkout muestra una moneda local ADEMÁS del USD, ese USD no es el
 *   precio base: es el equivalente que ve ESE país, IVA incluido (Chile lo
 *   engorda un 19 %: 57 → 67,83). Guardarlo pisaba el USD real y la web llegó
 *   a sobrecotizar soldadura a US$67,83. El USD solo se guarda cuando viene
 *   solo, que es cuando de verdad es el precio del país-USD (EE. UU./Ecuador,
 *   o el runner del job diario).
 */
function extraerPrecios(html: string): { moneda: string; monto: number }[] {
  const vistos = new Map<string, number>();
  for (const m of html.matchAll(/(\d{1,9}(?:\.\d{1,2})?),"([A-Z]{3})"/g)) {
    const monto = Number(m[1]);
    const moneda = m[2]!;
    if (!MONEDAS_ISO.has(moneda)) continue;
    if (!vistos.has(moneda) && monto > 0) vistos.set(moneda, monto);
  }
  const pares = [...vistos].map(([moneda, monto]) => ({ moneda, monto }));
  return pares.length > 1 ? pares.filter((p) => p.moneda !== 'USD') : pares;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let slug = '';
  try {
    slug = String(((await request.json()) as { slug?: string }).slug ?? '');
  } catch {
    return error('Cuerpo JSON inválido.');
  }
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return error('Slug inválido.');

  let precios: Record<string, number> = {};
  try {
    const filas = await env.DB.prepare(
      'SELECT moneda, monto, capturado FROM hotmart_precio WHERE slug = ?',
    )
      .bind(slug)
      .all<{ moneda: string; monto: number; capturado: number }>();
    for (const f of filas.results ?? []) precios[f.moneda] = f.monto;

    const masReciente = Math.max(0, ...(filas.results ?? []).map((f) => f.capturado));
    const ahora = Math.floor(Date.now() / 1000);
    if (ahora - masReciente < 1800) return json({ slug, precios, refrescado: false });

    const prod = await env.DB.prepare('SELECT pay_url FROM hotmart_producto WHERE slug = ?')
      .bind(slug)
      .first<{ pay_url: string }>();
    if (!prod) return error('Curso sin producto registrado.', 404);

    const r = await fetch(prod.pay_url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SablyPrecios/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return json({ slug, precios, refrescado: false });

    const nuevos = extraerPrecios(await r.text());
    if (nuevos.length) {
      await env.DB.batch(
        nuevos.map(({ moneda, monto }) =>
          env.DB.prepare(
            `INSERT INTO hotmart_precio (slug, moneda, monto, capturado)
             VALUES (?, ?, ?, unixepoch())
             ON CONFLICT(slug, moneda) DO UPDATE SET monto = excluded.monto, capturado = unixepoch()`,
          ).bind(slug, moneda, monto),
        ),
      );
      for (const { moneda, monto } of nuevos) precios[moneda] = monto;
    }
    return json({ slug, precios, refrescado: nuevos.length > 0 });
  } catch {
    // Ante cualquier fallo, lo que hubiera: este endpoint nunca rompe la ficha.
    return json({ slug, precios, refrescado: false });
  }
};
