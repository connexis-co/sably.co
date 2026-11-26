/**
 * Cierre de la barra de campaña V2 sin salto (E4). Quitarla de golpe sube 48 px (o más, a dos líneas) la cabecera
 * y, arriba del todo, toda la página. Aquí primero se anima —la barra sale hacia arriba y se desvanece; la cabecera
 * y el contenido suben lo mismo que subirán al quitarla— y al terminar se quita de verdad y se borran los
 * desplazamientos. Solo `translate` y `opacity` (composición). El contenido que ya estaba bajo la cabecera se queda
 * quieto: el desplazamiento de la página se compensa a mano (sin depender del anclaje de Chrome, que Safari no
 * tiene). Con `prefers-reduced-motion`, el mismo final sin animación.
 */
const DURACION = 240;

/** Puro: cuánto sube la cabecera y cuánto el contenido al quitar una barra de `alto` px con la página en `y`. */
export function desplazamientosCierre(alto: number, y: number, fija: boolean): { cabecera: number; contenido: number } {
  const contenido = Math.max(0, alto - Math.max(0, y));
  return { cabecera: fija ? alto : contenido, contenido };
}

export function cerrarBarraSuave(barra: HTMLElement, alFinal?: () => void): void {
  const alto = barra.offsetHeight;
  const y = scrollY;
  const fija = barra.hasAttribute('data-fija') && getComputedStyle(barra).position === 'sticky';
  const { cabecera: dCab, contenido: dCont } = desplazamientosCierre(alto, y, fija);
  const cab = document.querySelector<HTMLElement>('[data-cabecera]');
  // Lo que sigue a la cabecera en el flujo (el contenido y el pie), no lo fijo (WhatsApp, cookies, barras fijas).
  const resto = [...document.body.children].filter((el): el is HTMLElement =>
    el instanceof HTMLElement && el !== barra && el !== cab && !['SCRIPT', 'STYLE', 'TEMPLATE', 'DIALOG'].includes(el.tagName)
    && !el.hidden && !['fixed', 'absolute'].includes(getComputedStyle(el).position) && el.compareDocumentPosition(barra) & Node.DOCUMENT_POSITION_PRECEDING);
  const html = document.documentElement;
  const terminar = () => {
    // Quitarla de verdad y compensar: lo que estaba fuera de la vista por arriba no debe arrastrar la página.
    const anclaje = html.style.overflowAnchor;
    html.style.overflowAnchor = 'none';
    barra.hidden = true;
    barra.style.removeProperty('translate'); barra.style.removeProperty('opacity'); barra.style.removeProperty('transition');
    for (const el of [cab, ...resto]) if (el) { el.style.removeProperty('translate'); el.style.removeProperty('transition'); }
    const nuevoY = Math.max(0, y - alto);
    if (y > 0 && Math.round(scrollY) !== nuevoY) scrollTo({ top: nuevoY, behavior: 'instant' });
    html.style.removeProperty('--v2-barra-alto');
    requestAnimationFrame(() => { html.style.overflowAnchor = anclaje; });
    alFinal?.();
  };
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Si la barra no se ve (la página ya bajó y no es fija), no hay nada que animar.
  if (reducido || (dCab === 0 && dCont === 0) || alto === 0) { terminar(); return; }
  const transicion = `translate ${DURACION}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${DURACION}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
  barra.style.transition = transicion;
  if (cab) cab.style.transition = transicion;
  for (const el of resto) el.style.transition = transicion;
  // Un fotograma con la transición puesta antes de mover, para que anime.
  requestAnimationFrame(() => {
    barra.style.translate = '0 -100%';
    barra.style.opacity = '0';
    if (cab && dCab) cab.style.translate = `0 ${-dCab}px`;
    if (dCont) for (const el of resto) el.style.translate = `0 ${-dCont}px`;
    let hecho = false;
    const fin = () => { if (!hecho) { hecho = true; terminar(); } };
    barra.addEventListener('transitionend', (e) => { if (e.target === barra && e.propertyName === 'translate') fin(); });
    setTimeout(fin, DURACION + 120);
  });
}
