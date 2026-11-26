/**
 * Interruptores de la cuenta en el panel (grupo «Cuenta» de sably-operations) y
 * configuración del servidor. Sin clave de sesión o sin el cliente de Google en
 * el entorno, la cuenta no existe para el público aunque el panel la tenga
 * encendida: el HTML queda igual que sin cuenta.
 */
const PREFIJO = 'plugin:sably-operations:settings:';
export const CLAVES_CUENTA = { activa: 'cuentaActiva', google: 'cuentaGoogle', correo: 'cuentaCorreo', acceso: 'cuentaAcceso' } as const;

export interface EntornoCuenta {
  SABLY_AUTH_SECRET?: string;
  SABLY_GOOGLE_ID?: string;
  SABLY_GOOGLE_SECRET?: string;
}

export interface EstadoCuenta {
  /** Interruptor general del panel (de fábrica: encendido). */
  activa: boolean;
  /** Acceso con Google utilizable: interruptor + clave de sesión + cliente OAuth en el entorno. */
  google: boolean;
  /**
   * Acceso con código por correo pedido: interruptor + clave de sesión. Se ofrece solo si además el
   * proveedor de correo está listo (`envioCorreo`, que se comprueba en las rutas de cuenta).
   */
  correo: boolean;
  /** Hay alguna forma de entrar: se pinta «Entrar» y existen las rutas de cuenta. */
  disponible: boolean;
  /** «Entrar» abre la ventana emergente o lleva a la página /ingresar/ (las dos funcionan siempre). */
  acceso: 'ventana' | 'pagina';
}

function decodificar(valor: string): unknown {
  try { return JSON.parse(valor); } catch { return valor; }
}

/** Puro: filas de `options` + entorno → estado. Solo `false` apaga (de fábrica, encendido). */
export function leerEstadoCuenta(filas: { name: string; value: string }[], entorno: EntornoCuenta): EstadoCuenta {
  const v: Record<string, unknown> = {};
  for (const f of filas) if (f.name.startsWith(PREFIJO)) v[f.name.slice(PREFIJO.length)] = decodificar(f.value);
  const clave = (entorno.SABLY_AUTH_SECRET ?? '').length >= 32;
  const activa = v[CLAVES_CUENTA.activa] !== false;
  const google = activa && clave && v[CLAVES_CUENTA.google] !== false && !!entorno.SABLY_GOOGLE_ID && !!entorno.SABLY_GOOGLE_SECRET;
  const correo = activa && clave && v[CLAVES_CUENTA.correo] !== false;
  return { activa, google, correo, disponible: google || correo, acceso: v[CLAVES_CUENTA.acceso] === 'pagina' ? 'pagina' : 'ventana' };
}

async function filasCuenta(): Promise<{ name: string; value: string }[]> {
  try {
    const { getDb } = await import('emdash/runtime');
    return await (await getDb()).selectFrom('options').select(['name', 'value'])
      .where('name', 'in', Object.values(CLAVES_CUENTA).map(c => PREFIJO + c)).execute();
  } catch {
    // Sin base (build, pruebas): sin cuenta.
    return [];
  }
}

export async function entornoCuenta(): Promise<EntornoCuenta> {
  const { env } = await import('virtual:sably-runtime');
  return env as unknown as EntornoCuenta;
}

/** Estado de esta petición, guardado en `locals` para no leerlo dos veces. */
export async function estadoCuenta(locals?: App.Locals): Promise<EstadoCuenta> {
  if (locals?.sablyCuenta) return locals.sablyCuenta;
  const estado = leerEstadoCuenta(await filasCuenta(), await entornoCuenta());
  if (locals) locals.sablyCuenta = estado;
  return estado;
}
