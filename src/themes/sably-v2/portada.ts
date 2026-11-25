/**
 * Datos puros de la portada V2: el inventario del mosaico del héroe (D1) y su reparto entre celdas.
 * Sin Astro ni base de datos, para poder probarlo (tests/portada-v2.test.ts).
 */
export interface CursoMosaico { id: string; destacado: boolean; valoraciones: number; comprable: boolean; foto: string | null }

export const CELDAS_MOSAICO = 3;
export const MAXIMO_MOSAICO = 12;

/**
 * Cursos del mosaico, en orden: los elegidos en el panel (si hay) o los destacados y luego los de más
 * valoraciones, como «Destacados». Solo con inscripción abierta y foto de su oficio, y sin repetir foto:
 * dos celdas nunca enseñan la misma escena.
 */
export function inventarioMosaico(cursos: readonly CursoMosaico[], elegidos: readonly string[] = [], maximo = MAXIMO_MOSAICO, relleno = false): CursoMosaico[] {
  const validos = cursos.filter(c => c.comprable && c.foto);
  const automatico = [...validos].sort((a, b) => Number(b.destacado) - Number(a.destacado) || b.valoraciones - a.valoraciones);
  const primero = elegidos.map(id => validos.find(c => c.id === id)).filter((c): c is CursoMosaico => !!c);
  /* Con `relleno`, lo que falte hasta `maximo` se completa con el orden automático (lista de fábrica);
     sin él, una lista elegida en el panel manda tal cual. */
  const orden = !elegidos.length ? automatico : relleno ? [...primero, ...automatico.filter(c => !primero.includes(c))] : primero;
  const fotos = new Set<string>();
  const salida: CursoMosaico[] = [];
  for (const c of orden) {
    if (fotos.has(c.foto!)) continue;
    fotos.add(c.foto!);
    salida.push(c);
    if (salida.length === maximo) break;
  }
  return salida;
}

/** Reparto por turnos: el curso i va a la celda i % celdas; el primero de cada celda es el que se ve al cargar. */
export function repartirEnCeldas<T>(inventario: readonly T[], celdas = CELDAS_MOSAICO): T[][] {
  const salida: T[][] = Array.from({ length: celdas }, () => []);
  inventario.forEach((x, i) => salida[i % celdas]!.push(x));
  return salida.filter(c => c.length > 0);
}

export interface NotaCurso { rating: number; total: number }

/**
 * «Los mejor valorados»: cursos con inscripción abierta y al menos `minimo` valoraciones en Hotmart, por nota
 * y, a igual nota, por número de valoraciones. Si no llegan a `alMenos`, ninguno (el bloque no sale).
 */
export function mejorValorados<T extends { id: string; comprable: boolean }>(cursos: readonly T[], notas: Record<string, NotaCurso | null | undefined>, minimo = 20, maximo = 4, alMenos = 3): T[] {
  const con = cursos.flatMap(c => {
    const n = notas[c.id];
    return c.comprable && n && n.total >= minimo && n.rating >= 1 && n.rating <= 5 ? [{ c, n }] : [];
  });
  con.sort((a, b) => b.n.rating - a.n.rating || b.n.total - a.n.total);
  return con.length >= alMenos ? con.slice(0, maximo).map(x => x.c) : [];
}

/**
 * Orden por defecto de los oficios del héroe: primero los que más visitas tuvieron en su ficha según GA4
 * (sin tráfico Direct, que estaba anómalo; 28-oct → 24-nov-2026, docs/equipo/2026-11-25/portada/datos/
 * mas-vistos-ga4.csv), después el resto en el orden de la lista. No hay datos de ventas por curso en el repo.
 */
export const ORDEN_POR_VISITAS = ['curso-de-masajes', 'curso-de-unas-acrilicas', 'curso-de-barberia', 'curso-de-pasteleria', 'curso-de-reparacion-de-celulares'];
export function ordenarPorVisitas(slugs: readonly string[], orden: readonly string[] = ORDEN_POR_VISITAS): string[] {
  const rango = (s: string) => { const i = orden.indexOf(s); return i < 0 ? orden.length : i; };
  return [...slugs].map((s, i) => ({ s, i })).sort((a, b) => rango(a.s) - rango(b.s) || a.i - b.i).map(x => x.s);
}
