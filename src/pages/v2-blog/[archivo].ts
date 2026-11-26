/** Hoja de estilos del blog V2 (ver src/themes/sably-v2/blog-hoja.ts): un año en caché, el nombre cambia con el CSS. */
import type { APIRoute } from 'astro';
import { ARCHIVO_HOJA, CSS_HOJA } from '@/themes/sably-v2/blog-hoja';

export const prerender = false;

export const GET: APIRoute = ({ params }) => params.archivo === ARCHIVO_HOJA
  ? new Response(CSS_HOJA, { headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=31536000, immutable' } })
  : new Response('Not found', { status: 404 });
