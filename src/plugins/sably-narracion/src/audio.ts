// Cadena de audio en JS puro, sin ffmpeg (la imagen de Sably no lo trae y se despliega solo la capa `dist`):
// WAV PCM → unir tramos con pausas → sonoridad integrada BS.1770-4 → ganancia a −16 LUFS → limitador de pico →
// MP3 mono (MPEG-2 capa III con LAME en JS) → etiquetas ID3v2.3 que declaran la voz sintética.

export const preset = { lufs: -16, techoDbfs: -2, kbps: 64 } as const;

export interface Pcm {
  frecuencia: number;
  muestras: Float32Array;
}

export interface Medicion {
  segundos: number;
  lufs: number;
  picoDbfs: number;
  /** Silencio continuo más largo, en segundos (un corte o un tramo vacío lo delata). */
  silencioMaximo: number;
}

export interface Metadatos {
  titulo: string;
  artista: string;
  album?: string;
  comentario: string;
}

const FRECUENCIAS_MP3 = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

/** Lee un WAV PCM de 16 bits (mono o estéreo, se mezcla a mono). Sin cabecera RIFF se toma como PCM 24 kHz mono. */
export function leerWav(datos: Uint8Array, frecuenciaPorDefecto = 24000): Pcm {
  const vista = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  const texto = (i: number) => String.fromCharCode(datos[i]!, datos[i + 1]!, datos[i + 2]!, datos[i + 3]!);
  if (datos.length < 12 || texto(0) !== "RIFF" || texto(8) !== "WAVE") {
    const n = Math.floor(datos.length / 2);
    const muestras = new Float32Array(n);
    for (let i = 0; i < n; i++) muestras[i] = vista.getInt16(i * 2, true) / 32768;
    return { frecuencia: frecuenciaPorDefecto, muestras };
  }
  let canales = 1;
  let frecuencia = frecuenciaPorDefecto;
  let bits = 16;
  let formato = 1;
  let p = 12;
  while (p + 8 <= datos.length) {
    const id = texto(p);
    let tam = vista.getUint32(p + 4, true);
    const inicio = p + 8;
    if (id === "fmt ") {
      formato = vista.getUint16(inicio, true);
      canales = vista.getUint16(inicio + 2, true);
      frecuencia = vista.getUint32(inicio + 4, true);
      bits = vista.getUint16(inicio + 14, true);
    } else if (id === "data") {
      // Algunos generadores en flujo dejan el tamaño en 0 o 0xFFFFFFFF: se toma lo que queda.
      if (tam === 0 || inicio + tam > datos.length) tam = datos.length - inicio;
      if (formato !== 1 || bits !== 16) throw Error(`WAV no admitido (formato ${formato}, ${bits} bits)`);
      const n = Math.floor(tam / (2 * canales));
      const muestras = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let suma = 0;
        for (let c = 0; c < canales; c++) suma += vista.getInt16(inicio + (i * canales + c) * 2, true);
        muestras[i] = suma / canales / 32768;
      }
      return { frecuencia, muestras };
    }
    p = inicio + tam + (tam % 2);
  }
  throw Error("WAV sin datos de audio");
}

/** Une tramos de la misma frecuencia con un silencio entre ellos. */
export function unir(partes: Pcm[], pausaS: number): Pcm {
  if (!partes.length) throw Error("No hay audio que unir");
  const frecuencia = partes[0]!.frecuencia;
  if (partes.some((p) => p.frecuencia !== frecuencia)) throw Error("Los tramos tienen frecuencias distintas");
  const hueco = Math.round(pausaS * frecuencia);
  const total = partes.reduce((s, p) => s + p.muestras.length, 0) + hueco * (partes.length - 1);
  const muestras = new Float32Array(total);
  let o = 0;
  partes.forEach((p, i) => {
    if (i) o += hueco;
    muestras.set(p.muestras, o);
    o += p.muestras.length;
  });
  return { frecuencia, muestras };
}

/** Quita el silencio inicial y final por encima de un pequeño margen (las voces por API suelen traer colas). */
export function recortar(pcm: Pcm, margenS = 0.12, umbral = 0.004): Pcm {
  const m = pcm.muestras;
  let a = 0;
  let b = m.length - 1;
  while (a < m.length && Math.abs(m[a]!) < umbral) a++;
  while (b > a && Math.abs(m[b]!) < umbral) b--;
  const margen = Math.round(margenS * pcm.frecuencia);
  return { frecuencia: pcm.frecuencia, muestras: m.slice(Math.max(0, a - margen), Math.min(m.length, b + margen + 1)) };
}

