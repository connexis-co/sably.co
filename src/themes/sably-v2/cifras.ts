/**
 * Cifras públicas de la portada V2, calculadas en cada render (nunca escritas a
 * mano): cursos con inscripción abierta, países y valoraciones que Hotmart
 * publica en la página de cada curso, con la fecha en que se leyeron.
 */
import { env } from 'virtual:sably-runtime';
import { getContentRepository } from '@/lib/emdash-content';
import { readOperationalRatings } from '@/plugins/sably-operations/public';
import { comprable } from './navegacion';

const fecha = (ms: number) => {
  const p = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(ms);
  const v = (t: string) => p.find(x => x.type === t)?.value ?? '';
  return `${v('day')} ${v('month').replace(/\.$/, '')}. ${v('year')}`;
};

export async function cifrasPortada(scope: object) {
  const cms = await getContentRepository();
  const [cursos, paises, valoraciones] = await Promise.all([
    cms.getCourses(), cms.getCountries(),
    readOperationalRatings((env as unknown as { SABLY_DB: D1Database }).SABLY_DB, scope).catch(() => ({} as Awaited<ReturnType<typeof readOperationalRatings>>)),
  ]);
  const notas = cursos.map(c => valoraciones[c.id]).filter((v): v is NonNullable<typeof v> => !!v && v.total > 0 && v.rating >= 1 && v.rating <= 5);
  const calificaciones = notas.reduce((s, v) => s + v.total, 0);
  const media = notas.length ? Math.round(notas.reduce((s, v) => s + v.rating, 0) / notas.length * 10) / 10 : null;
  const capturas = notas.map(v => v.capturado ?? 0).filter(Boolean).map(c => (c < 1e12 ? c * 1000 : c));
  const leidas = capturas.length ? Math.max(...capturas) : null;
  return {
    cursos: cursos.filter(comprable).length,
    paises: paises.length,
    calificaciones,
    media,
    mediaTexto: media === null ? null : new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(media),
    /** Fecha de la lectura más reciente de Hotmart; los cursos y países, de hoy. */
    leidas: leidas ? fecha(leidas) : null,
    hoy: fecha(Date.now()),
  };
}
