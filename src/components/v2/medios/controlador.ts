/**
 * Controlador común de los reproductores V2 (audio de las narraciones y, si lo adopta, el vídeo). Une un
 * HTMLMediaElement a controles marcados con atributos `data-medio-*`, sin React:
 *   data-medio                raíz (data-medio-titulo, data-medio-artista, data-medio-caratula para Media Session;
 *                             data-medio-tipo, data-medio-id y data-medio-proveedor para la medición de medicion.ts)
 *   data-medio-elemento       el <audio> o <video>
 *   data-medio-controles      contenedor de los controles propios (oculto hasta que hay JS)
 *   data-medio-alternar       reproducir / pausar
 *   data-medio-saltar="-15"   retroceder o avanzar esos segundos
 *   data-medio-barra          <input type="range"> de posición
 *   data-medio-actual, data-medio-total   tiempos
 *   data-medio-velocidad      <select> de velocidad
 *   data-medio-estado         región aria-live para avisos
 *   data-medio-pantalla       pantalla completa (vídeo)
 * Textos (por defecto, los de la narración): data-medio-verbo («Escuchar»), data-medio-nombre («la narración»),
 * data-medio-fin («Narración terminada.») y data-medio-album («Artículos narrados», para Media Session).
 * Sin JS queda el reproductor nativo. Si algo falla, vuelve al nativo. Recuerda el punto en localStorage.
 */
import { enviarConConsentimiento, medir } from './medicion';

const reloj = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const enPalabras = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60);
  const seg = t % 60;
  return `${m} ${m === 1 ? 'minuto' : 'minutos'} ${seg} ${seg === 1 ? 'segundo' : 'segundos'}`;
};
const leer = (clave: string) => { try { return Number(localStorage.getItem(clave)) || 0; } catch { return 0; } };
const guardar = (clave: string, valor: number | null) => {
  try { if (valor === null) localStorage.removeItem(clave); else localStorage.setItem(clave, String(Math.floor(valor))); } catch { /* sin almacenamiento */ }
};

