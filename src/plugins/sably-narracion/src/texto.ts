// Texto narrable de una entrada de EmDash: extracción, huella y normalización para voz sintética.
// Copia de terapiadpareja.com (`web/plugins/sably-narracion/src/texto.ts`, 25-nov-2026): misma huella y mismas reglas.
// Cambios de Sably: la huella usa Web Crypto (vale en Node y en Cloudflare), campos del blog y lecturas propias.
//
// La huella se calcula sobre el texto tal como lo lee la persona (antes de normalizar), con el mismo
// formato que `narraciones.json`: SHA-256 de JSON.stringify(bloques). Cambiar las reglas de normalización
// no invalida audios aprobados; cambiar el texto publicado sí.

/** Cómo se lee un campo de la entrada. */
export type CampoNarrable =
  | { campo: string; tipo?: "texto" }
  | { campo: string; tipo: "secciones"; titulo?: string; parrafos?: string }
  | { campo: string; tipo: "portableText" };

/** Campos de los artículos del blog de Sably: título, descripción y cuerpo en Portable Text. */
export const camposBlog: CampoNarrable[] = [
  { campo: "title" },
  { campo: "description" },
  { campo: "body", tipo: "portableText" },
];

/** Preguntas frecuentes del artículo (`faq: [{ question, answer }]`), solo si el ajuste lo pide. */
export function bloquesPreguntas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const bloques: string[] = [];
  for (const p of valor) {
    if (!p || typeof p !== "object") continue;
    const { question, answer } = p as { question?: unknown; answer?: unknown };
    if (typeof question === "string" && question.trim()) bloques.push(question.trim());
    if (typeof answer === "string" && answer.trim()) bloques.push(answer.trim());
  }
  return bloques;
}

/** Campos de las guías de terapiadpareja: título, entradilla y secciones. Fuentes y FAQ quedan fuera. */
export const camposGuia: CampoNarrable[] = [
  { campo: "title" },
  { campo: "summary" },
  { campo: "sections", tipo: "secciones", titulo: "title", parrafos: "paragraphs" },
];

// Las cadenas se conservan tal cual (sin recortar ni descartar vacías): la huella debe coincidir byte a byte con la
// de las narraciones ya publicadas. Los bloques sin letras se descartan después, al preparar el guion.
const esTexto = (valor: unknown): valor is string => typeof valor === "string";

function portableText(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const bloques: string[] = [];
  for (const bloque of valor) {
    if (!bloque || typeof bloque !== "object") continue;
    const b = bloque as { _type?: unknown; children?: unknown; style?: unknown };
    // Solo párrafos, títulos y citas. Imágenes, código, tablas, incrustados y bloques propios no se leen.
    if (b._type !== "block" || !Array.isArray(b.children)) continue;
    if (typeof b.style === "string" && !/^(normal|h[1-6]|blockquote)$/.test(b.style)) continue;
    const linea = b.children
      .map((hijo) => (hijo && typeof hijo === "object" && typeof (hijo as { text?: unknown }).text === "string"
        ? (hijo as { text: string }).text : ""))
      .join("")
      .trim();
    if (linea) bloques.push(linea);
  }
  return bloques;
}

/** Bloques de texto, en orden de lectura, sin normalizar. Lo que no es texto narrable se descarta. */
export function bloquesNarrables(datos: Record<string, unknown>, campos: CampoNarrable[] = camposGuia): string[] {
  const bloques: string[] = [];
  for (const c of campos) {
    const valor = datos[c.campo];
    if (c.tipo === "secciones") {
      if (!Array.isArray(valor)) continue;
      for (const seccion of valor) {
        if (!seccion || typeof seccion !== "object") continue;
        const s = seccion as Record<string, unknown>;
        const titulo = s[c.titulo ?? "title"];
        if (esTexto(titulo)) bloques.push(titulo);
        const parrafos = s[c.parrafos ?? "paragraphs"];
        if (Array.isArray(parrafos)) for (const p of parrafos) if (esTexto(p)) bloques.push(p);
      }
    } else if (c.tipo === "portableText") {
      bloques.push(...portableText(valor));
    } else if (esTexto(valor)) {
      bloques.push(valor);
    }
  }
  return bloques;
}

