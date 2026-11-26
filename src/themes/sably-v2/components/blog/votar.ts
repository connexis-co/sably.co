/**
 * Voto de un artículo (1–5) compartido por las estrellas de la cabecera y el bloque «¿Te sirvió esta guía?»: el mismo
 * backend de siempre (/api/v1/votos, un voto por visitante y por conexión cada 24 h, permanencia mínima) y la misma
 * clave local (`sably:rating:<slug>`). Al guardar avisa con `sably:voto-articulo` para que la otra pieza se ponga al día.
 */
import { visitanteId, permanencia } from '@/lib/visitante';
import { trackEvent } from '@/lib/analytics';

export const EVENTO_VOTO = 'sably:voto-articulo';
export const ROTULOS = ['Nada útil', 'Poco útil', 'Útil a medias', 'Útil', 'Muy útil'];

export function votoGuardado(slug: string): number {
  try { return Number(localStorage.getItem(`sably:rating:${slug}`) || 0); } catch { return 0; }
}

export async function enviarVoto(slug: string, n: number, origen: 'cabecera' | 'cierre'): Promise<void> {
  const r = await fetch('/api/v1/votos', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subject: `blog:${slug}`, value: n, visitor_id: visitanteId(), dwell_ms: permanencia() }),
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json().catch(() => ({})) as { error?: string };
  if (!r.ok) throw new Error(r.status === 429 && /rápido/.test(d.error ?? '') ? 'Lee un poco antes de valorar.' : 'No pudimos guardar tu valoración. Prueba otra vez.');
  try { localStorage.setItem(`sably:rating:${slug}`, String(n)); } catch { /* sin almacenamiento */ }
  trackEvent('rate_article', { article: slug, rating: n, origen });
  document.dispatchEvent(new CustomEvent(EVENTO_VOTO, { detail: { slug, n, origen } }));
}
