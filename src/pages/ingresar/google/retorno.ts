/**
 * Retorno de Google: comprueba `state` contra la cookie `flow` (un solo uso), canjea el código con
 * el verificador PKCE, verifica el `id_token` y abre la sesión. La primera vez crea la cuenta.
 */
import type { APIRoute } from 'astro';
import { abrirSesion, cookieFlujo, cuentaServidor, ipCliente, noEncontrada, redirigir, tomarRetorno } from '@/lib/cuenta/http';
import { canjearGoogle } from '@/lib/cuenta/google';
import { CONSENTIMIENTO, SESION_SEGUNDOS, ahora, enlaceIngresar } from '@/lib/cuenta/nucleo';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return noEncontrada();
  const { destino, pais } = tomarRetorno(ctx);
  if (!servidor.google) return redirigir(enlaceIngresar(destino, 'google'));
  const params = ctx.url.searchParams;
  const grant = await servidor.almacen.consumirGoogle(cookieFlujo(ctx), params.get('state') ?? '', ahora());
  const codigo = params.get('code');
  if (!grant || !codigo || codigo.length > 4096 || params.has('error')) return redirigir(enlaceIngresar(destino, 'google'));
  try {
    const identidad = await canjearGoogle(servidor.google, codigo, grant);
    const resultado = await servidor.almacen.entrarConGoogle(identidad, ahora(),
      { ...CONSENTIMIENTO, ip: ipCliente(ctx.request) }, pais || undefined);
    if (!resultado.ok) return redirigir(enlaceIngresar(destino, resultado.aviso));
    await abrirSesion(ctx, servidor.almacen, resultado.token, SESION_SEGUNDOS);
    return redirigir(destino);
  } catch {
    // Ni el código, ni los tokens, ni el correo pasan al registro.
    return redirigir(enlaceIngresar(destino, 'google'));
  }
};
