/**
 * Portada del blog V2 (~1,5 KB + buscador): todo es mejora sobre enlaces y formularios reales.
 *  - Filtros: el enlace ?categoria= se pide en segundo plano y la zona de resultados se cambia con View Transition
 *    (240 ms, tarjetas con opacidad + 8 px); la URL se actualiza con replaceState. Sin JS, navega normal.
 *  - «Ver más»: añade las tarjetas de ?pagina=N+1 y lleva el foco a la primera nueva. Opción «cargar al llegar al
 *    final» (nunca con movimiento reducido).
 *  - Buscador: combobox ARIA 1.2 con guías, categorías y cursos (índice /blog/indice.json pedido al primer foco).
 */
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: Document | Element = document) => r.querySelector<T>(s);
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: Document | Element = document) => [...r.querySelectorAll<T>(s)];
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Cambia el DOM dentro de una View Transition (si existe y no hay movimiento reducido); resuelve con el DOM nuevo. */
const transicion = (fn: () => void): Promise<unknown> => {
  const d = document as Document & { startViewTransition?: (f: () => void) => { updateCallbackDone: Promise<unknown> } };
  if (d.startViewTransition && !reducido()) return d.startViewTransition(fn).updateCallbackDone;
  fn();
  return Promise.resolve();
};
const pedir = async (url: string) => new DOMParser().parseFromString(await (await fetch(url, { headers: { accept: 'text/html' } })).text(), 'text/html');
const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

async function filtrar(url: string, filtro: string | null) {
  const zona = $('[data-blog-resultados]');
  if (!zona) return void location.assign(url);
  try {
    const doc = await pedir(url);
    const nueva = $('[data-blog-resultados]', doc);
    if (!nueva) return void location.assign(url);
    await transicion(() => { zona.innerHTML = nueva.innerHTML; preparar(); });
    history.replaceState(null, '', url);
    if (filtro !== null) $<HTMLElement>(`[data-filtro="${filtro}"]`)?.focus({ preventScroll: true });
  } catch { location.assign(url); }
}

async function verMas(boton: HTMLAnchorElement) {
  const rejilla = $('[data-blog-rejilla]');
  if (!rejilla || boton.dataset.cargando) return;
  boton.dataset.cargando = '1';
  try {
    const doc = await pedir(boton.href);
    const nuevas = $$('[data-blog-rejilla] > li:not([data-banda])', doc);
    const bloque = $('[data-ver-mas]', doc);
    await transicion(() => {
      nuevas.forEach(n => rejilla.appendChild(n));
      const actual = $('[data-ver-mas]');
      if (actual && bloque) actual.replaceWith(bloque); else actual?.remove();
      prepararVerMas();
    });
    history.replaceState(null, '', boton.href);
    $<HTMLAnchorElement>('a', nuevas[0] ?? document.body)?.focus();
  } catch { location.assign(boton.href); }
}

function preparar() {
  for (const a of $$<HTMLAnchorElement>('[data-filtro]')) {
    a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      void filtrar(a.href, a.dataset.filtro ?? '');
    });
  }
  $('[data-filtro-select]')?.addEventListener('change', e => {
    const v = (e.target as unknown as { value: string }).value;
    void filtrar(v ? `/blog/?categoria=${encodeURIComponent(v)}` : '/blog/', null);
  });
  prepararVerMas();
}

function prepararVerMas() {
  const boton = $<HTMLAnchorElement>('[data-ver-mas-boton]');
  if (boton) {
    boton.addEventListener('click', e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); void verMas(boton); });
    const bloque = $('[data-ver-mas]');
    if (bloque?.hasAttribute('data-auto') && !reducido()) {
      const io = new IntersectionObserver(([en]) => { if (en?.isIntersecting) { io.disconnect(); void verMas(boton); } }, { rootMargin: '600px 0px' });
      io.observe(bloque);
    }
  }
}

