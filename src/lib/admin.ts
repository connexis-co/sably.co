/**
 * Autenticación y consultas del panel.
 *
 * No hay contraseñas ni sesiones propias: quien decide si pasas es Cloudflare
 * Access, que ya resuelve identidad, caducidad y revocación. Al origen llega
 * un JWT firmado en `Cf-Access-Jwt-Assertion` con el correo de quien entró, y
 * eso es lo que se guarda en moderation_log: la auditoría sale gratis.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AdminEnv {
  DB: D1Database;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  DEPLOY_HOOK_URL?: string;
}

/**
 * Bindings de Cloudflare desde una página SSR.
 *
 * `App.Locals` no recoge el tipo del adaptador en esta versión de Astro, así
 * que la conversión se hace una sola vez y aquí, en lugar de repetirla en cada
 * página del panel.
 */
export function entorno(locals: unknown): AdminEnv {
  return (locals as { runtime: { env: AdminEnv } }).runtime.env;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * Devuelve el correo del moderador o null.
 *
 * Verificar la firma es imprescindible: la cabecera es texto que cualquiera
 * puede enviar si consigue llegar al origen saltándose Access. Sin verificar,
 * el panel estaría abierto a quien conozca la URL directa del worker.
 */
export async function moderadorDe(request: Request, env: AdminEnv): Promise<string | null> {
  const token =
    request.headers.get('cf-access-jwt-assertion') ??
    (request.headers.get('cookie') ?? '').match(/CF_Authorization=([^;]+)/)?.[1];
  if (!token || !env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return null;

  jwks ??= createRemoteJWKSet(new URL(`${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`));
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.CF_ACCESS_TEAM_DOMAIN,
      audience: env.CF_ACCESS_AUD,
    });
    return (payload.email as string) ?? null;
  } catch {
    return null;
  }
}

export interface Resumen {
  comentariosPendientes: number;
  resenasPendientes: number;
  leadsSemana: number;
  votosTotales: number;
  articulosConVotos: number;
}

export async function resumen(db: D1Database): Promise<Resumen> {
  const semana = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
  const lote = await db.batch<{ n: number }>([
    db.prepare("SELECT COUNT(*) AS n FROM comment WHERE status = 'pending'"),
    db.prepare("SELECT COUNT(*) AS n FROM course_review WHERE status = 'pending'"),
    db.prepare('SELECT COUNT(*) AS n FROM lead WHERE created_at > ?').bind(semana),
    db.prepare('SELECT COUNT(*) AS n FROM vote'),
  ]);
  // Indexar el batch directamente no compila con noUncheckedIndexedAccess, y
  // tampoco conviene: si una sentencia fallara, un cero es mejor panel que una
  // excepción que deja al moderador sin nada.
  const cuenta = (i: number) => lote[i]?.results?.[0]?.n ?? 0;
  const art = await db
    .prepare('SELECT COUNT(*) AS n FROM v_article_pulse WHERE votes > 0')
    .first<{ n: number }>();
  return {
    comentariosPendientes: cuenta(0),
    resenasPendientes: cuenta(1),
    leadsSemana: cuenta(2),
    votosTotales: cuenta(3),
    articulosConVotos: art?.n ?? 0,
  };
}

/**
 * Cambia el estado y escribe el registro en el mismo batch.
 *
 * Van juntos a propósito: si la auditoría fuera una segunda llamada, un fallo
 * entre ambas dejaría un comentario aprobado sin constancia de quién lo hizo,
 * que es justo lo que habría que enseñar si Google pregunta.
 */
export async function moderar(
  db: D1Database,
  entidad: 'comment' | 'course_review',
  id: string,
  nuevoEstado: 'approved' | 'rejected' | 'spam',
  moderador: string,
  motivo?: string,
): Promise<void> {
  const previo = await db
    .prepare(`SELECT status FROM ${entidad} WHERE id = ?`)
    .bind(id)
    .first<{ status: string }>();
  await db.batch([
    db
      .prepare(`UPDATE ${entidad} SET status = ?, moderated_at = unixepoch() WHERE id = ?`)
      .bind(nuevoEstado, id),
    db
      .prepare(
        `INSERT INTO moderation_log (id, entity, entity_id, from_status, to_status, moderator, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), entidad, id, previo?.status ?? null, nuevoEstado, moderador, motivo ?? null),
  ]);
}

/** Dispara un despliegue de Pages. El hook es una URL secreta: sin ella, nada. */
export async function lanzarDespliegue(env: AdminEnv, moderador: string): Promise<boolean> {
  if (!env.DEPLOY_HOOK_URL) return false;
  const r = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
  if (r.ok) {
    await env.DB.prepare(
      `INSERT INTO moderation_log (id, entity, entity_id, to_status, moderator, reason)
       VALUES (?, 'comment', 'deploy', 'triggered', ?, 'despliegue manual desde el panel')`,
    )
      .bind(crypto.randomUUID(), moderador)
      .run();
  }
  return r.ok;
}

export const fecha = (epoch: number): string =>
  new Date(epoch * 1000).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
