/**
 * POST /api/v1/comentario-voto — marca un comentario como útil o no útil.
 *
 * Va en su propio archivo y no bajo /comentarios/[id]/voto porque Pages
 * Functions enrutaría esa ruta dinámica con un parámetro que aquí no aporta
 * nada: el id ya viaja en el cuerpo, junto al resto.
 *
 * La idempotencia la da la clave primaria (comment_id, visitor_id): votar otra
 * vez cambia el voto, no suma uno nuevo. Y el trigger de la 0002 impide votar
 * un comentario que no esté aprobado, así que el endpoint no tiene que
 * comprobarlo por su cuenta.
 */
import { type Env, error, hashIp, ipDe, json, paisDe, superaLimite } from './_shared';

interface Cuerpo {
  comment_id?: string;
  visitor_id?: string;
  /** 1 útil, −1 no útil, 0 retira el voto. */
  value?: number;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let b: Cuerpo;
  try {
    b = await request.json();
  } catch {
    return error('cuerpo JSON inválido');
  }

  const { comment_id: comentario, visitor_id: visitante, value } = b;
  if (!comentario || !visitante) return error('faltan comment_id o visitor_id');
  if (visitante.length < 8 || visitante.length > 64) return error('visitor_id inválido');
  if (value !== 1 && value !== -1 && value !== 0) return error('value debe ser 1, -1 o 0');

  const ipHash = await hashIp(ipDe(request), env.IP_SALT);
  if (await superaLimite(env.DB, 'comment_vote', ipHash, 60)) {
    return error('demasiados votos desde esta conexión', 429);
  }

  try {
    if (value === 0) {
      // Retirar el voto es borrar la fila. No hay estado «votó cero».
      await env.DB.prepare('DELETE FROM comment_vote WHERE comment_id = ? AND visitor_id = ?')
        .bind(comentario, visitante)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO comment_vote (comment_id, visitor_id, value, ip_hash, country)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (comment_id, visitor_id)
         DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
      )
        .bind(comentario, visitante, value, ipHash, paisDe(request))
        .run();
    }
  } catch (e) {
    // El trigger aborta con 'comentario no publicado'; la FK, con un mensaje
    // de SQLite. Ninguno de los dos debe salir tal cual al navegador.
    const msg = (e as Error).message;
    console.error('comentario-voto:', msg);
    return error(/no publicado/.test(msg) ? 'ese comentario no está publicado' : 'no se pudo registrar el voto', 422);
  }

  const fila = await env.DB.prepare('SELECT utiles FROM v_comment_utilidad WHERE comment_id = ?')
    .bind(comentario)
    .first<{ utiles: number }>();

  return json({ ok: true, utiles: fila?.utiles ?? 0 });
};
