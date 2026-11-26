/**
 * Columnas de las rejillas de tarjetas de cursos de la portada (destacados, mejor valorados) y de la ficha
 * (especializaciones, relacionados) entre 1024 y 1279 px: panel «Sitio y tema → Tarjetas de cursos».
 * `tres-completas` (de fábrica): 3 columnas y, en ese tramo, sin la última fila a medias; `tres`: 3 columnas con
 * todas las tarjetas; `cuatro`: como antes. El listado (`RejillaCursos`) ya va a 3 columnas en ese tramo.
 * Las clases de columnas ya existen en la hoja común (las usa el listado): no la hacen crecer.
 */
import filas from './filas-completas.css?raw';
import { minificar } from './blog-hoja';
import type { ColumnasTarjetas } from '@/lib/ajustes-tema';

export const CSS_FILAS_COMPLETAS = minificar(filas);

export function rejillaTarjetas(modo: ColumnasTarjetas): { columnas: string; filasCompletas: '' | undefined } {
  return {
    columnas: modo === 'cuatro' ? 'lg:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-4',
    filasCompletas: modo === 'tres-completas' ? '' : undefined,
  };
}
