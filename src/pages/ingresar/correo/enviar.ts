/**
 * POST desde /ingresar/: envía un código de 6 dígitos al correo y lleva al paso 2 (/ingresar/?paso=codigo).
 * La respuesta es la misma exista o no la cuenta: la cuenta se crea al validar el primer código.
 * El código queda atado a la cookie `flow` de este navegador (contrato §3).
 */
import type { APIRoute } from 'astro';
import { cookieFlujo, cuentaServidor, ipCliente, leerFormulario, noEncontrada, postValido, prohibido, recordarRetorno, redirigir } from '@/lib/cuenta/http';
import { correoCodigo } from '@/lib/cuenta/correo';
import { ahora, enlaceCodigo, enlaceIngresar, normalizarCorreo } from '@/lib/cuenta/nucleo';

export const prerender = false;

export const GET: APIRoute = async (ctx) => (await cuentaServidor(ctx)) ? redirigir(enlaceIngresar()) : noEncontrada();

export const POST: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return noEncontrada();
  const formulario = await leerFormulario(ctx.request);
  if (!formulario || !postValido(ctx, servidor.secreto, formulario)) return prohibido();
  const volver = String(formulario.get('volver') ?? '');
  const enviar = await servidor.correo();
  if (!enviar) return redirigir(enlaceIngresar(volver, 'correo-apagado'));
  const email = normalizarCorreo(String(formulario.get('email') ?? ''));
  if (!email) return redirigir(enlaceIngresar(volver, 'correo-invalido'));
  const flujo = cookieFlujo(ctx);
  const pedido = await servidor.almacen.pedirCodigo(flujo, email, ipCliente(ctx.request), ahora());
  if (!pedido.ok) return redirigir(pedido.aviso === 'correo-espera' ? enlaceCodigo(volver, 'correo-espera') : enlaceIngresar(volver, 'espera'));
  try {
    await enviar(correoCodigo(email, pedido.codigo));
  } catch {
    // Ni el código ni el correo pasan al registro.
    await servidor.almacen.olvidarCodigo(flujo);
    return redirigir(enlaceIngresar(volver, 'correo-envio'));
  }
  // El país del selector de la cabecera siembra las preferencias si la cuenta es nueva.
  recordarRetorno(ctx, volver, String(formulario.get('pais') ?? ''));
  return redirigir(enlaceCodigo(volver, formulario.get('reenviar') === '1' ? 'reenviado' : undefined));
};
