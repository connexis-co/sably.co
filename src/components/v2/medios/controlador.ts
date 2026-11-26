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
 *   data-medio-velocidad      botón del menú de velocidad (aria-haspopup="menu"); data-medio-menu, el menú
 *                             (role="menu"), y data-medio-velocidad-opcion="1.25", cada opción (menuitemradio).
 *                             Flechas, Inicio, Fin, Intro y Escape como en un menú; la velocidad se recuerda.
 *   data-medio-estado         región aria-live para avisos
 *   data-medio-pantalla       pantalla completa (vídeo)
 *   data-medio-silenciar      silenciar / activar el sonido (M); data-medio-volumen, <input type="range"> 0–100
 *                             (flechas arriba y abajo en el reproductor). La elección se recuerda en este navegador.
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
/** Volumen y silencio elegidos por el visitante, comunes a todos los reproductores del sitio. */
const CLAVE_SONIDO = 'sably:medio:sonido';
const CLAVE_VELOCIDAD = 'sably:medio:velocidad';
export function leerSonido(): { volumen: number; mudo: boolean } | undefined {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_SONIDO) ?? 'null');
    const volumen = Number(d?.volumen);
    return Number.isFinite(volumen) && volumen >= 0 && volumen <= 1 ? { volumen, mudo: d.mudo === true } : undefined;
  } catch { return undefined; }
}
const guardarSonido = (volumen: number, mudo: boolean) => {
  try { localStorage.setItem(CLAVE_SONIDO, JSON.stringify({ volumen, mudo })); } catch { /* sin almacenamiento */ }
};
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
  const velocidad = raiz.querySelector<HTMLButtonElement>('[data-medio-velocidad]');
  const menu = raiz.querySelector<HTMLElement>('[data-medio-menu]');
  const opciones = [...raiz.querySelectorAll<HTMLButtonElement>('[data-medio-velocidad-opcion]')];
  const valorVelocidad = raiz.querySelector<HTMLElement>('[data-medio-velocidad-valor]');
  const estado = raiz.querySelector<HTMLElement>('[data-medio-estado]');
  const pantalla = raiz.querySelector<HTMLButtonElement>('[data-medio-pantalla]');
  const silenciar = raiz.querySelector<HTMLButtonElement>('[data-medio-silenciar]');
  const volumen = raiz.querySelector<HTMLInputElement>('[data-medio-volumen]');
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
  // Velocidad: menú propio (botón + role="menu" con menuitemradio), recordado en este navegador.
  const enComa = (v: number) => String(v).replace('.', ',');
  function pintarVelocidad() {
    const v = medio.playbackRate;
    if (valorVelocidad) valorVelocidad.textContent = `${enComa(v)}×`;
    velocidad?.setAttribute('aria-label', `Velocidad: ${v === 1 ? 'normal' : `${enComa(v)} veces`}`);
    for (const o of opciones) o.setAttribute('aria-checked', String(Number(o.dataset.medioVelocidadOpcion) === v));
  }
  function cerrarMenu(devolverFoco = false) {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    velocidad?.setAttribute('aria-expanded', 'false');
    if (devolverFoco) velocidad?.focus();
  }
  function abrirMenu(foco: 'marcada' | 'primera' | 'ultima' = 'marcada') {
    if (!menu || !velocidad) return;
    menu.hidden = false;
    velocidad.setAttribute('aria-expanded', 'true');
    const marcada = opciones.find((o) => o.getAttribute('aria-checked') === 'true');
    (foco === 'primera' ? opciones[0] : foco === 'ultima' ? opciones.at(-1) : marcada ?? opciones[0])?.focus();
  }
  function ponerVelocidad(v: number) {
    if (!Number.isFinite(v) || v <= 0) return;
    medio.defaultPlaybackRate = medio.playbackRate = v;
    try { localStorage.setItem(CLAVE_VELOCIDAD, String(v)); } catch { /* sin almacenamiento */ }
  }
  velocidad?.addEventListener('click', () => (menu?.hidden ? abrirMenu() : cerrarMenu()));
  velocidad?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); abrirMenu(e.key === 'ArrowUp' ? 'ultima' : 'marcada'); }
  });
  for (const o of opciones) o.addEventListener('click', () => { ponerVelocidad(Number(o.dataset.medioVelocidadOpcion)); cerrarMenu(true); });
  menu?.addEventListener('keydown', (e) => {
    const i = opciones.indexOf(document.activeElement as HTMLButtonElement);
    const ir = (n: number) => { e.preventDefault(); opciones[(n + opciones.length) % opciones.length]?.focus(); };
    if (e.key === 'ArrowDown') ir(i + 1);
    else if (e.key === 'ArrowUp') ir(i - 1);
    else if (e.key === 'Home') ir(0);
    else if (e.key === 'End') ir(opciones.length - 1);
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarMenu(true); }
    else if (e.key === 'Tab') cerrarMenu();
  });
  document.addEventListener('pointerdown', (e) => { if (menu && !menu.hidden && !menu.parentElement?.contains(e.target as Node)) cerrarMenu(); });
  medio.addEventListener('ratechange', pintarVelocidad);
  const velocidadGuardada = (() => { try { return Number(localStorage.getItem(CLAVE_VELOCIDAD)); } catch { return 0; } })();
  if (velocidad && opciones.some((o) => Number(o.dataset.medioVelocidadOpcion) === velocidadGuardada)) ponerVelocidad(velocidadGuardada);
  pintarVelocidad();
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

  // Sonido: silenciar y volumen, recordados en este navegador para todos los reproductores (vídeo y audio).
  function pintarSonido() {
    const mudo = medio.muted || medio.volume === 0;
    raiz.dataset.silenciado = String(mudo);
    silenciar?.setAttribute('aria-pressed', String(mudo));
    silenciar?.setAttribute('aria-label', mudo ? 'Activar el sonido' : 'Silenciar');
    if (volumen) {
      const v = Math.round((medio.muted ? 0 : medio.volume) * 100);
      volumen.value = String(v);
      volumen.style.setProperty('--lleno', `${v}%`);
      volumen.setAttribute('aria-valuetext', mudo ? 'Silenciado' : `${v} %`);
    }
  }
  function ponerVolumen(v: number) {
    const nuevo = Math.min(1, Math.max(0, Math.round(v * 20) / 20));
    medio.volume = nuevo;
    medio.muted = nuevo === 0;
  }
  const sonido = leerSonido();
  if (sonido) { medio.volume = sonido.volumen; medio.muted = sonido.mudo; }
  silenciar?.addEventListener('click', () => {
    if (medio.muted || medio.volume === 0) { if (medio.volume === 0) medio.volume = 0.5; medio.muted = false; }
    else medio.muted = true;
  });
  volumen?.addEventListener('input', () => ponerVolumen(Number(volumen.value) / 100));
  medio.addEventListener('volumechange', () => { pintarSonido(); guardarSonido(medio.volume, medio.muted); });
  pintarSonido();

  // Atajos dentro del reproductor: espacio o K alterna; J y L retroceden y avanzan 15 s.
  raiz.addEventListener('keydown', (e) => {
    const destino = e.target as HTMLElement;
    if (e.altKey || e.ctrlKey || e.metaKey || destino.matches('select, input[type=range], [data-medio-velocidad]') || destino.closest('[data-medio-menu]')) return;
    const k = e.key.toLowerCase();
    if (k === 'k' || (k === ' ' && !destino.matches('button'))) { e.preventDefault(); alternar?.click(); }
    else if (k === 'j') { e.preventDefault(); ir(medio.currentTime - 15); }
    else if (k === 'l') { e.preventDefault(); ir(medio.currentTime + 15); }
    else if (k === 'f' && pantalla) { e.preventDefault(); pantalla.click(); }
    else if (k === 'm' && silenciar) { e.preventDefault(); silenciar.click(); avisar(medio.muted ? 'Silenciado.' : 'Sonido activado.'); }
    else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && silenciar) {
      e.preventDefault();
      ponerVolumen((medio.muted ? 0 : medio.volume) + (e.key === 'ArrowUp' ? 0.1 : -0.1));
      avisar(medio.muted ? 'Silenciado.' : `Volumen ${Math.round(medio.volume * 100)} %.`);
    }
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
