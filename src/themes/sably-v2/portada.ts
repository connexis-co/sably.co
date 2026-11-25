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
export function inventarioMosaico(cursos: readonly CursoMosaico[], elegidos: readonly string[] = [], maximo = MAXIMO_MOSAICO): CursoMosaico[] {
  const validos = cursos.filter(c => c.comprable && c.foto);
  const orden = elegidos.length
    ? elegidos.map(id => validos.find(c => c.id === id)).filter((c): c is CursoMosaico => !!c)
    : [...validos].sort((a, b) => Number(b.destacado) - Number(a.destacado) || b.valoraciones - a.valoraciones);
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
