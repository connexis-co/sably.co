/**
 * Correo del código de acceso (contrato común §3: «correo por adaptador»).
 * En el servidor va por el pipeline de correo de EmDash con el proveedor elegido en
 * Ajustes → Correo (hoy «Sably · Brevo», con la API de Brevo y el remitente verificado de
 * sably.co). Se envía como correo del sistema, igual que los de acceso del propio EmDash.
 * Sin proveedor listo (Brevo elegido pero sin clave), el acceso con correo no se ofrece.
 */
import { CODIGO_SEGUNDOS } from './nucleo';

export interface MensajeCorreo { to: string; subject: string; text: string; html: string }
export type Enviar = (mensaje: MensajeCorreo) => Promise<void>;

interface EntornoCorreo { SABLY_CORREO_EMULADOR?: string; SABLY_CORREO_BREVO_LOCAL?: string; SABLY_CORREO_REMITENTE?: string }

const MINUTOS = CODIGO_SEGUNDOS / 60;
const escapar = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Plantilla sobria (diseño «Cuenta / Correo del código», sin imágenes ni enlaces de seguimiento). */
export function correoCodigo(para: string, codigo: string): MensajeCorreo {
  const legible = `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
  const text = [
    `Tu código de acceso a Sably: ${legible}`,
    '',
    'Escríbelo en la página donde lo pediste.',
    `Vence en ${MINUTOS} minutos y sirve una sola vez.`,
    '',
    '¿No pediste este código? Ignora este correo. Nadie entra a tu cuenta sin él y nunca te lo pediremos por WhatsApp ni por teléfono.',
    '',
    'Sably · Plataforma de educación online · https://sably.co/',
    'Este es un aviso de tu cuenta, no publicidad. Lo recibes porque alguien pidió entrar con este correo.',
  ].join('\n');
  const fuente = "font-family:Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Tu código de Sably</title></head>
<body style="margin:0;padding:0;background:#F4F4F8;${fuente};color:#1B1B3A">
<div style="display:none;max-height:0;overflow:hidden">Vence en ${MINUTOS} minutos. Si no lo pediste, ignora este correo.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px">
<tr><td style="padding:32px 32px 0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#1B1B3A">Sably</td></tr>
<tr><td style="padding:20px 32px 0"><h1 style="margin:0;font-size:24px;line-height:30px;font-weight:600;color:#1B1B3A">Tu código de acceso</h1>
<p style="margin:8px 0 0;font-size:15px;line-height:22px;color:#4A4A78">Escríbelo en la página donde lo pediste.</p></td></tr>
<tr><td style="padding:20px 32px 0"><div style="background:#F4F4F8;border-radius:12px;padding:20px;text-align:center;font-size:34px;line-height:40px;font-weight:700;letter-spacing:0.16em;color:#1B1B3A">${escapar(legible)}</div>
<p style="margin:12px 0 0;font-size:14px;line-height:20px;color:#4A4A78">Vence en ${MINUTOS} minutos y sirve una sola vez.</p></td></tr>
<tr><td style="padding:24px 32px 32px"><p style="margin:0;padding:14px 16px;background:#F4F4F8;border-radius:10px;font-size:13px;line-height:19px;color:#4A4A78">¿No pediste este código? Ignora este correo. Nadie entra a tu cuenta sin él y nunca te lo pediremos por WhatsApp ni por teléfono.</p></td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #E6E6F0;font-size:12px;line-height:18px;color:#6E6E96"><strong style="color:#1B1B3A">Sably</strong> · Plataforma de educación online<br>Este es un aviso de tu cuenta, no publicidad. Lo recibes porque alguien pidió entrar con este correo.</td></tr>
</table></td></tr></table></body></html>`;
  return { to: para, subject: `${codigo} es tu código de Sably`, text, html };
}

/**
 * Cómo enviar en esta petición, o null si no hay proveedor listo.
 * Solo en `astro dev` sobre localhost (`local`): `SABLY_CORREO_EMULADOR` (ruta de un archivo donde se
 * escriben los correos, para las pruebas) o `SABLY_CORREO_BREVO_LOCAL` (clave de Brevo para un envío
 * real de prueba). Nunca en producción: `import.meta.env.DEV` es false al compilar.
 */
export async function envioCorreo(local: boolean, entorno: EntornoCorreo): Promise<Enviar | null> {
  if (import.meta.env?.DEV && local) {
    const archivo = entorno.SABLY_CORREO_EMULADOR;
    if (archivo) {
      const { appendFile } = await import('node:fs/promises');
      return async m => { await appendFile(archivo, JSON.stringify({ to: m.to, subject: m.subject, text: m.text }) + '\n'); };
    }
    const clave = entorno.SABLY_CORREO_BREVO_LOCAL;
    if (clave) {
      const remitente = entorno.SABLY_CORREO_REMITENTE || 'contacto@sably.co';
      return async m => {
        const r = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST', signal: AbortSignal.timeout(10_000),
          headers: { 'api-key': clave, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ sender: { email: remitente, name: 'Sably' }, to: [{ email: m.to }], subject: m.subject, textContent: m.text, htmlContent: m.html }),
        });
        if (!r.ok) throw new Error(`Brevo respondió ${r.status}`);
      };
    }
  }
  try {
    const { withEmDashRuntime } = await import('emdash/middleware');
    const { OptionsRepository } = await import('emdash');
    return await withEmDashRuntime(async runtime => {
      const email = runtime.email;
      if (!email?.isAvailable()) return null;
      // «Sably · Brevo» elegido sin clave: isAvailable() es true pero el envío fallaría.
      const opciones = new OptionsRepository(runtime.db);
      const elegido = await opciones.get<string>('emdash:exclusive_hook:email:deliver');
      if (elegido === 'sably-brevo') {
        const [clave, remitente] = await Promise.all([opciones.get<unknown>('plugin:sably-brevo:settings:apiKey'), opciones.get<unknown>('plugin:sably-brevo:settings:fromEmail')]);
        if (typeof clave !== 'string' || !clave.trim() || typeof remitente !== 'string' || !remitente.trim()) return null;
      }
      return (m: MensajeCorreo) => email.send(m, 'system');
    });
  } catch {
    return null;
  }
}
