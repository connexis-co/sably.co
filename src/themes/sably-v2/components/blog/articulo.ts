/**
 * Comportamiento del artículo V2, sin dependencias (~2 KB comprimido). Todo es mejora: sin JS el texto, el índice
 * (enlaces), compartir (enlaces) y el reproductor nativo siguen funcionando.
 *  - Progreso: si el navegador no tiene `animation-timeline: view()`, escribe --avance en la barra; además pone el
 *    porcentaje leído en el índice lateral. Un solo listener de scroll pasivo con requestAnimationFrame.
 *  - Índice: apartado activo = último encabezado que cruzó el 24 % superior de la ventana (aria-current="location"),
 *    indicador coral que se desliza, línea de progreso vertical en el lateral, píldora «Índice · 2 de 4» y hoja
 *    <dialog> en móvil, o barra superior con el apartado actual que despliega la lista.
 *  - Compartir: copiar enlace con aviso en role="status"; «Compartir» del sistema solo con puntero táctil.
 *  - Ancla «#» junto a cada apartado, ayuda «Desliza…» en tablas que desbordan, «Escuchar» que lleva al reproductor.
 *  - Narración fija: mientras suena y el reproductor salió por arriba, queda abajo (barra en móvil, píldora en
 *    escritorio); en móvil escribe --fijo-inferior para que lo demás suba con ella.
 */
const $ = <T extends Element = HTMLElement>(s: string, r: Document | HTMLElement = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: Document | HTMLElement = document) => [...r.querySelectorAll<T>(s)];

function medirAlQuieto(fn: () => void) {
  let pendiente = false;
  const tick = () => { pendiente = false; fn(); };
  addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(tick); } }, { passive: true });
  addEventListener('resize', () => requestAnimationFrame(fn), { passive: true });
  fn();
}

function avisar(texto: string) {
  const aviso = $('[data-aviso]');
  if (!aviso) return;
  aviso.textContent = texto;
  aviso.toggleAttribute('data-visible', true);
  clearTimeout(Number(aviso.dataset.t));
  aviso.dataset.t = String(setTimeout(() => aviso.removeAttribute('data-visible'), 2000));
}

function medir(metodo: string) {
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer?.push({ event: 'share', method: metodo, content_type: 'article', item_id: location.pathname });
}

