/**
 * POST del paso 2: comprueba el código (5 intentos, un solo uso, solo en el navegador que lo pidió) y abre
 * la sesión. La primera vez crea la cuenta; si el correo ya tiene cuenta (también una creada con Google), entra en ella.
 */
import type { APIRoute } from 'astro';
import { abrirSesion, cookieFlujo, cuentaServidor, ipCliente, leerFormulario, noEncontrada, postValido, prohibido, redirigir, tomarRetorno } from '@/lib/cuenta/http';
import { CONSENTIMIENTO, SESION_SEGUNDOS, ahora, destinoSeguro, enlaceCodigo, enlaceIngresar, limpiarCodigo } from '@/lib/cuenta/nucleo';

export const prerender = false;

export const GET: APIRoute = async (ctx) => (await cuentaServidor(ctx)) ? redirigir(enlaceIngresar()) : noEncontrada();

export const POST: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return noEncontrada();
  const formulario = await leerFormulario(ctx.request);
  if (!formulario || !postValido(ctx, servidor.secreto, formulario)) return prohibido();
  const volver = String(formulario.get('volver') ?? '');
  if (!servidor.estado.correo) return redirigir(enlaceIngresar(volver, 'correo-apagado'));
  const t = ahora();
  const verificado = await servidor.almacen.verificarCodigo(cookieFlujo(ctx), limpiarCodigo(formulario.get('codigo')), t);
  if (!verificado.ok) return redirigir(verificado.aviso === 'codigo-malo' ? enlaceCodigo(volver, 'codigo-malo') : enlaceIngresar(volver, verificado.aviso));
  const { pais } = tomarRetorno(ctx);
  const resultado = await servidor.almacen.entrarConCorreo(verificado.email, t, { ...CONSENTIMIENTO, ip: ipCliente(ctx.request) }, pais || undefined);
  if (!resultado.ok) return redirigir(enlaceIngresar(volver, resultado.aviso));
  await abrirSesion(ctx, servidor.almacen, resultado.token, SESION_SEGUNDOS);
  return redirigir(destinoSeguro(volver));
};
