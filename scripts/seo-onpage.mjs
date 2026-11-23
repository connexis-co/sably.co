/**
 * Auditoría on-page de una página ya renderizada.
 *
 * `verify-indexable-html.mjs` responde «¿esta URL se puede indexar?». Este
 * módulo responde «¿la página está bien construida?»: jerarquía de
 * encabezados, título, descripción, imágenes, marcado y textos que no deben
 * volver. No lanza: devuelve la lista de hallazgos para que quien llama decida
 * (el test falla con cualquier `error`; la CLI informa también los `aviso`).
 */

/**
 * Repite el reemplazo hasta que no cambie nada: quitar un bloque puede juntar
 * los restos de otro (`<scr<script></script>ipt>`) y una pasada no basta.
 */
const hastaEstable = (valor, patron, reemplazo = ' ') => {
  let antes;
  do {
    antes = valor;
    valor = valor.replace(patron, reemplazo);
  } while (valor !== antes);
  return valor;
};

/** Comentarios HTML, incluido el cierre `--!>` que los navegadores también aceptan. */
const COMENTARIO = /<!--[\s\S]*?--!?>/g;
/** Bloques que no son contenido visible; el cierre admite espacios o atributos (`</script >`). */
const CODIGO = /<script\b[^>]*>[\s\S]*?<\/script[^>]*>|<style\b[^>]*>[\s\S]*?<\/style[^>]*>|<template\b[^>]*>[\s\S]*?<\/template[^>]*>/gi;

