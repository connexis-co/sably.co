// Proveedores de voz detrás de una interfaz común. Para añadir otro basta con implementar `Proveedor` y registrarlo
// en `PROVEEDORES`: la cola, el trabajador, el panel y el reproductor no cambian.
//   gemini   Gemini 3.8 Flash TTS (API Interactions), voces es-419. El de terapiadpareja.com, por defecto.
//   minimax  MiniMax speech-2.8 (voces de biblioteca y voces clonadas con permiso registrado).
// Las claves se leen del entorno del servidor (GEMINI_API_KEY, MINIMAX_API_KEY) y nunca se registran ni se devuelven.
import { leerWav, type Pcm } from "./audio";

export interface PerfilVoz {
  proveedor: string;
  voz: string;
  modelo?: string;
}

export interface Sintesis {
  pcm: Pcm;
  costoUsd: number;
  /** Cómo se calculó el coste (tokens o caracteres por tarifa). */
  fuenteCosto: string;
}

export type TipoError = "transitorio" | "saldo" | "credenciales" | "peticion";

/** Error clasificado: decide si se reintenta, si se pausa el proveedor o si la toma falla. */
export class ErrorProveedor extends Error {
  constructor(readonly tipo: TipoError, mensaje: string, readonly estado?: number) {
    super(mensaje);
  }
}

export interface Proveedor {
  id: string;
  nombre: string;
  /** Variable de entorno con la clave; sin ella el proveedor no está disponible. */
  clave: string;
  modeloPorDefecto: string;
  puedeClonar: boolean;
  /** Coste estimado de un texto de `caracteres` que dura `segundos`, para topes y estimaciones. */
  estimar(perfil: PerfilVoz, caracteres: number, segundos: number, fecha?: Date): number;
  sintetizar(texto: string, perfil: PerfilVoz, opciones: { estilo?: string; senal?: AbortSignal }): Promise<Sintesis>;
  clonar?(muestra: { datos: Uint8Array; nombreArchivo: string }, idVoz: string): Promise<{ voz: string; costoUsd: number }>;
}

export const estiloPorDefecto =
  "Narrador de audioguía en español latinoamericano neutro. Voz serena y cálida, con autoridad tranquila; " +
  "ritmo pausado y natural, con pausas breves entre ideas. Sin dramatizar ni sonar a anuncio.";

function clave(nombre: string) {
  const valor = process.env[nombre];
  if (!valor) throw new ErrorProveedor("credenciales", `Falta la variable de entorno ${nombre} en el servidor`);
  return valor;
}

export const disponible = (p: Proveedor) => Boolean(process.env[p.clave]);

/** Clasifica una respuesta HTTP fallida sin copiar al registro nada que pueda llevar la clave. */
export function clasificar(estado: number, cuerpo: string): ErrorProveedor {
  const texto = cuerpo.slice(0, 300).replace(/key=[\w-]+/gi, "key=…");
  if (estado === 401 || estado === 403) return new ErrorProveedor("credenciales", `HTTP ${estado}: ${texto}`, estado);
  if (estado === 402 || /billing|insufficient|balance|saldo|FAILED_PRECONDITION/i.test(cuerpo))
    return new ErrorProveedor("saldo", `HTTP ${estado}: ${texto}`, estado);
  if (estado === 429 || estado === 408 || estado >= 500) return new ErrorProveedor("transitorio", `HTTP ${estado}: ${texto}`, estado);
  return new ErrorProveedor("peticion", `HTTP ${estado}: ${texto}`, estado);
}

async function postJson(url: string, cuerpo: unknown, cabeceras: Record<string, string>, senal?: AbortSignal, ms = 180_000) {
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cabeceras },
      body: JSON.stringify(cuerpo),
      signal: senal ? AbortSignal.any([senal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms),
    });
  } catch (e) {
    throw new ErrorProveedor("transitorio", `Sin respuesta del proveedor: ${(e as Error).name}`);
  }
  const texto = await r.text();
  if (!r.ok) throw clasificar(r.status, texto);
  try {
    return JSON.parse(texto) as Record<string, unknown>;
  } catch {
    throw new ErrorProveedor("transitorio", "Respuesta no válida del proveedor");
  }
}

// ---------------------------------------------------------------------------------------------------
// Gemini 3.8 Flash TTS
// ---------------------------------------------------------------------------------------------------

/** Precios de lista por millón de tokens (texto de entrada, audio de salida). Leídos el 25-nov-2026 por terapiadpareja. */
export function tarifaGemini(modelo: string, fecha = new Date()): [number, number] {
  const desde2027 = fecha >= new Date("2027-01-01T00:00:00Z");
  const tabla: Record<string, [number, number]> = {
    "gemini-3.8-flash-tts": desde2027 ? [1, 18] : [0.5, 9],
    "gemini-3.8-flash-lite-tts": desde2027 ? [1, 12] : [0.5, 6],
    "gemini-2.5-pro-preview-tts": [1, 20],
  };
  const t = tabla[modelo];
  if (!t) throw new ErrorProveedor("peticion", `Sin tarifa registrada para ${modelo}`);
  return t;
}

/** Tokens de audio por segundo en la salida de Gemini (medido por terapiadpareja). */
const TOKENS_AUDIO_POR_SEGUNDO = 25;

