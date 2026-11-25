/** Borrado de la cuenta a petición (POST con CSRF y confirmación). Borra en cascada y cierra la sesión. */
import type { APIRoute } from 'astro';
import { cuentaActual, cuentaServidor, leerFormulario, noEncontrada, olvidarCookies, postValido, prohibido, redirigir } from '@/lib/cuenta/http';
import { RUTAS, enlaceIngresar } from '@/lib/cuenta/nucleo';

export const prerender = false;

export const GET: APIRoute = async (ctx) => (await cuentaServidor(ctx)) ? redirigir(RUTAS.cuenta) : noEncontrada();

export const POST: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return noEncontrada();
  const formulario = await leerFormulario(ctx.request);
  if (!formulario || !postValido(ctx, servidor.secreto, formulario)) return prohibido();
  const cuenta = await cuentaActual(ctx, servidor.almacen);
  if (!cuenta) return redirigir(enlaceIngresar(RUTAS.cuenta));
  if (formulario.get('confirmar') !== 'si') return redirigir(RUTAS.cuenta);
  await servidor.almacen.borrarCuenta(cuenta.id);
  olvidarCookies(ctx);
  return redirigir(enlaceIngresar(null, 'borrada'));
};
