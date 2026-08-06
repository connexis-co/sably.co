/**
 * Render mínimo de markdown para las descripciones generadas (course-locales).
 *
 * Cubre exactamente lo que el generador puede producir —H2/H3, negrita,
 * listas y párrafos— y nada más. Se escapa TODO el texto antes de aplicar
 * las transformaciones: el contenido viene de un modelo y no puede llegar
 * al `set:html` sin neutralizar. Corre solo en build (SSG), cero JS al cliente.
 */

function escape(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inline(s: string): string {
  return escape(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

export function renderMarkdown(md: string): string {
  const out: string[] = [];
  let lista: string[] = [];

  const cerrarLista = () => {
    if (lista.length) {
      out.push(`<ul>${lista.map((li) => `<li>${li}</li>`).join('')}</ul>`);
      lista = [];
    }
  };

  for (const cruda of md.split('\n')) {
    const linea = cruda.trim();
    if (!linea) {
      cerrarLista();
      continue;
    }
    if (linea.startsWith('### ')) {
      cerrarLista();
      out.push(`<h3>${inline(linea.slice(4))}</h3>`);
    } else if (linea.startsWith('## ')) {
      cerrarLista();
      out.push(`<h2>${inline(linea.slice(3))}</h2>`);
    } else if (/^[-*] /.test(linea)) {
      lista.push(inline(linea.slice(2)));
    } else {
      cerrarLista();
      out.push(`<p>${inline(linea)}</p>`);
    }
  }
  cerrarLista();
  return out.join('\n');
}
