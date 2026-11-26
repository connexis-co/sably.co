/**
 * POST desde Mi cuenta: cambiar la contraseña (con la actual) o crear la primera (con un código al correo de la
 * cuenta, porque una sesión sola no basta para añadir una forma de entrar). Al cambiarla se cierran las demás
 * sesiones y la de este navegador se renueva.
 */
import type { APIRoute } from 'astro';
import { abrirSesion, cookieFlujo, cuentaActual, cuentaServidor, ipCliente, leerFormulario, noEncontrada, postValido, prohibido, redirigir } from '@/lib/cuenta/http';
import { correoCodigo } from '@/lib/cuenta/correo';
import { hashClave, revisarClaveNueva, verificarClave } from '@/lib/cuenta/clave';
import { LIMITE_CLAVE_CORREO_HORA, RUTAS, SESION_SEGUNDOS, ahora, enlaceIngresar } from '@/lib/cuenta/nucleo';

export const prerender = false;

const volverA = (aviso: string, extra = '') => redirigir(`${RUTAS.cuenta}?aviso=${aviso}${extra}#cuenta-clave`);

export const GET: APIRoute = async (ctx) => (await cuentaServidor(ctx)) ? redirigir(RUTAS.cuenta) : noEncontrada();

export const POST: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return noEncontrada();
  const formulario = await leerFormulario(ctx.request);
  if (!formulario || !postValido(ctx, servidor.secreto, formulario)) return prohibido();
  const { almacen } = servidor;
  const cuenta = await cuentaActual(ctx, almacen);
  if (!cuenta) return redirigir(enlaceIngresar(RUTAS.cuenta));
  if (!servidor.estado.clave) return volverA('clave-apagada');
  const t = ahora();
  const nueva = String(formulario.get('nueva') ?? '');
  const actualHash = await almacen.hashDeCuenta(cuenta.id);
  if (actualHash) {
    if (!(await almacen.permitir(`clave:correo:${cuenta.email}`, LIMITE_CLAVE_CORREO_HORA, t))) return volverA('espera');
    if (!(await verificarClave(String(formulario.get('actual') ?? ''), actualHash))) return volverA('clave-actual');
  }
  const fallo = await revisarClaveNueva(nueva, cuenta.email);
  if (fallo) return volverA(fallo);
  const hash = await hashClave(nueva);
  if (actualHash) {
    const token = await almacen.sesionNueva(cuenta.id, t);
    await almacen.fijarClave(cuenta.id, hash, t, token);
    await abrirSesion(ctx, almacen, token, SESION_SEGUNDOS);
    return volverA('clave-cambiada');
  }
  // Primera contraseña: se confirma con un código al correo de la cuenta.
  const enviar = await servidor.correo();
  if (!enviar) return volverA('clave-apagada');
  const flujo = cookieFlujo(ctx);
  const pedido = await almacen.pedirCodigo(flujo, cuenta.email, ipCliente(ctx.request), t, hash);
  if (!pedido.ok) return volverA(pedido.aviso === 'correo-espera' ? 'correo-espera' : 'espera');
  try {
    await enviar(correoCodigo(cuenta.email, pedido.codigo));
  } catch {
    await almacen.olvidarCodigo(flujo);
    return volverA('correo-envio');
  }
  return redirigir(`${RUTAS.cuenta}?paso=codigo#cuenta-clave`);
};
