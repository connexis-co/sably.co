/** Isolated EmDash email transport. No contact-list subscription or automatic retries. */
const address = value => {
  if (typeof value !== 'string' || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim())) throw new Error('Brevo: dirección de correo inválida.');
  return { email: value.trim() };
};
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export default {
  hooks: {
    'email:deliver': {
      exclusive: true,
      async handler({ message }, ctx) {
        const [key, fromEmail, fromName] = await Promise.all(['apiKey','fromEmail','fromName'].map(name => ctx.settings.get(name)));
        if (typeof key !== 'string' || !key.trim() || !fromEmail) throw new Error('Brevo: configura la clave API y el remitente en los ajustes del plugin.');
        if (!ctx.http) throw new Error('Brevo: falta el permiso de red para api.brevo.com.');
        const sender = address(fromEmail);
        if (typeof fromName === 'string' && fromName.trim()) sender.name = fromName.trim();
        const body = {
          sender, to: [address(message.to)], subject: message.subject,
          textContent: message.text,
          htmlContent: message.html || `<pre>${escapeHtml(message.text)}</pre>`,
          ...(message.cc?.length ? {cc: message.cc.map(address)} : {}),
          ...(message.replyTo ? {replyTo: address(message.replyTo)} : {}),
        };
        let response;
        try {
          response = await ctx.http.fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST', redirect: 'error',
            headers: {'api-key': key.trim(), 'Content-Type': 'application/json', Accept: 'application/json'},
            body: JSON.stringify(body),
          });
        } catch {
          throw new Error('Brevo: no se pudo confirmar el envío. Revisa el historial del proveedor antes de reintentar.');
        }
        // Do not expose provider response bodies: they can contain recipient data.
        if (!response.ok) throw new Error(`Brevo rechazó el envío (HTTP ${response.status}). Revisa el remitente, la clave y los límites de tu cuenta.`);
      },
    },
  },
};
