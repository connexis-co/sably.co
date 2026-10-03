/**
 * POST /api/v1/comentarios — deja un comentario, que nace en 'pending'.
 *
 * Sin aprobación no entra en v_comment_publico ni en el HTML del Worker.
 * La moderación no es un filtro que se pueda olvidar:
 * es el único camino por el que un comentario se vuelve visible.
 */
import {
  type Env, error, evaluarAbuso, hashIp, ipDe, json, paisDe,
  registrarConsentimiento, superaLimite, ulid,
} from './_shared';

interface Cuerpo {
  subject?: string;
  author_name?: string;
  author_email?: string;
  body?: string;
  parent_id?: string;
  turnstile_token?: string;
  consent_text?: string;
  /** Campo trampa: una persona no lo ve, así que solo lo rellena un guion. */
  trampa?: string;
  /** Milisegundos entre que se pintó el formulario y se envió. */
  abierto_ms?: number;
}

/** Señales baratas de spam. No decide, solo prioriza la cola de moderación. */
function puntuarSpam(texto: string, nombre: string): number {
  let s = 0;
  const enlaces = (texto.match(/https?:\/\//g) ?? []).length;
  s += Math.min(enlaces * 0.3, 0.6);
  if (/\b(viagra|casino|crypto|bitcoin|loan|porn|xxx)\b/i.test(texto)) s += 0.4;
  if (texto === texto.toUpperCase() && texto.length > 40) s += 0.2;
  if (/(.)\1{6,}/.test(texto)) s += 0.2;
  if (/https?:\/\//.test(nombre)) s += 0.4;
  return Math.min(s, 1);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let b: Cuerpo;
  try {
    b = await request.json();
  } catch {
    return error('cuerpo JSON inválido');
  }
  if (!b || typeof b !== 'object' || Array.isArray(b) ||
      ['subject','author_name','body','consent_text'].some(key => typeof (b as Record<string,unknown>)[key] !== 'string') ||
      (b.author_email !== undefined && typeof b.author_email !== 'string') ||
      (b.parent_id !== undefined && typeof b.parent_id !== 'string')) return error('datos de comentario inválidos');

  const nombre = (b.author_name ?? '').trim();
  const texto = (b.body ?? '').trim();
  if (!b.subject || !nombre || !texto) return error('faltan subject, author_name o body');
  if (nombre.length < 2 || nombre.length > 60) return error('el nombre debe tener entre 2 y 60 caracteres');
  if (texto.length < 10 || texto.length > 1200) return error('el comentario debe tener entre 10 y 1200 caracteres');
  if (!b.consent_text) return error('falta la autorización de tratamiento de datos');
  if (b.consent_text.length > 4000 || (b.parent_id?.length ?? 0) > 80) return error('datos de comentario demasiado largos');
  const email = b.author_email?.trim() || null;
  if (email && (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) return error('correo inválido');
  const article = await env.DB.prepare("SELECT id FROM subject WHERE id=? AND kind='blog' AND is_active=1").bind(b.subject).first();
  if (!article) return error('el artículo no está disponible para comentarios',404);
  if (b.parent_id && !await env.DB.prepare("SELECT id FROM comment WHERE id=? AND subject_id=? AND parent_id IS NULL AND status='approved'").bind(b.parent_id,b.subject).first()) return error('solo se puede responder a un comentario publicado de este artículo',422);

  const ip = ipDe(request);
  const ipHash = await hashIp(ip, env.IP_SALT);

  const abuso = await evaluarAbuso(
    { turnstileToken: b.turnstile_token, trampa: b.trampa, abiertoMs: b.abierto_ms },
    env.TURNSTILE_SECRET,
    ip,
  );
  if (abuso.rechazar) {
    console.error('comentario rechazado:', abuso.motivo);
    return error('no se pudo verificar que eres una persona', 403);
  }
  if (await superaLimite(env.DB, 'comment', ipHash, 5)) {
    return error('demasiados comentarios desde esta conexión, prueba más tarde', 429);
  }

  const pais = paisDe(request);
  const consentId = await registrarConsentimiento(env.DB, 'comment', ipHash, pais, b.consent_text);

  const id = ulid();
  // 90 días de conservación para el correo del autor, que nunca se publica.
  const purga = Math.floor(Date.now() / 1000) + 90 * 24 * 3600;

  try {
    await env.DB.prepare(
      `INSERT INTO comment
         (id, subject_id, parent_id, author_name, author_email, body,
          spam_score, turnstile, consent_id, visitor_id, ip_hash, country, purge_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, b.subject, b.parent_id || null, nombre, email, texto,
            Math.min(puntuarSpam(texto, nombre) + abuso.sospecha, 1),
            abuso.turnstile, consentId, null, ipHash, pais, purga)
      .run();
  } catch (e) {
    const msg = (e as Error).message;
    console.error('comentario:', msg);
    // El mensaje crudo de SQLite lleva nombres de índices y de columnas.
    return error(
      /un nivel|raiz/.test(msg)
        ? 'solo se puede responder a un comentario principal de este mismo artículo'
        : 'no se pudo guardar el comentario',
      422,
    );
  }

  return json({ ok: true, estado: 'pendiente_de_moderacion' }, 201);
};

/**
 * GET /api/v1/comentarios?subject=… — el hilo aprobado, sin el correo.
 *
 * Devuelve el árbol ya montado para que el cliente no tenga que agruparlo:
 * raíces de más nueva a más antigua, y dentro de cada una sus respuestas en
 * orden cronológico, que es como se lee una conversación.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const subject = new URL(request.url).searchParams.get('subject');
  if (!subject) return error('falta el parámetro subject');
  if (!await env.DB.prepare("SELECT id FROM subject WHERE id=? AND kind='blog' AND is_active=1").bind(subject).first()) return error('el artículo no está disponible para comentarios',404);

  const { results } = await env.DB.prepare(
    `SELECT id, parent_id, author_name, body, country, created_at, utiles
       FROM v_comment_hilo WHERE subject_id = ? LIMIT 500`,
  )
    .bind(subject)
    .all<Fila>();

  const filas = results ?? [];
  const respuestas = new Map<string, Fila[]>();
  for (const f of filas) {
    if (!f.parent_id) continue;
    const lista = respuestas.get(f.parent_id);
    if (lista) lista.push(f);
    else respuestas.set(f.parent_id, [f]);
  }

  const hilo = filas
    .filter((f) => !f.parent_id)
    .sort((a, b) => b.created_at - a.created_at)
    .map((raiz) => ({
      ...raiz,
      respuestas: (respuestas.get(raiz.id) ?? []).sort((a, b) => a.created_at - b.created_at),
    }));

  return json({ comentarios: hilo, total: filas.length });
};

interface Fila {
  id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  country: string | null;
  created_at: number;
  utiles: number;
}
