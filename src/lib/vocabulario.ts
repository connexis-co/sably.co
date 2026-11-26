/**
 * «Certificado», no «constancia» (decisión de JP, 26-nov-2026: «debe quedar como
 * certificado»). Antes la regla era la contraria (4-nov-2026); el nombre de la
 * función se conserva para no tocar a quien la importa.
 *
 * Lo que se entrega al terminar un curso es un certificado de finalización que
 * emite Hotmart o el creador del curso, no Sably: no es un título oficial ni una
 * certificación profesional. Las plantillas ya lo dicen así; si algún texto corto
 * del CMS quedó con la fórmula de «constancia» de la regla anterior, esta función
 * la devuelve a «certificado» al pintar donde el texto sale tal cual hacia fuera
 * (llms-full.txt, textos de la caja).
 *
 * Es deliberadamente corta de miras: solo toca las fórmulas en las que
 * «constancia» es el documento del curso. «Practicar con constancia» o «la
 * constancia del consentimiento» no se tocan, porque ahí la palabra es otra cosa
 * y un reemplazo ciego cambiaría el sentido.
 */
const FORMULAS: [RegExp, string][] = [
  [/\bconstancia y garantía de 7 días incluidas\b/gi, 'certificado y garantía de 7 días incluidos'],
  [/\bconstancia digital incluida\b/gi, 'certificado digital incluido'],
  [/\bconstancia incluida\b/gi, 'certificado incluido'],
  [/\buna constancia (digital|de finalizaci[oó]n)\b/gi, 'un certificado $1'],
  [/\bla constancia (digital|de finalizaci[oó]n)\b/gi, 'el certificado $1'],
  [/\bconstancia (digital|de finalizaci[oó]n)\b/gi, 'certificado $1'],
  [/\b(tu|incluye) constancia\b/gi, '$1 certificado'],
  [/\bcon constancia (al terminar|al finalizar)\b/gi, 'con certificado $1'],
  [/^constancia y garantía\b/gi, 'certificado y garantía'],
  [/(?<=[.!?]\s)constancia y garantía\b/gi, 'certificado y garantía'],
];

/** Reescribe las fórmulas de «constancia» de un texto corto a «certificado» conservando la mayúscula inicial. */
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
