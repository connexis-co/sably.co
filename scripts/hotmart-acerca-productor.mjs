#!/usr/bin/env node
/**
 * Lee la sección «Acerca del productor / de la productora» del texto de venta que Hotmart muestra en la página de pago
 * de cada producto (`pay.hotmart.com/<código>?checkoutMode=10`). En muchos cursos de MasterClasses.La® es la única
 * fuente pública que nombra a la persona que desarrolló y presenta el curso («Desarrollado por DIANA ZULETA, …»).
 * La ficha del marketplace no trae ese texto.
 *
 * Uso: node scripts/hotmart-acerca-productor.mjs --cursos <cursos.csv> --salida <archivo.json>
 *   cursos.csv: columnas `curso`, `estado_cms` y `producto`. Solo lee; no envía nada ni entra al pago.
 * Salida: por curso, la URL leída, la fecha y el texto de la sección (sin HTML), o el motivo de que no esté.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { leerCsv } from './hotmart-opiniones.mjs';

const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36' };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** HTML del texto de venta → texto plano con saltos de línea donde había párrafos. */
export function textoPlano(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d|div)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

/** La sección «Acerca del productor/de la productora/de los productores» (o «Sobre el autor…») hasta el siguiente título. */
export function seccionAcerca(texto) {
  const m = texto.match(/(?:^|\n)\s*(ACERCA DE(?:L| LA| LOS| LAS) (?:PRODUCTOR(?:A|ES|AS)?|AUTOR(?:A|ES)?|INSTRUCTOR(?:A|ES)?|DOCENTE(?:S)?)|SOBRE (?:EL|LA|LOS) (?:AUTOR|AUTORA|INSTRUCTOR|INSTRUCTORA|PROFESOR|PROFESORA|DOCENTE)[A-Z]*)\s*:?\s*\n([\s\S]{0,1600})/i);
  if (!m) return '';
  // Corta en el siguiente título en mayúsculas (línea corta toda en mayúsculas) o en garantía/bonos.
  const lineas = m[2].split('\n');
  const fuera = [];
  for (const l of lineas) {
    const t = l.trim();
    if (fuera.length && t.length > 3 && t.length < 60 && t === t.toLocaleUpperCase('es') && /[A-ZÁÉÍÓÚÑ]{4}/.test(t)) break;
    if (/^(garant[ií]a|bonus|bonos|preguntas frecuentes|privacidad|compra segura)/i.test(t)) break;
    if (t) fuera.push(t);
  }
  return fuera.join('\n');
}

async function leer(codigo) {
  const url = `https://pay.hotmart.com/${codigo}?checkoutMode=10`;
  for (let intento = 1; ; intento++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      const html = await r.text();
      // El texto de venta llega en el HTML inicial (una copia en claro y otra escapada); basta la primera.
      const crudo = html.match(/"description":"((?:[^"\\]|\\.)*)"/)?.[1];
      const desc = crudo ? JSON.parse(`"${crudo}"`) : html;
      return { url, status: r.status, texto: textoPlano(desc) };
    } catch (error) {
      if (intento >= 3) throw error;
      await dormir(3000 * intento);
    }
  }
}

async function main() {
  const arg = (n) => process.argv[process.argv.indexOf(n) + 1];
  const cursos = leerCsv(readFileSync(arg('--cursos'), 'utf8')).filter((c) => c.estado_cms === 'published' && c.producto);
  const leidoEl = new Date().toISOString().slice(0, 10);
  const salida = {};
  for (const c of cursos) {
    try {
      const { url, status, texto } = await leer(c.producto);
      const acerca = seccionAcerca(texto);
      const desarrollado = texto.match(/Desarrollad[oa] por:?\s*([^\n,.;]{3,80})/i)?.[1]?.trim() ?? '';
      salida[c.curso] = { producto: c.producto, url, status, leido_el: leidoEl, acerca, desarrollado_por: desarrollado };
      console.log(`${c.curso}: ${acerca ? 'con sección' : 'sin sección'}${desarrollado ? ` · ${desarrollado}` : ''}`);
    } catch (error) {
      salida[c.curso] = { producto: c.producto, error: error.message };
      console.error(`${c.curso}: ${error.message}`);
    }
    await dormir(900);
  }
  writeFileSync(arg('--salida'), JSON.stringify(salida, null, 1));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
