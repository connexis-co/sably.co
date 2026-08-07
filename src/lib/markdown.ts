/**
 * Render mínimo de markdown para las descripciones generadas (course-locales).
 *
 * Cubre lo que el generador produce —H2/H3, negrita, listas con viñeta,
 * listas numeradas y tablas— y nada más. Se escapa TODO el texto antes de
 * aplicar las transformaciones: el contenido viene de un modelo y no puede
 * llegar al `set:html` sin neutralizar. Corre solo en build (SSG), cero JS
 * al cliente.
 */

function escape(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Negrita e itálica sobre texto ya escapado.
 *
 * La negrita se busca de forma perezosa y no con `[^*]+`: el modelo anida
 * itálicas dentro de negritas ("**Degradado (*Fade*)**") y con la clase
 * negada el par exterior nunca casaba, dejando los asteriscos a la vista.
 * El orden importa — primero la negrita, si no `*` se comería sus asteriscos.
 *
 * La itálica exige texto pegado a ambos asteriscos, como el markdown real:
 * sin esa regla "3 * 4 * 5" se convertía en una itálica.
 */
function inline(s: string): string {
  return escape(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![*\w])/g, '$1<em>$2</em>');
}

/**
 * El modelo a veces devuelve los saltos escapados como texto (la secuencia
 * barra-n de dos caracteres en vez de un salto real), y otras veces mete el
 * `##` a media línea. Sin esto la página entera sale como un único párrafo
 * con los `###` a la vista, que es justo lo que pasó en producción.
 */
function normalizar(md: string): string {
  let t = md.replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\\t/g, ' ');
  // A veces devuelve HTML en vez de markdown. Se traduce el puñado de etiquetas
  // inline que usa y se descarta el resto: escaparlas dejaba "&lt;strong&gt;"
  // visible en pantalla.
  t = t
    .replace(/<\/?(?:strong|b)>/gi, '**')
    .replace(/<\/?(?:em|i)>/gi, '*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?(?:p|div|span|section)[^>]*>/gi, '');
  // Un encabezado siempre abre línea propia.
  t = t.replace(/([^\n])\s+(#{2,3} )/g, '$1\n\n$2');
  return t;
}

function celdas(linea: string): string[] {
  return linea
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}

const SEPARADOR_TABLA = /^\|?[\s:|-]+\|[\s:|-]*$/;

export function renderMarkdown(md: string): string {
  const lineas = normalizar(md).split('\n');
  const out: string[] = [];
  let vinetas: string[] = [];
  let numerada: string[] = [];

  const cerrar = () => {
    if (vinetas.length) {
      out.push(`<ul>${vinetas.map((li) => `<li>${li}</li>`).join('')}</ul>`);
      vinetas = [];
    }
    if (numerada.length) {
      out.push(`<ol>${numerada.map((li) => `<li>${li}</li>`).join('')}</ol>`);
      numerada = [];
    }
  };

  for (let i = 0; i < lineas.length; i++) {
    // El acceso por índice puede ser undefined con noUncheckedIndexedAccess,
    // y aquí se salta de posición al consumir una tabla.
    const linea = (lineas[i] ?? '').trim();
    if (!linea) {
      cerrar();
      continue;
    }

    // Tabla: cabecera + separador + filas, mientras sigan empezando por "|".
    if (linea.startsWith('|') && SEPARADOR_TABLA.test(lineas[i + 1]?.trim() ?? '')) {
      cerrar();
      const head = celdas(linea).map((c) => `<th>${inline(c)}</th>`).join('');
      const filas: string[] = [];
      i += 2;
      for (let fila = (lineas[i] ?? '').trim(); fila.startsWith('|'); fila = (lineas[i] ?? '').trim()) {
        filas.push(`<tr>${celdas(fila).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`);
        i++;
      }
      i--;
      out.push(`<table><thead><tr>${head}</tr></thead><tbody>${filas.join('')}</tbody></table>`);
      continue;
    }

    // Los encabezados bajan un nivel: este HTML se inyecta dentro de una
    // sección cuyo propio título ya es un <h2>, así que un ## del markdown
    // salía como hermano y no como hijo, dejando la sección vacía de
    // jerarquía. El h1 lo pone la página, de ahí que # también baje.
    if (linea.startsWith('### ')) {
      cerrar();
      out.push(`<h4>${inline(linea.slice(4))}</h4>`);
    } else if (linea.startsWith('## ')) {
      cerrar();
      out.push(`<h3>${inline(linea.slice(3))}</h3>`);
    } else if (linea.startsWith('# ')) {
      cerrar();
      out.push(`<h3>${inline(linea.slice(2))}</h3>`);
    } else if (/^[-*] /.test(linea)) {
      if (numerada.length) cerrar();
      vinetas.push(inline(linea.slice(2)));
    } else if (/^\d+[.)] /.test(linea)) {
      if (vinetas.length) cerrar();
      numerada.push(inline(linea.replace(/^\d+[.)] /, '')));
    } else {
      cerrar();
      out.push(`<p>${inline(linea)}</p>`);
    }
  }
  cerrar();
  return out.join('\n');
}
