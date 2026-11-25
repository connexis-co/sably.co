/**
 * Variantes del héroe de la portada V2 y prueba A/B (HEROES-X.md §11). Módulo puro: lo usan el servidor
 * (ajustes-tema.ts) y el panel (ajustes-pagina.tsx).
 */
import { listaDeTexto } from './portada-bloques';

export const VARIANTES_HEROE = ['collage', 'muro', 'cintas', 'orbita', 'anillo3d', 'vitrina', 'buscador', 'abanico', 'mosaico'] as const;
export type VarianteHeroe = (typeof VARIANTES_HEROE)[number];
/** Las que pueden entrar en la prueba A/B: todas menos el mosaico, que cambia los botones del texto. */
export const VARIANTES_HEROE_AB: readonly VarianteHeroe[] = VARIANTES_HEROE.filter(v => v !== 'mosaico');
export interface PruebaHeroe {
  /** La primera es la de control: la que ven bots y navegadores sin JavaScript. */
  variantes: VarianteHeroe[];
  /** Pesos en tanto por uno, en el mismo orden; suman 1. */
  pesos: number[];
  /** AAAA-MM-DD o vacío. */
  inicio: string;
}

/** Lee la prueba A/B del héroe: 2 o 3 variantes válidas y distintas, o null. */
export function leerPruebaHeroe(encendida: unknown, lista: unknown, reparto: unknown, inicio: unknown): PruebaHeroe | null {
  if (encendida !== true) return null;
  const variantes = [...new Set(listaDeTexto(lista).map(x => x.toLowerCase()))].filter((x): x is VarianteHeroe => (VARIANTES_HEROE_AB as readonly string[]).includes(x)).slice(0, 3);
  if (variantes.length < 2) return null;
  const n = variantes.length;
  const pesos = reparto === '70' ? variantes.map((_, i) => (i === 0 ? 0.7 : 0.3 / (n - 1))) : variantes.map(() => 1 / n);
  const fecha = typeof inicio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inicio.trim()) ? inicio.trim() : '';
  return { variantes, pesos, inicio: fecha };
}

