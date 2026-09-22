/**
 * GET /api/v1/promo — las promociones vivas ahora mismo.
 *
 * El sitio es estático: las 5.955 páginas se hornean en el despliegue, así que
 * el calendario de `src/lib/promo.ts` no puede reaccionar a una decisión tomada
 * esta tarde. El banner y el repintado de precio llaman a este endpoint al
 * cargar y, para cada curso, aplican la promoción que le corresponde por
 * proveedor, país y fechas.
 *
 * Devuelve TODAS las promociones activas y vigentes (dentro de su ventana de
 * fechas). No filtra por curso ni por país: eso lo hace el cliente, porque la
 * respuesta se cachea 60 s en el borde y debe servir igual a cualquier página.
 *
 * Retrocompatible: si la tabla `promocion` todavía no existe (migración 0010 sin
 * aplicar), cae a la tabla vieja `promo_override` y expone su contenido como una
 * única promoción. Así un despliegue no apaga el descuento por una migración que
 * aún no corrió.
 */
import { type Env, SIN_INDICE } from './_shared';

interface FilaPromo {
  id: string;
  nombre: string;
  pct: number;
  cupon: string;
  titular: string;
  proveedores: string;
  incluir: string;
  excluir: string;
  paises: string;
  desde: number | null;
  hasta: number | null;
  prioridad: number;
}

interface FilaOverride {
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

const cacheado = (data: unknown, segundos: number): Response =>
  new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${segundos}, s-maxage=${segundos}`,
      'access-control-allow-origin': '*',
      ...SIN_INDICE,
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

/** Forma que consume el cliente (ver `Promocion` en src/lib/promo.ts). */
interface PromoSalida {
  id: string;
  nombre: string;
  pct: number;
  cupon: string;
  titular: string;
  proveedores: string[];
  incluir: string[];
  excluir: string[];
  paises: string[];
  hasta: number | null;
  prioridad: number;
}

/** Lee la tabla nueva. Lanza si no existe, para que el caller caiga al legacy. */
async function leerPromociones(env: Env, ahora: number): Promise<PromoSalida[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, nombre, pct, cupon, titular, proveedores, incluir, excluir,
            paises, desde, hasta, prioridad
       FROM promocion
      WHERE activa = 1
      ORDER BY prioridad DESC`,
  ).all<FilaPromo>();

  return (results ?? [])
    // La ventana de fechas se filtra aquí, no en SQL, para que una promoción
    // programada aparezca sola en cuanto entra y una vencida deje de servirse.
    .filter((f) => (f.desde === null || f.desde <= ahora) && (f.hasta === null || f.hasta > ahora))
    .map((f) => ({
      id: f.id,
      nombre: f.nombre,
      pct: f.pct,
      cupon: f.cupon,
      titular: f.titular,
      proveedores: listaJson(f.proveedores),
      incluir: listaJson(f.incluir),
      excluir: listaJson(f.excluir),
      paises: listaJson(f.paises),
      hasta: f.hasta ? f.hasta * 1000 : null,
      prioridad: f.prioridad,
    }));
}

/** Compat: expone el viejo `promo_override` como una sola promoción. */
async function leerLegacy(env: Env, ahora: number): Promise<PromoSalida[]> {
  const f = await env.DB.prepare(
    `SELECT activa, pct, cupon, titular, alcance, slugs, modo, hasta, paises
       FROM promo_override WHERE id = 1`,
  ).first<FilaOverride>();

  if (!f?.activa) return [];
  if (f.modo === 'ventana' && (!f.hasta || f.hasta <= ahora)) return [];

  return [
    {
      id: 'legacy-manual',
      nombre: 'Descuento manual',
      pct: f.pct,
      cupon: f.cupon,
      titular: f.titular,
      // El override viejo no distinguía proveedor; el recorte a MasterClasses lo
      // dan los cursos marcados sin-cupón, que el cliente respeta igualmente.
      proveedores: [],
      incluir: f.alcance === 'algunos' ? listaJson(f.slugs) : [],
      excluir: [],
      paises: listaJson(f.paises),
      hasta: f.modo === 'ventana' && f.hasta ? f.hasta * 1000 : null,
      prioridad: 100,
    },
  ];
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const ahora = Math.floor(Date.now() / 1000);

  try {
    return cacheado({ promos: await leerPromociones(env, ahora) }, 60);
  } catch {
    // La tabla nueva no existe todavía: intenta la vieja antes de rendirse.
    try {
      return cacheado({ promos: await leerLegacy(env, ahora) }, 60);
    } catch {
      // Sin ninguna de las dos, la web se queda con su calendario horneado en
      // vez de romper el banner. Un 500 aquí apagaría toda promoción.
      return cacheado({ promos: [] }, 60);
    }
  }
};
