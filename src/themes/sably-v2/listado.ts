/**
 * Órdenes y texto de búsqueda de una lista de cursos para RejillaCursos.astro.
 * La nota es la publicada en Hotmart (solo con ≥ 5 calificaciones); el precio,
 * el que la ficha da como precio a pagar hoy (`preciosDeTarjetas`), que también
 * pinta cada tarjeta. USD se convierte con la tasa del país solo para ordenar,
 * nunca para mostrarse; un curso sin precio va al final.
 */
import { env } from 'virtual:sably-runtime';
import { readOperationalRatings } from '@/plugins/sably-operations/public';
import { preciosDeTarjetas, type ContextoPrecio } from '@/lib/precio-hoy';
import { importeParaOrdenar } from '@/lib/precio-tarjeta';
import { mostrarPromedio } from '@/lib/opiniones';
import type { Course } from '@/lib/emdash-content';
import type { Country } from '@/lib/countries';

export const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function ordenesDeCursos(cursos: Course[], country: Country, nombreArea: (slug: string) => string, ctx: ContextoPrecio) {
  const scope = ctx.locals;
  const db = (env as unknown as { SABLY_DB: D1Database }).SABLY_DB;
  const valoraciones = await readOperationalRatings(db, scope).catch(() => ({} as Awaited<ReturnType<typeof readOperationalRatings>>));
  const { precios, freshUntil } = await preciosDeTarjetas(cursos, country, ctx);
  const nota = (c: Course) => { const v = valoraciones[c.id]; return v && mostrarPromedio(v.total) ? v.rating : 0; };
  const porNota = [...cursos].sort((a, b) => nota(b) - nota(a) || (valoraciones[b.id]?.total ?? 0) - (valoraciones[a.id]?.total ?? 0));
  const importe = (c: Course) => importeParaOrdenar(precios.get(c.id), country.usdRate, country.currency);
  const porPrecio = [...cursos].sort((a, b) => importe(a) - importe(b));
  return {
    ordenNota: new Map(porNota.map((c, i) => [c.id, i])),
    ordenPrecio: new Map(porPrecio.map((c, i) => [c.id, i])),
    precios,
    /** Hasta cuándo valen las cifras (ms): el layout no deja la página en caché más tiempo. */
    freshUntil,
    buscable: new Map(cursos.map(c => [c.id, normalizar(`${c.data.title} ${nombreArea(c.data.category)} ${(c.data.keywords ?? []).join(' ')} ${c.data.subcategory ?? ''}`)])),
  };
}

/** Filtro del servidor para `?q=` (sin JavaScript): todas las palabras deben aparecer. */
export function filtrarCursos(cursos: Course[], q: string, buscable: Map<string, string>) {
  const terminos = normalizar(q).split(/\s+/).filter(t => t.length > 1);
  if (!terminos.length) return cursos;
  return cursos.filter(c => terminos.every(t => buscable.get(c.id)?.includes(t)));
}