type Biquad = [number, number, number, number, number];

/**
 * Coeficientes del filtro de ponderación K (BS.1770-4) para cualquier frecuencia de muestreo, con la derivación de
 * libebur128 (a 48 kHz reproduce los coeficientes de la norma).
 */
function filtrosK(fs: number): [Biquad, Biquad] {
  const f0 = 1681.974450955533;
  const G = 3.999843853973347;
  const Q = 0.7071752369554196;
  const K = Math.tan((Math.PI * f0) / fs);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  const a0 = 1 + K / Q + K * K;
  const estante: Biquad = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0,
    (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  const f1 = 38.13547087602444;
  const Q1 = 0.5003270373238773;
  const K1 = Math.tan((Math.PI * f1) / fs);
  const b0 = 1 + K1 / Q1 + K1 * K1;
  const pasoAlto: Biquad = [1, -2, 1, (2 * (K1 * K1 - 1)) / b0, (1 - K1 / Q1 + K1 * K1) / b0];
  return [estante, pasoAlto];
}

function filtrar(x: Float32Array, [b0, b1, b2, a1, a2]: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    const s = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = s;
    y[i] = s;
  }
  return y;
}

/** Sonoridad integrada en LUFS (BS.1770-4: bloques de 400 ms al 75 %, puerta absoluta −70 y relativa −10). */
export function sonoridad(pcm: Pcm): number {
  const [estante, pasoAlto] = filtrosK(pcm.frecuencia);
  const k = filtrar(filtrar(pcm.muestras, estante), pasoAlto);
  const bloque = Math.round(0.4 * pcm.frecuencia);
  const paso = Math.round(0.1 * pcm.frecuencia);
  if (k.length < bloque) return -Infinity;
  const energias: number[] = [];
  for (let i = 0; i + bloque <= k.length; i += paso) {
    let s = 0;
    for (let j = i; j < i + bloque; j++) s += k[j]! * k[j]!;
    energias.push(s / bloque);
  }
  const L = (z: number) => -0.691 + 10 * Math.log10(z);
  const absolutos = energias.filter((z) => L(z) > -70);
  if (!absolutos.length) return -Infinity;
  const relativo = L(absolutos.reduce((a, b) => a + b, 0) / absolutos.length) - 10;
  const validos = absolutos.filter((z) => L(z) > relativo);
  return L(validos.reduce((a, b) => a + b, 0) / validos.length);
}

export function medir(pcm: Pcm): Medicion {
  let pico = 0;
  let racha = 0;
  let maxRacha = 0;
  for (const v of pcm.muestras) {
    const a = Math.abs(v);
    if (a > pico) pico = a;
    if (a < 0.003) racha++;
    else {
      if (racha > maxRacha) maxRacha = racha;
      racha = 0;
    }
  }
  if (racha > maxRacha) maxRacha = racha;
  const redondear = (n: number) => Math.round(n * 100) / 100;
  return {
    segundos: redondear(pcm.muestras.length / pcm.frecuencia),
    lufs: redondear(sonoridad(pcm)),
    picoDbfs: redondear(20 * Math.log10(pico || 1e-9)),
    silencioMaximo: redondear(maxRacha / pcm.frecuencia),
  };
}

/** Ganancia y limitador con anticipación (5 ms) y liberación suave (60 ms): ningún pico pasa de `techoDbfs`. */
export function normalizar(pcm: Pcm, lufs: number = preset.lufs, techoDbfs: number = preset.techoDbfs): Pcm {
  const medida = sonoridad(pcm);
  const ganancia = Number.isFinite(medida) ? Math.pow(10, (lufs - medida) / 20) : 1;
  const techo = Math.pow(10, techoDbfs / 20);
  const x = pcm.muestras;
  const n = x.length;
  const requerida = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.abs(x[i]! * ganancia);
    requerida[i] = a > techo ? techo / a : 1;
  }
  // Mínimo en ventana deslizante hacia delante: la ganancia baja antes de que llegue el pico.
  const ventana = Math.max(1, Math.round(0.005 * pcm.frecuencia));
  const minimo = new Float32Array(n);
  const cola: number[] = [];
  let cabeza = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (cola.length > cabeza && requerida[cola[cola.length - 1]!]! >= requerida[i]!) cola.pop();
    cola.push(i);
    while (cola[cabeza]! > i + ventana) cabeza++;
    minimo[i] = requerida[cola[cabeza]!]!;
    if (cabeza > 4096) { cola.splice(0, cabeza); cabeza = 0; }
  }
  const liberar = 1 - Math.exp(-1 / (0.06 * pcm.frecuencia));
  const salida = new Float32Array(n);
  let g = 1;
  for (let i = 0; i < n; i++) {
    const objetivo = minimo[i]!;
    g = objetivo < g ? objetivo : g + (objetivo - g) * liberar;
    salida[i] = x[i]! * ganancia * g;
  }
  return { frecuencia: pcm.frecuencia, muestras: salida };
}

