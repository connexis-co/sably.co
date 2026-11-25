/**
 * Auditoría on-page de una página ya renderizada.
 *
 * `verify-indexable-html.mjs` responde «¿esta URL se puede indexar?». Este
 * módulo responde «¿la página está bien construida?»: jerarquía de
 * encabezados, título, descripción, imágenes, marcado y textos que no deben
 * volver. No lanza: devuelve la lista de hallazgos para que quien llama decida
 * (el test falla con cualquier `error`; la CLI informa también los `aviso`).
 */

import { readFileSync } from 'node:fs';

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

/**
 * Instructores de relleno del lote generado en agosto (106 nombres, uno por
 * curso; ninguno es el creador). La lista sale de los MDX con
 * `node scripts/instructores-relleno.mjs --lista`.
 */
export const INSTRUCTORES_RELLENO = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../src/data/instructores-relleno.json', import.meta.url), 'utf8')).nombres.map((n) => n.nombre);
  } catch {
    return [];
  }
})();

/** Textos que se retiraron del sitio por no ser ciertos y no deben reaparecer. */
/** Hechos que la plantilla V2 dice una sola vez fuera de la caja de compra (BRIEF-V2, «Reglas que no cambian»). */
export const HECHOS_V2 = [
  ['garantía de 7 días', /garant[ií]a de 7 d[ií]as|7 d[ií]as para pedir (?:el )?reembolso/gi],
  ['constancia de finalización', /constancia (?:digital )?de finalizaci[oó]n/gi],
  ['acceso de por vida', /acceso de por vida/gi],
];

export const TEXTOS_VETADOS = [
  [/Tu instructor/i, 'bloque de instructor sin dato verificado'],
  [/\bafiliad[oa]s?\b/i, 'la palabra «afiliado» en texto público'],
  [/\bcupo(s)? (sigue|limitad|disponible)/i, 'escasez falsa («cupo») en un curso online'],
  [/\bsolo (por )?hoy\b/i, 'urgencia falsa («solo hoy»)'],
  // 24-nov-2026: frases de plantilla que no eran ciertas.
  [/en todos los cursos con el cup[oó]n/i, '«en todos los cursos»: el cupón solo cubre a los creadores que lo aceptan'],
  [/descuento más grande del año/i, 'superlativo sin dato («el descuento más grande del año»)'],
  [/nuestro equipo en tu país/i, '«nuestro equipo en tu país»: no hay un equipo por país'],
  [/plataforma líder/i, 'superlativo sin dato («plataforma líder»)'],
  [/\bCatálogo (?:de \d+\+? cursos|completo)\b/i, 'Sably descrito como «catálogo», con una cifra de cursos que no cuadra'],
];

