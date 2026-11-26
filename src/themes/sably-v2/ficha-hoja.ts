/**
 * Estilos de la ficha de curso fuera de la hoja común (la que cargan todas las páginas). Mismo patrón que el blog
 * (blog-hoja.ts): lo que pinta la primera pantalla va EN LÍNEA (la cabeza antes del H1 y la caja al abrirla, para no
 * mover nada al llegar la hoja) y el resto en una hoja propia con huella en /_astro/, enlazada después de la cabeza.
 */
import cabeza from './ficha/cabeza.css?raw';
import caja from './ficha/caja.css?raw';
import { minificar } from './blog-hoja';

export const CSS_CABEZA = minificar(cabeza);
export const CSS_CAJA = minificar(caja);
export { default as RUTA_HOJA_FICHA } from './ficha/ficha-hoja.css?url';
