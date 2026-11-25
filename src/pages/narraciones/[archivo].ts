/**
 * MP3 de las narraciones guardadas en el disco del servidor (depósito «disco» del plugin sably-narracion). Solo sirve
 * archivos de tomas que suenan en el sitio (fila en `publicadas`). El nombre lleva la huella del contenido: caché
 * inmutable de un año en el navegador y en Cloudflare. Admite Range (avanzar en el reproductor sin bajar todo).
 */
import type { APIRoute } from 'astro';
import { archivoValido, CACHE_INMUTABLE, carpetaAudios } from '@/plugins/sably-narracion/src/deposito';

export const prerender = false;

const noEncontrado = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

async function publicada(archivo: string) {
  const { getDb } = await import('emdash/runtime');
  const fila = await (await getDb()).selectFrom('_plugin_storage' as never).select('id' as never)
    .where('plugin_id' as never, '=', 'sably-narracion' as never).where('collection' as never, '=', 'publicadas' as never)
    .where('data' as never, 'like', `%"archivo":"${archivo}"%` as never).executeTakeFirst();
  return Boolean(fila);
}

function rango(cabecera: string, tam: number) {
  const m = /^bytes=(\d*)-(\d*)$/i.exec(cabecera.trim());
  if (!m || (!m[1] && !m[2])) return undefined;
  const fin = m[1] && m[2] ? Number(m[2]) : tam - 1;
  const inicio = m[1] ? Number(m[1]) : Math.max(0, tam - Number(m[2]));
  if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fin) || inicio >= tam || fin < inicio) return null;
  return { inicio, fin: Math.min(fin, tam - 1) };
}

export const GET: APIRoute = async ({ params, request }) => {
  const archivo = params.archivo ?? '';
  if (!archivoValido(archivo) || process.env.SABLY_RUNTIME !== 'node') return noEncontrado();
  if (!(await publicada(archivo).catch(() => false))) return noEncontrado();
  const { open } = await import('node:fs/promises');
  const { join, resolve } = await import('node:path');
  const { Readable } = await import('node:stream');
  const manejador = await open(join(resolve(carpetaAudios()), archivo), 'r').catch(() => undefined);
  if (!manejador) return noEncontrado();
  let enFlujo = false;
  try {
    const { size } = await manejador.stat();
    const cabeceras = new Headers({
      'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': CACHE_INMUTABLE,
      'Content-Length': String(size), ETag: `"${archivo.slice(-16, -4)}"`, 'X-Content-Type-Options': 'nosniff',
    });
    if (request.headers.get('if-none-match') === cabeceras.get('ETag')) return new Response(null, { status: 304, headers: cabeceras });
    if (request.method === 'HEAD') return new Response(null, { headers: cabeceras });
    const pedido = request.headers.get('range');
    const r = pedido && !pedido.includes(',') ? rango(pedido, size) : undefined;
    if (r === null) {
      cabeceras.set('Content-Range', `bytes */${size}`);
      cabeceras.set('Content-Length', '0');
      return new Response(null, { status: 416, headers: cabeceras });
    }
    if (r) {
      cabeceras.set('Content-Range', `bytes ${r.inicio}-${r.fin}/${size}`);
      cabeceras.set('Content-Length', String(r.fin - r.inicio + 1));
    }
    const flujo = Readable.toWeb(manejador.createReadStream(r ? { start: r.inicio, end: r.fin } : {})) as ReadableStream<Uint8Array>;
    enFlujo = true;
    return new Response(flujo, { status: r ? 206 : 200, headers: cabeceras });
  } finally {
    if (!enFlujo) await manejador.close();
  }
};

export const HEAD = GET;
