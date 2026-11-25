#!/usr/bin/env node
/**
 * Detecta y quita los nombres de instructores de relleno del contenido.
 *
 * El lote de fichas de agosto se generó con un instructor inventado por curso
 * (nombre, cargo y biografía). La plantilla dejó de pintar ese bloque, pero el
 * generador había metido el nombre dentro de la prosa: «Andrés Villamil explica
 * cada maniobra» en masajes, cuando la ficha dice «Creado por MasterClasses.La®»
 * y Hotmart nombra a Mauricio Duque Zuluaga. Son 106 nombres en 610 de las 726
 * variantes de país (1.142 menciones, medido el 24-nov-2026).
 *
 *   node scripts/instructores-relleno.mjs                 # simulación sobre src/content: informa, no escribe
 *   node scripts/instructores-relleno.mjs --json informe.json    # cada cambio, antes y después, para revisar por muestreo
 *   node scripts/instructores-relleno.mjs --lista         # regenera src/data/instructores-relleno.json desde los MDX
 *   node scripts/instructores-relleno.mjs --escribir      # aplica a los archivos de src/content (variantes y MDX)
 *   node scripts/instructores-relleno.mjs --entrada variantes.json --salida limpias.json
 *                                                         # limpia un volcado del CMS; no toca el CMS
 *
 * Nunca escribe en producción: sobre el CMS solo transforma un volcado que
 * alguien exportó, y volver a cargarlo es un paso aparte que necesita el sí de
 * JP. `--escribir` cambia archivos locales y nada más.
 *
 * Cómo quita un nombre, por orden (la primera regla que deja la frase entera):
 *  1. `rol`      «la instructora Daniela Corredor evalúa» → «la instructora evalúa».
 *  2. `agente`   «impartidas por N», «de la mano de N», «bajo la guía de N», «con N»
 *                → se cae el complemento y la frase sigue.
 *  3. `sujeto`   «N te guía en 14 lecciones» → «El curso te guía en 14 lecciones».
 *  4. `frase`    si lo que queda habla de la persona (su biografía, «quien…») o
 *                la frase pierde el verbo, se quita la frase entera.
 * Una pregunta frecuente cuya pregunta no se puede salvar, o cuya respuesta se
 * queda vacía, se elimina. Todo queda en el informe con su regla.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const LISTA = new URL('../src/data/instructores-relleno.json', import.meta.url);
const CURSOS = new URL('../src/content/courses/', import.meta.url);
const VARIANTES = new URL('../src/content/course-locales/', import.meta.url);

/** Nombres que sí son de un creador real y nunca se tocan. */
const REALES = /masterclasses|seminarios\.?\s?online/i;

