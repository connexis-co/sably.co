/**
 * Lectura de la configuración del módulo de publicidad desde Astro (componentes de hueco y /ads.txt).
 * Vive en la tabla `options` como `plugin:sably-publicidad:config` (la escribe el plugin con `ctx.kv`).
 * Una consulta por render, memorizada por petición; sin base (build, pruebas) queda apagado.
 */
import { cuentaNueva, normalizarConfig, type ConfigPublicidad, type Cuenta } from '@/plugins/sably-publicidad/model';

export const OPCION_PUBLICIDAD = 'plugin:sably-publicidad:config';

const porPeticion = new WeakMap<object, Promise<ConfigPublicidad>>();
const cuentas = new WeakMap<object, Cuenta>();

async function leer(): Promise<ConfigPublicidad> {
  try {
    const { getDb } = await import('emdash/runtime');
    const fila = await (await getDb()).selectFrom('options').select(['value']).where('name', '=', OPCION_PUBLICIDAD).executeTakeFirst();
    if (!fila) return normalizarConfig(null);
    let valor: unknown = fila.value;
    if (typeof valor === 'string') { try { valor = JSON.parse(valor); } catch { /* valor tal cual */ } }
    return normalizarConfig(valor);
  } catch {
    return normalizarConfig(null);
  }
}

/** `clave`: algo que dure lo que la petición (Astro.locals). */
export function configPublicidad(clave: object): Promise<ConfigPublicidad> {
  let p = porPeticion.get(clave);
  if (!p) { p = leer(); porPeticion.set(clave, p); }
  return p;
}

/** Contador de huecos pintados en esta petición (tope por página). */
export function cuentaPublicidad(clave: object): Cuenta {
  let c = cuentas.get(clave);
  if (!c) { c = cuentaNueva(); cuentas.set(clave, c); }
  return c;
}
