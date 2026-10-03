/**
 * Lógica del hilo de comentarios. Se carga bajo demanda desde
 * `Comentarios.astro` cuando la sección se acerca al viewport.
 *
 * Regla que atraviesa el archivo: el nombre y el cuerpo de un comentario los
 * escribe un desconocido, así que **nunca** se asignan con `innerHTML`. El DOM
 * sale de clonar el `<template>` y rellenar con `textContent`, que trata todo
 * como texto por definición. Así la seguridad no depende de acordarse de
 * escapar en cada punto.
 */
import { visitanteId } from './visitante';
import { trackEvent } from './analytics';

interface Comentario {
  id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  country: string | null;
  created_at: number;
  utiles: number;
  respuestas?: Comentario[];
}

const VOTADOS = 'sably:comentarios-votados';

const fecha = (epoch: number): string =>
  new Date(epoch * 1000).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/** Qué comentarios ha marcado como útiles este navegador. */
function leerVotados(): Record<string, 1 | -1> {
  try {
    return JSON.parse(localStorage.getItem(VOTADOS) ?? '{}') as Record<string, 1 | -1>;
  } catch {
    return {};
  }
}

function guardarVotados(v: Record<string, 1 | -1>): void {
  try {
    localStorage.setItem(VOTADOS, JSON.stringify(v));
  } catch {
    /* sin almacenamiento el voto se envía igual; solo se pierde el resaltado */
  }
}

