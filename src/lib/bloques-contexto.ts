/**
 * Contexto de la página para los bloques del cuerpo que lo necesitan (el carrusel de cursos pinta precios del país).
 * Los componentes de Portable Text solo reciben el nodo: la página deja aquí el país antes de pintar el cuerpo.
 */
import type { Country } from '@/lib/countries';

const CLAVE = 'sablyPaisBloques';
export const fijarPaisDeBloques = (locals: object, country: Country) => { (locals as Record<string, unknown>)[CLAVE] = country; };
export const paisDeBloques = (locals: object): Country | null => ((locals as Record<string, unknown>)[CLAVE] as Country | undefined) ?? null;