export const gemini: Proveedor = {
  id: "gemini",
  nombre: "Gemini 3.8 Flash TTS",
  clave: "GEMINI_API_KEY",
  modeloPorDefecto: "gemini-3.8-flash-tts",
  puedeClonar: false,
  estimar(perfil, caracteres, segundos, fecha) {
    const [texto, audio] = tarifaGemini(perfil.modelo ?? this.modeloPorDefecto, fecha);
    return ((caracteres / 4 + 60) * texto + segundos * TOKENS_AUDIO_POR_SEGUNDO * audio) / 1e6;
  },
  async sintetizar(texto, perfil, { estilo, senal }) {
    const modelo = perfil.modelo ?? this.modeloPorDefecto;
    const [precioTexto, precioAudio] = tarifaGemini(modelo);
    const d = await postJson("https://generativelanguage.googleapis.com/v1beta/interactions", {
      model: modelo,
      input: [{ type: "user_input", content: [{ type: "text", text: texto, annotations: [
        { type: "speech_metadata", style: estilo ?? estiloPorDefecto }] }] }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: perfil.voz }] },
    }, { "x-goog-api-key": clave(this.clave) }, senal);
    const pasos = (d.steps ?? []) as { type?: string; content?: { type?: string; data?: string }[] }[];
    const datos = pasos.filter((s) => s.type === "model_output").flatMap((s) => s.content ?? [])
      .filter((c) => c.type === "audio").at(-1)?.data;
    if (!datos) throw new ErrorProveedor("transitorio", "Gemini no devolvió audio");
    const pcm = leerWav(Buffer.from(datos, "base64"));
    const uso = (d.usage ?? {}) as { total_input_tokens?: number; total_output_tokens?: number };
    const entrada = uso.total_input_tokens ?? Math.round(texto.length / 4);
    const audio = uso.total_output_tokens ?? Math.round((pcm.muestras.length / pcm.frecuencia) * TOKENS_AUDIO_POR_SEGUNDO);
    return {
      pcm,
      costoUsd: (entrada * precioTexto + audio * precioAudio) / 1e6,
      fuenteCosto: `${entrada} tokens de texto × USD ${precioTexto}/M + ${audio} de audio × USD ${precioAudio}/M`,
    };
  },
};

// ---------------------------------------------------------------------------------------------------
// MiniMax speech-2.8 (no probado en Sably: queda para voces clonadas con permiso)
// ---------------------------------------------------------------------------------------------------

const PRECIO_MINIMAX: Record<string, number> = { "speech-2.8-hd": 100, "speech-2.8-turbo": 60 };

export const minimax: Proveedor = {
  id: "minimax",
  nombre: "MiniMax speech-2.8",
  clave: "MINIMAX_API_KEY",
  modeloPorDefecto: "speech-2.8-hd",
  puedeClonar: true,
  estimar(perfil, caracteres) {
    return (caracteres * (PRECIO_MINIMAX[perfil.modelo ?? this.modeloPorDefecto] ?? 100)) / 1e6;
  },
  async sintetizar(texto, perfil, { senal }) {
    const modelo = perfil.modelo ?? this.modeloPorDefecto;
    const precio = PRECIO_MINIMAX[modelo];
    if (!precio) throw new ErrorProveedor("peticion", `Sin tarifa registrada para ${modelo}`);
    const d = await postJson("https://api.minimax.io/v1/t2a_v2", {
      model: modelo, text: texto, stream: false, language_boost: "Spanish", output_format: "hex",
      voice_setting: { voice_id: perfil.voz, speed: 0.95, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 24000, format: "pcm", channel: 1 },
    }, { Authorization: "Bearer " + clave(this.clave) }, senal);
    const base = d.base_resp as { status_code?: number; status_msg?: string } | undefined;
    if (base?.status_code !== 0) {
      const msg = `MiniMax ${base?.status_code ?? "?"}: ${base?.status_msg ?? "sin respuesta"}`;
      throw new ErrorProveedor(base?.status_code === 1008 ? "saldo" : base?.status_code === 1004 ? "credenciales" : "transitorio", msg);
    }
    const caracteres = Number((d.extra_info as { usage_characters?: number } | undefined)?.usage_characters ?? texto.length);
    const pcm = leerWav(Buffer.from(String((d.data as { audio?: string } | undefined)?.audio ?? ""), "hex"), 24000);
    return { pcm, costoUsd: (caracteres * precio) / 1e6, fuenteCosto: `${caracteres} caracteres × USD ${precio}/M` };
  },
  async clonar(muestra, idVoz) {
    const k = clave(this.clave);
    const form = new FormData();
    form.append("purpose", "voice_clone");
    form.append("file", new Blob([muestra.datos as Uint8Array<ArrayBuffer>]), muestra.nombreArchivo);
    const r = await fetch("https://api.minimax.io/v1/files/upload", { method: "POST", headers: { Authorization: "Bearer " + k }, body: form });
    const subida = (await r.json().catch(() => ({}))) as { file?: { file_id?: number } };
    if (!r.ok || !subida.file?.file_id) throw clasificar(r.status || 500, JSON.stringify(subida));
    const d = await postJson("https://api.minimax.io/v1/voice_clone", { file_id: subida.file.file_id, voice_id: idVoz },
      { Authorization: "Bearer " + k });
    const base = d.base_resp as { status_code?: number; status_msg?: string } | undefined;
    if (base?.status_code !== 0) throw new ErrorProveedor("peticion", `MiniMax ${base?.status_code}: ${base?.status_msg}`);
    return { voz: idVoz, costoUsd: 0 };
  },
};

export const PROVEEDORES: Record<string, Proveedor> = { gemini, minimax };

export function proveedor(id: string): Proveedor {
  const p = PROVEEDORES[id];
  if (!p) throw new ErrorProveedor("peticion", `Proveedor desconocido: ${id}`);
  return p;
}
