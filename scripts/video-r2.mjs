#!/usr/bin/env node
/**
 * Objetos de vídeo en R2 (bucket sably-assets, servido en cdn.sably.co) con caché larga.
 *
 * Por qué: los MP4 de `videos/hd/` se subieron sin `Cache-Control` y R2 responde con el
 * `max-age=14400` por defecto. Cloudflare los cachea igual en el borde, pero el navegador
 * los vuelve a pedir cada 4 horas. El token no tiene permiso de purga, así que no se
 * reescriben en su sitio: se copian a una ruta nueva (`videos/web2/`) con
 * `Cache-Control: public, max-age=31536000, immutable`. Cada archivo nuevo va siempre a
 * una ruta nueva; nunca se sobrescribe un objeto ya publicado.
 *
 *   node scripts/video-r2.mjs subir <archivo.mp4> <clave>   # p. ej. videos/web2/curso-x.mp4
 *   node scripts/video-r2.mjs comprobar                     # GET con Range: HIT + cabecera inmutable
 *
 * `videos/web2/` (25-nov-2026) es la copia web 720p SIN la cortinilla final «Beauty Luxe» (marca propia de Connexis;
 * retirada por decisión de la orquestadora delegada por JP): `videos/web/` cortado en el inicio del fundido a negro,
 * vídeo sin recodificar y audio con fundido de 0,25 s. Los originales intactos siguen en `videos/originales/` y los
 * editados a 1080p (fuente para Mux) en `videos/editados/`. `videos/web/` quedó obsoleta y `videos/v2/` inservible
 * (404 cacheado en el borde). Para saber si una ruta existe, `HEAD` a la API de R2, NUNCA un GET a cdn.sably.co: un
 * 404 del CDN queda cacheado 4 horas y el token no puede purgarlo.
 *
 * Credenciales: CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID en el entorno
 * (en el Mac de JP: `set -a; source ~/.config/connexis/cloudflare.env; set +a`).
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const CDN = 'https://cdn.sably.co';
export const BUCKET = 'sably-assets';
export const CACHE_INMUTABLE = 'public, max-age=31536000, immutable';

/** `hd/curso.mp4` → `web2/curso.mp4`. Solo cambia la carpeta; el nombre del archivo se conserva. */
export function claveWeb(clave) {
  const nombre = String(clave).split('/').pop();
  if (!nombre || !nombre.endsWith('.mp4')) throw new Error(`clave de vídeo no válida: ${clave}`);
  return `web2/${nombre}`;
}

function credenciales() {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: cuenta } = process.env;
  if (!token || !cuenta) throw new Error('Faltan CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID en el entorno.');
  return { token, cuenta };
}

async function subir(cuerpo, clave) {
  const { token, cuenta } = credenciales();
  const url = `https://api.cloudflare.com/client/v4/accounts/${cuenta}/r2/buckets/${BUCKET}/objects/${encodeURI(clave)}`;
  const r = await fetch(url, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'video/mp4', 'cache-control': CACHE_INMUTABLE },
    body: cuerpo,
  });
  if (!r.ok) throw new Error(`PUT ${clave}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
}

async function videos() {
  const { COURSE_VIDEOS } = await import('../src/lib/course-videos.ts').catch(() => ({}));
  if (!COURSE_VIDEOS) throw new Error('Ejecuta con un Node que cargue .ts (node ≥ 22.18) desde la raíz del repo.');
  return Object.entries(COURSE_VIDEOS);
}

async function comprobar() {
  let fallos = 0;
  for (const [slug, v] of await videos()) {
    let ultimo;
    for (let i = 0; i < 2; i++) {
      ultimo = await fetch(`${CDN}/videos/${v.key}`, { headers: { range: 'bytes=0-1023' } });
      await ultimo.arrayBuffer();
    }
    const cc = ultimo.headers.get('cache-control');
    const estado = ultimo.headers.get('cf-cache-status');
    const bien = ultimo.status === 206 && cc === CACHE_INMUTABLE && estado === 'HIT';
    if (!bien) fallos++;
    console.log(`${bien ? 'ok' : '!!'} ${slug}  ${ultimo.status} ${estado} «${cc}»`);
  }
  if (fallos) { console.error(`${fallos} vídeos sin caché larga`); process.exitCode = 1; }
}

const [orden, ...resto] = process.argv.slice(2);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (orden === 'subir' && resto.length === 2) await subir(readFileSync(resto[0]), resto[1]);
  else if (orden === 'comprobar') await comprobar();
  else { console.error('Uso: video-r2.mjs subir <archivo> <clave> | comprobar'); process.exitCode = 2; }
}
