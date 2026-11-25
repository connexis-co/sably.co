/** Preferencias de la cuenta (preferencias.md §5.3). Sably ofrece solo el país; la moneda sale del país. */
import type { APIRoute } from 'astro';
import { cuentaActual, cuentaServidor, json, leerFormulario, paisValido, postValido, prohibido, redirigir } from '@/lib/cuenta/http';
import { RUTAS, ahora } from '@/lib/cuenta/nucleo';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return json({ error: 'no-disponible' }, 404);
  const cuenta = await cuentaActual(ctx, servidor.almacen);
  return cuenta ? json(await servidor.almacen.preferencias(cuenta.id)) : json({ error: 'sin-sesion' }, 401);
};

export const POST: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return json({ error: 'no-disponible' }, 404);
  const formulario = await leerFormulario(ctx.request);
  if (!formulario || !postValido(ctx, servidor.secreto, formulario)) return prohibido();
  const cuenta = await cuentaActual(ctx, servidor.almacen);
  if (!cuenta) return json({ error: 'sin-sesion' }, 401);
  const pais = String(formulario.get('pais') ?? '');
  if (pais && !paisValido(pais)) return json({ error: 'pais' }, 400);
  const doc = await servidor.almacen.guardarPais(cuenta.id, pais || null, ahora());
  return ctx.request.headers.get('sec-fetch-mode') === 'navigate' ? redirigir(`${RUTAS.cuenta}?aviso=guardado`) : json(doc);
};
