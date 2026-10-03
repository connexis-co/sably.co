/** Operational data remains separate from EmDash content and its DB binding. */
export interface Actor { id: string; role: number }
export class OperationsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const STATUS = ['pending', 'approved', 'rejected', 'spam'] as const;
export const THEMES = ['medio', 'maximo', 'blackFriday', 'navidad', 'amor', 'cyber', 'clases', 'anoNuevo', 'madre'] as const;
export const COUNTRIES = ['co', 'mx', 'es', 'ar', 'cl', 'pe', 'ec', 'us'];
export function authorize(actor: Actor | undefined, admin = false): Actor {
  if (!actor?.id || ![40, 50].includes(actor.role) || (admin && actor.role !== 50)) {
    throw new OperationsError('Tu rol de EmDash no permite esta operación.', 403);
  }
  return actor;
}
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new OperationsError('Datos inválidos.');
  return input as Record<string, unknown>;
}
function str(value: unknown, label: string, max: number, min = 0): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new OperationsError(`${label}: longitud inválida.`);
  return value.trim();
}
function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new OperationsError(`${label}: valor inválido.`);
  return value;
}
function bit(value: unknown): number {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  throw new OperationsError('El interruptor debe ser verdadero o falso.');
}
function list(value: unknown, label: string, pattern = /^[a-z0-9][a-z0-9-]*$/): string[] {
  if (!Array.isArray(value) || value.length > 250 || value.some(v => typeof v !== 'string' || v.length > 180 || !pattern.test(v))) throw new OperationsError(`${label}: lista inválida.`);
  return [...new Set(value as string[])];
}
function date(value: unknown, label: string): number | null {
  if (value === null || value === '') return null;
  return integer(value, label, 0, 7258118400);
}
export interface Promo {
  id: string; nombre: string; activa: number; pct: number; cupon: string; titular: string;
  proveedores: string[]; incluir: string[]; excluir: string[]; paises: string[];
  desde: number | null; hasta: number | null; prioridad: number; url_key: string;
  tema: string; etiqueta: string; actualizado: number | null;
}
export function validatePromo(input: unknown): Promo {
  const p = record(input);
  const id = str(p.id, 'Identificador', 80, 1);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new OperationsError('El identificador admite letras minúsculas, números y guiones.');
  const pct = integer(p.pct, 'Descuento', 25, 50);
  if (pct !== 25 && pct !== 50) throw new OperationsError('Solo existen cupones verificados del 25 % y del 50 %.');
  const desde = date(p.desde, 'Inicio'), hasta = date(p.hasta, 'Fin');
  if (desde !== null && hasta !== null && hasta <= desde) throw new OperationsError('El fin debe ser posterior al inicio.');
  const paises = list(p.paises, 'Países');
  if (paises.some(v => !COUNTRIES.includes(v))) throw new OperationsError('País no admitido.');
  const url_key = str(p.url_key ?? '', 'Clave de URL', 80);
  if (url_key && !/^[a-z0-9][a-z0-9_-]*$/.test(url_key)) throw new OperationsError('Clave de URL inválida.');
  const tema = str(p.tema ?? 'medio', 'Tema', 30);
  if (!(THEMES as readonly string[]).includes(tema)) throw new OperationsError('Tema no admitido.');
  return { id, nombre: str(p.nombre, 'Nombre', 100, 2), activa: bit(p.activa), pct,
    cupon: pct === 50 ? '031016' : '010775', titular: str(p.titular, 'Titular', 150, 2),
    proveedores: list(p.proveedores, 'Proveedores'), incluir: list(p.incluir, 'Cursos incluidos'), excluir: list(p.excluir, 'Cursos excluidos'),
    paises, desde, hasta, prioridad: integer(p.prioridad, 'Prioridad', 0, 10000), url_key, tema,
    etiqueta: str(p.etiqueta ?? 'Oferta', 'Etiqueta', 60, 1),
    actualizado: p.actualizado === null || p.actualizado === undefined ? null : integer(p.actualizado, 'Versión', 0, 7258118400),
  };
}
export function promoState(p: Pick<Promo, 'activa'|'desde'|'hasta'>, now = Math.floor(Date.now()/1000)) {
  return !p.activa ? 'pausada' : p.desde !== null && p.desde > now ? 'programada' : p.hasta !== null && p.hasta <= now ? 'vencida' : 'vigente';
}
export function decodePromo(row: Record<string, unknown>): Promo {
  const parsed = { ...row };
  for (const key of ['proveedores', 'incluir', 'excluir', 'paises']) parsed[key] = JSON.parse(String(row[key]));
  return validatePromo(parsed);
}
export async function listPromos(db: D1Database, actor: Actor | undefined) {
  authorize(actor, true);
  const { results } = await db.prepare('SELECT * FROM promocion ORDER BY prioridad DESC, desde, id').all<Record<string, unknown>>();
  return { promos: results.map(decodePromo), now: Math.floor(Date.now()/1000) };
}
export async function savePromo(db: D1Database, actor: Actor | undefined, input: unknown) {
  const user = authorize(actor, true), p = validatePromo(input);
  const now = Math.max(Math.floor(Date.now()/1000), (p.actualizado ?? 0) + 1);
  const vals = [p.nombre, p.activa, p.pct, p.cupon, p.titular, JSON.stringify(p.proveedores), JSON.stringify(p.incluir), JSON.stringify(p.excluir), JSON.stringify(p.paises), p.desde, p.hasta, p.prioridad, p.url_key, p.tema, p.etiqueta, now, `emdash:${user.id}`];
  const statement = p.actualizado === null
    ? db.prepare('INSERT OR IGNORE INTO promocion (nombre,activa,pct,cupon,titular,proveedores,incluir,excluir,paises,desde,hasta,prioridad,url_key,tema,etiqueta,actualizado,por,id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...vals, p.id)
    : db.prepare('UPDATE promocion SET nombre=?,activa=?,pct=?,cupon=?,titular=?,proveedores=?,incluir=?,excluir=?,paises=?,desde=?,hasta=?,prioridad=?,url_key=?,tema=?,etiqueta=?,actualizado=?,por=? WHERE id=? AND actualizado=?').bind(...vals, p.id, p.actualizado);
  const result = await statement.run();
  if (!result.meta.changes) throw new OperationsError('La campaña cambió en otra sesión o el identificador ya existe. Recarga antes de guardar.', 409);
  return { saved: true, actualizado: now };
}
export async function listReviews(db: D1Database, actor: Actor | undefined, input: unknown) {
  authorize(actor);
  const query = record(input), status = str(query.status ?? 'pending', 'Estado', 20);
  if (!(STATUS as readonly string[]).includes(status)) throw new OperationsError('Estado inválido.');
  const offset = integer(Number(query.offset ?? 0), 'Página', 0, 100000);
  const rows = await db.prepare(`SELECT 'comment' AS entity,id,subject_id,author_name,body,status,created_at,NULL AS rating,moderated_at FROM comment WHERE status=?
    UNION ALL SELECT 'course_review',id,subject_id,author_name,body,status,created_at,rating,moderated_at FROM course_review WHERE status=?
    UNION ALL SELECT 'sably_public_review',id,'course:'||slug,author_name,body,status,created_at,rating,moderated_at FROM sably_public_review WHERE status=?
    ORDER BY created_at DESC LIMIT 51 OFFSET ?`).bind(status,status,status,offset).all();
  const counts = await db.prepare("SELECT status,COUNT(*) AS total FROM (SELECT status FROM comment UNION ALL SELECT status FROM course_review UNION ALL SELECT status FROM sably_public_review) GROUP BY status").all();
  return { items: rows.results.slice(0,50), hasMore: rows.results.length > 50, counts: counts.results };
}
export async function moderate(db: D1Database, actor: Actor | undefined, input: unknown) {
  const user = authorize(actor), p = record(input);
  if (p.entity !== 'comment' && p.entity !== 'course_review' && p.entity !== 'sably_public_review') throw new OperationsError('Entidad inválida.');
  const id = str(p.id, 'Reseña', 80, 1), from = str(p.expectedStatus, 'Estado anterior', 20), to = str(p.status, 'Estado', 20);
  if (!(STATUS as readonly string[]).includes(from) || !(STATUS as readonly string[]).includes(to) || from === to) throw new OperationsError('Cambio de estado inválido.');
  const reason = str(p.reason ?? '', 'Motivo', 500), now = Math.floor(Date.now()/1000);
  const log = p.entity === 'sably_public_review' ? 'sably_public_review_log' : 'moderation_log';
  // D1 batches are atomic; the log and mutation share the same conditional state.
  // No body, score, purchase reference, email or IP is editable here.
  const result = await db.batch([
    db.prepare(`INSERT INTO ${log} (id,entity,entity_id,from_status,to_status,moderator,reason,created_at) SELECT ?,?,?,?,?,?,?,? FROM ${p.entity} WHERE id=? AND status=?`).bind(crypto.randomUUID(),p.entity,id,from,to,`emdash:${user.id}`,reason,now,id,from),
    db.prepare(`UPDATE ${p.entity} SET status=?,moderated_at=? WHERE id=? AND status=?`).bind(to,now,id,from),
  ]);
  if (!result[1]?.meta.changes) throw new OperationsError('La reseña ya cambió en otra sesión. Recarga la lista.', 409);
  return { saved: true };
}
export async function ratings(db: D1Database, actor: Actor | undefined) {
  authorize(actor);
  const [verified, visitors, articles, hotmart] = await Promise.all([
    db.prepare('SELECT slug,reviews,avg_rating FROM v_course_rating WHERE reviews>0 ORDER BY reviews DESC LIMIT 200').all(),
    db.prepare('SELECT slug,votos,media FROM v_visitor_rating ORDER BY votos DESC LIMIT 200').all(),
    db.prepare('SELECT slug,votes,avg_rating FROM v_article_pulse WHERE votes>0 ORDER BY votes DESC LIMIT 200').all(),
    db.prepare('SELECT slug,rating AS avg_rating,total AS reviews,capturado FROM hotmart_valoracion ORDER BY total DESC LIMIT 200').all(),
  ]);
  return { verified: verified.results, visitors: visitors.results, articles: articles.results, hotmart: hotmart.results };
}
export async function summary(db: D1Database, actor: Actor | undefined) {
  authorize(actor);
  const result = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM lead) AS leads,
    (SELECT COUNT(*) FROM comment WHERE status='pending') AS pendingComments,
    ((SELECT COUNT(*) FROM course_review WHERE status='pending')+(SELECT COUNT(*) FROM sably_public_review WHERE status='pending')) AS pendingReviews,
    (SELECT COUNT(*) FROM promocion WHERE activa=1 AND (desde IS NULL OR desde<=unixepoch()) AND (hasta IS NULL OR hasta>unixepoch())) AS livePromos,
    (SELECT COUNT(*) FROM visitor_rating) AS visitorVotes,
    (SELECT COUNT(*) FROM subject WHERE is_active=1) AS subjects`).first();
  return { totals:result };
}
export async function listLeads(db: D1Database, actor: Actor | undefined, input: unknown) {
  authorize(actor,true);
  const p = record(input), country = str(p.country ?? '', 'País', 8), course = str(p.course ?? '', 'Curso',180);
  if (country && !COUNTRIES.includes(country)) throw new OperationsError('País no admitido.');
  if (course && !/^[a-z0-9][a-z0-9-]*$/.test(course)) throw new OperationsError('Curso inválido.');
  const offset = integer(Number(p.offset ?? 0),'Página',0,100000);
  const rows = await db.prepare(`SELECT l.id,l.name,l.email,l.phone,l.course_interest,l.country,l.source,l.created_at,l.turnstile,
    c.policy_version,c.policy_url,c.text_shown,c.granted_at FROM lead l JOIN consent c ON c.id=l.consent_id
    WHERE (?='' OR l.country=?) AND (?='' OR l.course_interest=?) ORDER BY l.created_at DESC,l.id LIMIT 101 OFFSET ?`).bind(country,country,course,course,offset).all();
  // This admin-only inbox includes contact details, never IP hashes or credentials.
  return { items:rows.results.slice(0,100),hasMore:rows.results.length>100,offset };
}
export async function getWidgets(db: D1Database, actor: Actor | undefined) {
  authorize(actor, true);
  const results = await db.batch([
    db.prepare('SELECT * FROM widget_whatsapp WHERE id=1'), db.prepare('SELECT * FROM widget_video WHERE id=1'), db.prepare('SELECT * FROM widget_prueba_social WHERE id=1'),
  ]);
  return { whatsapp: results[0]?.results[0], video: results[1]?.results[0], social: results[2]?.results[0] };
}
export async function saveWidget(db: D1Database, actor: Actor | undefined, input: unknown) {
  const user = authorize(actor, true), p = record(input);
  const version = integer(p.actualizado, 'Versión', 0, 7258118400), now = Math.max(Math.floor(Date.now()/1000),version+1);
  const hidden = () => JSON.stringify(list(p.paginas_ocultas, 'Rutas ocultas', /^\/(?!\/)[a-zA-Z0-9_/*.-]*$/));
  let statement: D1PreparedStatement;
  if (p.widget === 'whatsapp') {
    const numero = str(p.numero, 'Número', 20);
    if (numero && !/^\d{7,15}$/.test(numero)) throw new OperationsError('Usa el indicativo y número con 7–15 dígitos, sin + ni espacios.');
    statement = db.prepare('UPDATE widget_whatsapp SET activo=?,numero=?,offset_x=?,offset_y=?,paginas_ocultas=?,actualizado=?,por=? WHERE id=1 AND actualizado=?').bind(bit(p.activo),numero,integer(p.offset_x,'X',0,400),integer(p.offset_y,'Y',0,800),hidden(),now,`emdash:${user.id}`,version);
  } else if (p.widget === 'video') {
    if (p.modo !== 'play' && p.modo !== 'auto') throw new OperationsError('Modo inválido.');
    statement = db.prepare('UPDATE widget_video SET modo=?,bucle=?,actualizado=?,por=? WHERE id=1 AND actualizado=?').bind(p.modo,bit(p.bucle),now,`emdash:${user.id}`,version);
  } else if (p.widget === 'social') {
    if (!['inferior-izquierda','inferior-derecha','superior-izquierda','superior-derecha'].includes(String(p.posicion))) throw new OperationsError('Posición inválida.');
    statement = db.prepare('UPDATE widget_prueba_social SET activo=?,posicion=?,offset_x=?,offset_y=?,espera_seg=?,intervalo_seg=?,paginas_ocultas=?,actualizado=?,por=? WHERE id=1 AND actualizado=?').bind(bit(p.activo),p.posicion,integer(p.offset_x,'X',0,400),integer(p.offset_y,'Y',0,400),integer(p.espera_seg,'Espera',0,600),integer(p.intervalo_seg,'Intervalo',5,3600),hidden(),now,`emdash:${user.id}`,version);
  } else throw new OperationsError('Widget inválido.');
  const result = await statement.run();
  if (!result.meta.changes) throw new OperationsError('El widget cambió en otra sesión. Recarga antes de guardar.',409);
  return { saved: true };
}
