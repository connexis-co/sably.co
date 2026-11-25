#!/usr/bin/env node
/**
 * Contenido de las fichas de curso escrito a mano (contenido/cursos/<slug>.json) → CMS EmDash.
 *
 * Un texto base por curso y, por país, solo lo que cambia de verdad (nombre del país, vocabulario
 * medido, title y description). El guion construye el documento de `course_locales/<slug>--<cc>`
 * y los `learning_items` / `short_description` / `meta_title` del curso, y los escribe con la CLI
 * de EmDash (`content get --raw` + `content update --rev`).
 *
 *   node scripts/contenido-cursos.mjs validar [--cursos a,b]
 *   node scripts/contenido-cursos.mjs cargar   --url https://dev.sably.co [--cursos a,b] [--paises co,mx] [--aplicar]
 *   node scripts/contenido-cursos.mjs revertir --url https://dev.sably.co --respaldo <carpeta> [--aplicar]
 *
 * Sin `--aplicar` solo enseña qué cambiaría (simulación). Es idempotente: si el documento ya tiene
 * exactamente esos campos, no lo toca. Antes de cada escritura guarda el documento entero, con su
 * `_rev`, en `contenido/respaldos/<host>/<fecha>/` (fuera de git); `revertir` vuelve a escribir esos
 * datos sobre la revisión vigente.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'contenido', 'cursos');

// ── Reglas de redacción (las de JP, la auditoría del 24-nov y humanizar-es) ──────────────────
export const VETADAS = [
  [/\bcertificad[oa]s?\b/i, '«certificado» (solo se admite en la pregunta frecuente)'],
  [/\bafiliad[oa]s?\b/i, '«afiliado»'],
  [/\bproductor(a|es)?\b/i, '«productor»'],
  [/de la noche a la mañana/i, '«de la noche a la mañana»'],
  [/agenda llena/i, '«agenda llena»'],
  [/\bla clave\b/i, '«la clave»'],
  [/\bno solo\b[^.]*\bsino\b/i, '«no solo… sino»'],
  [/que la IA no puede/i, '«que la IA no puede tocar»'],
  [/techo de expectativas/i, '«techo de expectativas»'],
  [/\b(descubre|sumérgete|adéntrate|desbloquea|potencia(r)?|optimiza(r)?|empodera(r)?)\b/i, 'vocabulario de folleto'],
  [/\b(increíble|apasionante|fascinante|transformador(a)?|de primer nivel|sin igual|holístic[oa])\b/i, 'entusiasmo genérico'],
  [/el siguiente nivel|en el mundo actual|en la era digital/i, 'muletilla'],
  [/[—–]/, 'guion largo'],
  [/\b(cupos?|solo hoy|últimos días|antes de que suba)\b/i, 'urgencia falsa'],
  [/\b(ganancia|ganarás|ingresos? (garantizad|asegurad|desde el primer))/i, 'promesa de dinero'],
  [/plataforma líder|catálogo/i, 'Sably descrito como catálogo o líder'],
  [/[\u{1F300}-\u{1FAFF}]/u, 'emoji'],
];
const LIMITES = { title: [30, 60], description: [130, 158], h1: [10, 70], faqPalabras: [35, 75], cuerpoPalabras: [400, 650], vinetaPalabras: 13 };

/** Vocabulario de la versión neutra (documento del curso): el de Colombia si lo hay, si no estas formas. */
const NEUTRO = { computador: 'computador', tapabocas: 'tapabocas' };
const neutro = (curso) => ({ pais: '', vocabulario: { ...NEUTRO, ...(curso.paises?.co?.vocabulario ?? {}), ...(curso.vocabulario_neutro ?? {}) } });
const palabras = (s) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*>-]/g, ' ').split(/\s+/).filter(Boolean).length;
const sinEnlaces = (md) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

function rellenar(texto, cc, pais) {
  let t = texto.replaceAll('{cc}', cc).replaceAll('{pais}', pais.pais);
  for (const [clave, valor] of Object.entries(pais.vocabulario ?? {})) t = t.replaceAll(`{${clave}}`, valor);
  const resto = t.match(/\{[a-z_]+\}/);
  if (resto) throw new Error(`hueco sin rellenar ${resto[0]} (${cc})`);
  return t;
}

