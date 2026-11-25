/**
 * «Constancia», nunca «certificado» (regla de JP, 4-nov-2026).
 *
 * Lo que se entrega al terminar un curso es una constancia de finalización que
 * emite Hotmart: no es un título ni una certificación. Las plantillas ya lo
 * dicen así; las descripciones cortas del CMS siguen con la coletilla
 * «Certificado incluido.» y esta función la corrige al pintar donde el texto
 * sale tal cual hacia fuera (llms-full.txt).
 *
 * Es deliberadamente corta de miras: solo toca las fórmulas en las que
 * «certificado» es el documento del curso. «Electricista certificado»,
 * «certifícate» o las certificaciones de las homologaciones no se tocan, porque
 * ahí la palabra es otra cosa y un reemplazo ciego cambiaría el sentido o
 * dejaría la frase sin concordancia.
 */
const FORMULAS: [RegExp, string][] = [
  [/\bcertificado y garantía de 7 días incluidos\b/gi, 'constancia y garantía de 7 días incluidas'],
  [/\bcertificado digital incluido\b/gi, 'constancia digital incluida'],
  [/\bcertificado incluido\b/gi, 'constancia incluida'],
  [/\bun certificado digital\b/gi, 'una constancia digital'],
  [/\bel certificado digital\b/gi, 'la constancia digital'],
  [/\bcertificado digital\b/gi, 'constancia digital'],
  [/\b(con|tu|incluye) certificado\b(?! de\b)/gi, '$1 constancia'],
  [/^certificado y garantía\b/gi, 'constancia y garantía'],
  [/(?<=[.!?]\s)certificado y garantía\b/gi, 'constancia y garantía'],
];

/** Reescribe las fórmulas de «certificado» de un texto corto conservando la mayúscula inicial. */
export function conConstancia(texto: string): string {
  let salida = texto;
  for (const [patron, reemplazo] of FORMULAS) {
    salida = salida.replace(patron, (hallado: string, ...grupos: unknown[]) => {
      const primero = typeof grupos[0] === 'string' ? grupos[0] : '';
      const nuevo = reemplazo.replace('$1', primero);
      return hallado.charAt(0) === hallado.charAt(0).toUpperCase() ? nuevo.charAt(0).toUpperCase() + nuevo.slice(1) : nuevo;
    });
  }
  return salida;
}