/** SHA-256 en hexadecimal con Web Crypto (Node 22+ y Cloudflare Workers). */
export async function sha256(datos: string | Uint8Array): Promise<string> {
  const bytes = typeof datos === "string" ? new TextEncoder().encode(datos) : datos;
  const resumen = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Huella del texto narrado: SHA-256 de JSON.stringify(bloques), igual que en terapiadpareja. */
export function huella(bloques: string[]) {
  return sha256(JSON.stringify(bloques));
}

// ---------------------------------------------------------------------------------------------------
// Números en letras (español, de 0 a 999 999 999 999)
// ---------------------------------------------------------------------------------------------------

const UNIDADES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte",
  "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho",
  "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos",
  "setecientos", "ochocientos", "novecientos"];

export type Genero = "masculino" | "femenino" | "neutro";

function hastaMil(n: number, genero: Genero): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let centenas = CENTENAS[c] ?? "";
  if (genero === "femenino" && c > 1) centenas = centenas.replace(/ientos$/, "ientas");
  let decenas = "";
  if (resto > 0) {
    if (resto < 30) decenas = UNIDADES[resto]!;
    else decenas = DECENAS[Math.floor(resto / 10)]! + (resto % 10 ? " y " + UNIDADES[resto % 10] : "");
  }
  // «uno» delante de un sustantivo: «un» o «una»; también «veintiún», «treinta y un».
  if (resto % 10 === 1 && resto !== 11 && genero !== "neutro") {
    const forma = genero === "femenino" ? "una" : "un";
    decenas = decenas.replace(/(veinti)?uno$/, (_m, veinti) => (veinti ? (genero === "femenino" ? "veintiuna" : "veintiún") : forma));
  }
  return [centenas, decenas].filter(Boolean).join(" ");
}

/** Número entero en letras. El género concuerda con el sustantivo que sigue («una semana», «doscientas personas»). */
export function numeroEnLetras(n: number, genero: Genero = "neutro"): string {
  if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) return String(n);
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1e6);
  const miles = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "un millón" : hastaMil1e6(millones) + " millones");
  if (miles) partes.push(miles === 1 ? "mil" : hastaMil(miles, genero === "femenino" ? "femenino" : "masculino") + " mil");
  if (resto) partes.push(hastaMil(resto, genero));
  return partes.join(" ");
}

function hastaMil1e6(n: number): string {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  return [miles ? (miles === 1 ? "mil" : hastaMil(miles, "masculino") + " mil") : "", resto ? hastaMil(resto, "masculino") : ""]
    .filter(Boolean).join(" ");
}

const ORDINALES: Record<number, string> = {
  1: "primer", 2: "segund", 3: "tercer", 4: "cuart", 5: "quint", 6: "sext", 7: "séptim", 8: "octav", 9: "noven", 10: "décim",
};

function ordinal(n: number, sufijo: string) {
  const raiz = ORDINALES[n];
  if (!raiz) return numeroEnLetras(n);
  const femenino = /a$/i.test(sufijo);
  if (n === 1 || n === 3) return raiz + (femenino ? "a" : /er$/i.test(sufijo) ? "" : "o");
  return raiz + (femenino ? "a" : "o");
}

