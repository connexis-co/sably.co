/**
 * Texto largo de la ficha («Sobre este curso» del CMS): ~300 palabras visibles
 * y el resto plegado, pero todo en el HTML inicial (lo leen Google, Bing y
 * ChatGPT). El corte cae siempre antes de un subtítulo, nunca a media frase.
 */
export interface TextoDividido {
  /** HTML completo con id en cada subtítulo (para el índice «En este texto»). */
  visible: string;
  resto: string;
  titulos: { id: string; texto: string }[];
  /** Títulos de los apartados que quedan plegados. */
  plegados: string[];
}

const ETIQUETAS = /<[^>]+>/g;
const palabras = (html: string) => html.replace(ETIQUETAS, ' ').split(/\s+/).filter(Boolean).length;
const slug = (texto: string) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'apartado';
const decodificar = (texto: string) => texto.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export function dividirTexto(html: string, limite = 300): TextoDividido {
  const usados = new Set<string>();
  const titulos: TextoDividido['titulos'] = [];
  const conIds = html.replace(/<h3(\s[^>]*)?>([\s\S]*?)<\/h3>/g, (_, atributos: string | undefined, interior: string) => {
    const texto = decodificar(interior.replace(ETIQUETAS, '').trim());
    let id = `texto-${slug(texto)}`;
    for (let n = 2; usados.has(id); n++) id = `texto-${slug(texto)}-${n}`;
    usados.add(id);
    titulos.push({ id, texto });
    const limpio = (atributos ?? '').replace(/\sid="[^"]*"/, '');
    return `<h3 id="${id}"${limpio}>${interior}</h3>`;
  });
  // Cortes posibles: el comienzo de cada subtítulo.
  const cortes = [...conIds.matchAll(/<h3\s/g)].map(m => m.index!);
  const corte = cortes.find(i => i > 0 && palabras(conIds.slice(0, i)) >= limite);
  if (corte === undefined) return { visible: conIds, resto: '', titulos, plegados: [] };
  const resto = conIds.slice(corte);
  const plegados = titulos.filter(t => resto.includes(`id="${t.id}"`)).map(t => t.texto);
  return { visible: conIds.slice(0, corte), resto, titulos, plegados };
}
