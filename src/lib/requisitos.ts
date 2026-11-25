import relleno from '@/data/instructores-relleno.json';

const NOMBRES_RELLENO: readonly string[] = relleno.nombres.map((n) => n.nombre);

/**
 * Lista de «Qué necesitas» de la ficha. Usa los requisitos del país
 * (`requirement_items` del panel) y descarta los que nombran a un instructor de
 * relleno del lote de agosto (no es el creador: sería un dato inventado). Sin
 * requisitos válidos, una lista genérica que solo promete «sin experiencia»
 * donde el nivel lo permite, igual que `coursePrerequisites` del JSON-LD.
 */
export function requisitosDeFicha(delPais: readonly string[] | undefined, nivel: string): string[] {
  const validos = (delPais ?? []).filter((r) => r.trim() && !NOMBRES_RELLENO.some((n) => r.includes(n)));
  if (validos.length) return validos;
  const sinBase = nivel === 'Principiante' || nivel === 'Todos los niveles';
  return [...(sinBase ? ['No necesitas experiencia previa'] : []), 'Conexión a internet (celular o computador)', 'Ganas de aprender y practicar'];
}
