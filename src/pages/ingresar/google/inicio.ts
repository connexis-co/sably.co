/** POST desde /ingresar/: guarda `state`/`nonce`/PKCE atados a la cookie `flow` y lleva a Google. */
import type { APIRoute } from 'astro';
import { cookieFlujo, cuentaServidor, ipCliente, leerFormulario, noEncontrada, postValido, prohibido, recordarRetorno, redirigir } from '@/lib/cuenta/http';
import { urlGoogle } from '@/lib/cuenta/google';
import { ahora, enlaceIngresar } from '@/lib/cuenta/nucleo';

export const prerender = false;

export const GET: APIRoute = async (ctx) => (await cuentaServidor(ctx)) ? redirigir(enlaceIngresar()) : noEncontrada();

export const POST: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return noEncontrada();
  const formulario = await leerFormulario(ctx.request);
  if (!formulario || !postValido(ctx, servidor.secreto, formulario)) return prohibido();
  const volver = String(formulario.get('volver') ?? '');
  if (!servidor.google) return redirigir(enlaceIngresar(volver, 'google'));
  const t = ahora();
  if (!(await servidor.almacen.permitirInicio(ipCliente(ctx.request), t))) return redirigir(enlaceIngresar(volver, 'espera'));
  const flujo = await servidor.almacen.iniciarGoogle(cookieFlujo(ctx), t);
  // El país del selector de la cabecera siembra las preferencias si la cuenta es nueva.
  recordarRetorno(ctx, volver, String(formulario.get('pais') ?? ''));
  return redirigir(urlGoogle(servidor.google, flujo));
};
