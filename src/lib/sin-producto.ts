/**
 * Textos de un curso sin checkout («Próximamente»).
 *
 * La ficha se publica para captar el interés, pero su contenido se redactó como
 * si el curso ya se vendiera: el subtítulo de tatuaje decía «Certificado y
 * garantía de 7 días» sin que hubiera nada que comprar, reembolsar ni terminar.
 * El texto vive en el CMS, así que la promesa se quita al pintar.
 */

/** Lo que solo existe cuando hay un producto en Hotmart. */
const PROMESA = /certific|constancia|diploma|garant[ií]a|reembolso|devoluci[oó]n|acceso (?:inmediato|de por vida)|inscr[ií]b|\bcompra\b|\bpago\b/i;

const MIN_PALABRAS = 4;

/**
 * Quita de un texto las frases que prometen constancia, garantía, acceso o
 * inscripción. Si la promesa es solo un inciso («…desde cero y obtén tu
 * certificado»), se cae el inciso y se conserva el resto de la frase.
 */
export function sinPromesas(texto: string): string {
  const frases = texto.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/);
  const limpias: string[] = [];
  for (const frase of frases) {
    if (!PROMESA.test(frase)) { limpias.push(frase); continue; }
    const cierre = frase.match(/[.!?…]+$/)?.[0] ?? '';
    // Incisos separados por coma o por « y »; los separadores se conservan en las posiciones impares.
    const partes = frase.slice(0, frase.length - cierre.length).split(/(,\s+|\s+y\s+)/);
    let resto = '';
    for (let i = 0; i < partes.length; i += 2) {
      const inciso = partes[i] ?? '';
      if (PROMESA.test(inciso)) continue;
      resto += resto ? (partes[i - 1] ?? ' ') + inciso : inciso;
    }
    resto = resto.trim();
    if (resto.split(/\s+/).filter(Boolean).length >= MIN_PALABRAS) limpias.push(resto.charAt(0).toUpperCase() + resto.slice(1) + (cierre || '.'));
  }
  return limpias.join(' ');
}

/** Descripción para buscadores y redes cuando, quitadas las promesas, no queda nada que decir. */
export const DESCRIPCION_SIN_PRODUCTO =
  'Este curso todavía no tiene inscripciones abiertas en Sably. Déjanos tus datos y te avisamos cuando se pueda comprar.';
