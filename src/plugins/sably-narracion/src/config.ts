// Ajustes del panel (guardados en ctx.kv `config`) con valores por defecto y validación.
import { estiloPorDefecto, PROVEEDORES, type PerfilVoz } from "./proveedores";
import { bloquesNarrables, bloquesPreguntas, camposBlog, type CampoNarrable } from "./texto";

export const pluginId = "sably-narracion";

/** Colecciones que se pueden narrar y qué campos se leen de cada una. */
export const COLECCIONES: Record<string, { etiqueta: string; campos: CampoNarrable[]; ruta: (slug: string) => string }> = {
  blog: { etiqueta: "Artículos del blog", campos: camposBlog, ruta: (slug) => `/blog/${slug}/` },
  courses: {
    etiqueta: "Fichas de curso",
    campos: [{ campo: "title" }, { campo: "description" }, { campo: "body", tipo: "portableText" }],
    ruta: (slug) => `/co/${slug}/`,
  },
};

export interface Config {
  colecciones: Record<string, boolean>;
  /** Id del catálogo de voces que se usa por defecto. */
  voz: string;
  estilo: string;
  revision: "automatica" | "manual";
  topeMensualUsd: number;
  topeLoteUsd: number;
  incluirPreguntas: boolean;
  deposito: "auto" | "r2" | "disco";
  pronunciaciones: Record<string, string>;
  /** Caracteres por segundo esperados de la voz (para el control de duración). */
  caracteresPorSegundo: number;
}

export interface Voz extends PerfilVoz {
  id: string;
  etiqueta: string;
  origen: "biblioteca" | "clonada";
  /** Id del registro de permiso (solo voces clonadas). */
  permiso?: string;
  activa: boolean;
  creada: number;
}

export const VOCES_INICIALES: Voz[] = [
  { id: "csagent-9", proveedor: "gemini", voz: "es-419-csagent-9", modelo: "gemini-3.8-flash-tts", origen: "biblioteca", activa: true, creada: 0,
    etiqueta: "Masculina, madura, mexicano neutro, grave y serena (la de terapiadpareja.com)" },
  { id: "techagent-13", proveedor: "gemini", voz: "es-419-techagent-13", modelo: "gemini-3.8-flash-tts", origen: "biblioteca", activa: true, creada: 0,
    etiqueta: "Masculina, cuarentona, acento colombiano, cálida y clara (terapiadpareja.com, temas de habilidades)" },
];

export const CONFIG_INICIAL: Config = {
  colecciones: { blog: true, courses: false },
  voz: "csagent-9",
  estilo: estiloPorDefecto,
  revision: "automatica",
  topeMensualUsd: 5,
  topeLoteUsd: 2,
  incluirPreguntas: false,
  deposito: "auto",
  pronunciaciones: { SMAW: "ese eme a doble ve", COP: "pesos colombianos", ARS: "pesos argentinos" },
  // Medido con es-419-csagent-9 el 25-nov-2026: 2.294 caracteres en 169,6 s (13,5 c/s).
  caracteresPorSegundo: 13.5,
};

const numero = (v: unknown, min: number, max: number, defecto: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : defecto;

/** Mezcla lo guardado con los valores por defecto y descarta lo que no sea válido. */
export function normalizarConfig(valor: unknown): Config {
  const v = (valor && typeof valor === "object" ? valor : {}) as Partial<Config>;
  const colecciones = { ...CONFIG_INICIAL.colecciones };
  for (const c of Object.keys(COLECCIONES)) if (typeof v.colecciones?.[c] === "boolean") colecciones[c] = v.colecciones[c]!;
  const pronunciaciones: Record<string, string> = {};
  for (const [k, l] of Object.entries(v.pronunciaciones ?? CONFIG_INICIAL.pronunciaciones))
    if (typeof l === "string" && k.trim() && l.trim() && k.length <= 40 && l.length <= 120) pronunciaciones[k.trim()] = l.trim();
  return {
    colecciones,
    voz: typeof v.voz === "string" && /^[a-z0-9-]{1,40}$/.test(v.voz) ? v.voz : CONFIG_INICIAL.voz,
    estilo: typeof v.estilo === "string" && v.estilo.trim().length >= 10 ? v.estilo.trim().slice(0, 600) : CONFIG_INICIAL.estilo,
    revision: v.revision === "manual" ? "manual" : "automatica",
    topeMensualUsd: numero(v.topeMensualUsd, 0, 200, CONFIG_INICIAL.topeMensualUsd),
    topeLoteUsd: numero(v.topeLoteUsd, 0, 100, CONFIG_INICIAL.topeLoteUsd),
    incluirPreguntas: v.incluirPreguntas === true,
    deposito: v.deposito === "r2" || v.deposito === "disco" ? v.deposito : "auto",
    pronunciaciones,
    caracteresPorSegundo: numero(v.caracteresPorSegundo, 8, 30, CONFIG_INICIAL.caracteresPorSegundo),
  };
}

export function validarVoz(v: Partial<Voz>): string | undefined {
  if (!v.proveedor || !PROVEEDORES[v.proveedor]) return "Proveedor desconocido.";
  if (!v.voz || !/^[\w.-]{2,80}$/.test(v.voz)) return "El identificador de la voz no es válido.";
  if (!v.etiqueta?.trim()) return "Escribe una descripción de la voz.";
  return undefined;
}

/** Bloques narrables de una entrada según su colección y los ajustes. */
export function bloquesDe(coleccion: string, datos: Record<string, unknown>, config: Pick<Config, "incluirPreguntas">): string[] {
  const def = COLECCIONES[coleccion];
  if (!def) return [];
  const bloques = bloquesNarrables(datos, def.campos);
  if (config.incluirPreguntas && coleccion === "blog") {
    const preguntas = bloquesPreguntas(datos.faq);
    if (preguntas.length) bloques.push("Preguntas frecuentes", ...preguntas);
  }
  return bloques;
}
