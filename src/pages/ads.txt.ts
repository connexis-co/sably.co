import type { APIRoute } from 'astro';
import { configPublicidad } from '@/lib/publicidad';
export const prerender = false;
/** /ads.txt desde el panel «Publicidad». Vacío: 404, como sin el módulo. Independiente del interruptor. */
export const GET: APIRoute = async ({ locals }) => {
  const { adsTxt } = await configPublicidad(locals);
  if (!adsTxt.trim()) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } });
  return new Response(`${adsTxt.trim()}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