export function montarComentarios(seccion: HTMLElement): void {
  if (seccion.dataset.mounted) return;
  const subject = seccion.dataset.subject ?? '';
  const lista = seccion.querySelector<HTMLOListElement>('[data-lista]');
  const estado = seccion.querySelector<HTMLElement>('[data-estado]');
  const total = seccion.querySelector<HTMLElement>('[data-total]');
  const plantilla = seccion.querySelector<HTMLTemplateElement>('[data-plantilla]');
  const form = seccion.querySelector<HTMLFormElement>('[data-form]');
  if (!subject || !lista || !estado || !plantilla || !form) return;

  seccion.dataset.mounted = 'true';
  const abiertoEn = Date.now();
  let votados = leerVotados();

  // ---------------------------------------------------------------- pintar

  function nodo(c: Comentario, esRespuesta: boolean): HTMLElement {
    const frag = plantilla!.content.cloneNode(true) as DocumentFragment;
    const li = frag.querySelector('li')!;

    li.querySelector<HTMLElement>('[data-autor]')!.textContent = c.author_name;
    const t = li.querySelector<HTMLTimeElement>('[data-fecha]')!;
    t.textContent = fecha(c.created_at);
    t.dateTime = new Date(c.created_at * 1000).toISOString();
    li.querySelector<HTMLElement>('[data-cuerpo]')!.textContent = c.body;

    const botonUtil = li.querySelector<HTMLButtonElement>('[data-util]')!;
    const contador = li.querySelector<HTMLElement>('[data-utiles]')!;
    contador.textContent = c.utiles > 0 ? String(c.utiles) : '';
    if (votados[c.id] === 1) botonUtil.setAttribute('aria-pressed', 'true');
    botonUtil.addEventListener('click', () => votarUtil(c, botonUtil, contador));

    const responder = li.querySelector<HTMLButtonElement>('[data-responder]')!;
    if (esRespuesta) {
      // Un solo nivel: el backend lo impone con un trigger, y aquí ni se ofrece.
      responder.remove();
      li.classList.remove('rounded-xl', 'border', 'border-surface-200', 'p-5');
      li.classList.add('pb-1');
      li.querySelector<HTMLElement>('[data-respuestas]')!.remove();
    } else {
      responder.setAttribute('aria-label', `Responder a ${c.author_name}`);
      responder.addEventListener('click', () => activarRespuesta(c));
      const hijas = li.querySelector<HTMLOListElement>('[data-respuestas]')!;
      const respuestas = c.respuestas ?? [];
      if (!respuestas.length) hijas.remove();
      else for (const r of respuestas) hijas.appendChild(nodo(r, true));
    }
    return li;
  }

  function pintar(comentarios: Comentario[], cuantos: number): void {
    lista!.replaceChildren();
    for (const c of comentarios) lista!.appendChild(nodo(c, false));
    total!.textContent = cuantos ? `(${cuantos})` : '';
    estado!.textContent = comentarios.length
      ? ''
      : 'Todavía no hay comentarios. Sé la primera persona en escribir.';
    estado!.hidden = comentarios.length > 0;
  }

  // ----------------------------------------------------------------- votar

  async function votarUtil(c: Comentario, boton: HTMLButtonElement, contador: HTMLElement): Promise<void> {
    if (boton.disabled) return;
    boton.disabled = true;
    const activo = boton.getAttribute('aria-pressed') === 'true';
    const value = activo ? 0 : 1;
    const previo = contador.textContent;

    // Optimista: se pinta ya y se revierte si el servidor dice que no.
    boton.setAttribute('aria-pressed', String(!activo));
    const n = Number(previo || 0) + (activo ? -1 : 1);
    contador.textContent = n > 0 ? String(n) : '';

    try {
      const r = await fetch('/api/v1/comentario-voto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comment_id: c.id, visitor_id: visitanteId(), value }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { utiles: number };
      contador.textContent = d.utiles > 0 ? String(d.utiles) : '';
      if (value === 0) delete votados[c.id];
      else votados[c.id] = 1;
      guardarVotados(votados);
      trackEvent('vote_comment', { subject, value });
    } catch {
      boton.setAttribute('aria-pressed', String(activo));
      contador.textContent = previo;
    } finally { boton.disabled = false; }
  }

  // -------------------------------------------------------------- responder

  const campoPadre = form.querySelector<HTMLInputElement>('[name="parent_id"]')!;
  const cancelar = form.querySelector<HTMLButtonElement>('[data-cancelar-respuesta]')!;
  const tituloForm = form.querySelector('h3')!;
  const tituloOriginal = tituloForm.textContent ?? '';

  function activarRespuesta(c: Comentario): void {
    campoPadre.value = c.id;
    tituloForm.textContent = `Responder a ${c.author_name}`;
    cancelar.classList.remove('hidden');
    form!.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    form!.querySelector<HTMLTextAreaElement>('[name="body"]')?.focus();
  }

  cancelar.addEventListener('click', () => {
    campoPadre.value = '';
    tituloForm.textContent = tituloOriginal;
    cancelar.classList.add('hidden');
  });

  // ----------------------------------------------------------------- enviar

  const aviso = form.querySelector<HTMLElement>('[data-aviso]')!;
  const enviar = form.querySelector<HTMLButtonElement>('[data-enviar]')!;

  const mostrarError = (campo: string, texto: string): void => {
    const el = form.querySelector<HTMLElement>(`[data-err="${campo}"]`);
    if (!el) return;
    el.textContent = texto;
    el.classList.toggle('hidden', !texto);
    form.querySelector(`[name="${campo}"]`)?.setAttribute('aria-invalid',String(Boolean(texto)));
  };

  const bodyField = form.querySelector<HTMLTextAreaElement>('[name="body"]')!;
  const counter = form.querySelector<HTMLElement>('[data-counter]');
  const updateCounter = () => { if (counter) counter.textContent = `${bodyField.value.length} / 1200 caracteres`; };
  bodyField.addEventListener('input',updateCounter);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    for (const c of ['author_name', 'author_email', 'body', 'consent']) mostrarError(c, '');
    aviso.textContent = '';

    const datos = new FormData(form);
    const nombre = String(datos.get('author_name') ?? '').trim();
    const texto = String(datos.get('body') ?? '').trim();
    const correo = String(datos.get('author_email') ?? '').trim();

    const fallos: string[] = [];
    const fallar = (campo: string, msg: string): void => {
      mostrarError(campo, msg);
      fallos.push(campo);
    };
    if (nombre.length < 2) fallar('author_name', 'Escribe tu nombre (mínimo 2 caracteres).');
    if (texto.length < 10) fallar('body', 'El comentario debe tener al menos 10 caracteres.');
    if (texto.length > 1200) fallar('body', 'El comentario no puede pasar de 1200 caracteres.');
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
      fallar('author_email', 'Ese correo no parece válido.');
    }
    if (!datos.get('consent')) fallar('consent', 'Necesitamos tu autorización para publicarlo.');
    if (fallos.length) {
      form.querySelector<HTMLElement>(`[name="${fallos[0]}"]`)?.focus();
      return;
    }

    enviar.disabled = true;
    aviso.textContent = 'Enviando…';
    aviso.className = 'text-sm text-muted';

    try {
      const r = await fetch('/api/v1/comentarios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject,
          author_name: nombre,
          author_email: correo || undefined,
          body: texto,
          parent_id: campoPadre.value || undefined,
          // El mismo literal que se le mostró, que es lo que exige la ley.
          consent_text: form.querySelector('[data-consent-text]')?.textContent?.trim(),
          trampa: String(datos.get('trampa') ?? ''),
          abierto_ms: Date.now() - abiertoEn,
        }),
        signal: AbortSignal.timeout(12000),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || 'no se pudo enviar');

      form.reset();
      updateCounter();
      cancelar.click();
      // Honesto: nace en 'pending' y sin aprobación no aparece en ningún sitio.
      aviso.textContent = 'Recibido. Lo revisamos antes de publicarlo.';
      aviso.className = 'text-sm font-semibold text-success';
      trackEvent('submit_comment', { subject });
    } catch (err) {
      aviso.textContent =
        err instanceof DOMException && err.name === 'TimeoutError'
          ? 'La conexión tardó demasiado. Inténtalo otra vez.'
          : (err as Error).message;
      aviso.className = 'text-sm font-semibold text-error';
    } finally {
      enviar.disabled = false;
    }
  });

  const fields = form.querySelector<HTMLFieldSetElement>('[data-fields]');
  if (fields) fields.disabled = false;

  // ----------------------------------------------------------------- cargar

  void (async () => {
    try {
      const r = await fetch(`/api/v1/comentarios?subject=${encodeURIComponent(subject)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { comentarios: Comentario[]; total: number };
      votados = leerVotados();
      pintar(d.comentarios ?? [], d.total ?? 0);
    } catch {
      estado.hidden = false;
      estado.textContent = 'No pudimos cargar los comentarios. Recarga la página para reintentar.';
      estado.className = 'mt-4 text-sm text-error';
    }
  })();
}
