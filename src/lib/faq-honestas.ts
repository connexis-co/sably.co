/**
 * FAQ de ficha sin precios, descuentos ni medios de pago inventados.
 *
 * Las 968 variantes de país se redactaron con IA en agosto y cada una fijó su
 * propio precio en las FAQ («El precio de $32 USD ya es el precio final»), un
 * «40 % de descuento de lanzamiento» y medios de pago por país que nadie
 * verificó en el checkout (Daviplata y Bizum ni existen en Hotmart; ver
 * medios-de-pago.ts). Los precios cambiaron y
 * esas respuestas no: el 27-oct, en 180 de las 201 fichas cuya FAQ daba un
 * precio del curso, ese precio difería más de un 20 % del de la oferta, y el
 * FAQPage repetía la cifra falsa a Google y a los LLM.
 *
 * El texto vive en el CMS, así que se corrige al pintar y no en la fuente: una
 * reimportación no lo devuelve. Lo que se cae se sustituye por una respuesta
 * construida con el precio que la propia ficha muestra.
 */

import { fechaFinPromo } from './fecha-promo';

export interface Faq {
  q: string;
  a: string;
}

/** Un importe con su moneda: «$32 USD», «US$49,99», «35 dólares», «29 €». */
const IMPORTE =
  /(?:US\$|\$|€|S\/)\s?\d[\d.,]*|\d[\d.,]*\s?(?:USD|EUR|COP|MXN|PEN|CLP|ARS|d[oó]lares?|euros?|soles|pesos)\b/i;

/** Palabras que hacen del importe el precio del curso. */
const PRECIO =
  /\b(?:precio|valor|pago|pagas|pagar|cobro|cargo|cuesta|costo|coste|inversi[oó]n|importe|monto|tarifa|matr[ií]cula)\b/i;

/* Frases en las que el importe es de lo que cobra el alumno a sus clientes o de
   lo que cuestan los materiales: no hablan del precio del curso. */
const NEGOCIO =
  /\b(?:cobrar|cobras|cobran|ganar|ganancias?|clientes?|vender|vendes|venden|se vende|servicios?|sesi[oó]n|por hora|materiales|kit|insumos|herramientas)\b/i;

/** Un descuento concreto que la ficha no puede respaldar. */
const DESCUENTO =
  /\d+\s?%\s*(?:de\s+)?(?:descuento|dto\.?)|descuento\s+(?:del?\s+)?\d+\s?%|(?:descuento|precio|oferta|promoci[oó]n)\s+de\s+lanzamiento/i;

/** Medios de pago concretos: dependen del checkout de cada país y no se verificaron. */
const MEDIO_DE_PAGO =
  /\b(?:Nequi|Daviplata|PSE|Efecty|Baloto|Bizum|OXXO|Yape|Plin|PagoEfectivo|Mercado\s?Pago|Rapipago|Pago\s?F[aá]cil|Webpay|Khipu|SPEI|PayPal|Discover|American Express|Amex|transferencia bancaria|criptomonedas?)\b/i;

type Motivo = 'precio' | 'descuento' | 'medio-de-pago';

/** Por qué una FAQ no se puede publicar, o null si se puede. */
export function motivoFaqFalsa(faq: Faq): Motivo | null {
  const texto = `${faq.q} ${faq.a}`;
  /* La palabra de precio suele ir en la pregunta y el importe en la respuesta;
     lo que descarta un importe de negocio es su propia frase. */
  const frases = texto.split(/(?<=[.?!])\s+/);
  if (PRECIO.test(texto) && frases.some((f) => IMPORTE.test(f) && !NEGOCIO.test(f))) return 'precio';
  if (DESCUENTO.test(texto)) return 'descuento';
  if (MEDIO_DE_PAGO.test(texto)) return 'medio-de-pago';
  return null;
}

interface Contexto {
  /**
   * El precio de LISTA tal como lo pinta la ficha («US$49,99», «$294.950 COP»):
   * el importe sin cupón, el que la caja de compra muestra tachado cuando hay
   * promoción. Nunca el rebajado: hasta el 24-nov-2026 se pasaba aquí el precio
   * con cupón y la respuesta llamaba «precio de lista» a 93.067 COP mientras la
   * caja decía que el de lista era 186.134.
   */
  precioTexto: string;
  /** La promoción que la caja de compra aplica ahora mismo, si hay alguna. */
  oferta?: { precio: string; cupon: string; hasta: number | null } | null;
  /** La FAQ de pago con los medios verificados del país; nunca se filtra. */
  faqPago: Faq;
}

/** Respuesta de precio: el de lista y, aparte, lo que queda con el cupón vigente. */
export function respuestaPrecio(precioTexto: string, oferta?: Contexto['oferta']): string {
  if (!oferta) {
    return `El precio de lista es ${precioTexto}. Si hay una promoción vigente, el precio con descuento aparece en esta página antes de pagar.`;
  }
  const vigencia = oferta.hasta ? ` hasta el ${fechaFinPromo(oferta.hasta)} (hora de Colombia)` : '';
  return `El precio de lista es ${precioTexto}. Con el cupón ${oferta.cupon}, que esta página aplica al enlace de pago, queda en ${oferta.precio}${vigencia}. El importe final lo confirma Hotmart antes de pagar.`;
}

/**
 * Quita las FAQ con precio, descuento o medio de pago inventados. La primera
 * que se cae deja su sitio a una de precio con la cifra de la ficha; si con
 * ella se fue la única pregunta de pago, se añade la verificada del país.
 */
export function faqsHonestas(faqs: Faq[], { precioTexto, oferta, faqPago }: Contexto): Faq[] {
  const faqPrecio: Faq = {
    q: '¿Cuánto cuesta el curso?',
    a: respuestaPrecio(precioTexto, oferta),
  };
  const salida: Faq[] = [];
  let cayoAlguna = false;
  for (const faq of faqs) {
    if (faq === faqPago || !motivoFaqFalsa(faq)) {
      salida.push(faq);
    } else if (!cayoAlguna) {
      cayoAlguna = true;
      salida.push(faqPrecio);
    }
  }
  /* Basta con mirar las preguntas: «una vez completado el pago» en otra
     respuesta no explica cómo se paga. */
  if (cayoAlguna && !salida.some((f) => f !== faqPrecio && /\bpag(?:o|ar|as)\b|\bmoneda\b/i.test(f.q))) {
    salida.splice(salida.indexOf(faqPrecio) + 1, 0, faqPago);
  }
  return salida;
}
