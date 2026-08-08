/**
 * Identificador anónimo del visitante.
 *
 * No es una cookie ni un perfil: es una cadena aleatoria que solo sirve para
 * que votar dos veces sustituya el voto en vez de sumar uno nuevo. No viaja a
 * ningún tercero, no se cruza con nada y el servidor no puede asociarla a una
 * persona — el único dato de red que guarda es un hash de IP con sal diaria.
 *
 * Se guarda en localStorage. Si no se puede (modo privado estricto, iframes
 * con almacenamiento particionado), se genera uno por sesión: el voto seguirá
 * contando, pero la persona podrá votar otra vez desde otra pestaña. Es un
 * intercambio deliberado — preferimos perder precisión antes que bloquear a
 * quien navega con el almacenamiento cerrado.
 */
const CLAVE = 'sably:visitante';

let enMemoria = '';

/**
 * 32 caracteres hexadecimales. No usa `crypto.randomUUID`, que solo existe en
 * contextos seguros y es `undefined` al abrir el sitio de desarrollo por IP
 * desde el móvil.
 */
function generar(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function visitanteId(): string {
  if (enMemoria) return enMemoria;
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado && guardado.length >= 8 && guardado.length <= 64) {
      enMemoria = guardado;
      return enMemoria;
    }
    enMemoria = generar();
    localStorage.setItem(CLAVE, enMemoria);
  } catch {
    // Sin almacenamiento: uno por carga de página. Se cachea en el módulo para
    // que al menos sea estable dentro de la misma vista.
    enMemoria = enMemoria || generar();
  }
  return enMemoria;
}

/** Milisegundos desde que cargó la página. El backend exige un mínimo. */
export const permanencia = (): number => Math.round(performance.now());