export function leerCursos(filtro) {
  return readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')))
    .filter((c) => !filtro || filtro.includes(c.slug));
}

/**
 * Medios de pago verificados por país, leídos de src/lib/medios-de-pago.ts (la misma lista que pinta la plantilla).
 * La variante lleva una pregunta de medios de pago con esos datos: la plantilla (faq-honestas.ts) la sustituye por
 * «¿Cuánto cuesta el curso?» con el precio de la caja y añade «¿Cómo puedo pagar desde…?» verificada, igual que hacía
 * con las preguntas de pago de agosto. Sin ella, la ficha con variante se quedaría sin esas dos respuestas de compra.
 */
export function faqMediosDePago(cc, nombrePais) {
  const fuente = readFileSync(path.join(RAIZ, 'src', 'lib', 'medios-de-pago.ts'), 'utf8');
  const lista = fuente.match(new RegExp(`\\b${cc}:\\s*\\[([^\\]]*)\\]`))?.[1].match(/'([^']+)'/g)?.map((x) => x.slice(1, -1)) ?? [];
  const enumerar = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} o ${xs.at(-1)}` : xs.join(''));
  const extra = lista.length ? ` Desde ${nombrePais} el checkout admite además ${enumerar(lista)}, si el curso los tiene activados.` : '';
  return { q: `¿Qué medios de pago acepta Hotmart en ${nombrePais}?`, a: `Se paga en el checkout seguro de Hotmart con tarjeta de crédito o débito, o con PayPal.${extra} Los medios disponibles aparecen antes de pagar.` };
}

/** Campos del documento `course_locales` para un país. Se escriben a la vez los del editor y los heredados. */
export async function campos(curso, cc) {
  const { markdownToPortableText } = await import('emdash/client');
  const pais = curso.paises[cc];
  const b = curso.base;
  const r = (s) => rellenar(s, cc, pais);
  const cuerpo = r(b.cuerpo);
  const faqs = [...b.faqs.map((f) => ({ q: r(f.q), a: r(f.a) })), faqMediosDePago(cc, pais.pais)];
  const beneficios = b.beneficios.map(r);
  const paraQuien = b.para_quien.map(r);
  const requisitos = b.requisitos.map(r);
  const h1 = r(b.h1);
  return {
    title: h1,
    h1,
    angulo: 'base',
    meta_title: pais.meta_title,
    meta_description: pais.meta_description,
    subtitulo: r(b.subtitulo),
    certificado: r(b.certificado),
    garantia: r(b.garantia),
    // El tema clásico y el V2 pintan `body` (Portable Text, con enlaces); `descripcion` es el respaldo en markdown.
    body: markdownToPortableText(cuerpo),
    descripcion: sinEnlaces(cuerpo),
    faq_items: faqs,
    faqs,
    benefit_items: beneficios.map((text) => ({ text })),
    beneficios,
    audience_items: paraQuien.map((text) => ({ text })),
    para_quien: paraQuien,
    requirement_items: requisitos.map((text) => ({ text })),
    requisitos,
  };
}

/**
 * Campos del documento `courses`: `teaches` del JSON-LD sale de `learning_items`. Los países sin
 * variante (`course_locales`) pintan la ficha con este documento, así que también lleva la versión
 * neutra del cuerpo (sin enlaces: no sabe el país), el público y las preguntas. `variantes: false` marca los cursos sin ninguna variante.
 */
export async function camposCurso(curso) {
  const c = curso.base.curso ?? {};
  const n = neutro(curso);
  const r = (t) => rellenar(t, 'co', n);
  const beneficios = curso.base.beneficios.map(r);
  const out = { learning_items: beneficios.map((text) => ({ text })), learnings: beneficios };
  if (c.short_description) out.short_description = c.short_description;
  if (c.meta_title) out.meta_title = c.meta_title;
  {
    // La ficha de los países sin variante sale de este documento: versión neutra, sin enlaces.
    const { markdownToPortableText } = await import('emdash/client');
    const cuerpo = sinEnlaces(r(curso.base.cuerpo));
    const faqs = curso.base.faqs.map((f) => ({ q: r(f.q), a: r(f.a) }));
    Object.assign(out, {
      body: markdownToPortableText(cuerpo),
      audience_items: curso.base.para_quien.map(r).map((text) => ({ text })),
      audience: curso.base.para_quien.map(r),
      faq_items: faqs,
      faqs,
    });
  }
  return out;
}

export function validar(curso) {
  const fallos = [];
  const mal = (donde, motivo) => fallos.push(`${curso.slug} · ${donde}: ${motivo}`);
  const revisar = (donde, texto, { permitirCertificado = false } = {}) => {
    for (const [patron, motivo] of VETADAS) {
      if (permitirCertificado && motivo.startsWith('«certificado»')) continue;
      if (patron.test(texto)) mal(donde, motivo);
    }
  };
  const b = curso.base;
  for (const [cc, pais] of Object.entries(curso.paises)) {
    const t = pais.meta_title.length, d = pais.meta_description.length;
    if (t < LIMITES.title[0] || t > LIMITES.title[1]) mal(`${cc}.meta_title`, `${t} caracteres`);
    if (d < LIMITES.description[0] || d > LIMITES.description[1]) mal(`${cc}.meta_description`, `${d} caracteres`);
    revisar(`${cc}.meta_title`, pais.meta_title);
    revisar(`${cc}.meta_description`, pais.meta_description);
    const h1 = rellenar(b.h1, cc, pais);
    if (h1.length > LIMITES.h1[1]) mal(`${cc}.h1`, `${h1.length} caracteres`);
    rellenar(b.cuerpo, cc, pais);
  }
  if (curso.variantes === false) {
    const c = curso.base.curso ?? {};
    if (!c.meta_title || c.meta_title.length > LIMITES.title[1]) mal('curso.meta_title', `${c.meta_title?.length ?? 0} caracteres`);
    if (!c.short_description || c.short_description.length > LIMITES.description[1]) mal('curso.short_description', `${c.short_description?.length ?? 0} caracteres`);
    revisar('curso', JSON.stringify(c));
    
  }
  // Huecos sin rellenar en cualquier país o en la versión neutra.
  const todos = [b.cuerpo, b.h1, b.subtitulo, b.certificado, b.garantia, ...b.beneficios, ...b.para_quien, ...b.requisitos, ...b.faqs.flatMap((f) => [f.q, f.a])];
  for (const [cc, pais] of [...Object.entries(curso.paises), ['neutro', neutro(curso)]]) {
    try { todos.forEach((t) => rellenar(t, cc === 'neutro' ? 'co' : cc, pais)); } catch (e) { mal(cc, e.message); }
  }
  const titulos = Object.values(curso.paises).map((p) => p.meta_title);
  if (new Set(titulos).size !== titulos.length) mal('meta_title', 'repetido entre países (la ficha añadiría el país al final)');
  const descs = Object.values(curso.paises).map((p) => p.meta_description);
  if (new Set(descs).size !== descs.length) mal('meta_description', 'repetida entre países');
  for (const campo of ['h1', 'subtitulo', 'cuerpo', 'certificado', 'garantia']) revisar(campo, b[campo]);
  [...b.beneficios, ...b.para_quien, ...b.requisitos].forEach((v, i) => {
    revisar(`viñeta ${i + 1}`, v);
    if (palabras(v) > LIMITES.vinetaPalabras) mal(`viñeta «${v.slice(0, 30)}…»`, `${palabras(v)} palabras`);
  });
  const arranques = b.beneficios.map((v) => v.split(' ')[0].toLowerCase());
  if (new Set(arranques).size < arranques.length - 1) mal('beneficios', 'varias viñetas empiezan igual');
  const n = palabras(b.cuerpo);
  if (n < LIMITES.cuerpoPalabras[0] || n > LIMITES.cuerpoPalabras[1]) mal('cuerpo', `${n} palabras`);
  if (!/^## /m.test(b.cuerpo)) mal('cuerpo', 'sin subtítulos');
  if (b.faqs.length < 6 || b.faqs.length > 8) mal('faqs', `${b.faqs.length} preguntas`);
  // Pregunta de compra obligatoria: pago único, acceso y garantía (no se quita ninguna respuesta de compra de hoy).
  if (!b.faqs.some((f) => /pago único/i.test(f.a) && /7 días/.test(f.a) && /acceso/i.test(f.a))) mal('faqs', 'falta la pregunta de compra (pago único, acceso y garantía de 7 días)');
  b.faqs.forEach((f, i) => {
    revisar(`faq ${i + 1} (pregunta)`, f.q, { permitirCertificado: true });
    revisar(`faq ${i + 1} (respuesta)`, f.a);
    const p = palabras(f.a);
    if (p < LIMITES.faqPalabras[0] || p > LIMITES.faqPalabras[1]) mal(`faq ${i + 1}`, `${p} palabras en la respuesta`);
    // La plantilla añade la pregunta de pago con los medios verificados; aquí no van medios ni importes.
    if (/\b(Nequi|PSE|OXXO|SPEI|Mercado ?Pago|Yape|PayPal)\b|\$\s?\d|\d+\s?(USD|COP|MXN)/i.test(f.a)) mal(`faq ${i + 1}`, 'medio de pago o importe');
  });
  // Instructores de relleno (lista medida el 24-nov).
  const relleno = path.join(RAIZ, 'src', 'data', 'instructores-relleno.json');
  if (existsSync(relleno)) {
    const datos = JSON.parse(readFileSync(relleno, 'utf8'));
    const nombres = (Array.isArray(datos) ? datos : datos.nombres ?? Object.values(datos).flat()).map((x) => (typeof x === 'string' ? x : x.nombre ?? x.name)).filter(Boolean);
    const todo = JSON.stringify(curso);
    for (const nombre of nombres) if (todo.includes(nombre)) mal('texto', `instructor de relleno «${nombre}»`);
  }
  // Densidad: la principal («curso de X») no más de 4 veces en el cuerpo.
  const principal = rellenar(b.h1, 'co', curso.paises.co ?? Object.values(curso.paises)[0] ?? { pais: '' }).replace(/ online en .*/i, '').toLowerCase();
  const veces = sinEnlaces(b.cuerpo).toLowerCase().split(principal).length - 1;
  if (veces > 4) mal('cuerpo', `la principal «${principal}» aparece ${veces} veces`);
  return fallos;
}

// ── CLI de EmDash ─────────────────────────────────────────────────────────────────────────────
function emdash(args) {
  // Token de API opcional (servidor local con copia de datos); en producción vale la sesión guardada de la CLI.
  const token = process.env.EMDASH_TOKEN_FILE ? readFileSync(process.env.EMDASH_TOKEN_FILE, 'utf8').trim() : null;
  const r = spawnSync('npx', ['--no-install', 'emdash', ...args, ...(token ? ['--token', token] : [])], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 << 20, env: process.env });
  if (r.status !== 0) throw new Error(`emdash ${args.slice(0, 3).join(' ')}: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ')}`);
  return r.stdout;
}
export const leer = (url, coleccion, slug) => JSON.parse(emdash(['content', 'get', coleccion, slug, '--url', url, '--json', '--raw']));
function escribir(url, coleccion, slug, data, rev) {
  const tmp = path.join(RAIZ, 'contenido', 'respaldos', '.escritura.json');
  writeFileSync(tmp, JSON.stringify(data));
  return JSON.parse(emdash(['content', 'update', coleccion, slug, '--url', url, '--file', tmp, '--rev', rev, '--json']));
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Portable Text con claves nuevas en cada conversión: se compara sin `_key`. */
const sinClaves = (v) => JSON.parse(JSON.stringify(v ?? null, (k, x) => (k === '_key' ? undefined : x)));

async function cargar({ url, cursos, paises, aplicar }) {
  const host = new URL(url).hostname;
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const respaldo = path.join(RAIZ, 'contenido', 'respaldos', host, sello);
  mkdirSync(respaldo, { recursive: true });
  const registro = [];
  for (const curso of leerCursos(cursos)) {
    const fallos = validar(curso);
    if (fallos.length) throw new Error(`no se carga ${curso.slug}:\n  ${fallos.join('\n  ')}`);
    const objetivos = [['courses', curso.slug, await camposCurso(curso)]];
    for (const cc of Object.keys(curso.paises)) if (!paises || paises.includes(cc)) objetivos.push(['course_locales', `${curso.slug}--${cc}`, await campos(curso, cc)]);
    for (const [coleccion, slug, nuevos] of objetivos) {
      let actual;
      try { actual = leer(url, coleccion, slug); } catch (e) {
        if (coleccion === 'course_locales' && /not found/i.test(e.message)) { registro.push({ coleccion, slug, accion: 'sin-variante' }); console.log(`· ${coleccion}/${slug} no existe: ese país usa el documento del curso`); continue; }
        throw e;
      }
      const cambian = Object.keys(nuevos).filter((k) => !igual(sinClaves(actual.data[k]), sinClaves(nuevos[k])));
      const fila = { coleccion, slug, rev_antes: actual._rev, cambian };
      if (!cambian.length) { registro.push({ ...fila, accion: 'igual' }); console.log(`= ${coleccion}/${slug}`); continue; }
      writeFileSync(path.join(respaldo, `${coleccion}__${slug}.json`), JSON.stringify(actual, null, 1));
      if (!aplicar) { registro.push({ ...fila, accion: 'simulado' }); console.log(`~ ${coleccion}/${slug}: ${cambian.join(', ')}`); continue; }
      const res = escribir(url, coleccion, slug, { ...actual.data, ...nuevos }, actual._rev);
      registro.push({ ...fila, accion: 'escrito', rev_despues: res._rev ?? res.item?._rev ?? null, hora: new Date().toISOString() });
      console.log(`✓ ${coleccion}/${slug}: ${cambian.join(', ')}`);
    }
  }
  writeFileSync(path.join(respaldo, 'registro.json'), JSON.stringify({ url, aplicar, registro }, null, 1));
  console.log(`\nRespaldo y registro: ${path.relative(RAIZ, respaldo)}`);
}

async function revertir({ url, respaldo, aplicar }) {
  const dir = path.resolve(respaldo);
  for (const f of readdirSync(dir).filter((x) => x.includes('__') && x.endsWith('.json'))) {
    const viejo = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
    const [coleccion, slug] = f.replace(/\.json$/, '').split('__');
    const actual = leer(url, coleccion, slug);
    if (igual(sinClaves(actual.data), sinClaves(viejo.data))) { console.log(`= ${coleccion}/${slug} ya está como el respaldo`); continue; }
    if (!aplicar) { console.log(`~ ${coleccion}/${slug} volvería a la revisión ${viejo._rev}`); continue; }
    escribir(url, coleccion, slug, viejo.data, actual._rev);
    console.log(`↩ ${coleccion}/${slug}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [orden, ...resto] = process.argv.slice(2);
  const opt = (n) => { const i = resto.indexOf(`--${n}`); return i < 0 ? undefined : resto[i + 1]; };
  const lista = (n) => opt(n)?.split(',').map((s) => s.trim()).filter(Boolean);
  const aplicar = resto.includes('--aplicar');
  try {
    if (orden === 'validar') {
      const fallos = leerCursos(lista('cursos')).flatMap(validar);
      console.log(fallos.length ? fallos.join('\n') : 'Sin fallos.');
      process.exit(fallos.length ? 1 : 0);
    } else if (orden === 'cargar') {
      if (!opt('url')) throw new Error('falta --url');
      await cargar({ url: opt('url'), cursos: lista('cursos'), paises: lista('paises'), aplicar });
    } else if (orden === 'revertir') {
      if (!opt('url') || !opt('respaldo')) throw new Error('faltan --url y --respaldo');
      await revertir({ url: opt('url'), respaldo: opt('respaldo'), aplicar });
    } else {
      console.log('uso: validar | cargar --url <base> [--cursos] [--paises] [--aplicar] | revertir --url <base> --respaldo <dir> [--aplicar]');
      process.exit(2);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
