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

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * Correo del moderador, o null.
 *
 * Verificar la firma es imprescindible: la cabecera es texto que cualquiera
 * puede enviar si llega al origen saltándose Access. Sin verificarla el panel
 * quedaría abierto a quien conozca la URL.
 */
export async function moderadorDe(request: Request, env: Env): Promise<string | null> {
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

export const noAutorizado = (): Response =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>No autorizado</title>
<body style="font:16px system-ui;padding:3rem;max-width:52ch;margin:0 auto">
<h1>No autorizado</h1>
<p>Este panel está detrás de Cloudflare Access. Si acabas de configurarlo, comprueba que existan
las variables <code>CF_ACCESS_TEAM_DOMAIN</code> y <code>CF_ACCESS_AUD</code> en el proyecto de
Pages, y que tu correo esté en la política de acceso.</p>`,
    { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );

export const irA = (ruta: string): Response =>
  new Response(null, { status: 303, headers: { location: ruta } });
