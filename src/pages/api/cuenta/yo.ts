/**
 * Lo que pinta la cabecera con sesión: nombre, iniciales, foto, país preferido y el token CSRF para
 * «Salir». Solo lo pide el script de la cabecera cuando existe la cookie pista. `private, no-store`.
 */
import type { APIRoute } from 'astro';
import { cuentaActual, cuentaServidor, json, olvidarCookies, tokenCsrf } from '@/lib/cuenta/http';
import { iniciales } from '@/lib/cuenta/nucleo';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) { olvidarCookies(ctx); return json({ cuenta: null }, 404); }
  const cuenta = await cuentaActual(ctx, servidor.almacen);
  if (!cuenta) return json({ cuenta: null }, 401);
  const prefs = await servidor.almacen.preferencias(cuenta.id);
  return json({
    cuenta: { nombre: cuenta.nombre, iniciales: iniciales(cuenta.nombre, cuenta.email), foto: cuenta.foto, pais: prefs.pais ?? null },
    csrf: tokenCsrf(ctx, servidor.secreto),
  });
};