/** Género probable del sustantivo que sigue a una cifra. */
function generoSiguiente(resto: string): Genero {
  const palabra = /^\s+([a-záéíóúñü]+)/i.exec(resto)?.[1]?.toLowerCase();
  if (!palabra) return "neutro";
  if (/^(día|días|mapa|mapas|problema|problemas|tema|temas|programa|programas|idioma|idiomas|sistema|sistemas)$/.test(palabra)) return "masculino";
  if (/(as?|ión|iones|dad|dades|tud|tudes|umbre|umbres|sis)$/.test(palabra)) return "femenino";
  if (/^(de|del|y|o|a|en|por|para|al|con)$/.test(palabra)) return "neutro";
  return "masculino";
}

function digitoADigito(cifras: string) {
  return cifras.replace(/\D/g, "").split("").map((d) => UNIDADES[Number(d)]).join(" ");
}

const MONEDAS: [RegExp, string, string][] = [
  [/^(?:US\$|USD|U\$S)$/i, "dólar", "dólares"],
  [/^(?:€|EUR)$/i, "euro", "euros"],
  [/^MXN$/i, "peso mexicano", "pesos mexicanos"],
  [/^COP$/i, "peso colombiano", "pesos colombianos"],
  [/^ARS$/i, "peso argentino", "pesos argentinos"],
  [/^CLP$/i, "peso chileno", "pesos chilenos"],
  [/^PEN$/i, "sol", "soles"],
  [/^\$$/, "peso", "pesos"],
];

function cantidad(entero: string, decimales?: string, genero: Genero = "neutro") {
  const n = Number(entero.replace(/[.\s]/g, ""));
  const base = numeroEnLetras(n, genero);
  return decimales ? base + " coma " + (decimales.length > 2 ? digitoADigito(decimales) : numeroEnLetras(Number(decimales))) : base;
}

const NUM = String.raw`\d{1,3}(?:[.\u00A0\u202F ]\d{3})+|\d+`;

/** Cifras, horas, porcentajes, ordinales, rangos y monedas en letras. */
export function cifrasEnLetras(t: string): string {
  let s = t;
  // Teléfonos y líneas de ayuda: cifra a cifra («llama al 106», «800 911 2000», «024»).
  s = s.replace(/\b(línea|linea|llama al|llamar al|marca el|marcar el|número|numero|teléfono|telefono|whatsapp)\s+(\+?\d[\d\s-]{1,16}\d)\b/gi,
    (_m, previa: string, cifras: string) => previa + " " + digitoADigito(cifras));
  s = s.replace(/\b\d{2,4}(?:[ -]\d{2,4}){2,}\b/g, (m) => digitoADigito(m));
  s = s.replace(/(?<!\d[.   ])\b0\d{2,}\b/g, (m) => digitoADigito(m));
  // Horas.
  s = s.replace(/(\b(?:a\s)?las?\s)?\b(\d{1,2}):(\d{2})(?:\s*(a\.\s?m\.|p\.\s?m\.|h\b))?/gi, (_m, articulo: string | undefined, h: string, min: string, sufijo?: string) => {
    const hora = Number(h);
    const minutos = Number(min);
    const previo = articulo ? articulo.replace(/las?\s$/i, "") : "";
    const base = previo + (hora === 1 ? "la una" : "las " + numeroEnLetras(hora)) + (minutos ? " y " + numeroEnLetras(minutos) : " en punto");
    if (!sufijo || /^h$/i.test(sufijo)) return base;
    return base + (/a/i.test(sufijo) ? " de la mañana" : hora >= 7 && hora < 12 ? " de la noche" : " de la tarde");
  });
  // Monedas delante o detrás de la cifra.
  s = s.replace(new RegExp(String.raw`(US\$|USD|U\$S|€|EUR|MXN|COP|ARS|CLP|PEN|\$)\s?(${NUM})(?:,(\d+))?`, "g"), (_m, simbolo: string, entero: string, dec?: string) => {
    const moneda = MONEDAS.find(([re]) => re.test(simbolo))!;
    const n = Number(entero.replace(/[.\s]/g, ""));
    return cantidad(entero, dec, "masculino") + " " + (n === 1 && !dec ? moneda[1] : moneda[2]);
  });
  s = s.replace(new RegExp(String.raw`(${NUM})(?:,(\d+))?\s?(USD|EUR|€|MXN|COP|ARS|CLP|PEN)\b`, "g"), (_m, entero: string, dec: string | undefined, simbolo: string) => {
    const moneda = MONEDAS.find(([re]) => re.test(simbolo))!;
    return cantidad(entero, dec, "masculino") + " " + (Number(entero) === 1 && !dec ? moneda[1] : moneda[2]);
  });
  // Porcentajes.
  s = s.replace(new RegExp(String.raw`(${NUM})(?:,(\d+))?\s?%`, "g"), (_m, entero: string, dec?: string) => cantidad(entero, dec) + " por ciento");
  s = s.replace(/(\d)\s?°\s?C?\b/g, "$1 grados");
  // Ordinales: 1.º, 2.ª, 1er, 3er.
  s = s.replace(/\b(\d{1,2})(?:\.?([ºª])|(er|ra|ro|do|da|to|ta|vo|va|mo|ma|no|na)\b)/gi, (m, n: string, simbolo?: string, letras?: string) => {
    const sufijo = simbolo === "ª" ? "a" : simbolo ? "o" : (letras ?? "o");
    return Number(n) <= 10 ? ordinal(Number(n), sufijo) : m;
  });
  // Rangos «3-5», «3–5»: «tres a cinco».
  s = s.replace(new RegExp(String.raw`\b(${NUM})\s?[-–]\s?(${NUM})\b`, "g"), (_m, a: string, b: string, offset: number, todo: string) =>
    cantidad(a) + " a " + cantidad(b, undefined, generoSiguiente(todo.slice(offset + _m.length))));
  // Decimales con coma y enteros, con concordancia de género.
  s = s.replace(new RegExp(String.raw`\b(${NUM})(?:,(\d+))?\b`, "g"), (m, entero: string, dec: string | undefined, offset: number, todo: string) =>
    cantidad(entero, dec, dec ? "neutro" : generoSiguiente(todo.slice(offset + m.length))));
  return s;
}

