/**
 * POST: entrar con correo y contraseña. Límites por hora: 10 intentos por correo (la cuenta), 30 por IP y 600
 * en el sitio. La respuesta es la misma si el correo no existe, no tiene contraseña o la contraseña no coincide,
 * y el tiempo también (se verifica contra un hash ficticio). Un hash scrypt se rehace en Argon2id al entrar.
 */
import type { APIRoute } from 'astro';
import { abrirSesion, cuentaServidor, ipCliente, leerFormulario, noEncontrada, postValido, prohibido, redirigir } from '@/lib/cuenta/http';
import { hashClave, hashFicticio, necesitaRehash, verificarClave } from '@/lib/cuenta/clave';
import { LIMITE_CLAVE_CORREO_HORA, LIMITE_CLAVE_IP_HORA, LIMITE_CLAVE_TOTAL_HORA, SESION_SEGUNDOS, ahora, destinoSeguro, enlaceIngresar, normalizarCorreo } from '@/lib/cuenta/nucleo';

export const prerender = false;

export const GET: APIRoute = async (ctx) => (await cuentaServidor(ctx)) ? redirigir(enlaceIngresar(null, undefined, 'clave')) : noEncontrada();

export const POST: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return noEncontrada();
  const formulario = await leerFormulario(ctx.request);
  if (!formulario || !postValido(ctx, servidor.secreto, formulario)) return prohibido();
  const volver = String(formulario.get('volver') ?? '');
  if (!servidor.estado.clave) return redirigir(enlaceIngresar(volver, 'clave-apagada'));
  const email = normalizarCorreo(String(formulario.get('email') ?? ''));
  const clave = String(formulario.get('clave') ?? '');
  if (!email || !clave || clave.length > 512) return redirigir(enlaceIngresar(volver, 'clave-mala', 'clave'));
  const t = ahora();
  const { almacen } = servidor;
  if (!(await almacen.permitir('clave:total', LIMITE_CLAVE_TOTAL_HORA, t))
    || !(await almacen.permitir(`clave:ip:${ipCliente(ctx.request)}`, LIMITE_CLAVE_IP_HORA, t))
    || !(await almacen.permitir(`clave:correo:${email}`, LIMITE_CLAVE_CORREO_HORA, t))) return redirigir(enlaceIngresar(volver, 'espera', 'clave'));
  const registro = await almacen.claveDe(email);
  const valida = await verificarClave(clave, registro?.hash ?? await hashFicticio());
  if (!registro || !valida) return redirigir(enlaceIngresar(volver, 'clave-mala', 'clave'));
  if (registro.status === 'blocked') return redirigir(enlaceIngresar(volver, 'bloqueada'));
  if (necesitaRehash(registro.hash)) await almacen.fijarClave(registro.cuenta, await hashClave(clave), t, undefined, false);
  await abrirSesion(ctx, almacen, await almacen.sesionNueva(registro.cuenta, t), SESION_SEGUNDOS);
  return redirigir(destinoSeguro(volver));
};
