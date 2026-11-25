/**
 * Cursos guardados (contrato §6, `curso:<slug>`). La lista y el guardado ya funcionan; el botón
 * «Guardar curso» de la ficha llega con el diseño `fhG4J` (F2) y llamará a este POST.
 */
import type { APIRoute } from 'astro';
import { cuentaActual, cuentaServidor, json, leerFormulario, postValido, prohibido } from '@/lib/cuenta/http';
import { ahora, claveGuardadoValida } from '@/lib/cuenta/nucleo';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return json({ error: 'no-disponible' }, 404);
  const cuenta = await cuentaActual(ctx, servidor.almacen);
  return cuenta ? json({ guardados: await servidor.almacen.guardados(cuenta.id) }) : json({ error: 'sin-sesion' }, 401);
};

export const POST: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return json({ error: 'no-disponible' }, 404);
  const formulario = await leerFormulario(ctx.request);
  if (!formulario || !postValido(ctx, servidor.secreto, formulario)) return prohibido();
  const cuenta = await cuentaActual(ctx, servidor.almacen);
  if (!cuenta) return json({ error: 'sin-sesion' }, 401);
  const item = formulario.get('item'), accion = formulario.get('accion');
  if (!claveGuardadoValida(item) || (accion !== 'guardar' && accion !== 'quitar')) return json({ error: 'datos' }, 400);
  if (accion === 'guardar') await servidor.almacen.guardar(cuenta.id, item, ahora());
  else await servidor.almacen.quitar(cuenta.id, item);
  return json({ guardados: await servidor.almacen.guardados(cuenta.id) });
};
