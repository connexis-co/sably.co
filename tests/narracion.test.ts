import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { aMp3, aWav, leerWav, medir, normalizar, sonoridad, unir, type Pcm } from '../src/plugins/sably-narracion/src/audio';
import { Cola, almacenEnMemoria, idToma } from '../src/plugins/sably-narracion/src/cola';
import { bloquesDe, normalizarConfig, VOCES_INICIALES } from '../src/plugins/sably-narracion/src/config';
import { guardar } from '../src/plugins/sably-narracion/src/deposito';
import { clasificar, ErrorProveedor, type Proveedor } from '../src/plugins/sably-narracion/src/proveedores';
import { bloquesNarrables, camposBlog, guion, huella, normalizarParaVoz } from '../src/plugins/sably-narracion/src/texto';
import { agrupar, procesar } from '../src/plugins/sably-narracion/src/trabajador';

const seno = (segundos: number, amplitud: number, frecuencia = 24000, hz = 997): Pcm => {
  const muestras = new Float32Array(Math.round(segundos * frecuencia));
  for (let i = 0; i < muestras.length; i++) muestras[i] = amplitud * Math.sin((2 * Math.PI * hz * i) / frecuencia);
  return { frecuencia, muestras };
};

const articulo = {
  title: 'Cómo empezar a coser en casa',
  description: 'Qué necesitas y por dónde empezar.',
  body: [
    { _type: 'block', style: 'h2', children: [{ text: 'Materiales' }] },
    { _type: 'block', style: 'normal', children: [{ text: 'Una máquina básica cuesta $ 450.000 COP y dura 10 años.' }] },
    { _type: 'image', asset: {} },
    { _type: 'block', style: 'blockquote', children: [{ text: 'Empieza por lo simple.' }] },
  ],
  faq: [{ question: '¿Necesito experiencia?', answer: 'No.' }],
};

test('texto: extrae título, descripción y cuerpo, sin imágenes; la huella es la de terapiadpareja', async () => {
  const bloques = bloquesNarrables(articulo, camposBlog);
  assert.deepEqual(bloques, ['Cómo empezar a coser en casa', 'Qué necesitas y por dónde empezar.', 'Materiales',
    'Una máquina básica cuesta $ 450.000 COP y dura 10 años.', 'Empieza por lo simple.']);
  const esperado = createHash('sha256').update(JSON.stringify(bloques)).digest('hex');
  assert.equal(await huella(bloques), esperado);
  assert.equal(bloquesDe('blog', articulo, { incluirPreguntas: true }).slice(-3).join('|'), 'Preguntas frecuentes|¿Necesito experiencia?|No.');
  assert.match(normalizarParaVoz('Dura 10 años y cuesta 25 %.'), /diez años.*veinticinco por ciento/);
});

test('texto: tramos sin partir bloques y de hasta 1.800 caracteres', () => {
  const largo = 'palabra '.repeat(150).trim() + '.';
  const tramos = agrupar(guion(Array(8).fill(largo)));
  assert.ok(tramos.every((t) => t.length <= 1800));
  assert.equal(tramos.join('\n\n').split('\n\n').length, 8);
});

test('audio: sonoridad BS.1770 de un seno de 997 Hz a escala completa ≈ −3,01 LUFS', () => {
  assert.ok(Math.abs(sonoridad(seno(3, 1, 48000)) - -3.01) < 0.1);
  assert.ok(Math.abs(sonoridad(seno(3, 1, 24000)) - -3.01) < 0.15);
});

test('audio: normaliza a −16 LUFS sin pasar el techo de pico', () => {
  const voz = unir([seno(2, 0.05), seno(2, 0.9, 24000, 300)], 0.5);
  const m = medir(normalizar(voz));
  assert.ok(Math.abs(m.lufs - -16) < 1, `LUFS ${m.lufs}`);
  assert.ok(m.picoDbfs <= -1.9, `pico ${m.picoDbfs}`);
  assert.ok(Math.abs(m.segundos - 4.5) < 0.01);
});

test('audio: WAV de ida y vuelta, y MP3 con ID3 y tramas MPEG', async () => {
  const pcm = seno(1, 0.3);
  const vuelta = leerWav(aWav(pcm));
  assert.equal(vuelta.frecuencia, 24000);
  assert.equal(vuelta.muestras.length, pcm.muestras.length);
  const mp3 = await aMp3(normalizar(pcm), { titulo: 'Título ñ', artista: 'Sably', comentario: 'Voz sintética.' });
  assert.equal(String.fromCharCode(mp3[0]!, mp3[1]!, mp3[2]!), 'ID3');
  const tam = ((mp3[6]! & 0x7f) << 21) | ((mp3[7]! & 0x7f) << 14) | ((mp3[8]! & 0x7f) << 7) | (mp3[9]! & 0x7f);
  assert.equal(mp3[10 + tam], 0xff);
  assert.equal(mp3[11 + tam]! & 0xe0, 0xe0);
  assert.ok(mp3.length > 6000 && mp3.length < 12000, `bytes ${mp3.length}`);
});

