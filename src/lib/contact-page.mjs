/** Public editorial defaults; stored in the native contact block when migrated. */
export const contactDefaults = {
  form_title: 'Envíanos un mensaje',
  name_label: 'Nombre', email_label: 'Correo', phone_label: 'Teléfono (opcional)',
  country_label: 'País', message_label: 'Mensaje',
  message_placeholder: 'Cuéntanos en qué podemos ayudarte.', submit_label: 'Enviar mensaje',
  consent_text: 'Autorizo a Sably a tratar mis datos de contacto con la única finalidad de responder a este mensaje, conforme a su política de privacidad.',
  privacy_label: 'Leer la política de privacidad', privacy_url: '/legal/privacidad/',
  channels_title: 'Otros canales', email: 'contacto@sably.co',
  whatsapp: '', whatsapp_label: 'Escribir por WhatsApp',
  whatsapp_description: 'Para dudas rápidas antes de comprar.', hours: '',
  help_title: 'Antes de escribir',
  help_text: 'Muchas dudas ya están resueltas en la ficha de cada curso: qué incluye, cuántas horas son, cómo se recibe el certificado y cómo se paga.',
  help_button_label: 'Ver los cursos', help_button_url: '/co/cursos/',
};

/** Empty optional values deliberately hide a channel instead of restoring it. */
export function contactContent(value = {}) {
  return /** @type {typeof contactDefaults} */ (Object.fromEntries(Object.entries(contactDefaults).map(([key, fallback]) =>
    [key, typeof value[key] === 'string' ? value[key] : fallback])));
}
