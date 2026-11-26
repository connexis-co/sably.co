/**
 * POST: crear la cuenta con contraseña o cambiarla («olvidé mi contraseña»). Revisa la contraseña (largo, distinta
 * del correo, fuera de filtraciones), la guarda como hash a la espera y envía un código al correo. Al validar el
 * código (/ingresar/correo/verificar/) se crea la cuenta o se cambia la contraseña y se cierran las demás sesiones.
 * La respuesta es la misma exista o no la cuenta.
 */
import type { APIRoute } from 'astro';
import { cookieFlujo, cuentaServidor, ipCliente, leerFormulario, noEncontrada, postValido, prohibido, recordarRetorno, redirigir } from '@/lib/cuenta/http';
import { correoCodigo } from '@/lib/cuenta/correo';
import { hashClave, revisarClaveNueva } from '@/lib/cuenta/clave';
import { ahora, enlaceCodigo, enlaceIngresar, normalizarCorreo, LIMITE_CLAVE_CORREO_HORA, LIMITE_CLAVE_IP_HORA, LIMITE_CLAVE_TOTAL_HORA } from '@/lib/cuenta/nucleo';

export const prerender = false;

export const GET: APIRoute = async (ctx) => (await cuentaServidor(ctx)) ? redirigir(enlaceIngresar(null, undefined, 'nueva')) : noEncontrada();

export const POST: APIRoute = async (ctx) => {
  const servidor = await cuentaServidor(ctx);
  if (!servidor) return noEncontrada();
  const formulario = await leerFormulario(ctx.request);
  if (!formulario || !postValido(ctx, servidor.secreto, formulario)) return prohibido();
  const volver = String(formulario.get('volver') ?? '');
  const enviar = servidor.estado.clave ? await servidor.correo() : null;
  if (!enviar) return redirigir(enlaceIngresar(volver, 'clave-apagada'));
  const email = normalizarCorreo(String(formulario.get('email') ?? ''));
  if (!email) return redirigir(enlaceIngresar(volver, 'correo-invalido', 'nueva'));
  const clave = String(formulario.get('clave') ?? '');
  if (clave.length > 512) return redirigir(enlaceIngresar(volver, 'clave-mala', 'nueva'));
  // El límite va antes de revisar la contraseña (consulta de filtraciones) y de calcular su hash (Argon2id, caro
  // en CPU y memoria): sin él, una ráfaga de peticiones podía agotar el servidor antes de llegar a `pedirCodigo`.
  const t = ahora();
  const ip = ipCliente(ctx.request);
  if (!(await servidor.almacen.permitir('clave-nueva:total', LIMITE_CLAVE_TOTAL_HORA, t))
    || !(await servidor.almacen.permitir(`clave-nueva:ip:${ip}`, LIMITE_CLAVE_IP_HORA, t))
    || !(await servidor.almacen.permitir(`clave-nueva:correo:${email}`, LIMITE_CLAVE_CORREO_HORA, t))) return redirigir(enlaceIngresar(volver, 'espera', 'nueva'));
  const fallo = await revisarClaveNueva(clave, email);
  if (fallo) return redirigir(enlaceIngresar(volver, fallo, 'nueva'));
  const flujo = cookieFlujo(ctx);
  const pedido = await servidor.almacen.pedirCodigo(flujo, email, ip, t, await hashClave(clave));
  if (!pedido.ok) return redirigir(pedido.aviso === 'correo-espera' ? enlaceCodigo(volver, 'correo-espera') : enlaceIngresar(volver, 'espera', 'nueva'));
  try {
    await enviar(correoCodigo(email, pedido.codigo));
  } catch {
    await servidor.almacen.olvidarCodigo(flujo);
    return redirigir(enlaceIngresar(volver, 'correo-envio', 'nueva'));
  }
  recordarRetorno(ctx, volver, String(formulario.get('pais') ?? ''));
  return redirigir(enlaceCodigo(volver));
};
