/**
 * Última cotización buena de Hotmart por curso, país y cupón, en `sably.db`
 * (tabla `hotmart_cotizacion`, migrations/0011_hotmart_cotizacion.sql).
 *
 * La ficha cotiza en vivo; si Hotmart falla o tarda, enseña esta (con su fecha) en
 * vez de caer al precio en USD de la captura de octubre. Hoy `sably.db` no aplica
 * migraciones al arrancar en Node, así que la tabla se crea aquí la primera vez
 * (`CREATE TABLE IF NOT EXISTS`, una vez por proceso); el archivo de migración la
 * deja registrada para entornos nuevos. Si la base falla, la ficha sigue con lo
 * que haya en memoria: nunca rompe el render.
 */
import type { AlmacenCotizaciones, CotizacionGuardada } from '@/lib/checkout-price';

export const SQL_TABLA_COTIZACION = `CREATE TABLE IF NOT EXISTS hotmart_cotizacion (
  slug     TEXT NOT NULL,
  mercado  TEXT NOT NULL CHECK (length(mercado) = 2),
  cupon    TEXT NOT NULL DEFAULT '',
  moneda   TEXT NOT NULL CHECK (length(moneda) = 3),
  base     REAL NOT NULL CHECK (base > 0),
  rebajado REAL CHECK (rebajado IS NULL OR rebajado > 0),
  leida    INTEGER NOT NULL,
  PRIMARY KEY (slug, mercado, cupon)
)`;

interface Fila { cupon: string; moneda: string; base: number; rebajado: number | null; leida: number }

export function almacenEnBase(db: () => D1Database | undefined): AlmacenCotizaciones {
  let lista: Promise<void> | null = null;
  const preparar = (d: D1Database) => (lista ??= d.prepare(SQL_TABLA_COTIZACION).run().then(() => undefined).catch((e) => { lista = null; throw e; }));
  return {
    async leer(slug, mercado, cupon) {
      const d = db();
      if (!d) return null;
      await preparar(d);
      const fila = await d.prepare(
        `SELECT cupon, moneda, base, rebajado, leida FROM hotmart_cotizacion
         WHERE slug = ? AND mercado = ? AND cupon IN (?, '') ORDER BY (cupon = ?) DESC LIMIT 1`,
      ).bind(slug, mercado, cupon ?? '', cupon ?? '').first<Fila>();
      if (!fila) return null;
      return { currency: fila.moneda, base: fila.base, reduced: fila.cupon ? fila.rebajado : null, cupon: fila.cupon || null, at: fila.leida };
    },
    async guardar(slug, mercado, c: CotizacionGuardada) {
      const d = db();
      if (!d) return;
      await preparar(d);
      await d.prepare(
        `INSERT INTO hotmart_cotizacion (slug, mercado, cupon, moneda, base, rebajado, leida) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (slug, mercado, cupon) DO UPDATE SET moneda = excluded.moneda, base = excluded.base, rebajado = excluded.rebajado, leida = excluded.leida
         WHERE excluded.leida >= hotmart_cotizacion.leida`,
      ).bind(slug, mercado, c.cupon ?? '', c.currency, c.base, c.reduced, c.at).run();
    },
  };
}