function utf16(texto: string): Uint8Array {
  const b = new Uint8Array(2 + texto.length * 2 + 2);
  b[0] = 0xff;
  b[1] = 0xfe;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    b[2 + i * 2] = c & 0xff;
    b[3 + i * 2] = c >> 8;
  }
  return b;
}

function marco(id: string, cuerpo: Uint8Array): Uint8Array {
  const m = new Uint8Array(10 + cuerpo.length);
  for (let i = 0; i < 4; i++) m[i] = id.charCodeAt(i);
  new DataView(m.buffer).setUint32(4, cuerpo.length);
  m.set(cuerpo, 10);
  return m;
}

const concatenar = (partes: Uint8Array[]) => {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const salida = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { salida.set(p, o); o += p.length; }
  return salida;
};

/** Etiqueta ID3v2.3 con texto en UTF-16 (título, artista, álbum, idioma y comentario). */
export function id3(meta: Metadatos): Uint8Array {
  const texto = (id: string, valor: string) => marco(id, concatenar([Uint8Array.of(1), utf16(valor)]));
  const marcos = [
    texto("TIT2", meta.titulo.slice(0, 200)),
    texto("TPE1", meta.artista),
    ...(meta.album ? [texto("TALB", meta.album)] : []),
    texto("TLAN", "spa"),
    marco("COMM", concatenar([Uint8Array.of(1, 0x73, 0x70, 0x61), utf16(""), utf16(meta.comentario)])),
  ];
  const cuerpo = concatenar(marcos);
  const cabecera = Uint8Array.of(0x49, 0x44, 0x33, 3, 0, 0,
    (cuerpo.length >> 21) & 0x7f, (cuerpo.length >> 14) & 0x7f, (cuerpo.length >> 7) & 0x7f, cuerpo.length & 0x7f);
  return concatenar([cabecera, cuerpo]);
}

/** Codifica a MP3 mono con LAME en JS. La frecuencia debe ser una de MPEG (24 kHz para las voces de Gemini). */
export async function aMp3(pcm: Pcm, meta: Metadatos, kbps: number = preset.kbps): Promise<Uint8Array> {
  if (!FRECUENCIAS_MP3.includes(pcm.frecuencia)) throw Error(`Frecuencia no admitida por MP3: ${pcm.frecuencia}`);
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const codificador = new Mp3Encoder(1, pcm.frecuencia, kbps);
  const partes: Uint8Array[] = [id3(meta)];
  const bloque = 1152 * 8;
  const enteros = new Int16Array(bloque);
  for (let i = 0; i < pcm.muestras.length; i += bloque) {
    const trozo = pcm.muestras.subarray(i, i + bloque);
    for (let j = 0; j < trozo.length; j++) enteros[j] = Math.max(-32768, Math.min(32767, Math.round(trozo[j]! * 32767)));
    const salida = codificador.encodeBuffer(trozo.length === bloque ? enteros : enteros.subarray(0, trozo.length));
    if (salida.length) partes.push(new Uint8Array(salida));
  }
  const final = codificador.flush();
  if (final.length) partes.push(new Uint8Array(final));
  return concatenar(partes);
}

/** WAV PCM 16 bits mono (para las pruebas y para guardar tramos en depuración). */
export function aWav(pcm: Pcm): Uint8Array {
  const n = pcm.muestras.length;
  const b = new Uint8Array(44 + n * 2);
  const v = new DataView(b.buffer);
  const escribir = (o: number, s: string) => { for (let i = 0; i < 4; i++) b[o + i] = s.charCodeAt(i); };
  escribir(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); escribir(8, "WAVE"); escribir(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, pcm.frecuencia, true);
  v.setUint32(28, pcm.frecuencia * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  escribir(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(pcm.muestras[i]! * 32767))), true);
  return b;
}