// ---------------------------------------------------------------------------------------------------
// Siglas, abreviaturas y signos
// ---------------------------------------------------------------------------------------------------

const LETRAS: Record<string, string> = {
  A: "a", B: "be", C: "ce", D: "de", E: "e", F: "efe", G: "ge", H: "hache", I: "i", J: "jota", K: "ka", L: "ele",
  M: "eme", N: "ene", Ñ: "eñe", O: "o", P: "pe", Q: "cu", R: "erre", S: "ese", T: "te", U: "u", V: "uve", W: "uve doble",
  X: "equis", Y: "ye", Z: "zeta",
};

/** Pronunciaciones por defecto. Cada sitio puede añadir las suyas en la configuración del plugin. */
export const pronunciacionesBase: Record<string, string> = {
  "EE. UU.": "Estados Unidos",
  "EE.UU.": "Estados Unidos",
  "p. ej.": "por ejemplo",
  "etc.": "etcétera",
  "aprox.": "aproximadamente",
  "Dr.": "doctor",
  "Dra.": "doctora",
  "Sr.": "señor",
  "Sra.": "señora",
  "núm.": "número",
  "pág.": "página",
  "vs.": "frente a",
  "PHQ-4": "pe hache cu cuatro",
  "PHQ-9": "pe hache cu nueve",
  "GAD-7": "ge a de siete",
  OMS: "o eme ese",
  OPS: "o pe ese",
  NHS: "ene hache ese",
  APA: "APA",
  ONU: "ONU",
  UNICEF: "UNICEF",
  IA: "inteligencia artificial",
  TCC: "te ce ce",
};

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function deletrear(sigla: string) {
  return sigla.split("").map((l) => LETRAS[l] ?? l).join(" ");
}

