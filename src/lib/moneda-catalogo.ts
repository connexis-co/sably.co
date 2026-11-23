import { env } from 'virtual:sably-runtime';
import { operationalPrice, readOperationalData } from '@/plugins/sably-operations/public';
import { listaMonedas } from './moneda';

/**
 * Las monedas en que salen los precios de estos cursos, con la misma regla que
 * CourseCard: la del checkout de Hotmart y, sin dato real, la del país.
 */
export async function monedasCobradas(slugs: string[], country: { currency: string }, scope?: object): Promise<string> {
  const db = (env as unknown as { SABLY_DB: D1Database }).SABLY_DB;
  const data = await readOperationalData(db, scope).catch(() => null);
  return listaMonedas(slugs.map(slug => (data && operationalPrice(data, slug, country)?.moneda) || country.currency), country.currency);
}
