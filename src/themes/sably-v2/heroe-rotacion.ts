/**
 * Rotación del héroe de la portada V2 para las variantes «vitrina», «buscador» y «abanico». Cada cierto tiempo
 * pasa al curso siguiente (bolsa aleatoria sin repetición, o en orden) y avisa a quien pinta. El reloj es la
 * animación de la línea de progreso (solo transform). Se para con el cursor, el foco, el botón de pausa, la
 * pestaña oculta y fuera de pantalla, y no se crea con «reducir movimiento» (WCAG 2.2.2). Sin JavaScript, el
 * héroe se queda en el primer curso, con todos los demás enlazados en el HTML.
 */
export interface OpcionesRotacion {
  total: number;
  intervalo: number;
  aleatorio: boolean;
  /** Pinta el curso `n` (después de decodificar su foto, si la tiene). */
  pintar: (n: number) => Promise<void> | void;
  /** Foto del curso `n`, para pedirla y decodificarla antes de enseñarlo. */
  foto?: (n: number) => HTMLImageElement | null | undefined;
}

export function rotacion(raiz: HTMLElement, o: OpcionesRotacion) {
  const reducido = matchMedia('(prefers-reduced-motion: reduce)');
  const boton = raiz.querySelector<HTMLButtonElement>('[data-rota-pausa]');
  const texto = raiz.querySelector<HTMLElement>('[data-rota-pausa-texto]');
  const barra = raiz.querySelector<HTMLElement>('[data-rota-reloj]');
  const progreso = raiz.querySelector<HTMLElement>('[data-rota-progreso]');
  if (o.total < 2 || !barra || !('animate' in Element.prototype)) return { ir: (_: number) => {} };
  let actual = 0, bolsa: number[] = [];
  const siguiente = () => {
    if (!o.aleatorio) return (actual + 1) % o.total;
    if (!bolsa.length) {
      bolsa = [...Array(o.total).keys()].filter(i => i !== actual);
      for (let i = bolsa.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bolsa[i], bolsa[j]] = [bolsa[j]!, bolsa[i]!]; }
    }
    return bolsa.shift()!;
  };
  const ir = async (n: number) => {
    if (n === actual) return;
    const img = o.foto?.(n);
    if (img) { img.loading = 'eager'; try { await img.decode(); } catch { /* se pinta igual */ } }
    actual = n;
    await o.pintar(n);
    const prox = o.aleatorio ? bolsa[0] : (n + 1) % o.total;
    const sig = prox === undefined ? null : o.foto?.(prox);
    if (sig) sig.loading = 'eager';
  };
  let enVista = true, cursor = false, foco = false, manual = false, ocupado = false;
  let anim: Animation | null = null;
  const corriendo = () => enVista && !cursor && !foco && !manual && !document.hidden && !reducido.matches;
  const actualizar = () => {
    if (corriendo() && !ocupado) {
      anim ??= (() => {
        const a = barra.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: o.intervalo, easing: 'linear', fill: 'both' });
        a.onfinish = async () => { ocupado = true; await ir(siguiente()); ocupado = false; a.currentTime = 0; actualizar(); };
        return a;
      })();
      anim.play();
    } else anim?.pause();
  };
  raiz.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { cursor = true; actualizar(); } });
  raiz.addEventListener('pointerleave', () => { cursor = false; actualizar(); });
  raiz.addEventListener('focusin', () => { foco = true; actualizar(); });
  raiz.addEventListener('focusout', e => { if (!raiz.contains(e.relatedTarget as Node)) { foco = false; actualizar(); } });
  document.addEventListener('visibilitychange', actualizar);
  reducido.addEventListener('change', actualizar);
  new IntersectionObserver(([e]) => { enVista = !!e?.isIntersecting; actualizar(); }, { threshold: 0.25 }).observe(raiz);
  boton?.addEventListener('click', () => {
    manual = !manual;
    boton.setAttribute('aria-pressed', String(manual));
    if (texto) texto.textContent = manual ? 'Seguir con los cursos que cambian' : 'Pausar los cursos que cambian';
    actualizar();
  });
  const empezar = () => { raiz.setAttribute('data-rotando', ''); if (boton) boton.hidden = false; if (progreso) progreso.hidden = false; actualizar(); };
  if (document.readyState === 'complete') empezar(); else addEventListener('load', empezar, { once: true });
  /* `ir` también lo usan el cursor y el foco sobre una celda (vitrina): manda el usuario. */
  return { ir: (n: number) => { if (anim) anim.currentTime = 0; void ir(n); } };
}
