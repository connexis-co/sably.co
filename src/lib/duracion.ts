/**
 * Duración real de vídeo de cada curso: la única cifra de tiempo que muestra el sitio.
 *
 * El campo `duration_hours` del CMS se rellenó sin fuente al dar de alta el catálogo (agosto) y,
 * frente a los vídeos del área de alumnos, decía 3,9 veces más en mediana. Desde el 26-nov la
 * duración sale de `src/data/duracion-video.json` (medida, versionada y con fecha; método en
 * docs/equipo/2026-11-26/contenido/horas.csv). Un curso que no está en la lista no muestra
 * ninguna duración: ni tarjeta, ni ficha, ni JSON-LD. `durationHours` del CMS queda sin uso en
 * pantalla.
 */
import medicion from '../data/duracion-video.json';

const SEGUNDOS: Readonly<Record<string, number>> = medicion.cursos;

/** Fecha de la medición (AAAA-MM-DD). */
export const DURACION_MEDIDA_EL = medicion.medido;

/** Segundos de vídeo medidos para el curso, o `null` si no consta medición. */
export function segundosDeVideo(cursoId: string): number | null {
  const s = SEGUNDOS[cursoId];
  return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : null;
}

/** Minutos redondeados a 5 (mínimo 5). Es la cifra que se pinta y la que se declara en JSON-LD. */
export function minutosRedondeados(segundos: number | null | undefined): number | null {
  if (typeof segundos !== 'number' || !Number.isFinite(segundos) || segundos <= 0) return null;
  return Math.max(5, Math.round(segundos / 300) * 5);
}

/** «1 h 10 min», «45 min», «3 h». Vacío si no hay dato. */
export function duracionCorta(segundos: number | null | undefined): string {
  const m = minutosRedondeados(segundos);
  if (m === null) return '';
  const h = Math.floor(m / 60), r = m % 60;
  return h === 0 ? `${r} min` : r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** «1 h 10 min de vídeo». Vacío si no hay dato. */
export function duracionLarga(segundos: number | null | undefined): string {
  const corta = duracionCorta(segundos);
  return corta ? `${corta} de vídeo` : '';
}

/** ISO 8601 para Schema.org (`PT1H10M`, `PT45M`, `PT3H`), con el mismo redondeo que lo visible. `null` sin dato. */
export function duracionIso(segundos: number | null | undefined): string | null {
  const m = minutosRedondeados(segundos);
  if (m === null) return null;
  const h = Math.floor(m / 60), r = m % 60;
  return `PT${h ? `${h}H` : ''}${r ? `${r}M` : ''}`;
}

/** Atajos por curso. */
export const duracionCurso = {
  corta: (cursoId: string) => duracionCorta(segundosDeVideo(cursoId)),
  larga: (cursoId: string) => duracionLarga(segundosDeVideo(cursoId)),
  iso: (cursoId: string) => duracionIso(segundosDeVideo(cursoId)),
};
