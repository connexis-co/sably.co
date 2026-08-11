/**
 * GET /api/v1/config — configuración de widgets que el sitio lee al cargar.
 *
 * Hoy solo lleva el botón de WhatsApp. El sitio es estático: sin este endpoint,
 * cambiar el número o la posición del botón exigiría un despliegue. Con él, lo
 * que se guarde en /admin/widgets se ve en la web en ≤60 s (caché de borde).
 *
 * Ante cualquier fallo (migración sin aplicar, D1 caído) responde los valores
 * por defecto que el HTML ya trae horneados: el botón nunca desaparece por una
 * llamada opcional.
 */
import type { Env } from './_shared';

interface FilaWhatsApp {
  activo: number;
  numero: string;
  offset_x: number;
  offset_y: number;
}

const DEFECTO = { activo: true, numero: '', x: 21, y: 58 };

const cacheado = (data: unknown, segundos: number): Response =>
  new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${segundos}, s-maxage=${segundos}`,
      'access-control-allow-origin': '*',
    },
  });

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const f = await env.DB.prepare(
      'SELECT activo, numero, offset_x, offset_y FROM widget_whatsapp WHERE id = 1',
    ).first<FilaWhatsApp>();
    if (!f) return cacheado({ whatsapp: DEFECTO }, 60);
    return cacheado(
      {
        whatsapp: {
          activo: !!f.activo,
          // Solo dígitos: un número pegado con espacios o "+" no rompe wa.me.
          numero: (f.numero ?? '').replace(/\D/g, ''),
          x: f.offset_x,
          y: f.offset_y,
        },
      },
      60,
    );
  } catch {
    return cacheado({ whatsapp: DEFECTO }, 60);
  }
};
