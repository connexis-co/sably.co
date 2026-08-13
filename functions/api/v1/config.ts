/**
 * GET /api/v1/config — configuración de widgets que el sitio lee al cargar.
 *
 * Lleva el botón de WhatsApp y el arranque del video de los cursos. El sitio es
 * estático: sin este endpoint, cambiar el número del botón o pasar el video a
 * reproducción automática exigiría desplegar las 5.971 páginas. Con él, lo que
 * se guarde en /admin/widgets se ve en la web en ≤60 s (caché de borde).
 *
 * Ante cualquier fallo (migración sin aplicar, D1 caído) responde los valores
 * por defecto que el HTML ya trae horneados: ni el botón desaparece ni el video
 * se pone a arrancar solo por una llamada opcional. Cada bloque se consulta por
 * separado para que una tabla que falte no se lleve por delante a la otra.
 */
import type { Env } from './_shared';

interface FilaWhatsApp {
  activo: number;
  numero: string;
  offset_x: number;
  offset_y: number;
  paginas_ocultas: string;
}

interface FilaVideo {
  modo: string;
  bucle: number;
}

interface FilaPrueba {
  activo: number;
  posicion: string;
  offset_x: number;
  offset_y: number;
  espera_seg: number;
  intervalo_seg: number;
  paginas_ocultas: string;
}

const DEFECTO = { activo: true, numero: '', x: 21, y: 58, paginasOcultas: [] as string[] };

/** El reproductor espera al play salvo que el panel diga lo contrario. */
const DEFECTO_VIDEO = { modo: 'play' as const, bucle: false };

/** Los valores con los que el aviso lleva funcionando: cambiar nada por defecto. */
const DEFECTO_PRUEBA = {
  activo: true,
  posicion: 'inferior-izquierda',
  x: 16,
  y: 16,
  esperaSeg: 8,
  intervaloSeg: 14,
  paginasOcultas: [] as string[],
};

const POSICIONES = new Set([
  'inferior-izquierda',
  'inferior-derecha',
  'superior-izquierda',
  'superior-derecha',
]);

const listaJson = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const cacheado = (data: unknown, segundos: number): Response =>
  new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${segundos}, s-maxage=${segundos}`,
      'access-control-allow-origin': '*',
    },
  });

async function leerWhatsApp(env: Env) {
  try {
    const f = await env.DB.prepare(
      'SELECT activo, numero, offset_x, offset_y, paginas_ocultas FROM widget_whatsapp WHERE id = 1',
    ).first<FilaWhatsApp>();
    if (!f) return DEFECTO;
    return {
      activo: !!f.activo,
      // Solo dígitos: un número pegado con espacios o "+" no rompe wa.me.
      numero: (f.numero ?? '').replace(/\D/g, ''),
      x: f.offset_x,
      y: f.offset_y,
      paginasOcultas: listaJson(f.paginas_ocultas ?? '[]'),
    };
  } catch {
    return DEFECTO;
  }
}

async function leerVideo(env: Env) {
  try {
    const f = await env.DB.prepare('SELECT modo, bucle FROM widget_video WHERE id = 1').first<FilaVideo>();
    if (!f) return DEFECTO_VIDEO;
    return {
      // Cualquier valor que no sea 'auto' se trata como 'play': ante un dato
      // corrupto, el video se queda quieto en vez de arrancar sin permiso.
      modo: f.modo === 'auto' ? ('auto' as const) : ('play' as const),
      bucle: !!f.bucle,
    };
  } catch {
    return DEFECTO_VIDEO;
  }
}

async function leerPrueba(env: Env) {
  try {
    const f = await env.DB.prepare(
      `SELECT activo, posicion, offset_x, offset_y, espera_seg, intervalo_seg, paginas_ocultas
         FROM widget_prueba_social WHERE id = 1`,
    ).first<FilaPrueba>();
    if (!f) return DEFECTO_PRUEBA;
    return {
      activo: !!f.activo,
      // Una posición que no se reconozca vuelve a la de siempre: el aviso no
      // puede acabar anclado en una esquina que el CSS no sabe pintar.
      posicion: POSICIONES.has(f.posicion) ? f.posicion : DEFECTO_PRUEBA.posicion,
      x: f.offset_x,
      y: f.offset_y,
      esperaSeg: f.espera_seg,
      intervaloSeg: f.intervalo_seg,
      paginasOcultas: listaJson(f.paginas_ocultas ?? '[]'),
    };
  } catch {
    return DEFECTO_PRUEBA;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [whatsapp, video, pruebaSocial] = await Promise.all([
    leerWhatsApp(env),
    leerVideo(env),
    leerPrueba(env),
  ]);
  return cacheado({ whatsapp, video, pruebaSocial }, 60);
};