export function leerLista() {
  try { return JSON.parse(readFileSync(LISTA, 'utf8')).nombres.map((n) => n.nombre); } catch { return []; }
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const L = '\\p{L}';
const ROL = '(?:instructor|instructora|profesor|profesora|profe|docente|chef|maestro|maestra|especialista|experto|experta|formador|formadora|tutor|tutora|artesano|artesana|mentor|mentora|coach|capacitador|capacitadora|facilitador|facilitadora|barbero|estilista|pastelero|pastelera|panadero|panadera|diseñador|diseñadora)';
const PARTICIPIO = '(?:impartid|dictad|guiad|diseñad|cread|elaborad|desarrollad|preparad|dirigid|liderad|presentad|explicad|enseñad|avalad|otorgad|emitid|firmad|respaldad|acompañad|grabad|producid|orientad|conducid|realizad|estructurad|pensad|propuest|compartid|transmitid|mostrad|demostrad)[oa]s?';
const AGENTE = `(?:${PARTICIPIO}\\s+(?:por|de)|que (?:imparte|dicta|enseña|explica|propone|comparte|presenta|utiliza|aplica|desarrolla|plantea|transmite)|a cargo de|de la mano de|bajo la (?:guía|tutoría|dirección|supervisión|mirada|orientación|instrucción) de|con la (?:guía|ayuda|orientación|tutoría|dirección|experiencia|metodología|instrucción|enseñanza) de|con el (?:acompañamiento|método|apoyo|respaldo|paso a paso) de|en compañía de|junto a|junto con|siguiendo a|gracias a|con|del?)`;
const COPULA = '(?:es|son|está|están|fue|fueron|será|serán|sea|sean|ha sido|han sido|viene|vienen)';
/** Oficios y cargos por su terminación («masoterapeuta», «diseñadora», «pastelero»): tras «N, …» abren su biografía. */
const OFICIO = /(?:ista|logo|loga|peuta|ero|era|dor|dora|tor|tora|nomo|noma|tecto|tecta|ario|aria|ico|ica)$/i;
const NO_OFICIO = /^(?:primero|primera|tercero|tercera|manera|fuera|siquiera|quiera|cualquiera|práctico|práctica|técnico|técnica|básico|básica|único|única|clásico|clásica|teórico|teórica|económico|económica|específico|específica|música|lógica|dinámica|mejor|mayor|menor|ahora|era|pero)$/i;
/**
 * ¿Lo que sigue a «N, » habla de la persona? `resto` empieza justo tras el
 * nombre. «N, quien guía…», «N, especialista en…», «N, una chef con 15 años…»
 * son biografía inventada: la frase no se puede salvar quitando solo el nombre.
 * `documento`: el complemento era «avalado/firmado por N», y un «, que acredita…»
 * detrás se refiere al documento, no a la persona.
 */
function esBiografia(resto, documento = false) {
  const m = resto.match(new RegExp(`^\\s*,\\s+(${L}+)(?:\\s+(${L}+|\\d+))?`, 'u'));
  if (!m) return false;
  const [, primera, segunda = ''] = m;
  if (/^(?:quien|quienes|cuy[oa]s?)$/i.test(primera)) return true;
  if (/^que$/i.test(primera)) return !documento;
  if (new RegExp(`^${ROL}$`, 'i').test(primera)) return true;
  if (/^(?:un|una)$/i.test(primera)) return new RegExp(`^${ROL}$`, 'i').test(segunda) || (OFICIO.test(segunda) && !NO_OFICIO.test(segunda));
  if (/^(?:referente|fundador|fundadora|creador|creadora|director|directora|profesional|reconocid[oa]|experimentad[oa]|apasionad[oa]|dueñ[oa])$/i.test(primera)) return true;
  if (/^con$/i.test(primera)) return /^(?:más|amplia|años|experiencia|trayectoria|larga|vasta|\d+)$/i.test(segunda);
  return OFICIO.test(primera) && !NO_OFICIO.test(primera) && /^(?:con|de|en|y|profesional|especializad[oa]|certificad[oa]|del)$/i.test(segunda);
}

const mayuscula = (s) => s.replace(new RegExp(`^(\\s*(?:[#>*\\-]+\\s+)?[¿¡"«(]*)(${L})`, 'u'), (_, pre, letra) => pre + letra.toLocaleUpperCase('es'));
const ordenar = (s) => s
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\s+([,.;:!?])/g, '$1')
  .replace(/,\s*([.;:!?])/g, '$1')
  .replace(/([¿¡(«])\s+/g, '$1')
  .replace(/,\s*,/g, ',')
  .replace(/^\s*,\s*/, '')
  .trim();

/**
 * Quita `nombre` de UNA frase. Devuelve `{ texto, regla }`; `texto === ''`
 * significa que la frase no se pudo salvar y hay que quitarla entera.
 */
export function quitarDeFrase(frase, nombre, minPalabras = 3) {
  const N = esc(nombre);
  const fin = `(?=[\\s,.;:!?)»"]|$)`;
  let texto = frase;
  const reglas = new Set();

  // 1. rol + nombre → rol.
  texto = texto.replace(new RegExp(`\\b(${ROL})\\s+${N}${fin}`, 'giu'), (_, rol) => { reglas.add('rol'); return rol; });

  // 2. complemento con el nombre → fuera.
  let guard = 0;
  const complemento = new RegExp(`(^|[\\s¿¡(«"])(${COPULA}\\s+)?(${AGENTE})\\s+(?:(?:el|la|tu|nuestro|nuestra)\\s+)?${N}${fin}`, 'iu');
  while (guard++ < 6) {
    const m = texto.match(complemento);
    if (!m) break;
    const [todo, antes, copula, agente] = m;
    const inicio = m.index + antes.length;
    const resto = texto.slice(m.index + todo.length);
    // «es impartido por N»: sin el complemento la frase se queda sin predicado.
    if (copula) return { texto: '', regla: 'frase' };
    if (esBiografia(resto, /^(?:avalad|firmad|otorgad|emitid|respaldad)/i.test(agente))) return { texto: '', regla: 'frase' };
    const alPrincipio = !/[\p{L}\p{N}]/u.test(texto.slice(0, inicio));
    // Al principio de la frase se va también la coma que cerraba el complemento.
    texto = texto.slice(0, inicio) + (alPrincipio ? resto.replace(/^\s*,\s*/, '') : resto);
    reglas.add('agente');
  }

  // 3. nombre como sujeto → «el curso».
  const sujeto = new RegExp(`${N}(?=\\s+(?:(?:te|nos|les|se|lo|la|le|no|también|ya)\\s+)?${L}+)`, 'u');
  guard = 0;
  while (guard++ < 6) {
    const m = texto.match(sujeto);
    if (!m) break;
    const antes = texto.slice(0, m.index);
    const previa = antes.match(new RegExp(`(${L}+)\\s*$`, 'u'))?.[1]?.toLowerCase();
    // «de N», «por N», «a N» que no cayeron arriba, o un verbo delante: no es sujeto.
    if (previa && /^(?:de|por|a|con|para|según|sobre|entre|hacia|ante|tras|del|al)$/.test(previa)) return { texto: '', regla: 'frase' };
    const siguiente = texto.slice(m.index + m[0].length).match(new RegExp(`^\\s+(${L}+)`, 'u'))?.[1] ?? '';
    // Mayúscula después del nombre: otro nombre propio o un título, no un verbo.
    if (siguiente && siguiente[0] !== siguiente[0].toLocaleLowerCase('es')) return { texto: '', regla: 'frase' };
    const alPrincipio = !/[\p{L}\p{N}]/u.test(antes);
    texto = antes + (alPrincipio ? 'El curso' : 'el curso') + texto.slice(m.index + m[0].length);
    reglas.add('sujeto');
  }

  // 4. si el nombre sigue ahí, la frase no tiene arreglo automático.
  if (texto.includes(nombre)) return { texto: '', regla: 'frase' };
  texto = mayuscula(ordenar(texto));
  // Una frase que se quedó en dos palabras ya no dice nada (a un encabezado le bastan dos).
  if (texto.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).filter(Boolean).length < minPalabras) return { texto: '', regla: 'frase' };
  return { texto, regla: [...reglas].join('+') || 'frase' };
}