/** Siglas y abreviaturas conocidas por su lectura; las siglas desconocidas sin vocales se deletrean. */
export function siglas(t: string, pronunciaciones: Record<string, string> = {}): string {
  const tabla = { ...pronunciacionesBase, ...pronunciaciones };
  let s = t;
  const claves = Object.keys(tabla).sort((a, b) => b.length - a.length);
  for (const clave of claves) {
    const inicio = /^\w/.test(clave) ? String.raw`(?<![\wÁÉÍÓÚÑáéíóúñ])` : "";
    const fin = /\w$/.test(clave) ? String.raw`(?![\wÁÉÍÓÚÑáéíóúñ])` : "";
    const lectura = tabla[clave]!;
    s = s.replace(new RegExp(inicio + escapar(clave) + fin, "g"), (m: string, offset: number, todo: string) =>
      clave.endsWith(".") && /^\s+[A-ZÁÉÍÓÚÑ¿¡]/.test(todo.slice(offset + m.length)) ? lectura + "." : lectura);
  }
  // Una sigla sin vocales no se puede leer como palabra («NHS»): se deletrea. «NO» o «ONU» quedan igual.
  return s.replace(/(?<![\wÁÉÍÓÚÑáéíóúñ])([B-DF-HJ-NP-TV-XZÑ]{2,5})(?![\wÁÉÍÓÚÑáéíóúñ])/g, (m: string) => deletrear(m));
}

/** Signos que la voz leería mal o en voz alta; enlaces, correos y emojis se quitan. */
export function signos(t: string): string {
  return t
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/[“„]|"(?=\p{L})/gu, "«")
    .replace(/[”"]/g, "»")
    .replace(/[‘’]/g, "'")
    .replace(/\s+[—–]\s+|\s*—\s*/g, ", ")
    .replace(/\s*[·•|]\s*/g, ", ")
    .replace(/\s*\(([^()]*)\)/g, ", $1,")
    .replace(/[[\]{}*_#~`^<>]/g, "")
    .replace(/\by\/o\b/g, "y o")
    .replace(/(\p{L})\s?\/\s?(\p{L})/gu, "$1 o $2")
    .replace(/\s?&\s?/g, " y ")
    .replace(/(\p{L}|\d)\s?\+\s?(\p{L}|\d)/gu, "$1 más $2")
    .replace(/\s?=\s?/g, " igual a ")
    .replace(/\.{3}|…/g, "…")
    .replace(/\s+,/g, ",")
    .replace(/,\s*([,.;:!?…])/g, "$1")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;:\s]+/, "")
    .trim();
}

/** Cierra el bloque con puntuación para que la voz haga la pausa y la entonación finales. */
function cerrar(t: string) {
  if (/:$/.test(t)) return t.slice(0, -1) + ".";
  return /[.!?…]»?$/.test(t) ? t : t + ".";
}

export interface OpcionesVoz {
  pronunciaciones?: Record<string, string>;
}

/** Normaliza un bloque para TTS: siglas y abreviaturas, cifras en letras y signos. */
export function normalizarParaVoz(t: string, opciones: OpcionesVoz = {}): string {
  return cerrar(signos(cifrasEnLetras(siglas(t, opciones.pronunciaciones))));
}

export interface Fragmento {
  texto: string;
  /** Silencio antes del bloque, en segundos (título → párrafo, párrafo → párrafo). */
  pausa: number;
}

/** Guion para el proveedor de voz: un fragmento por bloque, con la pausa editorial entre bloques. */
export function guion(bloques: string[], opciones: OpcionesVoz = {}): Fragmento[] {
  return bloques
    .map((b) => normalizarParaVoz(b, opciones))
    .filter((b) => /\p{L}/u.test(b))
    .map((texto, i) => ({ texto, pausa: i === 0 ? 0 : 0.58 }));
}

/** Versión de las reglas de normalización: forma parte del perfil de cada narración. */
export const versionNormalizador = "1";
