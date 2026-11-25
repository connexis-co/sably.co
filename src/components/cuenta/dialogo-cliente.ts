/**
 * Ventana emergente de acceso: intercepta los enlaces `[data-cuenta-abrir]` y carga el formulario de
 * /ingresar/ (`X-Account-Form: 1`) dentro del `<dialog>`. Si algo falla, sigue el enlace a la página.
 */
export function prepararDialogo(): void {
  const dialogo = document.querySelector<HTMLDialogElement>('#v2-cuenta-dialogo');
  const cuerpo = dialogo?.querySelector<HTMLElement>('[data-cuenta-dialogo-cuerpo]');
  if (!dialogo || !cuerpo || typeof dialogo.showModal !== 'function') return;
  const vacio = cuerpo.innerHTML;
  let origen: HTMLElement | null = null;

  dialogo.querySelector('[data-cuenta-cerrar]')?.addEventListener('click', () => dialogo.close());
  // Clic en el fondo (fuera de la caja) cierra.
  dialogo.addEventListener('click', e => { if (e.target === dialogo) dialogo.close(); });
  dialogo.addEventListener('close', () => { cuerpo.innerHTML = vacio; origen?.focus(); });

  document.addEventListener('click', async e => {
    const enlace = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[data-cuenta-abrir]');
    if (!enlace || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    origen = enlace;
    // Si viene del menú móvil (popover), se cierra antes de abrir la ventana.
    enlace.closest<HTMLElement>('[popover]')?.hidePopover?.();
    dialogo.showModal();
    try {
      const r = await fetch(enlace.href, { credentials: 'same-origin', headers: { 'X-Account-Form': '1', Accept: 'text/html' } });
      if (!r.ok) throw new Error(String(r.status));
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const formulario = doc.querySelector('[data-cuenta-formulario]');
      // Con sesión ya abierta, /ingresar/ redirige: se va a su destino como haría la página.
      if (!formulario) { location.href = r.url; return; }
      cuerpo.replaceChildren(document.importNode(formulario, true));
      const pais = cuerpo.querySelector<HTMLInputElement>('[data-cuenta-pais]');
      try { const p = localStorage.getItem('sably:country'); if (pais && p && /^[a-z]{2}$/.test(p)) pais.value = p; } catch { /* sin almacenamiento */ }
      cuerpo.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
    } catch {
      location.href = enlace.href;
    }
  });
}