const FRASES = /(?<=[.!?…])\s+(?=[\p{Lu}¿¡"«(*_#\d])/u;

/**
 * Quita todos los nombres de un texto (una frase, un párrafo o Markdown con
 * varias líneas). Devuelve el texto y la lista de cambios aplicados.
 */
export function limpiarTexto(texto, nombres, { encabezado = false } = {}) {
  const cambios = [];
  if (typeof texto !== 'string' || !nombres.some((n) => texto.includes(n))) return { texto, cambios };
  const lineas = texto.split('\n').map((linea) => {
    if (!nombres.some((n) => linea.includes(n))) return linea;
    const sangria = linea.match(/^\s*(?:#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s+)?/)?.[0] ?? '';
    const cuerpo = linea.slice(sangria.length);
    const frases = cuerpo.split(FRASES).map((frase) => {
      let actual = frase;
      for (const nombre of nombres) {
        if (!actual.includes(nombre)) continue;
        const { texto: nuevo, regla } = quitarDeFrase(actual, nombre, encabezado || /^\s*#/.test(sangria) ? 2 : 3);
        cambios.push({ nombre, regla, antes: actual, despues: nuevo });
        actual = nuevo;
        if (!actual) break;
      }
      return actual;
    }).filter(Boolean);
    // Un encabezado o una viñeta que se queda sin texto desaparece con su marca.
    return frases.length ? sangria + frases.join(' ') : null;
  }).filter((linea) => linea !== null);
  return { texto: lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim(), cambios };
}

/**
 * Limpia una variante de país (o cualquier objeto de contenido): recorre todos
 * sus textos. Las preguntas frecuentes se tratan como pareja: si la pregunta o
 * la respuesta se quedan vacías, se elimina la pareja.
 */
const esBloque = (v) => v && typeof v === 'object' && !Array.isArray(v) && v._type === 'block' && Array.isArray(v.children);
const textoDeBloque = (v) => (esBloque(v) ? v.children.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('').trim() : '');

export function limpiarEntrada(datos, nombres) {
  const cambios = [];
  const anotar = (campo, lista) => cambios.push(...lista.map((c) => ({ campo, ...c })));
  const recorrer = (valor, campo, encabezado = false) => {
    if (typeof valor === 'string') {
      const { texto, cambios: lista } = limpiarTexto(valor, nombres, { encabezado });
      anotar(campo, lista);
      return texto;
    }
    if (Array.isArray(valor)) {
      const esFaq = valor.length > 0 && valor.every((v) => v && typeof v === 'object' && typeof v.q === 'string' && typeof v.a === 'string');
      const salida = [];
      valor.forEach((item, i) => {
        const limpio = recorrer(item, `${campo}[${i}]`, encabezado);
        // Bloque de texto enriquecido (Portable Text) que se quedó sin texto: fuera
        // entero, para que no quede un encabezado ni un párrafo vacíos.
        if (esBloque(item) && textoDeBloque(item) && !textoDeBloque(limpio)) { cambios.push({ campo: `${campo}[${i}]`, nombre: '', regla: 'bloque-eliminado', antes: textoDeBloque(item), despues: '' }); return; }
        if (esFaq && (!limpio.q || !limpio.a)) { cambios.push({ campo: `${campo}[${i}]`, nombre: '', regla: 'faq-eliminada', antes: `${item.q} — ${item.a}`, despues: '' }); return; }
        if (typeof item === 'string' && !limpio) { cambios.push({ campo: `${campo}[${i}]`, nombre: '', regla: 'elemento-eliminado', antes: item, despues: '' }); return; }
        salida.push(limpio);
      });
      return salida;
    }
    if (valor && typeof valor === 'object') {
      // En un encabezado (style h1–h6) basta con dos palabras: «Aprendizaje práctico guiado por N» → «Aprendizaje práctico».
      const enEncabezado = encabezado || (esBloque(valor) && /^h[1-6]$/.test(String(valor.style ?? '')));
      return Object.fromEntries(Object.entries(valor).map(([clave, v]) => [clave, clave.startsWith('_') ? v : recorrer(v, campo ? `${campo}.${clave}` : clave, enEncabezado)]));
    }
    return valor;
  };
  const limpio = recorrer(datos, '');
  for (const c of cambios) if (!['faq-eliminada', 'elemento-eliminado', 'bloque-eliminado'].includes(c.regla) && c.despues === '') c.regla = 'frase';
  return { datos: limpio, cambios };
}

/** Bloque `instructor:` del frontmatter de un MDX (nombre, cargo y biografía de relleno). */
const BLOQUE_INSTRUCTOR = /^instructor:\n(?:[ \t]+.*\n)+/m;
export function nombreEnMdx(fuente) {
  const bloque = fuente.match(/^---\n([\s\S]*?)\n---/)?.[1].match(BLOQUE_INSTRUCTOR)?.[0];
  return bloque?.match(/^[ \t]+name:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? null;
}
export function sinBloqueInstructor(fuente) {
  const nombre = nombreEnMdx(fuente);
  return nombre && !REALES.test(nombre) ? fuente.replace(BLOQUE_INSTRUCTOR, '') : fuente;
}

function listaDesdeMdx() {
  const porNombre = new Map();
  for (const archivo of readdirSync(CURSOS).filter((f) => f.endsWith('.mdx')).sort()) {
    const nombre = nombreEnMdx(readFileSync(new URL(archivo, CURSOS), 'utf8'));
    if (!nombre || REALES.test(nombre)) continue;
    porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), archivo.replace(/\.mdx$/, '')]);
  }
  return [...porNombre].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([nombre, cursos]) => ({ nombre, cursos }));
}

function main() {
  const args = process.argv.slice(2);
  const opcion = (nombre) => { const i = args.indexOf(`--${nombre}`); return i >= 0 ? args[i + 1] : undefined; };
  const tiene = (nombre) => args.includes(`--${nombre}`);

  if (tiene('lista')) {
    const nombres = listaDesdeMdx();
    writeFileSync(LISTA, `${JSON.stringify({ fuente: 'src/content/courses/*.mdx · instructor.name', nota: 'Instructores de relleno del lote generado en agosto de 2026. Ninguno es el creador del curso. scripts/seo-onpage.mjs falla si alguno aparece en una página.', nombres }, null, 2)}\n`);
    console.log(`${nombres.length} nombres de relleno escritos en src/data/instructores-relleno.json`);
    return;
  }

  const nombres = leerLista();
  if (!nombres.length) { console.error('Sin lista de nombres: ejecuta primero con --lista.'); process.exit(1); }

  if (opcion('entrada')) {
    const salida = opcion('salida');
    if (!salida) { console.error('Falta --salida <archivo.json>.'); process.exit(1); }
    const volcado = JSON.parse(readFileSync(opcion('entrada'), 'utf8'));
    const { datos, cambios } = limpiarEntrada(volcado, nombres);
    writeFileSync(salida, `${JSON.stringify(datos, null, 2)}\n`);
    if (opcion('json')) writeFileSync(opcion('json'), JSON.stringify(cambios, null, 1));
    console.log(`${cambios.length} cambios sobre el volcado → ${salida}. El CMS no se ha tocado.`);
    return;
  }

  const escribir = tiene('escribir');
  const informe = [];
  const porRegla = new Map();
  const porCampo = new Map();
  let variantes = 0;
  for (const archivo of readdirSync(VARIANTES).filter((f) => f.endsWith('.json')).sort()) {
    const ruta = new URL(archivo, VARIANTES);
    const original = readFileSync(ruta, 'utf8');
    const { datos, cambios } = limpiarEntrada(JSON.parse(original), nombres);
    if (!cambios.length) continue;
    variantes++;
    for (const c of cambios) {
      informe.push({ archivo, ...c });
      porRegla.set(c.regla, (porRegla.get(c.regla) ?? 0) + 1);
      const campo = c.campo.replace(/\[\d+\]/g, '[]');
      porCampo.set(campo, (porCampo.get(campo) ?? 0) + 1);
    }
    if (escribir) writeFileSync(ruta, `${JSON.stringify(datos, null, 2)}\n`);
    // Nada puede quedar: si queda, el informe lo dice en vez de darlo por bueno.
    const resto = nombres.filter((n) => JSON.stringify(datos).includes(n));
    if (resto.length) informe.push({ archivo, campo: '*', nombre: resto.join(', '), regla: 'SIN-QUITAR', antes: '', despues: '' });
  }
  let mdx = 0;
  for (const archivo of readdirSync(CURSOS).filter((f) => f.endsWith('.mdx')).sort()) {
    const ruta = new URL(archivo, CURSOS);
    const original = readFileSync(ruta, 'utf8');
    const limpio = sinBloqueInstructor(original);
    if (limpio === original) continue;
    mdx++;
    informe.push({ archivo, campo: 'instructor', nombre: nombreEnMdx(original), regla: 'bloque-instructor', antes: nombreEnMdx(original), despues: '' });
    if (escribir) writeFileSync(ruta, limpio);
  }
  const fila = (mapa) => [...mapa].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ');
  console.log(`${escribir ? 'APLICADO' : 'SIMULACIÓN (no se ha escrito nada)'} · ${nombres.length} nombres de relleno`);
  console.log(`Variantes de país con menciones: ${variantes} · cambios: ${informe.filter((c) => c.campo !== 'instructor').length}`);
  console.log(`  por regla: ${fila(porRegla)}`);
  console.log(`  por campo: ${fila(porCampo)}`);
  console.log(`MDX con bloque instructor de relleno: ${mdx}`);
  const pendientes = informe.filter((c) => c.regla === 'SIN-QUITAR');
  if (pendientes.length) console.log(`ATENCIÓN: ${pendientes.length} archivos conservan algún nombre (regla SIN-QUITAR en el informe).`);
  if (opcion('json')) { writeFileSync(opcion('json'), JSON.stringify(informe, null, 1)); console.log(`Informe detallado en ${opcion('json')}`); }
  process.exit(pendientes.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