test('proveedores: clasifica saldo, credenciales y transitorios sin copiar la clave', () => {
  assert.equal(clasificar(401, '').tipo, 'credenciales');
  assert.equal(clasificar(400, 'FAILED_PRECONDITION billing').tipo, 'saldo');
  assert.equal(clasificar(503, '').tipo, 'transitorio');
  assert.equal(clasificar(429, '').tipo, 'transitorio');
  assert.equal(clasificar(400, 'bad').tipo, 'peticion');
  assert.doesNotMatch(clasificar(400, 'url?key=AIzaSECRETO').message, /SECRETO/);
});

async function nuevaCola(config: Record<string, unknown> = {}) {
  const almacen = almacenEnMemoria();
  let reloj = Date.parse('2026-11-25T12:00:00Z');
  const avisos: number[] = [];
  const cola = new Cola(almacen, () => reloj, () => avisos.push(1));
  await cola.guardarConfig({ deposito: 'disco', ...config });
  return { cola, almacen, avisos, avanzar: (ms: number) => { reloj += ms; } };
}

async function encolar(cola: Cola, slug = 'coser', bloques = ['Título', 'Un párrafo de prueba con texto.'], origen: 'publicar' | 'lote' = 'publicar') {
  return cola.encolar({ coleccion: 'blog', slug, titulo: bloques[0]!, bloques, huella: await huella(bloques), voz: VOCES_INICIALES[0]!, origen, costoEstimadoUsd: 0.01 });
}

test('cola: encolar es idempotente y un texto nuevo deja obsoleta la toma anterior', async () => {
  const { cola } = await nuevaCola();
  const a = await encolar(cola);
  assert.equal(a.resultado, 'nuevo');
  assert.equal((await encolar(cola)).resultado, 'existente');
  const b = await encolar(cola, 'coser', ['Título', 'Otro texto.']);
  assert.equal(b.resultado, 'nuevo');
  assert.equal((await cola.a.tomas.get((a as { id: string }).id))?.estado, 'obsoleta');
  assert.match((b as { id: string }).id, /^blog:coser:[a-f0-9]{12}:[a-f0-9]{8}:0$/);
});

test('cola: reclamar no entrega dos veces la misma toma', async () => {
  const { cola } = await nuevaCola();
  await encolar(cola, 'a');
  await encolar(cola, 'b');
  const [uno, dos] = await Promise.all([cola.reclamar(5), cola.reclamar(5)]);
  const ids = [...uno!, ...dos!].map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 2);
});

/** Proveedor simulado: duración según los caracteres (14,5 c/s), con fallos programados. */
function falso(guion: ('ok' | 'corto' | 'transitorio' | 'saldo')[] = []): Proveedor & { llamadas: number } {
  const p = {
    id: 'gemini', nombre: 'Falso', clave: 'NO_HACE_FALTA', modeloPorDefecto: 'x', puedeClonar: false, llamadas: 0,
    estimar: () => 0.01,
    async sintetizar(texto: string) {
      const paso = guion[p.llamadas++] ?? 'ok';
      if (paso === 'transitorio') throw new ErrorProveedor('transitorio', 'HTTP 503');
      if (paso === 'saldo') throw new ErrorProveedor('saldo', 'HTTP 400: billing');
      const segundos = (texto.length / 14.5) * (paso === 'corto' ? 0.4 : 1);
      return { pcm: seno(segundos, 0.3, 24000, 220), costoUsd: 0.002, fuenteCosto: 'prueba' };
    },
  };
  return p;
}

test('trabajador: genera, deposita en disco y publica solo con revisión automática', async (t) => {
  const carpeta = await mkdtemp(join(tmpdir(), 'narracion-'));
  process.env.NARRACION_AUDIOS = carpeta;
  t.after(() => rm(carpeta, { recursive: true, force: true }));
  const { cola, avisos } = await nuevaCola();
  await encolar(cola);
  const r = await procesar(cola, { proveedorInstancia: falso(), esperar: async () => {} });
  assert.equal(r.publicadas.length, 1);
  const publicada = (await cola.publicadasTodas())[0]!.data;
  assert.match(publicada.url, /^\/narraciones\/coser-[a-f0-9]{12}\.mp3$/);
  assert.equal((await readFile(join(carpeta, publicada.archivo))).subarray(0, 3).toString(), 'ID3');
  assert.equal(avisos.length, 1, 'avisa para invalidar la caché de páginas');
  assert.equal((await cola.gasto()).usd, 0.002);
  // Mismo texto y voz otra vez (despublicar y volver a publicar): se reutiliza sin pagar.
  await cola.retirar('blog', 'coser');
  const otra = await encolar(cola);
  assert.equal(otra.resultado, 'nuevo');
  assert.equal((otra as { reutilizada: boolean }).reutilizada, true);
  assert.equal((await cola.gasto()).usd, 0.002);
  assert.equal((await cola.publicadasTodas()).length, 1);
});

