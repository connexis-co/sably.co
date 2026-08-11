/**
 * GET /api/v1/promo — la promoción activa ahora mismo, si la hay.
 *
 * El sitio es estático: las 5.955 páginas se hornean en el despliegue, así que
 * el calendario de `src/lib/promo.ts` no puede reaccionar a una decisión tomada
 * esta tarde. El banner llama a este endpoint al cargar y, si devuelve algo,
 * manda sobre el calendario.
 *
 * Se cachea 60 s en el borde: suficiente para no consultar D1 en cada visita, y
 * lo bastante corto para que apagar la promoción se note enseguida.
 */
import type { Env } from './_shared';

interface Fila {
  activa: number;
  pct: number;
  cupon: string;
  titular: string;
  alcance: string;
  slugs: string;
  modo: string;
  hasta: number | null;
  paises: string;
}

/** Respuesta con caché de borde. `json()` de _shared fuerza no-store, y aquí sí interesa cachear. */
const cacheado = (data: unknown, segundos: number): Response =>
  new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${segundos}, s-maxage=${segundos}`,
      'access-control-allow-origin': '*',
    },
  });

const listaJson = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let fila: Fila | null = null;
  try {
    fila = await env.DB.prepare(
      `SELECT activa, pct, cupon, titular, alcance, slugs, modo, hasta, paises
         FROM promo_override WHERE id = 1`,
    ).first<Fila>();
  } catch {
    // Si la migración aún no corrió, la web se queda con su calendario en vez de
    // romper el banner. Un 500 aquí apagaría la promoción de todas las páginas.
    return cacheado({ activa: false }, 60);
  }

  if (!fila?.activa) return cacheado({ activa: false }, 60);

  // Una ventana ya vencida se apaga sola: así una promo olvidada no queda
  // colgada anunciando una cuenta atrás en negativo.
  if (fila.modo === 'ventana' && (!fila.hasta || fila.hasta * 1000 <= Date.now())) {
    return cacheado({ activa: false }, 60);
  }

  return cacheado(
    {
      activa: true,
      pct: fila.pct,
      cupon: fila.cupon,
      titular: fila.titular,
      alcance: fila.alcance,
      slugs: fila.alcance === 'algunos' ? listaJson(fila.slugs) : [],
      modo: fila.modo,
      // En milisegundos, que es lo que espera el countdown del banner.
      hasta: fila.modo === 'ventana' && fila.hasta ? fila.hasta * 1000 : null,
      paises: listaJson(fila.paises),
    },
    60,
  );
};
