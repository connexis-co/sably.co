/**
 * Valoraciones y comentarios reales de los artículos, leídos en el servidor (sably.db) para hornearlos en el HTML:
 * sin JS ni CLS en la portada y en la cabecera del artículo. La media solo cuenta como publicable con ≥ 5 votos de
 * ≥ 5 conexiones distintas (la misma regla que /api/v1/pulso). Nunca se marca en JSON-LD (Google no admite
 * reseñas en artículos). Si la base no responde, no se pinta nada: nunca un dato de relleno.
 */
import { env } from 'virtual:sably-runtime';

export interface PulsoArticulo { votos: number; media: number | null; publicable: boolean; comentarios: number }

const base = () => (env as unknown as { SABLY_DB?: D1Database }).SABLY_DB;

export async function pulsoDeArticulos(slugs: readonly string[]): Promise<Map<string, PulsoArticulo>> {
  const salida = new Map<string, PulsoArticulo>();
  const db = base();
  if (!db || !slugs.length) return salida;
  const ids = slugs.map(s => `blog:${s}`);
  const marcas = ids.map(() => '?').join(',');
  try {
    const [votos, comentarios] = await Promise.all([
      db.prepare(`SELECT subject_id, votes, avg_rating, distinct_ips FROM v_article_pulse WHERE subject_id IN (${marcas})`).bind(...ids)
        .all<{ subject_id: string; votes: number; avg_rating: number | null; distinct_ips: number }>(),
      db.prepare(`SELECT subject_id, COUNT(*) AS n FROM comment WHERE status = 'approved' AND subject_id IN (${marcas}) GROUP BY subject_id`).bind(...ids)
        .all<{ subject_id: string; n: number }>(),
    ]);
    const n = new Map((comentarios.results ?? []).map(r => [r.subject_id, r.n]));
    for (const id of ids) {
      const v = (votos.results ?? []).find(r => r.subject_id === id);
      const publicable = !!v && v.votes >= 5 && v.distinct_ips >= 5 && v.avg_rating !== null;
      salida.set(id.slice(5), { votos: v?.votes ?? 0, media: publicable ? v!.avg_rating : null, publicable, comentarios: n.get(id) ?? 0 });
    }
  } catch { /* sin base: no se pinta nada */ }
  return salida;
}

/** «4,6» con coma decimal. */
export const notaCorta = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
