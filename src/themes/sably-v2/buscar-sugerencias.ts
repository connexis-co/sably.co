/**
 * Sugerencias al escribir para los buscadores en una frase (héroe y cierre de la portada, I3): el mismo índice
 * (`/search-index.json`) y el mismo criterio que el buscador de la cabecera (Buscador.astro), en una lista
 * desplegable bajo el campo. Combobox ARIA con flechas, Enter y Escape; sin JavaScript, el formulario sigue
 * enviando a /xx/cursos/?q=…
 */
export type ItemIndice = { t: string; s: string; c: string; a?: string; k: string; i?: string; n?: string };
/** Áreas y guías que se suman a las sugerencias (título, enlace y tipo). */
export type ExtraBusqueda = { t: string; u: string; c: 'Área' | 'Guía' };

/** Puro: áreas y guías cuyo título contiene todos los términos (hasta `max` de cada tipo). */
export function buscarExtra(extra: readonly ExtraBusqueda[], bruto: string, max = 2): ExtraBusqueda[] {
  const q = normalizar(bruto.trim());
  if (q.length < 2) return [];
  const terminos = q.split(/\s+/);
  const vale = extra.filter(e => terminos.every(x => normalizar(e.t).includes(x)));
  return [...vale.filter(e => e.c === 'Área').slice(0, max), ...vale.filter(e => e.c === 'Guía').slice(0, max)];
}

export const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Puro: cursos que contienen todos los términos, primero los que los tienen en el título. */
export function buscarEnIndice(indice: readonly ItemIndice[], bruto: string): ItemIndice[] {
  const q = normalizar(bruto.trim());
  if (q.length < 2) return [];
  const terminos = q.split(/\s+/);
  return indice.map(it => {
    const t = normalizar(it.t), todo = normalizar(`${it.t} ${it.c} ${it.k}`);
    let p = 0;
    for (const x of terminos) { if (t.includes(x)) p += 3; else if (todo.includes(x)) p += 1; else return null; }
    return { it, p: p + (t.startsWith(q) ? 2 : 0) };
  }).filter((x): x is { it: ItemIndice; p: number } => !!x).sort((a, b) => b.p - a.p).map(x => x.it);
}

let indice: Promise<ItemIndice[]> | null = null;
const cargar = () => (indice ??= fetch('/search-index.json').then(r => r.json() as Promise<ItemIndice[]>).catch(() => []));
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

export function iniciarSugerencias(form: HTMLFormElement) {
  const campo = form.querySelector<HTMLInputElement>('input[name=q]');
  if (!campo || form.dataset.sugerencias) return;
  form.dataset.sugerencias = '1';
  const base = new URL(form.action, location.href).pathname.replace(/\/cursos\/?$/, '');
  let extra: ExtraBusqueda[] = [];
  try { extra = JSON.parse(form.dataset.extra || '[]'); } catch { /* sin extras */ }
  const id = `${campo.id}-sugerencias`;
  const panel = document.createElement('div');
  panel.className = 'v2-sugerencias';
  panel.hidden = true;
  panel.innerHTML = `<ul id="${id}" role="listbox" aria-label="Cursos sugeridos"></ul><a class="v2-sugerencias-todos" href="${base}/cursos/"></a><p class="sr-only" aria-live="polite"></p>`;
  form.insertAdjacentElement("beforeend", panel);
  const lista = panel.querySelector('ul')!, todos = panel.querySelector<HTMLAnchorElement>('a')!, vivo = panel.querySelector('p')!;
  campo.setAttribute('role', 'combobox');
  campo.setAttribute('aria-autocomplete', 'list');
  campo.setAttribute('aria-expanded', 'false');
  campo.setAttribute('aria-controls', id);
  let sel = -1;
  const opciones = () => [...lista.querySelectorAll<HTMLAnchorElement>('[role=option]')];
  const cerrar = () => { panel.hidden = true; campo.setAttribute('aria-expanded', 'false'); campo.removeAttribute('aria-activedescendant'); sel = -1; };
  const mover = (paso: number) => {
    const o = opciones(); if (!o.length) return;
    sel = (sel + paso + o.length) % o.length;
    o.forEach((a, i) => a.setAttribute('aria-selected', String(i === sel)));
    campo.setAttribute('aria-activedescendant', o[sel]!.id);
  };
  let turno = 0;
  const pintar = async () => {
    const mio = ++turno;
    const bruto = campo.value.trim();
    if (bruto.length < 2) { cerrar(); return; }
    const res = buscarEnIndice(await cargar(), bruto);
    if (mio !== turno) return;
    sel = -1;
    const otros = buscarExtra(extra, bruto);
    const areas = otros.filter(o => o.c === 'Área'), guias = otros.filter(o => o.c === 'Guía');
    const filaExtra = (o: ExtraBusqueda, i: number) => `<li><a role="option" id="${id}-x${i}" aria-selected="false" href="${esc(o.u)}"><span class="v2-sug-tipo">${o.c}</span><span><strong>${esc(o.t)}</strong></span></a></li>`;
    lista.innerHTML = areas.map(filaExtra).join('')
      + res.slice(0, 5).map((r, i) => `<li><a role="option" id="${id}-${i}" aria-selected="false" href="${base}/${r.s}/">${r.i ? `<img src="${esc(r.i)}" alt="" width="64" height="48" loading="lazy">` : ''}<span><strong>${esc(r.t)}</strong><small>${esc(r.c)}${r.n ? ` · ${esc(r.n)} en Hotmart` : ''}</small></span></a></li>`).join('')
      + guias.map((o, i) => filaExtra(o, 10 + i)).join('');
    todos.href = `${base}/cursos/?q=${encodeURIComponent(bruto)}`;
    todos.textContent = res.length ? `Ver los ${res.length} resultados de «${bruto}»` : `Buscar «${bruto}» en todos los cursos`;
    vivo.textContent = `${res.length === 1 ? '1 curso' : `${res.length} cursos`}${otros.length ? ` y ${otros.length} más` : ''} sugeridos`;
    panel.hidden = false;
    campo.setAttribute('aria-expanded', 'true');
  };
  let reloj: ReturnType<typeof setTimeout>;
  campo.addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(pintar, 120); });
  campo.addEventListener('focus', () => { void cargar(); if (campo.value.trim().length >= 2) void pintar(); });
  campo.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (panel.hidden) void pintar(); else mover(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
    else if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); cerrar(); }
    else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); opciones()[sel]!.click(); }
  });
  form.addEventListener('focusout', e => { if (!form.contains(e.relatedTarget as Node)) cerrar(); });
}
