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

  /** Pinta un fragmento de /ingresar/; false si la respuesta no lo trae (sesión abierta o error). */
  const pintar = async (r: Response): Promise<boolean> => {
    if (!r.ok) return false;
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const formulario = doc.querySelector('[data-cuenta-formulario]');
    if (!formulario) return false;
    cuerpo.replaceChildren(document.importNode(formulario, true));
    try { const p = localStorage.getItem('sably:country'); if (p && /^[a-z]{2}$/.test(p)) cuerpo.querySelectorAll<HTMLInputElement>('[data-cuenta-pais]').forEach(c => { c.value = p; }); } catch { /* sin almacenamiento */ }
    cuerpo.querySelector<HTMLElement>('#cuenta-codigo, #cuenta-correo, button[type="submit"]')?.focus();
    return true;
  };
  const pedir = (url: string, init: RequestInit = {}) =>
    fetch(url, { ...init, credentials: 'same-origin', headers: { 'X-Account-Form': '1', Accept: 'text/html', ...init.headers } });

  // Correo y código: se envían sin salir de la ventana (la respuesta redirige a /ingresar/ con el paso siguiente).
  // Al entrar, la redirección lleva a la página de origen: se recarga como haría la página /ingresar/.
  cuerpo.addEventListener('submit', async e => {
    const form = e.target as HTMLFormElement;
    if (!form.matches('[data-cuenta-paso]') || e.defaultPrevented) return;
    e.preventDefault();
    const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (boton) boton.disabled = true;
    try {
      const r = await pedir(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form) as unknown as Record<string, string>), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!(await pintar(r))) location.href = r.ok ? r.url : form.action;
    } catch {
      form.submit();
    }
  });
  // «Cambiar» y «Paso 2 de 2» vuelven al paso 1 dentro de la ventana.
  cuerpo.addEventListener('click', async e => {
    const atras = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[data-cuenta-paso-atras]');
    if (!atras) return;
    e.preventDefault();
    try { if (!(await pintar(await pedir(atras.href)))) location.href = atras.href; } catch { location.href = atras.href; }
  });

  document.addEventListener('click', async e => {
    const enlace = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[data-cuenta-abrir]');
    if (!enlace || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    origen = enlace;
    // Si viene del menú móvil (popover), se cierra antes de abrir la ventana.
    enlace.closest<HTMLElement>('[popover]')?.hidePopover?.();
    dialogo.showModal();
    try {
      const r = await pedir(enlace.href);
      // Con sesión ya abierta, /ingresar/ redirige: se va a su destino como haría la página.
      if (!(await pintar(r))) location.href = r.ok ? r.url : enlace.href;
    } catch {
      location.href = enlace.href;
    }
  });
}
