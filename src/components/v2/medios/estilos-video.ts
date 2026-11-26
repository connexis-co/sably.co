/**
 * Estilos de los controles del vídeo, cargados junto al controlador (import diferido al acercarse o pulsar): ni la
 * hoja común del sitio ni el primer pintado los llevan. La fachada (caja, póster, botón) va en línea en la página.
 */
import comunes from './medios.css?inline';
import video from './video-controles.css?inline';

export function ponerEstilosVideo(doc: Document = document) {
  if (doc.getElementById('v2-medios-video')) return;
  const style = doc.createElement('style');
  style.id = 'v2-medios-video';
  // Si la página ya trae los estilos del audio en línea, basta con los del vídeo.
  style.textContent = (doc.querySelector('.v2-medio-audio') ? '' : comunes) + video;
  doc.head.appendChild(style);
}
