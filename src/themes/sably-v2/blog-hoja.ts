/**
 * Hoja de estilos del blog que no hace falta para pintar la cabecera: se sirve aparte (`/v2-blog/blog.<huella>.css`,
 * inmutable y cacheable) y se enlaza DESPUÉS de la cabecera, así no retrasa el título (el LCP). Lo crítico de la
 * cabecera va en línea (EstilosBlog.astro). Importada como hoja normal, Astro la metería en el CSS común de todo el
 * sitio, porque themes/index.ts importa todas las vistas.
 */
import cabeza from './blog-cabeza.css?raw';
import cuerpo from './blog.css?raw';
import portada from './blog-portada.css?raw';

export const minificar = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
  .replace(/\s*([{};,>])\s*/g, '$1').replace(/:\s+/g, ':').replace(/;}/g, '}').trim();

/* La cabeza del artículo va también aquí: el artículo la lleva en línea y la portada la usa en las tarjetas. */
export const CSS_HOJA = minificar(cabeza + cuerpo + portada);

/** Huella FNV-1a del contenido: cambia el nombre del archivo cuando cambia el CSS. */
function huella(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
/** Nombre que sigue sirviendo /v2-blog/ para las páginas guardadas antes de que la hoja pasara a /_astro/. */
export const ARCHIVO_HOJA = `blog.${huella(CSS_HOJA)}.css`;
/* La hoja que enlazan las páginas: recurso estático con huella en /_astro/, inmutable y guardado en el borde de
   Cloudflare (la ruta dinámica /v2-blog/ salía «cf-cache-status: BYPASS» aunque pidiera un año de caché). */
export { default as RUTA_HOJA } from './blog-hoja.css?url';
