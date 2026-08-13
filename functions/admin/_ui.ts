/**
 * Panel de administración en Pages Functions.
 *
 * Se descartó el adaptador de Astro: @astrojs/cloudflare 14.2.0 importa un
 * símbolo que Astro 7.1.6 ya no exporta, y 14.1.7 no genera salida. Las Pages
 * Functions son la primitiva nativa, no tocan el build estático de las 5.918
 * páginas y despliegan con el mismo push.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface Env {
  DB: D1Database;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  GITHUB_TOKEN?: string;
}

/**
 * Identidad de la aplicación de Access.
 *
 * **Ninguno de los dos es un secreto.** Cualquiera que abra `/admin` sin
 * autenticarse recibe un 302 hacia
 * `https://connexis-pages.cloudflareaccess.com/cdn-cgi/access/login/sably.co?kid=662d7a30…`
 * con los dos valores a la vista, y el JWKS que cuelga de ese dominio es
 * público. Lo que protege el panel es la firma del token, no que estos dos
 * datos sean difíciles de averiguar.
 *
 * Por eso viven aquí y no solo en variables de entorno: el `PATCH` de la API de
 * Pages **reemplaza** el mapa `env_vars` entero, así que cada vez que alguien
 * añadía una variable nueva (Brevo, HOTTOK, Meta CAPI…) estas dos se perdían y
 * el panel quedaba inaccesible. Ya pasó tres veces.
 *
 * Las variables de entorno siguen ganando si están, para poder mover el panel
 * a otra cuenta o rotar la aplicación sin tocar código.
 */
const ACCESS_POR_DEFECTO = {
  teamDomain: 'https://connexis-pages.cloudflareaccess.com',
  aud: '662d7a3035f5543f69620cee3ef7571146024bc9076d6544b2a549dbf8936689',
} as const;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
/** El JWKS se cachea por isolate; si cambia el team domain hay que soltarlo. */
let jwksDe = '';

export interface Sesion {
  email: string | null;
  /** Por qué se rechazó. Vacío si entró. */
  motivo: string;
}

/**
 * Correo del moderador, o el motivo del rechazo.
 *
 * Verificar la firma es imprescindible: la cabecera es texto que cualquiera
 * puede enviar si llega al origen saltándose Access. Sin verificarla el panel
 * quedaría abierto a quien conozca la URL.
 *
 * El motivo se devuelve porque un rechazo mudo es indistinguible de «Access no
 * me deja entrar», y las dos causas reales —variables ausentes y team domain
 * renombrado— se arreglan en sitios distintos.
 */
export async function sesion(request: Request, env: Env): Promise<Sesion> {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN || ACCESS_POR_DEFECTO.teamDomain;
  const aud = env.CF_ACCESS_AUD || ACCESS_POR_DEFECTO.aud;

  const token =
    request.headers.get('cf-access-jwt-assertion') ??
    (request.headers.get('cookie') ?? '').match(/CF_Authorization=([^;]+)/)?.[1];
  if (!token) {
    return {
      email: null,
      motivo: 'La petición llegó sin token de Access: ni cabecera cf-access-jwt-assertion ni cookie CF_Authorization.',
    };
  }

  // El mismo valor alimenta dos usos incompatibles con otro formato: la URL del
  // JWKS y el claim `iss` que Access emite como https://<team>.cloudflareaccess.com.
  // Normalizarlo hace que una barra final o un valor sin esquema no rompan nada.
  const bruto = teamDomain.trim().replace(/\/+$/, '');
  const dominio = /^https?:\/\//.test(bruto) ? bruto : `https://${bruto}`;

  try {
    // Dentro del try a propósito: `new URL` lanza con un valor malformado, y
    // fuera de aquí eso sería un 500 opaco en vez de este mensaje.
    if (jwksDe !== dominio) {
      jwks = createRemoteJWKSet(new URL(`${dominio}/cdn-cgi/access/certs`));
      jwksDe = dominio;
    }
    const { payload } = await jwtVerify(token, jwks!, {
      issuer: dominio,
      audience: aud,
    });
    const email = (payload.email as string) ?? null;
    return email
      ? { email, motivo: '' }
      : { email: null, motivo: 'El token es válido pero no trae el campo email.' };
  } catch (err) {
    // Un JWKS que falló queda cacheado apuntando a un dominio muerto; soltarlo
    // permite que el siguiente despliegue con la variable corregida funcione.
    jwks = null;
    jwksDe = '';
    const e = err as { code?: string; claim?: string; message?: string };
    console.error('Access JWT rechazado:', e.code ?? '?', e.claim ?? '', e.message ?? '');
    const detalle =
      e.code === 'ERR_JWT_EXPIRED'
        ? 'El token caducó. Vuelve a entrar.'
        : e.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && e.claim === 'iss'
          ? 'El emisor del token no coincide: el team domain de Zero Trust cambió. Actualiza ACCESS_POR_DEFECTO.teamDomain en functions/admin/_ui.ts (o la variable CF_ACCESS_TEAM_DOMAIN) y vuelve a desplegar.'
          : e.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && e.claim === 'aud'
            ? 'El destinatario del token no coincide: el identificador de la aplicación de Access cambió. Actualiza ACCESS_POR_DEFECTO.aud en functions/admin/_ui.ts (o la variable CF_ACCESS_AUD) y vuelve a desplegar.'
            : e.code === 'ERR_JWKS_NO_MATCHING_KEY' || e.code === 'ERR_JWKS_TIMEOUT'
              ? 'No se pudieron descargar las claves públicas de Access. Suele significar que CF_ACCESS_TEAM_DOMAIN apunta a un team domain que ya no existe.'
              : `No se pudo verificar la firma (${e.code ?? 'error desconocido'}).`;
    return { email: null, motivo: detalle };
  }
}

