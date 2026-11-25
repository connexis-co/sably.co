/**
 * Medición de reproducción para informes de retención (no son conversiones). La usa el controlador común, así que el
 * audio de las narraciones y el vídeo comparten nombres y parámetros (tabla en
 * docs/equipo/2026-11-25/narraciones/DISENO.md, sección «Medición»).
 *
 * Eventos (`<tipo>` = audio | video): <tipo>_start, _pause, _resume, _progress (10/25/50/75/90 %), _complete, _seek,
 * _rate_change y _engagement (segundos reales reproducidos, al ocultar o cerrar la página). Para vídeo se añaden los
 * parámetros recomendados de GA4 (video_current_time, video_duration, video_percent, video_provider, video_title,
 * video_url).
 *
 * Solo se envía con la medición aceptada (`sablyConsent.get().analytics`); sin respuesta o con «no» no sale nada.
 * Nada aquí puede romper la reproducción: todo va en try/catch y sin esperar a nadie.
 */
export interface InfoMedio {
  tipo: 'audio' | 'video';
  id: string;
  titulo: string;
  proveedor: string;
}

export type Enviar = (evento: Record<string, unknown>) => void;

/** Lo que la medición necesita del elemento multimedia (un HTMLMediaElement o un doble en las pruebas). */
export interface MedioMedible extends EventTarget {
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
  playbackRate: number;
  currentSrc?: string;
}

export const HITOS = [10, 25, 50, 75, 90] as const;

/** Envía al dataLayer solo si la medición está aceptada. */
export function enviarConConsentimiento(w: { dataLayer?: unknown[]; sablyConsent?: { get(): { analytics?: boolean } | null } } = globalThis as never): Enviar {
  return (evento) => {
    try {
      if (w.sablyConsent?.get()?.analytics !== true) return;
      (w.dataLayer ??= []).push(evento);
    } catch { /* la medición nunca interrumpe */ }
  };
}

const entero = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0);

/**
 * Engancha la medición a un medio. `pagina` es la ruta; `ahora` permite pruebas con reloj falso.
 * Devuelve `salir()` para cerrar la cuenta del tiempo reproducido (lo llama el controlador al ocultarse la página).
 */
export function medir(medio: MedioMedible, info: InfoMedio, enviar: Enviar, pagina: string, ahora: () => number = () => Date.now()) {
  const t = info.tipo;
  let iniciado = false;
  let pausadoPorUsuario = false;
  const hitos = new Set<number>();
  // Tiempo real reproducido (reloj de pared mientras suena) y su parte ya enviada.
  let segundos = 0;
  let enviados = 0;
  let desde: number | undefined;
  let ultimaPosicion = 0;
  let desdePosicion = 0;
  let buscando = false;

  const duracion = () => (Number.isFinite(medio.duration) && medio.duration > 0 ? medio.duration : 0);
  const porcentaje = () => (duracion() ? Math.min(100, Math.floor((medio.currentTime / duracion()) * 100)) : 0);
  const acumular = () => {
    if (desde !== undefined) {
      segundos += Math.max(0, ahora() - desde) / 1000;
      desde = medio.paused || medio.ended ? undefined : ahora();
    }
  };

  function evento(nombre: string, extra: Record<string, unknown> = {}) {
    try {
      const datos: Record<string, unknown> = {
        event: `${t}_${nombre}`,
        media_type: t, media_id: info.id, media_title: info.titulo, media_provider: info.proveedor, media_page: pagina,
        media_duration: entero(duracion()), media_current_time: entero(medio.currentTime),
        media_percent: porcentaje(), media_playback_rate: medio.playbackRate, ...extra,
      };
      if (t === 'video') Object.assign(datos, {
        video_current_time: datos.media_current_time, video_duration: datos.media_duration, video_percent: datos.media_percent,
        video_provider: info.proveedor, video_title: info.titulo, video_url: medio.currentSrc ?? '',
      });
      enviar(datos);
    } catch { /* nunca interrumpe */ }
  }

  function tiempoReproducido(nombre: 'engagement' | 'complete') {
    acumular();
    const delta = Math.round(segundos - enviados);
    if (nombre === 'engagement' && delta < 1) return;
    enviados += delta;
    evento(nombre, { media_seconds_played: delta });
  }

  const al = (tipo: string, fn: () => void) => medio.addEventListener(tipo, () => { try { fn(); } catch { /* nunca interrumpe */ } });

  al('play', () => {
    desde = ahora();
    if (!iniciado) { iniciado = true; evento('start'); }
    else if (pausadoPorUsuario) evento('resume');
    pausadoPorUsuario = false;
  });
  al('pause', () => {
    acumular();
    desde = undefined;
    if (medio.ended || !iniciado) return;
    pausadoPorUsuario = true;
    evento('pause');
  });
  al('timeupdate', () => {
    // Durante un salto el navegador ya da la posición nueva: se conserva la de antes para el evento de salto.
    if (!buscando) ultimaPosicion = medio.currentTime;
    if (medio.paused) return;
    acumular();
    if (buscando) return;
    const p = porcentaje();
    for (const h of HITOS) if (p >= h && !hitos.has(h)) { hitos.add(h); evento('progress', { media_percent: h }); }
  });
  al('seeking', () => {
    acumular();
    if (!buscando) desdePosicion = ultimaPosicion;
    buscando = true;
  });
  al('seeked', () => {
    buscando = false;
    ultimaPosicion = medio.currentTime;
    if (iniciado && Math.abs(medio.currentTime - desdePosicion) >= 1) evento('seek', { media_seek_from: entero(desdePosicion) });
  });
  // Cambiar defaultPlaybackRate también dispara ratechange: solo cuenta un cambio real de velocidad.
  let velocidad = medio.playbackRate;
  al('ratechange', () => {
    if (medio.playbackRate === velocidad) return;
    acumular();
    velocidad = medio.playbackRate;
    if (iniciado) evento('rate_change');
  });
  al('ended', () => {
    for (const h of HITOS) if (!hitos.has(h)) { hitos.add(h); evento('progress', { media_percent: h }); }
    tiempoReproducido('complete');
    desde = undefined;
    // Una nueva escucha completa vuelve a contar desde cero.
    iniciado = false; pausadoPorUsuario = false; hitos.clear();
  });

  return { salir: () => { try { tiempoReproducido('engagement'); } catch { /* nunca interrumpe */ } } };
}
