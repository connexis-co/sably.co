/**
 * Formulario de contacto (bloque sably_contact del CMS): validación, envío a
 * /api/v1/leads y avisos. Lo comparten la versión clásica y la V2 del bloque;
 * antes vivía dentro de ContactSection.astro.
 */
import { trackEvent } from '@/lib/analytics';

export function iniciarContacto(): void {
  const form = document.querySelector<HTMLFormElement>('[data-contacto]');
  if (!form) return;
  {
    const abiertoEn = Date.now();
    const aviso = form.querySelector<HTMLElement>('[data-aviso]')!;
    const enviar = form.querySelector<HTMLButtonElement>('[data-enviar]')!;

    const mostrarError = (campo: string, texto: string) => {
      const el = form.querySelector<HTMLElement>(`[data-err="${campo}"]`);
      if (!el) return;
      el.textContent = texto;
      el.classList.toggle('hidden', !texto);
      form.querySelector(`[name="${campo}"]`)?.setAttribute('aria-invalid', String(!!texto));
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      for (const c of ['name', 'email', 'message', 'consent']) mostrarError(c, '');
      aviso.textContent = '';

      const datos = new FormData(form);
      const nombre = String(datos.get('name') ?? '').trim();
      const correo = String(datos.get('email') ?? '').trim();
      const mensaje = String(datos.get('message') ?? '').trim();

      const fallos: string[] = [];
      const fallar = (campo: string, msg: string) => {
        mostrarError(campo, msg);
        fallos.push(campo);
      };
      if (nombre.length < 2) fallar('name', 'Escribe tu nombre.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) fallar('email', 'Ese correo no parece válido.');
      if (mensaje.length < 10) fallar('message', 'Cuéntanos un poco más (mínimo 10 caracteres).');
      if (!datos.get('consent')) fallar('consent', 'Necesitamos tu autorización para responderte.');
      if (fallos.length) {
        form.querySelector<HTMLElement>(`[name="${fallos[0]}"]`)?.focus();
        return;
      }

      enviar.disabled = true;
      aviso.textContent = 'Enviando…';
      aviso.className = 'text-sm text-muted';

      try {
        const r = await fetch('/api/v1/leads', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: nombre,
            email: correo,
            phone: String(datos.get('phone') ?? '') || undefined,
            message: mensaje,
            source: 'contacto',
            consent_policy_url: form.querySelector<HTMLAnchorElement>('[data-privacy-link]')?.getAttribute('href'),
            country: String(datos.get('country') ?? ''),
            consent_text: form.querySelector('[data-consent-text]')?.textContent?.trim(),
            trampa: String(datos.get('trampa') ?? ''),
            abierto_ms: Date.now() - abiertoEn,
          }),
          signal: AbortSignal.timeout(12000),
        });
        const d = (await r.json().catch(() => ({}))) as { error?: string; mensaje?: string };
        if (!r.ok) throw new Error(d.error || 'no se pudo enviar');

        form.reset();
        // El texto lo decide el servidor: solo él sabe si salió un correo.
        aviso.textContent = d.mensaje ?? 'Recibimos tu mensaje.';
        aviso.className = 'text-sm font-semibold text-success';
        trackEvent('submit_contact_form', { source: 'contacto' });
      } catch (err) {
        aviso.textContent =
          err instanceof DOMException && err.name === 'TimeoutError'
            ? 'La conexión tardó demasiado. Inténtalo otra vez o escríbenos por WhatsApp.'
            : (err as Error).message;
        aviso.className = 'text-sm font-semibold text-error';
      } finally {
        enviar.disabled = false;
      }
    });
    form.querySelector<HTMLFieldSetElement>('[data-contact-fields]')!.disabled = false;
  }
}