export function prepararArticulo() {
  const lectura = $('.v2-ba-lectura');
  const barra = $('[data-progreso]');
  const porcentaje = $('[data-porcentaje]');
  const progresoIndice = $('[data-progreso-indice]');
  const sinLinea = !CSS.supports('animation-timeline: view()') && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Progreso y porcentaje ---------- */
  if (lectura && (barra || porcentaje || progresoIndice)) {
    medirAlQuieto(() => {
      const r = lectura.getBoundingClientRect();
      const total = r.height - innerHeight;
      const v = Math.min(1, Math.max(0, -r.top / (total > 0 ? total : 1)));
      if (barra && sinLinea) barra.style.setProperty('--avance', v.toFixed(4));
      if (porcentaje) porcentaje.textContent = `${Math.round(v * 100)} %`;
      progresoIndice?.style.setProperty('--avance-indice', v.toFixed(4));
    });
  }

  /* ---------- Apartado activo ---------- */
  const enlaces = $$<HTMLAnchorElement>('[data-indice-enlace]');
  const ids = [...new Set(enlaces.map(a => a.dataset.indiceEnlace!))];
  const encabezados = ids.map(id => document.getElementById(id)).filter((h): h is HTMLElement => !!h);
  const lateral = $('[data-indice-lateral]');
  const indicador = $('[data-indicador]');
  const pildoraTexto = $('[data-pildora-texto]');
  const barraTexto = $('[data-barra-texto]');
  const barraN = $('[data-barra-n]');
  const principales = encabezados.filter(h => h.tagName === 'H2');
  let activo = '';
  const marcar = (id: string) => {
    if (id === activo) return;
    activo = id;
    for (const a of enlaces) if (a.dataset.indiceEnlace === id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    const enLateral = lateral && enlaces.find(a => a.dataset.indiceEnlace === id && lateral.contains(a));
    if (indicador && enLateral) {
      indicador.style.setProperty('--y', `${enLateral.offsetTop}px`);
      indicador.style.setProperty('--alto', `${enLateral.offsetHeight}px`);
      lateral!.toggleAttribute('data-activo', true);
      // Si el índice es más alto que su caja, el activo se queda a la vista (sin mover la página).
      const caja = lateral!.closest<HTMLElement>('.v2-ba-pegado');
      if (caja && caja.scrollHeight > caja.clientHeight) caja.scrollTo({ top: enLateral.offsetTop - caja.clientHeight / 3 });
    }
    if ((pildoraTexto || barraTexto) && principales.length) {
      const n = Math.max(1, principales.filter(h => h.getBoundingClientRect().top < innerHeight * 0.24).length);
      if (pildoraTexto) pildoraTexto.textContent = `Índice · ${n} de ${principales.length}`;
      if (barraTexto) barraTexto.textContent = principales[n - 1]!.textContent?.replace(/#$/, '').trim() ?? '';
      if (barraN) barraN.textContent = `${n}/${principales.length}`;
    }
  };
  if (encabezados.length) {
    const recalcular = () => {
      const pasados = encabezados.filter(h => h.getBoundingClientRect().top < innerHeight * 0.24);
      if (pasados.length) marcar(pasados.at(-1)!.id);
      else { activo = ''; for (const a of enlaces) a.removeAttribute('aria-current'); lateral?.removeAttribute('data-activo'); }
    };
    const io = new IntersectionObserver(recalcular, { rootMargin: '0px 0px -76% 0px' });
    encabezados.forEach(h => io.observe(h));
    // Un salto (ancla, «Volver arriba», teclado Inicio/Fin) no cruza la línea fotograma a fotograma y el observador no avisa.
    addEventListener('scrollend', recalcular, { passive: true });
    recalcular();
  }

  /* ---------- Píldora y hoja del índice (móvil) ---------- */
  const pildora = $<HTMLButtonElement>('[data-indice-pildora]');
  const hoja = $<HTMLDialogElement>('[data-indice-hoja]');
  const inicio = $('[data-indice-inicio]');
  if (pildora && hoja) {
    let fuera = false, escribiendo = false;
    const pintar = () => pildora.toggleAttribute('data-visible', fuera && !escribiendo);
    if (inicio) new IntersectionObserver(([e]) => { fuera = !e!.isIntersecting && e!.boundingClientRect.top < 0; pintar(); }).observe(inicio);
    // Se oculta mientras se escribe un comentario (teclado abierto).
    document.addEventListener('focusin', e => { escribiendo = (e.target as Element).matches('textarea, input:not([type=checkbox]):not([type=radio])'); pintar(); });
    document.addEventListener('focusout', () => { escribiendo = false; pintar(); });
    pildora.addEventListener('click', () => hoja.showModal());
    $('[data-cerrar-hoja]', hoja)?.addEventListener('click', () => hoja.close());
    hoja.addEventListener('click', e => { if (e.target === hoja || (e.target as Element).closest('a')) hoja.close(); });
  }

  /* ---------- Barra superior del índice (móvil) ---------- */
  const franja = $('[data-indice-barra]');
  const boton = franja && $<HTMLButtonElement>('[data-indice-barra-boton]', franja);
  const lista = franja && $('[data-indice-barra-lista]', franja);
  if (franja && boton && lista && inicio) {
    let pasado = false, subiendo = false, escribiendo = false, ultimoY = scrollY;
    const abierta = () => boton.getAttribute('aria-expanded') === 'true';
    const abrir = (si: boolean) => { boton.setAttribute('aria-expanded', String(si)); lista.hidden = !si; };
    const pintar = () => {
      const visible = pasado && (!subiendo || abierta()) && !escribiendo;
      if (!visible && abierta()) abrir(false);
      franja.toggleAttribute('data-visible', visible);
      franja.inert = !visible;
    };
    // Pasado = el índice del inicio quedó por encima de la ventana. Se mide al desplazar (no con un observador: un
    // salto de ancla lo deja atrás sin «cruzarlo»). Se esconde al subir, con 8 px de margen contra el temblor del dedo.
    const medir = () => {
      const y = scrollY, d = y - ultimoY;
      const ahora = inicio.getBoundingClientRect().bottom < 0;
      const cambio = ahora !== pasado || (Math.abs(d) >= 8 && subiendo !== d < 0);
      if (Math.abs(d) >= 8) { subiendo = d < 0; ultimoY = y; }
      pasado = ahora;
      if (cambio) pintar();
    };
    medirAlQuieto(medir);
    addEventListener('scrollend', medir, { passive: true });
    document.addEventListener('focusin', e => { escribiendo = (e.target as Element).matches('textarea, input:not([type=checkbox]):not([type=radio])'); pintar(); });
    document.addEventListener('focusout', () => { escribiendo = false; pintar(); });
    boton.addEventListener('click', () => abrir(!abierta()));
    lista.addEventListener('click', e => { if ((e.target as Element).closest('a')) { abrir(false); subiendo = false; } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && abierta()) { abrir(false); boton.focus(); } });
    document.addEventListener('click', e => { if (abierta() && !franja.contains(e.target as Node)) abrir(false); });
  }

  /* ---------- Compartir ---------- */
  for (const b of $$<HTMLButtonElement>('[data-copiar-enlace]')) {
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copiarEnlace!); avisar('Enlace copiado'); medir('copiar'); }
      catch { avisar('No se pudo copiar: mantén pulsado el enlace'); }
    });
  }
  for (const a of $$<HTMLAnchorElement>('.v2-compartir a[data-red]')) a.addEventListener('click', () => medir(a.dataset.red!));
  if ('share' in navigator && matchMedia('(pointer: coarse)').matches) {
    for (const b of $$<HTMLButtonElement>('[data-compartir-nativo]')) {
      b.hidden = false;
      b.addEventListener('click', () => {
        const nav = b.closest<HTMLElement>('[data-compartir]')!;
        navigator.share({ title: document.title, url: nav.dataset.compartir }).then(() => medir('sistema')).catch(() => {});
      });
    }
  }

  /* ---------- Anclas «#», tablas y «Escuchar» ---------- */
  for (const h of $$('[data-prosa] :is(h2, h3)[id]')) {
    const a = document.createElement('a');
    a.className = 'v2-ancla'; a.href = `#${h.id}`; a.textContent = '#';
    a.setAttribute('aria-label', `Enlace a «${h.textContent?.trim()}»`);
    a.addEventListener('click', () => { navigator.clipboard?.writeText(a.href).then(() => avisar('Enlace a la sección copiado'), () => {}); });
    h.insertAdjacentElement('beforeend', a);
  }
  for (const t of $$('[data-prosa] .v2-tabla')) {
    if (t.scrollWidth <= t.clientWidth + 1) continue;
    t.toggleAttribute('data-desborda', true);
    const ayuda = document.createElement('p');
    ayuda.className = 'v2-tabla-ayuda'; ayuda.textContent = '↔ Desliza para ver toda la tabla';
    t.insertAdjacentElement('afterend', ayuda);
  }
  $('[data-escuchar]')?.addEventListener('click', () => {
    const boton = $<HTMLButtonElement>('#narracion [data-medio-alternar]');
    const audio = $<HTMLAudioElement>('#narracion audio');
    setTimeout(() => { if (boton && !boton.closest('[hidden]')) boton.click(); else audio?.play().catch(() => {}); }, 50);
  });

  /* ---------- Narración fija al bajar ---------- */
  const caja = $('[data-narracion-fija]');
  const audio = caja && $<HTMLAudioElement>('audio', caja);
  if (caja && audio) {
    let fuera = false, cerrado = false;
    const reproductor = caja.firstElementChild as HTMLElement;
    const pintar = () => {
      const fija = fuera && !audio.paused && !cerrado;
      if (fija && !caja.hasAttribute('data-fija')) caja.style.setProperty('--alto-narracion', `${caja.offsetHeight}px`);
      caja.toggleAttribute('data-fija', fija);
      const movil = matchMedia('(width < 768px)').matches;
      document.documentElement.style.setProperty('--fijo-inferior', fija && movil ? `${reproductor.offsetHeight}px` : '0px');
    };
    new IntersectionObserver(([e]) => { fuera = !e!.isIntersecting && e!.boundingClientRect.top < 0; pintar(); }).observe(caja);
    audio.addEventListener('play', () => { cerrado = false; pintar(); });
    audio.addEventListener('pause', pintar);
    audio.addEventListener('ended', pintar);
    $('[data-narracion-cerrar]', caja)?.addEventListener('click', () => { audio.pause(); cerrado = true; pintar(); });
  }

  /* ---------- «Seguir escuchando» en la página siguiente ---------- */
  // Solo se anota QUÉ narración quedó a medias; el punto lo guarda el controlador de medios en su propia clave
  // (sably:medio:<ruta del audio>) y lo borra al terminar. La píldora la pinta SeguirEscuchando.astro.
  const seguir = $('[data-seguir]');
  const audioSeguir = seguir && $<HTMLAudioElement>('audio', seguir);
  if (seguir && audioSeguir) {
    const anotar = () => {
      const src = new URL(audioSeguir.currentSrc || audioSeguir.src, location.href);
      const medio = $('[data-medio]', seguir);
      try {
        localStorage.setItem('sably:seguir', JSON.stringify({
          u: location.pathname, t: medio?.dataset.medioTitulo ?? document.title, a: src.href, s: src.pathname,
          d: Number.isFinite(audioSeguir.duration) ? Math.round(audioSeguir.duration) : Number($<HTMLInputElement>('[data-medio-barra]', seguir)?.max) || 0,
          h: Date.now(),
        }));
      } catch { /* sin almacenamiento */ }
    };
    audioSeguir.addEventListener('play', anotar);
    audioSeguir.addEventListener('pause', anotar);
  }
}