/* ---------- Buscador con sugerencias ---------- */
type Indice = { articulos: { t: string; u: string; c: string; k: string }[]; categorias: { n: string; u: string; k: number }[]; cursos: { t: string; u: string; p: string }[] };
function buscador() {
  const campo = $<HTMLInputElement>('[data-bb-campo]');
  const lista = $('[data-bb-lista]');
  const estado = $('[data-bb-estado]');
  if (!campo || !lista) return;
  let indice: Promise<Indice> | null = null;
  let opciones: HTMLElement[] = [];
  let activa = -1;
  const cargar = () => (indice ??= fetch('/blog/indice.json').then(r => r.json() as Promise<Indice>).catch(() => ({ articulos: [], categorias: [], cursos: [] })));
  const cerrar = () => { lista.hidden = true; campo.setAttribute('aria-expanded', 'false'); campo.removeAttribute('aria-activedescendant'); activa = -1; };
  const marcar = (texto: string, q: string) => {
    const i = normalizar(texto).indexOf(normalizar(q));
    const span = document.createElement('span');
    if (i < 0 || !q) { span.textContent = texto; return span; }
    const m = document.createElement('mark');
    m.textContent = texto.slice(i, i + q.length);
    span.appendChild(document.createTextNode(texto.slice(0, i))); span.appendChild(m); span.appendChild(document.createTextNode(texto.slice(i + q.length)));
    return span;
  };
  const mover = (n: number) => {
    if (!opciones.length) return;
    activa = (n + opciones.length) % opciones.length;
    opciones.forEach((o, i) => o.setAttribute('aria-selected', String(i === activa)));
    campo.setAttribute('aria-activedescendant', opciones[activa]!.id);
    opciones[activa]!.scrollIntoView({ block: 'nearest' });
  };
  const pintar = async () => {
    const q = campo.value.trim();
    if (q.length < 2) return cerrar();
    const d = await cargar();
    const p = normalizar(q).split(/\s+/);
    const vale = (s: string) => p.every(w => normalizar(s).includes(w));
    const grupos: [string, { t: string; u: string; x?: string }[]][] = [
      ['Guías', d.articulos.filter(a => vale(`${a.t} ${a.c} ${a.k}`)).slice(0, 5).map(a => ({ t: a.t, u: a.u, x: a.c }))],
      ['Categorías', d.categorias.filter(c => vale(c.n)).slice(0, 3).map(c => ({ t: c.n, u: c.u, x: `${c.k} ${c.k === 1 ? 'guía' : 'guías'}` }))],
      ['Cursos', d.cursos.filter(c => vale(c.t)).slice(0, 3).map(c => ({ t: c.t, u: c.u, x: c.p }))],
    ];
    lista.replaceChildren();
    opciones = [];
    let n = 0;
    for (const [nombre, items] of grupos) {
      if (!items.length) continue;
      const g = document.createElement('div');
      g.setAttribute('role', 'group');
      const r = document.createElement('p');
      r.className = 'v2-bb-grupo'; r.textContent = nombre; r.id = `bb-g-${nombre}`;
      g.setAttribute('aria-labelledby', r.id);
      g.appendChild(r);
      for (const it of items) {
        const o = document.createElement('div');
        o.className = 'v2-bb-op'; o.id = `bb-op-${n++}`; o.setAttribute('role', 'option'); o.setAttribute('aria-selected', 'false'); o.dataset.url = it.u;
        o.appendChild(marcar(it.t, q));
        if (it.x) { const s = document.createElement('small'); s.textContent = it.x; o.appendChild(s); }
        o.addEventListener('mousedown', e => { e.preventDefault(); location.assign(it.u); });
        g.appendChild(o); opciones.push(o);
      }
      lista.appendChild(g);
    }
    if (!opciones.length) {
      const v = document.createElement('p');
      v.className = 'v2-bb-vacio'; v.textContent = `No hay guías con «${q}». Prueba con el nombre del oficio.`;
      lista.appendChild(v);
    }
    lista.hidden = false;
    campo.setAttribute('aria-expanded', 'true');
    activa = -1;
    if (estado) estado.textContent = opciones.length ? `${opciones.length} sugerencias` : 'Sin sugerencias';
  };
  let espera: ReturnType<typeof setTimeout>;
  campo.addEventListener('focus', () => void cargar(), { once: true });
  campo.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => void pintar(), 120); });
  campo.addEventListener('blur', () => setTimeout(cerrar, 120));
  campo.addEventListener('keydown', e => {
    const abierta = !lista.hidden;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!abierta) void pintar(); else mover(activa + 1); }
    else if (e.key === 'ArrowUp' && abierta) { e.preventDefault(); mover(activa - 1); }
    else if (e.key === 'Home' && abierta && activa >= 0) { e.preventDefault(); mover(0); }
    else if (e.key === 'End' && abierta && activa >= 0) { e.preventDefault(); mover(opciones.length - 1); }
    else if (e.key === 'Escape') { if (abierta) { e.preventDefault(); cerrar(); } else campo.value = ''; }
    else if (e.key === 'Enter' && abierta && activa >= 0) { e.preventDefault(); location.assign(opciones[activa]!.dataset.url!); }
  });
  document.addEventListener('keydown', e => {
    const t = e.target as HTMLElement;
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !t.closest('input, textarea, select, [contenteditable]')) { e.preventDefault(); campo.focus(); }
  });
}

export function prepararPortada() {
  preparar();
  buscador();
}
