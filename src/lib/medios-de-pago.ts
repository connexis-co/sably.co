/**
 * Medios de pago locales que el checkout de Hotmart admite en cada país, según
 * su centro de ayuda («¿Qué métodos de pago están disponibles y cómo puedo
 * habilitarlos para mi producto?», actualizado el 19-oct-2026):
 * https://help.hotmart.com/es/article/25588460435085/
 *
 * Sustituyen a los que escribieron las variantes de país: Daviplata (Colombia)
 * y Bizum (España) no figuran en esa lista. Tarjeta y PayPal valen en todos los
 * países. Cada curso solo muestra los medios que su creador activó, así que la
 * respuesta remite al checkout en vez de prometerlos.
 */
import type { Faq } from './faq-honestas';

const LOCALES: Record<string, string[]> = {
  co: ['PSE', 'Nequi', 'Bancolombia', 'Efecty'],
  mx: ['OXXO', 'SPEI', 'Mercado Pago', 'Kueski'],
  pe: ['Yape', 'PagoEfectivo'],
  ar: ['Mercado Pago'],
  cl: ['MACH', 'Servipag', 'Sencillito'],
  es: ['SEPA', 'Klarna', 'SeQura'],
  us: ['Venmo', 'Apple Pay', 'Klarna'],
};

const enumerar = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} o ${items.at(-1)}` : items.join('');

/** La pregunta de pago de la ficha, con los medios verificados del país. */
export function faqPagoPais(country: { code: string; name: string }): Faq {
  const locales = LOCALES[country.code] ?? [];
  const extra = locales.length
    ? ` Desde ${country.name} el checkout admite además ${enumerar(locales)}, si el curso los tiene activados.`
    : '';
  return {
    q: `¿Cómo puedo pagar desde ${country.name}?`,
    a: `El pago se hace en el checkout seguro de Hotmart con tarjeta de crédito o débito, o con PayPal.${extra} Los medios disponibles aparecen antes de pagar.`,
  };
}
