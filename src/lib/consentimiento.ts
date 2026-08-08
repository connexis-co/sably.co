/**
 * Textos de autorización de tratamiento de datos.
 *
 * La Ley 1581/2012 y el RGPD exigen poder demostrar QUÉ se le mostró a la
 * persona, no que marcó una casilla. Por eso estos literales son la fuente
 * única: lo que se pinta en pantalla y lo que se guarda en `consent.text_shown`
 * son la misma cadena, sin interpolaciones ni reconstrucciones.
 *
 * Reglas al redactarlos:
 *
 *   · No prometer un plazo de borrado mientras no exista una tarea que borre.
 *   · No citar un correo de contacto que no esté publicado; remitir a la
 *     política de privacidad, que es la que debe llevarlo.
 *   · Una finalidad por texto. Meter «responder tu consulta y enviarte
 *     información sobre cursos» bajo la palabra «única» obliga a aceptar
 *     publicidad para ejercer un derecho, y eso no es consentimiento libre.
 *
 * Si se cambia un texto hay que subir `VERSION`: los registros antiguos deben
 * seguir apuntando a la redacción que de verdad se mostró entonces.
 */
export const VERSION = '2026-08-v1';

export const CONSENTIMIENTO = {
  comentario:
    'Autorizo a Sably a tratar mi nombre y mi correo con la única finalidad de publicar y ' +
    'moderar este comentario, conforme a su política de privacidad. Mi correo no se publica.',

  lead:
    'Autorizo a Sably a tratar mis datos de contacto para responder a esta solicitud y ' +
    'enviarme información sobre el curso que me interesa, conforme a su política de privacidad.',

  contacto:
    'Autorizo a Sably a tratar mis datos de contacto con la única finalidad de responder a ' +
    'este mensaje, conforme a su política de privacidad.',
} as const;

export const POLITICA_URL = '/legal/privacidad/';