export function prepararMedio(raiz: HTMLElement) {
  if (raiz.dataset.medioListo) return;
  const elemento = raiz.querySelector<HTMLMediaElement>('[data-medio-elemento]');
  const contenedor = raiz.querySelector<HTMLElement>('[data-medio-controles]');
  if (!elemento || !contenedor) return;
  const medio: HTMLMediaElement = elemento;
  const controles: HTMLElement = contenedor;
  raiz.dataset.medioListo = '1';
  const alternar = raiz.querySelector<HTMLButtonElement>('[data-medio-alternar]');
  const etiqueta = alternar?.querySelector<HTMLElement>('[data-medio-etiqueta]');
  const saltos = [...raiz.querySelectorAll<HTMLButtonElement>('[data-medio-saltar]')];
  const barra = raiz.querySelector<HTMLInputElement>('[data-medio-barra]');
  const actual = raiz.querySelector<HTMLElement>('[data-medio-actual]');
  const total = raiz.querySelector<HTMLElement>('[data-medio-total]');
  const velocidad = raiz.querySelector('[data-medio-velocidad]') as HTMLSelectElement | null;
  const estado = raiz.querySelector<HTMLElement>('[data-medio-estado]');
  const pantalla = raiz.querySelector<HTMLButtonElement>('[data-medio-pantalla]');
  const verbo = raiz.dataset.medioVerbo ?? 'Escuchar';
  const nombre = raiz.dataset.medioNombre ?? 'la narración';
  const clave = `sably:medio:${new URL(medio.currentSrc || medio.src, location.href).pathname}`;
  const duracionInicial = Number(barra?.max) || 0;
  let arrastrando = false;
  let pendiente: number | undefined;
  let ultimoGuardado = 0;
  let restaurado = false;

  const duracion = () => (Number.isFinite(medio.duration) && medio.duration > 0 ? medio.duration : duracionInicial);
  const avisar = (texto: string) => { if (estado) estado.textContent = texto; };

  function pintarPosicion(s: number) {
    if (!barra) return;
    const d = duracion();
    barra.value = String(Math.floor(s));
    barra.style.setProperty('--lleno', `${d ? Math.min(100, (s / d) * 100) : 0}%`);
    barra.setAttribute('aria-valuetext', `${enPalabras(s)} de ${enPalabras(d)}`);
    if (actual) actual.textContent = reloj(s);
  }

  function sincronizar() {
    const sonando = !medio.paused && !medio.ended;
    raiz.dataset.sonando = String(sonando);
    if (etiqueta) etiqueta.textContent = sonando ? 'Pausar' : verbo;
    alternar?.setAttribute('aria-label', `${sonando ? 'Pausar' : 'Reproducir'} ${nombre}`);
    if (!arrastrando && pendiente === undefined) pintarPosicion(medio.ended ? duracion() : medio.currentTime);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = sonando ? 'playing' : 'paused';
  }

  function nativo() {
    // Mientras el reproductor cambia a su fuente de respaldo (HLS → MP4), el fallo no es definitivo.
    if (raiz.dataset.medioRespaldo === 'pendiente') return;
    controles.hidden = true;
    medio.controls = true;
    avisar('Puedes usar el reproductor del navegador.');
  }

  function ir(segundos: number) {
    const destino = Math.min(Math.max(0, segundos), duracion() || segundos);
    if (medio.readyState >= HTMLMediaElement.HAVE_METADATA) medio.currentTime = destino;
    else {
      pendiente = destino;
      pintarPosicion(destino);
      if (medio.preload === 'none') { medio.preload = 'metadata'; medio.load(); }
    }
  }

  async function reproducir() {
    if (!restaurado) {
      restaurado = true;
      const guardado = leer(clave);
      if (guardado > 5 && (!duracion() || guardado < duracion() - 10) && medio.currentTime < 1) {
        pendiente ??= guardado;
        avisar(`Sigues desde ${reloj(guardado)}.`);
      }
    }
    try {
      await medio.play();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) nativo();
    }
  }

  alternar?.addEventListener('click', () => (medio.paused || medio.ended ? void reproducir() : medio.pause()));
  for (const b of saltos) b.addEventListener('click', () => ir((pendiente ?? medio.currentTime) + Number(b.dataset.medioSaltar)));
  barra?.addEventListener('input', () => { arrastrando = true; pintarPosicion(Number(barra.value)); });
  barra?.addEventListener('change', () => { arrastrando = false; ir(Number(barra.value)); });
  barra?.addEventListener('keydown', (e) => {
    const paso = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -30, PageUp: 30 }[e.key];
    if (paso === undefined) return;
    e.preventDefault();
    ir((pendiente ?? medio.currentTime) + paso);
  });
  velocidad?.addEventListener('change', () => {
    medio.defaultPlaybackRate = medio.playbackRate = Number(velocidad.value) || 1;
  });
  medio.addEventListener('ratechange', () => { if (velocidad) velocidad.value = String(medio.playbackRate); });
  medio.addEventListener('loadedmetadata', () => {
    if (total && Number.isFinite(medio.duration)) total.textContent = reloj(medio.duration);
    if (barra && Number.isFinite(medio.duration)) barra.max = String(Math.ceil(medio.duration));
    if (pendiente !== undefined) { medio.currentTime = Math.min(pendiente, duracion()); pendiente = undefined; }
    sincronizar();
  });
  medio.addEventListener('timeupdate', () => {
    sincronizar();
    if (Date.now() - ultimoGuardado > 5000) { ultimoGuardado = Date.now(); guardar(clave, medio.currentTime); }
  });
  for (const ev of ['play', 'pause', 'seeked', 'emptied']) medio.addEventListener(ev, sincronizar);
  medio.addEventListener('pause', () => guardar(clave, medio.currentTime));
  medio.addEventListener('ended', () => { guardar(clave, null); avisar(raiz.dataset.medioFin ?? 'Narración terminada.'); sincronizar(); });
  medio.addEventListener('error', nativo);

  // Atajos dentro del reproductor: espacio o K alterna; J y L retroceden y avanzan 15 s.
  raiz.addEventListener('keydown', (e) => {
    const destino = e.target as HTMLElement;
    if (e.altKey || e.ctrlKey || e.metaKey || destino.matches('select, input[type=range]')) return;
    const k = e.key.toLowerCase();
    if (k === 'k' || (k === ' ' && !destino.matches('button'))) { e.preventDefault(); alternar?.click(); }
    else if (k === 'j') { e.preventDefault(); ir(medio.currentTime - 15); }
    else if (k === 'l') { e.preventDefault(); ir(medio.currentTime + 15); }
    else if (k === 'f' && pantalla) { e.preventDefault(); pantalla.click(); }
  });

  // Vídeo: pulsar la imagen alterna, y pantalla completa sobre la raíz (para conservar los controles propios);
  // en iPhone, que no la permite sobre un div, la del propio <video>.
  if (medio.tagName === 'VIDEO') medio.addEventListener('click', () => alternar?.click());
  pantalla?.addEventListener('click', () => {
    const video = medio as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (raiz.requestFullscreen) raiz.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    else video.webkitEnterFullscreen?.();
  });
  document.addEventListener('fullscreenchange', () => {
    const dentro = document.fullscreenElement === raiz;
    raiz.dataset.pantalla = String(dentro);
    pantalla?.setAttribute('aria-label', dentro ? 'Salir de pantalla completa' : 'Pantalla completa');
  });

  if ('mediaSession' in navigator) {
    medio.addEventListener('play', () => {
      const caratula = raiz.dataset.medioCaratula;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: raiz.dataset.medioTitulo ?? document.title,
        artist: raiz.dataset.medioArtista ?? 'Sably',
        album: raiz.dataset.medioAlbum ?? 'Artículos narrados',
        ...(caratula ? { artwork: [{ src: caratula }] } : {}),
      });
      const acciones: [MediaSessionAction, MediaSessionActionHandler][] = [
        ['play', () => void reproducir()],
        ['pause', () => medio.pause()],
        ['seekbackward', (d) => ir(medio.currentTime - (d.seekOffset ?? 15))],
        ['seekforward', (d) => ir(medio.currentTime + (d.seekOffset ?? 15))],
        ['seekto', (d) => { if (d.seekTime !== undefined) ir(d.seekTime); }],
      ];
      for (const [accion, fn] of acciones) { try { navigator.mediaSession.setActionHandler(accion, fn); } catch { /* acción no admitida */ } }
    });
  }

  // Medición de retención (solo con la medición aceptada; ver medicion.ts).
  const medicion = medir(medio, {
    tipo: raiz.dataset.medioTipo === 'video' || medio.tagName === 'VIDEO' ? 'video' : 'audio',
    id: raiz.dataset.medioId ?? new URL(medio.currentSrc || medio.src, location.href).pathname,
    titulo: raiz.dataset.medioTitulo ?? document.title,
    proveedor: raiz.dataset.medioProveedor ?? '',
  }, enviarConConsentimiento(window as never), location.pathname);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') medicion.salir(); });
  window.addEventListener('pagehide', () => medicion.salir());

  pintarPosicion(0);
  controles.hidden = false;
  medio.controls = false;
}

export function prepararMedios(raiz: ParentNode = document) {
  raiz.querySelectorAll<HTMLElement>('[data-medio]').forEach(prepararMedio);
}
