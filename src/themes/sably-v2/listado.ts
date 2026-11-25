/**
 * Órdenes y texto de búsqueda de una lista de cursos para RejillaCursos.astro.
 * La nota es la publicada en Hotmart (solo con ≥ 5 calificaciones); el precio,
 * el real de la ficha en la moneda del país (USD convertido con la tasa del país
 * solo para ordenar, nunca para mostrarse).
 */
import { env } from 'virtual:sably-runtime';
import { readOperationalPrice, readOperationalRatings } from '@/plugins/sably-operations/public';
import { mostrarPromedio } from '@/lib/opiniones';
import type { Course } from '@/lib/emdash-content';
import type { Country } from '@/lib/countries';

export const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function ordenesDeCursos(cursos: Course[], country: Country, nombreArea: (slug: string) => string, scope: object) {
  const db = (env as unknown as { SABLY_DB: D1Database }).SABLY_DB;
  const valoraciones = await readOperationalRatings(db, scope).catch(() => ({} as Awaited<ReturnType<typeof readOperationalRatings>>));
  const precios = await Promise.all(cursos.map(async c => {
    const real = await readOperationalPrice(db, c.id, country, scope).catch(() => null);
    const local = real ? (real.moneda === 'USD' && country.currency !== 'USD' ? real.monto * country.usdRate : real.monto) : c.data.priceUSD * country.usdRate;
    return [c.id, local] as const;
  }));
  const nota = (c: Course) => { const v = valoraciones[c.id]; return v && mostrarPromedio(v.total) ? v.rating : 0; };
  const porNota = [...cursos].sort((a, b) => nota(b) - nota(a) || (valoraciones[b.id]?.total ?? 0) - (valoraciones[a.id]?.total ?? 0));
  const precio = new Map(precios);
  const porPrecio = [...cursos].sort((a, b) => (precio.get(a.id) ?? 0) - (precio.get(b.id) ?? 0));
  return {
    ordenNota: new Map(porNota.map((c, i) => [c.id, i])),
    ordenPrecio: new Map(porPrecio.map((c, i) => [c.id, i])),
    buscable: new Map(cursos.map(c => [c.id, normalizar(`${c.data.title} ${nombreArea(c.data.category)} ${(c.data.keywords ?? []).join(' ')} ${c.data.subcategory ?? ''}`)])),
  };
}

/** Filtro del servidor para `?q=` (sin JavaScript): todas las palabras deben aparecer. */
export function filtrarCursos(cursos: Course[], q: string, buscable: Map<string, string>) {
  const terminos = normalizar(q).split(/\s+/).filter(t => t.length > 1);
  if (!terminos.length) return cursos;
  return cursos.filter(c => terminos.every(t => buscable.get(c.id)?.includes(t)));
}
