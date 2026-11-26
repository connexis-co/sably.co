import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enviarConConsentimiento, medir, type MedioMedible } from '../src/components/v2/medios/medicion';

/** Doble de HTMLMediaElement: el test mueve el estado y dispara los eventos en el orden del navegador. */
class Medio extends EventTarget implements MedioMedible {
  currentTime = 0; duration = 200; paused = true; ended = false; playbackRate = 1; currentSrc = 'https://sably.co/narraciones/x.mp3';
  emitir(...tipos: string[]) { for (const t of tipos) this.dispatchEvent(new Event(t)); }
  reproducir() { this.paused = false; this.emitir('play', 'playing'); }
  pausar() { this.paused = true; this.emitir('pause'); }
  ir(s: number) { this.emitir('seeking'); this.currentTime = s; this.emitir('timeupdate', 'seeked'); }
  avanzar(s: number, reloj: { t: number }) { reloj.t += (s / this.playbackRate) * 1000; this.currentTime += s; this.emitir('timeupdate'); }
  terminar() { this.currentTime = this.duration; this.paused = true; this.ended = true; this.emitir('timeupdate', 'pause', 'ended'); }
}

function montar(tipo: 'audio' | 'video' = 'audio', consentimiento: { analytics: boolean } | null = { analytics: true }) {
  const ventana = { dataLayer: [] as Record<string, unknown>[], sablyConsent: { get: () => consentimiento } };
  const reloj = { t: 1_000_000 };
  const medio = new Medio();
  const m = medir(medio, { tipo, id: 'blog:energia-solar', titulo: 'Energía solar', proveedor: 'gemini:es-419-csagent-9' },
    enviarConConsentimiento(ventana), '/blog/energia-solar/', () => reloj.t);
  const nombres = () => ventana.dataLayer.map((e) => e.event);
  return { ventana, reloj, medio, m, nombres };
}

test('medición: cada evento sale una vez, con sus parámetros, en una escucha completa', () => {
  const { ventana, reloj, medio, m, nombres } = montar();
  medio.reproducir();
  for (let i = 0; i < 12; i++) medio.avanzar(5, reloj); // 60 s: hitos 10 y 25
  medio.pausar();
  medio.reproducir();
  medio.ir(120); // salto: 60 → 120
  medio.avanzar(1, reloj); // 60,5 %: hito 50
  medio.playbackRate = 1.5; medio.emitir('ratechange', 'ratechange'); // defaultPlaybackRate + playbackRate
  medio.avanzar(30, reloj);
  m.salir(); // la página se oculta: tiempo real hasta aquí
  medio.terminar();
  assert.deepEqual(nombres(), ['audio_start', 'audio_progress', 'audio_progress', 'audio_pause', 'audio_resume', 'audio_seek',
    'audio_progress', 'audio_rate_change', 'audio_progress', 'audio_engagement', 'audio_progress', 'audio_complete']);
  const dl = ventana.dataLayer;
  assert.deepEqual(dl.filter((e) => e.event === 'audio_progress').map((e) => e.media_percent), [10, 25, 50, 75, 90]);
  assert.equal(dl[5]!.media_seek_from, 60);
  assert.equal(dl[5]!.media_current_time, 120);
  assert.equal(dl[7]!.media_playback_rate, 1.5);
  // 60 + 1 s a 1× y 30 s de contenido a 1,5× = 20 s reales: 81 s reproducidos.
  assert.equal(dl[9]!.media_seconds_played, 81);
  assert.equal(dl[11]!.media_seconds_played, 0, 'el final no vuelve a contar lo ya enviado');
  assert.deepEqual(Object.keys(dl[0]!).sort(), ['event', 'media_current_time', 'media_duration', 'media_id', 'media_page', 'media_percent',
    'media_playback_rate', 'media_provider', 'media_title', 'media_type'].sort());
  assert.equal(dl[0]!.media_provider, 'gemini:es-419-csagent-9');
  assert.equal(dl[0]!.media_duration, 200);
  assert.ok(!JSON.stringify(dl).match(/@|correo|email/i), 'sin datos personales');
});

test('medición: sin consentimiento o con la medición rechazada no sale ningún evento', () => {
  for (const c of [null, { analytics: false }]) {
    const { ventana, reloj, medio, m } = montar('audio', c);
    medio.reproducir();
    medio.avanzar(100, reloj);
    medio.pausar();
    m.salir();
    medio.terminar();
    assert.equal(ventana.dataLayer.length, 0);
  }
});

test('medición: el vídeo lleva además los parámetros recomendados de GA4', () => {
  const { ventana, reloj, medio } = montar('video');
  medio.reproducir();
  medio.avanzar(25, reloj);
  const p = ventana.dataLayer.find((e) => e.event === 'video_progress')!;
  assert.equal(ventana.dataLayer[0]!.event, 'video_start');
  assert.equal(p.video_percent, 10);
  assert.equal(p.video_provider, 'gemini:es-419-csagent-9');
  assert.equal(p.video_url, 'https://sably.co/narraciones/x.mp3');
  assert.equal(p.video_duration, 200);
});

test('medición: un fallo del dataLayer no interrumpe la reproducción', () => {
  const medio = new Medio();
  const roto = { get dataLayer(): never { throw new Error('roto'); }, sablyConsent: { get: () => ({ analytics: true }) } };
  medir(medio, { tipo: 'audio', id: 'x', titulo: 'x', proveedor: '' }, enviarConConsentimiento(roto as never), '/');
  assert.doesNotThrow(() => { medio.reproducir(); medio.avanzar(50, { t: 0 }); medio.terminar(); });
});

test('medición: el salto antes de empezar (recuperar el punto guardado) no cuenta', () => {
  const { medio, nombres } = montar();
  medio.ir(49);
  medio.reproducir();
  assert.deepEqual(nombres(), ['audio_start']);
});

test('con ?medicion=prueba los eventos quedan en window.sablyMedicionPrueba y no van al dataLayer', () => {
  const w: { location: { search: string }; dataLayer?: unknown[]; sablyMedicionPrueba?: unknown[]; console: Console } = { location: { search: '?x=1&medicion=prueba' }, console: { info() {} } as unknown as Console };
  enviarConConsentimiento(w)({ event: 'video_start' });
  assert.deepEqual(w.sablyMedicionPrueba, [{ event: 'video_start' }]);
  assert.equal(w.dataLayer, undefined);
});
