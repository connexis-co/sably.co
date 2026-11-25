import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { copiaDesdeMux, costeMux, firmaMuxValida, fuentesDe, normalizarConfig, type Copia, type Video } from '../src/plugins/sably-video/src/modelo';
import { clienteMux } from '../src/plugins/sably-video/src/mux';
import { semilla } from '../src/plugins/sably-video/src/semilla';

const video: Video = { titulo: 'Curso de Barbería', original: 'videos/originales/curso-de-barberia.mp4', web: 'videos/web/curso-de-barberia.mp4', segundos: 25.4, creado: 0 };
const lista: Copia = { video: 'curso-de-barberia', proveedor: 'mux', externoId: 'a1', playbackId: 'p1', estado: 'lista', subtitulos: 't1', mp4: true, segundos: 25.43, actualizado: 0 };

test('con entrega R2 se sirve el MP4 de R2 aunque haya copia en Mux', () => {
  const f = fuentesDe(video, [lista], { entrega: 'r2' })!;
  assert.equal(f.mp4, 'https://cdn.sably.co/videos/web/curso-de-barberia.mp4');
  assert.equal(f.hls, undefined);
  assert.equal(f.proveedor, 'r2');
});

test('con entrega Mux y copia lista: HLS, subtítulos y MP4 de R2 como respaldo y contentUrl', () => {
  const f = fuentesDe(video, [lista], { entrega: 'mux' })!;
  assert.equal(f.hls, 'https://stream.mux.com/p1.m3u8');
  assert.equal(f.subtitulos, 'https://stream.mux.com/p1/text/t1.vtt');
  assert.equal(f.mp4, 'https://cdn.sably.co/videos/web/curso-de-barberia.mp4');
  assert.equal(f.contentUrl, f.mp4);
  assert.equal(f.proveedor, 'mux');
});

test('si la copia de Mux no está lista, falló o se borró, vuelve al MP4 de R2', () => {
  for (const estado of ['preparando', 'error', 'borrada'] as const) {
    const f = fuentesDe(video, [{ ...lista, estado }], { entrega: 'mux' })!;
    assert.equal(f.proveedor, 'r2', estado);
    assert.equal(f.hls, undefined, estado);
  }
  assert.equal(fuentesDe(video, [], { entrega: 'mux' })?.proveedor, 'r2');
});

test('sin MP4 web en R2: el 720p de Mux como respaldo; sin nada, no hay vídeo', () => {
  const sinWeb = { ...video, web: undefined };
  assert.equal(fuentesDe(sinWeb, [lista], { entrega: 'mux' })?.mp4, 'https://stream.mux.com/p1/720p.mp4');
  assert.equal(fuentesDe(sinWeb, [{ ...lista, mp4: false }], { entrega: 'mux' }), undefined);
  assert.equal(fuentesDe(sinWeb, [lista], { entrega: 'r2' }), undefined);
});

test('copiaDesdeMux traduce estado, playback público, subtítulos en español y MP4', () => {
  const c = copiaDesdeMux({
    status: 'ready', duration: 25.43, resolution_tier: '1080p', playback_ids: [{ id: 'firmado', policy: 'signed' }, { id: 'pub', policy: 'public' }],
    tracks: [{ type: 'video' }, { type: 'text', status: 'ready', language_code: 'es', id: 'sub1' }],
    static_renditions: { files: [{ name: '720p.mp4', status: 'ready' }] },
  });
  assert.deepEqual([c.estado, c.playbackId, c.subtitulos, c.mp4, c.resolucion], ['lista', 'pub', 'sub1', true, '1080p']);
  assert.equal(copiaDesdeMux({ status: 'preparing' }).estado, 'preparando');
  const e = copiaDesdeMux({ status: 'errored', errors: { messages: ['input inválido'] } });
  assert.equal(e.estado, 'error');
  assert.match(e.error!, /input inválido/);
});

test('coste de Mux en premium: 4K cuesta más que 1080p', () => {
  const c = costeMux([{ segundos: 600, resolucion: '1080p' }, { segundos: 60, resolucion: '2160p' }], 'premium');
  assert.equal(c.entradaUsd, Math.round((10 * 0.046875 + 0.15) * 100) / 100);
  assert.equal(c.almacenamientoMesUsd, Math.round((10 * 0.0045 + 0.0144) * 100) / 100);
  assert.equal(costeMux([{ segundos: 600 }], 'basic').entradaUsd, 0);
});

test('ajustes: valores desconocidos vuelven a los de fábrica', () => {
  assert.deepEqual(normalizarConfig({ entrega: 'youtube' as never, calidad: 'x' as never, alertaUsd: -1 }), { entrega: 'r2', calidad: 'premium', alertaUsd: 5 });
  assert.equal(normalizarConfig({ entrega: 'mux' }).entrega, 'mux');
});

test('webhook: firma buena pasa; mala, vieja o sin secreto no', async () => {
  const cuerpo = '{"type":"video.asset.ready"}';
  const t = Math.floor(Date.now() / 1000);
  const firma = (ts: number, s = 'secreto') => `t=${ts},v1=${createHmac('sha256', s).update(`${ts}.${cuerpo}`).digest('hex')}`;
  assert.equal(await firmaMuxValida(firma(t), cuerpo, 'secreto'), true);
  assert.equal(await firmaMuxValida(firma(t, 'otro'), cuerpo, 'secreto'), false);
  assert.equal(await firmaMuxValida(firma(t - 3600), cuerpo, 'secreto'), false);
  assert.equal(await firmaMuxValida(firma(t), cuerpo + ' ', 'secreto'), false);
  assert.equal(await firmaMuxValida(firma(t), cuerpo, ''), false);
  assert.equal(await firmaMuxValida(undefined, cuerpo, 'secreto'), false);
});

test('importar pide a Mux copiar desde R2 con la calidad, 4K máximo, subtítulos en español y MP4 de 720p', async () => {
  let pedido: { url: string; init: RequestInit } | undefined;
  const falso = (async (url: string, init: RequestInit) => {
    pedido = { url, init };
    return new Response(JSON.stringify({ data: { id: 'asset1', status: 'preparing' } }), { status: 201 });
  }) as unknown as typeof fetch;
  const r = await clienteMux({ id: 'i', secreto: 's' }, falso).importar('https://cdn.sably.co/videos/originales/x.mp4', 'curso-x', 'premium');
  assert.equal(r.id, 'asset1');
  const cuerpo = JSON.parse(String(pedido!.init.body));
  assert.equal(pedido!.url, 'https://api.mux.com/video/v1/assets');
  assert.equal((pedido!.init.headers as Record<string, string>).authorization, 'Basic ' + btoa('i:s'));
  assert.deepEqual(cuerpo.inputs[0].generated_subtitles, [{ language_code: 'es', name: 'Español' }]);
  assert.equal(cuerpo.video_quality, 'premium');
  assert.equal(cuerpo.max_resolution_tier, '2160p');
  assert.deepEqual(cuerpo.playback_policies, ['public']);
  assert.equal(cuerpo.passthrough, 'curso-x');
});

test('la semilla tiene los 15 de presentación con MP4 web y los 3 vídeos oficiales solo con original', () => {
  const s = semilla(0);
  assert.equal(Object.keys(s).length, 18);
  assert.ok(s['curso-de-barberia']!.web?.startsWith('videos/'));
  assert.equal(s['curso-de-barista']!.web, undefined);
  for (const v of Object.values(s)) assert.match(v.original, /^videos\/originales\/[a-z0-9-]+\.mp4$/);
});