/**
 * @param {string} url
 * @param {string} html
 * @param {{ limites?: { titulo?: number, descripcionMin?: number, descripcionMax?: number }, instructores?: string[] }} [opciones]
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
  // Bing corta el srcset en cada coma: una URL con comas acaba pedida como ruta inventada (404).
  const urlsConComa = imagenes.flatMap((i) => [atributo(i, 'src') ?? '', ...(atributo(i, 'srcset') ?? '').split(/\s+\d+(?:\.\d+)?[wx](?:,|$)/)])
    .map((u) => u.trim()).filter((u) => u.includes(','));
  if (urlsConComa.length) marcar('img-url-coma', 'error', `${urlsConComa.length} URL de imagen con comas (Bing las corta): ${urlsConComa[0].slice(0, 80)}`);
  const sinMedidas = imagenes.filter((i) => !/\swidth=/i.test(i) || !/\sheight=/i.test(i)).length;
  if (sinMedidas) marcar('img-medidas', 'aviso', `${sinMedidas} imagen(es) sin width/height (CLS)`);

  // ── Datos estructurados ──────────────────────────────────────────────────
  const tipos = [];
  const credenciales = [];
  const personasSinPerfil = [];
  const ofertas = [];
  const respuestas = [];
  for (const m of documento.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const recorrer = (nodo) => {
        if (Array.isArray(nodo)) nodo.forEach(recorrer);
        else if (nodo && typeof nodo === 'object') {
          if (nodo['@type']) tipos.push(...[].concat(nodo['@type']));
          // Una Person vale solo si es un creador real con perfil en Sably
          // (`@id` …/creadores/<slug>/#creador); el instructor de relleno no tenía.
          if ([].concat(nodo['@type'] ?? []).includes('Person') && !/\/creadores\/[a-z0-9-]+\/#creador$/.test(String(nodo['@id'] ?? '')))
            personasSinPerfil.push(nodo.name ?? '(sin nombre)');
          if ([].concat(nodo['@type'] ?? []).includes('Offer')) ofertas.push(nodo);
          if ([].concat(nodo['@type'] ?? []).includes('EducationalOccupationalCredential')) credenciales.push(String(nodo.name ?? ''));
          if ([].concat(nodo['@type'] ?? []).includes('Answer') && typeof nodo.text === 'string') respuestas.push(nodo.text);
          Object.values(nodo).forEach(recorrer);
        }
      };
      recorrer(JSON.parse(m[1]));
    } catch {
      marcar('json-ld', 'error', 'bloque JSON-LD que no se puede leer');
    }
  }
  if (personasSinPerfil.length)
    marcar('json-ld-person', 'error', `nodo Person sin perfil de creador (${personasSinPerfil.slice(0, 2).join(', ')}): no hay persona verificada`);
  if (tipos.includes('AggregateRating')) marcar('json-ld-rating', 'error', 'AggregateRating con valoraciones de terceros');

  // ── Precio: la caja de compra, la pregunta de precio y el Offer dicen lo mismo ──
  /* Se compara el importe y la moneda, no la escritura: el tema V2 escribe «$ 1,191.32 MXN»
     y la pregunta (común a los dos temas) «$1,191.32 MXN»; «$ 25,00 USD» y «$25 USD» son lo mismo. */
  const importeDe = (frase) => {
    const codigo = frase.match(/\b([A-Z]{3})\s*$/)?.[1] ?? '';
    const cifra = frase.replace(/\b[A-Z]{3}\s*$/, '').replace(/[^\d.,]/g, '');
    const decimal = cifra.match(/[.,](\d{1,2})$/);
    const entero = (decimal ? cifra.slice(0, -decimal[0].length) : cifra).replace(/[.,]/g, '');
    return { codigo, valor: Number(`${entero}.${decimal?.[1] ?? '0'}`) };
  };
  const mismoImporte = (a, b) => { const x = importeDe(a), y = importeDe(b); return x.codigo === y.codigo && Math.abs(x.valor - y.valor) < 0.005; };
  const visible = texto(sinCodigo);
  const caja = sinCodigo.match(/<section\b[^>]*\sdata-purchase-panel\b[^>]*>/i)?.[0];
  if (caja) {
    const limpio = (valor) => texto(String(valor ?? ''));
    const lista = limpio(atributo(caja, 'data-base'));
    const rebajado = limpio(atributo(caja, 'data-reduced'));
    /* «El precio de lista es X» solo puede nombrar el importe sin cupón. El
       24-nov-2026 la respuesta daba el rebajado y la caja lo desmentía. */
    for (const frase of [visible, ...respuestas.map(limpio)]) {
      const dicho = frase.match(/El precio de lista es (.+? [A-Z]{3})\b/)?.[1];
      if (dicho && lista && !mismoImporte(dicho, lista)) {
        marcar('precio-de-lista', 'error', `la pregunta de precio llama «precio de lista» a ${dicho} y la caja dice ${lista}`);
        break;
      }
    }
    const oferta = ofertas[0];
    if (oferta && rebajado && atributo(caja, 'data-until') && !oferta.priceValidUntil)
      marcar('oferta-sin-fecha', 'error', 'el Offer publica el precio con cupón sin priceValidUntil');
    const crudo = atributo(caja, rebajado ? 'data-reduced-amount' : 'data-base-amount');
    if (oferta && crudo && Math.abs(Number(oferta.price) - Number(crudo)) >= 0.005)
      marcar('oferta-precio', 'error', `el Offer dice ${oferta.price} y la caja ${crudo}`);
  }

  // ── «Constancia», nunca «certificado» ────────────────────────────────────
  // Lo que sale de plantilla es error. El texto del CMS (descripciones cortas,
  // preguntas de las variantes de país, títulos) sigue pendiente de decisión y
  // solo se cuenta, para que el número baje y no vuelva a subir. Las
  // homologaciones son certificaciones de verdad, de una institución.
  if (credenciales.some((nombre) => /certificad/i.test(nombre)))
    marcar('constancia-json-ld', 'error', 'el JSON-LD llama «certificado» a la constancia de finalización');
  if (/certificado-sably\.jpg/i.test(documento)) marcar('imagen-certificado', 'error', 'vuelve la imagen del certificado inventado');
  if (!/\/homologaciones\//.test(url)) {
    const veces = (visible.match(/\bcertificad[oa]s?\b/gi) ?? []).length;
    if (veces) marcar('certificado', 'aviso', `«certificado» ${veces} veces en el texto visible (la regla es «constancia»)`);
  }

  // ── Instructores de relleno ──────────────────────────────────────────────
  // En el texto visible y en el JSON-LD (FAQPage): es lo que leen los asistentes.
  const todo = `${visible} ${respuestas.join(' ')}`;
  const inventados = (opciones.instructores ?? INSTRUCTORES_RELLENO).filter((nombre) => todo.includes(nombre));
  if (inventados.length)
    marcar('instructor-relleno', 'error', `nombra a ${inventados.slice(0, 3).join(', ')}: instructor de relleno, no es el creador del curso`);

  // ── Reglas del rediseño (tema V2: <body data-tema="v2">) ──────────────────
  if (/<body\b[^>]*\sdata-tema=["']v2["']/i.test(documento)) {
    // Bloques con texto del CMS (preguntas, texto largo, biografía): ahí manda
    // el contenido, no la plantilla. La caja de compra repite hechos a propósito.
    // Solo <main>: la cabecera y el pie siguen siendo los del tema clásico hasta que tengan versión V2.
    const principal = sinCodigo.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)?.[1] ?? sinCodigo;
    const plantilla = principal
      .replace(/<section\b[^>]*\sdata-purchase-panel\b[\s\S]*?<\/section>/gi, ' ')
      .replace(/<section\b[^>]*\sdata-cms\b[\s\S]*?<\/section>/gi, ' ');
    const enPlantilla = texto(plantilla);
    // ©, ® y ™ son «pictográficos» para Unicode pero son parte de nombres de marca.
    const emoji = /(?![©®™])\p{Extended_Pictographic}/u;
    if (emoji.test(enPlantilla)) marcar('v2-emoji', 'error', `emoji en la interfaz: «${enPlantilla.match(/.{0,20}(?![©®™])\p{Extended_Pictographic}/u)?.[0] ?? ''}»`);
    else if (emoji.test(texto(principal))) marcar('v2-emoji-cms', 'aviso', 'emoji en el texto del CMS');
    for (const [hecho, patron] of HECHOS_V2) {
      const veces = (enPlantilla.match(patron) ?? []).length;
      if (veces > 1) marcar('v2-hecho-repetido', 'error', `«${hecho}» ${veces} veces fuera de la caja de compra (una sola vez)`);
    }
    const ficha = /\sdata-purchase-panel\b|data-estado=["']cerrado["']/i.test(sinCodigo);
    if (ficha) {
      const largo = sinCodigo.match(/<div\b[^>]*\sdata-texto-largo\b[^>]*>([\s\S]*?)<\/section>/i)?.[1];
      const palabras = largo ? texto(largo).split(' ').filter(Boolean).length : 0;
      if (!largo) marcar('v2-texto-largo', 'error', 'la ficha no trae el texto largo del curso en el HTML');
      else if (palabras < 150) marcar('v2-texto-largo', 'aviso', `texto largo de ${palabras} palabras en el HTML`);
    }
  }

  // ── Textos que no deben volver ───────────────────────────────────────────
  for (const [patron, motivo] of TEXTOS_VETADOS) if (patron.test(visible)) marcar('texto-vetado', 'error', motivo);

  return hallazgos.map((h) => ({ ...h, url }));
}