const esc = (s: unknown): string =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export const e = esc;

export const fecha = (epoch: number): string =>
  new Date(epoch * 1000).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

const MENU: [string, string, string][] = [
  ['/admin/', 'Resumen', 'resumen'],
  ['/admin/moderacion', 'Moderación', 'moderacion'],
  ['/admin/leads', 'Leads', 'leads'],
  ['/admin/promociones', 'Promociones', 'promociones'],
  ['/admin/widgets', 'Widgets', 'widgets'],
  ['/admin/contenido', 'Contenido', 'contenido'],
  ['/admin/despliegue', 'Despliegue', 'despliegue'],
];

const CSS = `
:root{--tinta:#1b1033;--papel:#fff;--suave:#f6f5fa;--borde:#e4e1ec;--acento:#e6285f;
--apagado:#6b6480;--ok:#0f9d58;--alerta:#d93025}
*{box-sizing:border-box}
body{margin:0;font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
color:var(--tinta);background:var(--suave)}
header{background:var(--tinta);color:#fff;padding:.85rem 1.5rem;display:flex;
align-items:center;gap:1.5rem;flex-wrap:wrap}
header b{font-size:1.05rem}header nav{display:flex;gap:1rem;flex-wrap:wrap}
header a{color:#cfc9dd;text-decoration:none;font-size:.9rem}
header a:hover,header a[aria-current]{color:#fff}header a[aria-current]{font-weight:700}
.quien{margin-left:auto;font-size:.8rem;color:#a79fbd}
main{max-width:1100px;margin:0 auto;padding:1.75rem 1.5rem 4rem}
h1{font-size:1.5rem;margin:0 0 1.25rem}h2{font-size:1.05rem;margin:2rem 0 .75rem}
.tarjetas{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.tarjeta{background:var(--papel);border:1px solid var(--borde);border-radius:10px;padding:1.1rem}
.tarjeta .n{font-size:2rem;font-weight:800;line-height:1}
.tarjeta .t{font-size:.8rem;color:var(--apagado);margin-top:.35rem}
.tarjeta.avisa .n{color:var(--alerta)}
table{width:100%;border-collapse:collapse;background:var(--papel);font-size:.88rem}
th,td{text-align:left;padding:.7rem .8rem;border-bottom:1px solid var(--borde);vertical-align:top}
th{font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--apagado)}
.caja{background:var(--papel);border:1px solid var(--borde);border-radius:10px;overflow:auto}
button,.boton{font:inherit;font-size:.82rem;padding:.4rem .8rem;border-radius:6px;
border:1px solid var(--borde);background:var(--papel);cursor:pointer;text-decoration:none;
color:var(--tinta);display:inline-block}
button.ok{background:var(--ok);border-color:var(--ok);color:#fff}
button.no{background:var(--alerta);border-color:var(--alerta);color:#fff}
button.pri{background:var(--acento);border-color:var(--acento);color:#fff}
.vacio{padding:2.5rem;text-align:center;color:var(--apagado)}
.aviso{background:#fff6e5;border:1px solid #f0d9a8;border-radius:8px;padding:.8rem 1rem;
margin-bottom:1.25rem;font-size:.87rem}
form.fila{display:inline}
code{background:var(--suave);padding:.1rem .3rem;border-radius:4px;font-size:.85em}
p.nota{color:var(--apagado);font-size:.86rem;max-width:64ch;margin-top:1.25rem}
`;

export function pagina(titulo: string, moderador: string, activo: string, cuerpo: string): Response {
  const nav = MENU.map(
    ([href, txt, id]) =>
      `<a href="${href}"${id === activo ? ' aria-current="page"' : ''}>${txt}</a>`,
  ).join('');
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(titulo)} · Panel Sably</title><style>${CSS}</style></head>
<body><header><b>Sably</b><nav>${nav}</nav><span class="quien">${esc(moderador)}</span></header>
<main><h1>${esc(titulo)}</h1>${cuerpo}</main></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
}

/**
 * Rechazo explicado.
 *
 * Quien llega aquí ya pasó Cloudflare Access, así que decirle por qué se le
 * rechaza no filtra nada a un desconocido y le ahorra adivinar entre cuatro
 * causas que antes pintaban la misma pantalla.
 */
export const noAutorizado = (motivo = ''): Response =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>No autorizado</title>
<body style="font:16px/1.6 system-ui;padding:3rem;max-width:56ch;margin:0 auto;color:#1b1033">
<h1>No autorizado</h1>
${motivo ? `<p style="background:#fff6e5;border:1px solid #f0d9a8;border-radius:8px;padding:.9rem 1.1rem">${esc(motivo)}</p>` : ''}
<p>Este panel está detrás de Cloudflare Access. Comprueba que tu correo esté en la política
de acceso de la aplicación <b>Panel Sably</b>.</p>
<p style="color:#6b6480;font-size:.9rem">La identidad de la aplicación va en el código
(<code>ACCESS_POR_DEFECTO</code> en <code>functions/admin/_ui.ts</code>), así que ya no
depende de variables de entorno que se puedan perder. Si de verdad cambió el team domain
o el identificador de la aplicación, hay que actualizarla ahí y volver a desplegar.</p>`,
    { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );

export const irA = (ruta: string): Response =>
  new Response(null, { status: 303, headers: { location: ruta } });
