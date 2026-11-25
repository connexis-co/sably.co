/**
 * Bloques de la portada de país V2 y su orden desde el panel («Ajustes del sitio → Portada»).
 *
 * El héroe no está aquí: lleva el único H1 y va siempre primero. El resto se ordena y se apaga con dos
 * ajustes de texto (`portadaOrden` y `portadaOcultos`, listas separadas por comas). Un bloque que no
 * aparece en el orden guardado (por ejemplo, uno nuevo que llegó después de guardar) entra en su sitio de
 * fábrica, así que añadir bloques nunca los esconde por accidente. Puro: lo comparten el sitio y el panel.
 */
export const BLOQUES_PORTADA = [
  { id: 'cifras', nombre: 'Sably en cifras y medios de pago' },
  { id: 'categorias', nombre: 'Áreas con foto' },
  { id: 'destacados', nombre: 'Cursos destacados' },
  { id: 'promo', nombre: 'Banda de la campaña' },
  { id: 'oficio', nombre: 'Oficio destacado' },
  { id: 'como-funciona', nombre: 'Cómo funciona Sably' },
  { id: 'beneficios', nombre: 'Por qué Sably' },
  { id: 'videos', nombre: 'Presentaciones en vídeo' },
  { id: 'guias', nombre: 'Guías del blog' },
  { id: 'preguntas', nombre: 'Preguntas frecuentes' },
  { id: 'cierre', nombre: 'Encuentra tu curso (cierre)' },
] as const;

export type BloquePortada = (typeof BLOQUES_PORTADA)[number]['id'];

export const ORDEN_DE_FABRICA: readonly BloquePortada[] = BLOQUES_PORTADA.map(b => b.id);

const esBloque = (x: string): x is BloquePortada => (ORDEN_DE_FABRICA as readonly string[]).includes(x);

/** «a, b ,c» → ['a','b','c'] sin vacíos ni repetidos. */
export function listaDeTexto(texto: unknown): string[] {
  if (typeof texto !== 'string') return [];
  return [...new Set(texto.split(',').map(x => x.trim()).filter(Boolean))];
}

/**
 * Orden final de los bloques visibles. Los ids desconocidos se ignoran; los que faltan en el orden guardado
 * se insertan detrás del bloque que les precede en el orden de fábrica (o al principio si no hay ninguno).
 */
export function bloquesVisibles(ordenGuardado: unknown, ocultos: unknown): BloquePortada[] {
  const guardado = listaDeTexto(ordenGuardado).filter(esBloque);
  const orden = [...guardado];
  ORDEN_DE_FABRICA.forEach((id, i) => {
    if (orden.includes(id)) return;
    const previo = ORDEN_DE_FABRICA.slice(0, i).reverse().find(p => orden.includes(p));
    orden.splice(previo ? orden.indexOf(previo) + 1 : 0, 0, id);
  });
  const fuera = new Set(listaDeTexto(ocultos));
  return orden.filter(id => !fuera.has(id));
}

/** Para el panel: todos los bloques en su orden actual, con su estado. */
export function bloquesParaElPanel(ordenGuardado: unknown, ocultos: unknown) {
  const fuera = new Set(listaDeTexto(ocultos));
  const todos = bloquesVisibles(ordenGuardado, '');
  return todos.map(id => ({ id, nombre: BLOQUES_PORTADA.find(b => b.id === id)!.nombre, visible: !fuera.has(id) }));
}