test('trabajador: un tramo que sale corto se repite y, si sigue corto, la toma queda en revisión', async (t) => {
  const carpeta = await mkdtemp(join(tmpdir(), 'narracion-'));
  process.env.NARRACION_AUDIOS = carpeta;
  t.after(() => rm(carpeta, { recursive: true, force: true }));
  const { cola } = await nuevaCola();
  const { id } = await encolar(cola) as { id: string };
  const p = falso(['corto', 'corto']);
  const r = await procesar(cola, { proveedorInstancia: p, esperar: async () => {} });
  assert.equal(p.llamadas, 2);
  assert.deepEqual(r.revision, [id]);
  assert.equal((await cola.publicadasTodas()).length, 0);
  assert.match(String((await cola.a.tomas.get(id))?.informe?.motivoRevision), /duración/);
});

test('trabajador: reintenta errores transitorios por tramo', async (t) => {
  const carpeta = await mkdtemp(join(tmpdir(), 'narracion-'));
  process.env.NARRACION_AUDIOS = carpeta;
  t.after(() => rm(carpeta, { recursive: true, force: true }));
  const { cola } = await nuevaCola();
  await encolar(cola);
  const esperas: number[] = [];
  const r = await procesar(cola, { proveedorInstancia: falso(['transitorio', 'transitorio', 'ok']), esperar: async (ms) => { esperas.push(ms); } });
  assert.equal(r.publicadas.length, 1);
  assert.deepEqual(esperas, [1000, 4000]);
});

test('trabajador: sin saldo pausa el proveedor y no gasta intentos', async () => {
  const { cola } = await nuevaCola();
  const { id } = await encolar(cola) as { id: string };
  const r = await procesar(cola, { proveedorInstancia: falso(['saldo']), esperar: async () => {} });
  assert.equal(r.fallidas.length, 1);
  const toma = await cola.a.tomas.get(id);
  assert.equal(toma?.estado, 'pendiente');
  assert.equal(toma?.intentos, 0);
  assert.ok(await cola.disyuntor('gemini'));
  const otra = await procesar(cola, { proveedorInstancia: falso(), esperar: async () => {} });
  assert.match(String(otra.omitido), /pausa/);
});

test('trabajador: el tope mensual detiene la cola', async () => {
  const { cola } = await nuevaCola({ topeMensualUsd: 0.005 });
  await encolar(cola);
  const r = await procesar(cola, { proveedorInstancia: falso(), esperar: async () => {} });
  assert.match(String(r.omitido), /Tope mensual/);
  assert.equal((await cola.gasto()).usd, 0);
});

test('trabajador: tras tres fallos la toma queda en error con esperas crecientes', async () => {
  const { cola, avanzar } = await nuevaCola();
  const { id } = await encolar(cola) as { id: string };
  const roto = { ...falso(), async sintetizar() { throw new ErrorProveedor('transitorio', 'HTTP 500'); } };
  for (let i = 0; i < 3; i++) {
    await procesar(cola, { proveedorInstancia: roto, esperar: async () => {} });
    avanzar(3 * 3600_000);
  }
  const toma = await cola.a.tomas.get(id);
  assert.equal(toma?.estado, 'error');
  assert.equal(toma?.intentos, 3);
});

test('config y depósito: valores fuera de rango se corrigen; nombres no válidos se rechazan', async () => {
  const c = normalizarConfig({ topeMensualUsd: 9999, revision: 'otra', colecciones: { blog: false, inventada: true } });
  assert.equal(c.topeMensualUsd, 200);
  assert.equal(c.revision, 'automatica');
  assert.deepEqual(c.colecciones, { blog: false, courses: false });
  await assert.rejects(guardar('disco', '../fuera.mp3', new Uint8Array(4)));
  assert.equal(idToma({ coleccion: 'blog', slug: 's', huella: 'a'.repeat(64), perfilId: 'b'.repeat(16), numero: 2 }), `blog:s:${'a'.repeat(12)}:${'b'.repeat(8)}:2`);
});