// `&amp;` se decodifica el último: antes convertiría `&amp;quot;` en una comilla.
const texto = (html) =>
  hastaEstable(html, /<[^>]+>/g)
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const atributo = (tag, nombre) => {
  const m = tag.match(new RegExp(`\\s${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[1] ?? m[2]) : undefined;
};

/** Encabezados en orden de documento: `{ nivel, texto }`. */
export function encabezados(html) {
  const cuerpo = hastaEstable(hastaEstable(html, COMENTARIO), CODIGO);
  return [...cuerpo.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ nivel: Number(m[1]), texto: texto(m[2]) }));
}

/** Textos que se retiraron del sitio por no ser ciertos y no deben reaparecer. */
export const TEXTOS_VETADOS = [
  [/Tu instructor/i, 'bloque de instructor sin dato verificado'],
  [/\bafiliad[oa]s?\b/i, 'la palabra «afiliado» en texto público'],
  [/\bcupo(s)? (sigue|limitad|disponible)/i, 'escasez falsa («cupo») en un curso online'],
  [/\bsolo (por )?hoy\b/i, 'urgencia falsa («solo hoy»)'],
];

/**
 * @param {string} url
 * @param {string} html
 * @param {{ limites?: { titulo?: number, descripcionMin?: number, descripcionMax?: number } }} [opciones]
 * @returns {{ regla: string, nivel: 'error' | 'aviso', detalle: string }[]}
 */
export function auditarOnPage(url, html, opciones = {}) {
  const limites = { titulo: 60, descripcionMin: 70, descripcionMax: 160, ...opciones.limites };
  const hallazgos = [];
  const marcar = (regla, nivel, detalle) => hallazgos.push({ regla, nivel, detalle });
  const documento = hastaEstable(html, COMENTARIO, '');
  const sinCodigo = hastaEstable(documento, CODIGO);

  // ── Encabezados ──────────────────────────────────────────────────────────
  const hs = encabezados(documento);
  const h1 = hs.filter((h) => h.nivel === 1);
  if (h1.length !== 1) marcar('h1-unico', 'error', `${h1.length} H1 (debe haber exactamente uno)`);
  if (hs.length && hs[0].nivel !== 1) {
    const antes = hs.findIndex((h) => h.nivel === 1);
    marcar('h1-primero', 'error', `${antes < 0 ? hs.length : antes} encabezado(s) antes del H1; el primero es H${hs[0].nivel} «${hs[0].texto.slice(0, 40)}»`);
  }
  let previo = 0;
  for (const h of hs) {
    if (previo && h.nivel > previo + 1) marcar('sin-saltos', 'error', `salto de H${previo} a H${h.nivel} en «${h.texto.slice(0, 50)}»`);
    if (!h.texto) marcar('encabezado-vacio', 'error', `H${h.nivel} sin texto`);
    previo = h.nivel;
  }
  if (h1[0] && h1[0].texto.length > 70) marcar('h1-largo', 'aviso', `H1 de ${h1[0].texto.length} caracteres`);

  // ── Título y descripción ─────────────────────────────────────────────────
  const titulo = texto((documento.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? '');
  if (!titulo) marcar('titulo', 'error', 'sin <title>');
  else if (titulo.length > limites.titulo) marcar('titulo-largo', 'aviso', `título de ${titulo.length} caracteres`);
  const metas = [...documento.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const descripcion = atributo(metas.find((m) => /name=["']description["']/i.test(m)) ?? '', 'content') ?? '';
  if (!descripcion) marcar('descripcion', 'error', 'sin meta description');
  else if (descripcion.length < limites.descripcionMin || descripcion.length > limites.descripcionMax)
    marcar('descripcion-longitud', 'aviso', `descripción de ${descripcion.length} caracteres`);
  if (h1[0] && titulo && h1[0].texto.toLowerCase() === titulo.toLowerCase()) marcar('titulo-igual-h1', 'aviso', 'título idéntico al H1');
  if (!/<html\b[^>]*\slang=/i.test(documento)) marcar('lang', 'error', 'sin atributo lang en <html>');
  if (!metas.some((m) => /property=["']og:image["']/i.test(m))) marcar('og-image', 'aviso', 'sin og:image');

  // ── Imágenes ─────────────────────────────────────────────────────────────
  const imagenes = [...sinCodigo.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const sinAlt = imagenes.filter((i) => !/\salt(\s*=|[\s>])/i.test(i)).length;
  if (sinAlt) marcar('img-alt', 'error', `${sinAlt} imagen(es) sin atributo alt`);
  const altVacio = imagenes.filter((i) => /\salt=(""|'')/i.test(i) || /\salt(?=[\s>])/i.test(i)).length;
  if (imagenes.length >= 4 && altVacio / imagenes.length > 0.5)
    marcar('img-alt-vacio', 'aviso', `${altVacio} de ${imagenes.length} imágenes con alt vacío`);
  const sinMedidas = imagenes.filter((i) => !/\swidth=/i.test(i) || !/\sheight=/i.test(i)).length;
  if (sinMedidas) marcar('img-medidas', 'aviso', `${sinMedidas} imagen(es) sin width/height (CLS)`);

  // ── Datos estructurados ──────────────────────────────────────────────────
  const tipos = [];
  for (const m of documento.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const recorrer = (nodo) => {
        if (Array.isArray(nodo)) nodo.forEach(recorrer);
        else if (nodo && typeof nodo === 'object') {
          if (nodo['@type']) tipos.push(...[].concat(nodo['@type']));
          Object.values(nodo).forEach(recorrer);
        }
      };
      recorrer(JSON.parse(m[1]));
    } catch {
      marcar('json-ld', 'error', 'bloque JSON-LD que no se puede leer');
    }
  }
  if (tipos.includes('Person')) marcar('json-ld-person', 'error', 'nodo Person en el marcado (no hay persona verificada)');
  if (tipos.includes('AggregateRating')) marcar('json-ld-rating', 'error', 'AggregateRating con valoraciones de terceros');

  // ── Textos que no deben volver ───────────────────────────────────────────
  const visible = texto(sinCodigo);
  for (const [patron, motivo] of TEXTOS_VETADOS) if (patron.test(visible)) marcar('texto-vetado', 'error', motivo);

  return hallazgos.map((h) => ({ ...h, url }));
}
