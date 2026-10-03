/**
 * POST /api/v1/leads — sustituye el PUBLIC_LEADS_ENDPOINT que estaba vacío.
 *
 * Es el dato de menor riesgo porque no se publica en ninguna parte, así que
 * es el primero que conviene poner en producción para validar la tubería.
 */
import {
  type Env, error, evaluarAbuso, hashIp, ipDe, json, paisDe,
  registrarConsentimiento, superaLimite, ulid,
} from './_shared';

interface Cuerpo {
  name?: string;
  email?: string;
  phone?: string;
  course_interest?: string;
  source?: string;
  turnstile_token?: string;
  consent_text?: string;
  consent_policy_url?: string;
  country?: string;
  /** Texto libre del formulario de contacto. Nulo en el modal de curso. */
  message?: string;
  /** Campo trampa: invisible para una persona. */
  trampa?: string;
  /** Milisegundos entre que se pintó el formulario y se envió. */
  abierto_ms?: number;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let b: Cuerpo;
  try {
    b = await request.json();
  } catch {
    return error('cuerpo JSON inválido');
  }

  if (!b || typeof b !== 'object' || Array.isArray(b) || ['name','email','phone','message','source','country','consent_text','consent_policy_url','course_interest'].some(key => key in b && typeof b[key as keyof Cuerpo] !== 'string')) return error('datos de solicitud inválidos');
  if (b.country && !/^[a-z]{2}$/i.test(b.country)) return error('país inválido');
  const policyPath = b.consent_policy_url ?? '/legal/privacidad/';
  if (!/^\/(?!\/)[a-z0-9/_-]+\/?$/i.test(policyPath)) return error('política de privacidad inválida');
  const nombre = (b.name ?? '').trim();
  const email = (b.email ?? '').trim().toLowerCase();
  if (nombre.length < 2 || nombre.length > 80) return error('nombre inválido');
  if (!EMAIL.test(email)) return error('correo inválido');
  if (!b.consent_text) return error('falta la autorización de tratamiento de datos');

  const ip = ipDe(request);
  const ipHash = await hashIp(ip, env.IP_SALT);

  const abuso = await evaluarAbuso(
    { turnstileToken: b.turnstile_token, trampa: b.trampa, abiertoMs: b.abierto_ms },
    env.TURNSTILE_SECRET,
    ip,
  );
  if (abuso.rechazar) {
    console.error('lead rechazado:', abuso.motivo);
    return error('no se pudo verificar que eres una persona', 403);
  }
  if (await superaLimite(env.DB, 'lead', ipHash, 10)) {
    return error('demasiados envíos desde esta conexión', 429);
  }

  const pais = b.country?.toUpperCase() || paisDe(request);
  const consentId = await registrarConsentimiento(env.DB, 'lead', ipHash, pais, b.consent_text, new URL(policyPath, 'https://sably.co').href);
  // Dos años de conservación comercial; después lo purga el cron.
  const purga = Math.floor(Date.now() / 1000) + 730 * 24 * 3600;

  // El mensaje del formulario de contacto se guarda pegado al origen: la tabla
  // `lead` no tiene columna de texto libre y añadirla obligaría a migrar una
  // tabla que ya está en producción. `source` es TEXT sin longitud máxima.
  const mensaje = (b.message ?? '').trim().slice(0, 2000);
  const origen = [b.source ?? '', mensaje && `mensaje: ${mensaje}`].filter(Boolean).join('\n');

  let guardado = false;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO lead (id, name, email, phone, course_interest, country,
                         source, consent_id, turnstile, ip_hash, purge_after)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM lead WHERE email=? AND COALESCE(course_interest,'')=COALESCE(?,'')
           AND date(created_at,'unixepoch')=date('now')
       )`,
    )
      .bind(ulid(), nombre, email, b.phone ?? null, b.course_interest ?? null,
            pais, origen || null, consentId, abuso.turnstile, ipHash, purga,email,b.course_interest ?? null)
      .run();
    guardado = result.meta.changes > 0;
  } catch (e) {
    const msg = (e as Error).message;
    // El índice único (email, curso, día) hace idempotente el doble clic. No es
    // un error para quien envía: sus datos ya están, de la primera vez.
    if (!/UNIQUE/i.test(msg)) {
      console.error('lead:', msg);
      return error('no se pudo registrar la solicitud', 422);
    }
  }

  // El texto lo decide el servidor, no el cliente: es el único que sabe si de
  // verdad se escribió la fila y si hay proveedor de correo configurado. Sin
  // proveedor NO se dice «te enviamos un correo», porque no salió ninguno.
  const enviado = guardado && await notificar(env, { nombre, email, curso: b.course_interest, mensaje, origen });

  return json(
    {
      ok: true,
      guardado,
      duplicado: !guardado,
      correo: false,
      equipo_notificado: enviado,
      mensaje: guardado
        ? 'Recibimos tu solicitud. Nuestro equipo tiene tus datos para contactarte.'
        : 'Tu solicitud ya estaba registrada. Nuestro equipo tiene tus datos para contactarte.',
    },
    guardado ? 201 : 200,
  );
};

/**
 * Avisa al equipo por correo, si hay proveedor.
 *
 * Devuelve false —y no lanza— cuando no está configurado: el lead ya está en
 * la base, que es lo que no se puede perder. Lo que no puede pasar es que la
 * interfaz afirme que salió un correo cuando no salió, así que este booleano
 * es el que elige el texto de confirmación.
 */
async function notificar(
  env: Env,
  datos: { nombre: string; email: string; curso?: string; mensaje: string; origen: string },
): Promise<boolean> {
  if (!env.MAIL) return false;
  // Texto plano a propósito: el nombre y el mensaje son de un desconocido, y
  // en text/plain no hay marcado que pueda inyectarse.
  const cuerpo = [
    `Nombre:  ${datos.nombre}`,
    `Correo:  ${datos.email}`,
    datos.curso ? `Curso:   ${datos.curso}` : null,
    '',
    datos.mensaje || '(sin mensaje)',
    '',
    `Origen: ${datos.origen}`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  try {
    await env.MAIL.send({to:env.MAIL.notificationEmail,replyTo:datos.email,subject:`Nueva solicitud de ${datos.nombre}`,text:cuerpo});
    return true;
  } catch {
    console.error('No se pudo notificar la solicitud mediante el proveedor de correo de EmDash.');
    return false;
  }
}
