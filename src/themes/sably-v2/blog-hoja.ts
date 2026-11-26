/**
 * Hoja de estilos del blog que no hace falta para pintar la cabecera: se sirve aparte (`/v2-blog/blog.<huella>.css`,
 * inmutable y cacheable) y se enlaza DESPUÉS de la cabecera, así no retrasa el título (el LCP). Lo crítico de la
 * cabecera va en línea (EstilosBlog.astro). Importada como hoja normal, Astro la metería en el CSS común de todo el
 * sitio, porque themes/index.ts importa todas las vistas.
 */
import cuerpo from './blog.css?raw';

export const minificar = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
  .replace(/\s*([{};,>])\s*/g, '$1').replace(/:\s+/g, ':').replace(/;}/g, '}').trim();

export const CSS_HOJA = minificar(cuerpo);

/** Huella FNV-1a del contenido: cambia el nombre del archivo cuando cambia el CSS. */
function huella(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
export const ARCHIVO_HOJA = `blog.${huella(CSS_HOJA)}.css`;
export const RUTA_HOJA = `/v2-blog/${ARCHIVO_HOJA}`;
