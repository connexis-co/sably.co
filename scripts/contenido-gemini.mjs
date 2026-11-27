#!/usr/bin/env node
/**
 * Cadena de redacción de fichas con la API de Gemini, sobre el formato de contenido/cursos/<slug>.json.
 *
 *   node scripts/contenido-gemini.mjs hechos   --cursos a,b            # lee la página de pago de Hotmart y reúne los hechos
 *   node scripts/contenido-gemini.mjs redactar --cursos a,b [--paralelo 5]   # borrador, control por código, auditoría y arreglos
 *   node scripts/contenido-gemini.mjs revisar  --cursos a,b            # la misma segunda pasada sobre un JSON que ya existe
 *   node scripts/contenido-gemini.mjs gasto
 *
 * Variables: SABLY_DOCS (carpeta docs/ del proyecto), SABLY_INVENTARIO (carpeta con cursos.json y listas.json
 * volcados del CMS). La clave se lee de ~/.config/connexis/marketing-secrets.env y nunca se imprime.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validar, VETADAS } from './contenido-cursos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'contenido', 'cursos');
const DOCS = process.env.SABLY_DOCS ?? path.resolve(RAIZ, '../../../../docs');
const OUT = path.join(DOCS, 'equipo/2026-11-26/contenido');
const SEO = path.join(DOCS, 'equipo/2026-11-25/seo/datos');
const INV = process.env.SABLY_INVENTARIO ?? path.join(OUT, 'inventario');
const HOY = new Date().toISOString().slice(0, 10);
for (const d of ['fuentes-hotmart', 'hechos', 'revisiones']) mkdirSync(path.join(OUT, d), { recursive: true });

const MODELO = process.env.SABLY_MODELO ?? 'gemini-4-carbon';
const PRECIOS = { 'gemini-4-carbon': [2, 10], 'gemini-4-argon': [2, 10], 'gemini-4-hydrogen': [1.5, 7.5], 'gemini-4-neon': [3, 15] }; // USD por millón (hasta el 30-nov)
const TOPE_USD = 28.5;

const PAISES = { co: ['Colombia', 'COP'], mx: ['México', 'MXN'], pe: ['Perú', 'PEN'], ec: ['Ecuador', 'USD'], cl: ['Chile', 'CLP'], ar: ['Argentina', 'ARS'], es: ['España', 'EUR'], us: ['Estados Unidos', 'USD'] };
const VOCABULARIO = {
  co: { computador: 'computador', tapabocas: 'tapabocas', celular: 'celular' },
  mx: { computador: 'computadora', tapabocas: 'cubrebocas', celular: 'celular' },
  pe: { computador: 'computadora', tapabocas: 'mascarilla', celular: 'celular' },
  ec: { computador: 'computadora', tapabocas: 'mascarilla', celular: 'celular' },
  cl: { computador: 'computador', tapabocas: 'mascarilla', celular: 'celular' },
  ar: { computador: 'computadora', tapabocas: 'barbijo', celular: 'celular' },
  es: { computador: 'ordenador', tapabocas: 'mascarilla', celular: 'móvil' },
  us: { computador: 'computadora', tapabocas: 'mascarilla', celular: 'celular' },
};
/** Frases que delatan notas internas, la fuente o relleno de palabras clave: nunca llegan al lector. */
export const INTERNAS = [
  [/\b(la|su|esta|propia) (propia )?descripci[oó]n\b|descripci[oó]n (del|de la) (creador|docente|producto|curso|vendedor)|\bla fuente\b|seg[uú]n hotmart|dudas verificadas/i, 'habla de la fuente o de la descripción del producto'],
  [/\b(el creador|el docente|hotmart|el curso)\s+(no\s+)?(lo\s+|la\s+)?(menciona|nombra|detalla|especifica|aclara|indica|declara|plantea|promete)\b|\b(sin|no) (se )?(nombrar?|mencionar?|detallar?)\b|por nombre\b|de forma expresa/i, 'comenta lo que la fuente dice o calla'],
  [/\bfichas?\b(?! t[eé]cnicas?)/i, 'dice «ficha»'],
  [/en (varios|algunos|otros) pa[ií]ses|tambi[eé]n (se )?(conoce|llama|busca)|se (le )?conoce como|mucha gente (busca|pregunta)/i, 'relleno de palabra clave'],
  [/antes de comprar y (te )?confirmamos|escr[ií]benos|nuestro equipo/i, 'pide contacto o habla como vendedor'],
  [/\b(quien(es)?|si) (busca[ns]?|compara[ns]?)\b[^.]{0,60}\bcurso de\b|al (revisar|comparar) (opciones|cursos)/i, 'frase hecha para colar la palabra clave'],
];
const MEDICAS = /contraindica|embaraz|gestaci[oó]n|trombosis|v[aá]rices|ganglion|quemaduras|hematoma|hongos|infecci|medicament|diagn[oó]stic[oa] m[eé]dic|\bsin dolor\b|enfermedades de/gi;
const SENSIBLES = /masaje|drenaje|maderoterapia|primeros-auxilios|nutricion|depilacion|facial|maquillaje-permanente|microblading|pestanas|cejas|keratina|colorimetria|balayage|unas|tatuaje|canina|mascotas|adiestramiento|defensa|yoga|entrenador|cosmetica|aloe|jabones|cuidado-de|spa|reflexologia|peluqueria/;

// ── Utilidades ────────────────────────────────────────────────────────────────────────────────
const leerJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
function leerCsv(f) {
  const t = readFileSync(f, 'utf8').replace(/^﻿/, '');
  const filas = []; let campo = '', fila = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; } else if (c === '"') q = true;
    else if (c === ',') { fila.push(campo); campo = ''; } else if (c === '\n') { fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas;
  return resto.map((r) => Object.fromEntries(cab.map((k, i) => [k, r[i] ?? ''])));
}
let _datos;
function datos() {
  return (_datos ??= {
    cursos: leerJson(path.join(INV, 'cursos.json')),
    listas: leerJson(path.join(INV, 'listas.json')),
    clusteres: leerCsv(path.join(SEO, 'clusteres.csv')),
    canib: leerCsv(path.join(SEO, 'canibalizacion-decisiones.csv')),
    faqs: leerCsv(path.join(SEO, 'faq-nuevas.csv')),
    codigos: leerCsv(path.join(SEO, 'riesgo-hotmart-certificado-acceso.csv')),
    creadores: leerCsv(path.join(SEO, 'cursos.csv')),
    acerca: leerJson(path.join(DOCS, 'equipo/2026-11-26/ficha-datos/acerca-productor.json')),
    docentes: leerJson(path.join(DOCS, 'equipo/2026-11-26/ficha-datos/docentes-carga.json')).docentes,
  });
}

// ── 1 · Hechos de la página de pago ───────────────────────────────────────────────────────────
const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36' };
export function productoDelCheckout(html) {
  const bloques = [...html.matchAll(/<script[^>]*(?:id="__NUXT_DATA__"|type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).sort((a, b) => b.length - a.length);
  const arr = JSON.parse(bloques[0]);
  const res = (i, n = 0) => {
    const v = arr[i];
    if (n > 6) return null;
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && /^(Reactive|ShallowReactive|Ref|ShallowRef)$/.test(v[0])) return res(v[1], n + 1);
      return v.map((x) => (typeof x === 'number' ? res(x, n + 1) : x));
    }
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'number' ? res(x, n + 1) : x]));
    return v;
  };
  const i = arr.findIndex((v) => v && typeof v === 'object' && !Array.isArray(v) && 'warrantyDays' in v && 'authorName' in v);
  if (i < 0) throw new Error('la página de pago no trae el producto');
  const p = res(i);
  const sub = arr.find((v) => v && typeof v === 'object' && !Array.isArray(v) && 'subscriptionId' in v);
  const suscripcion = sub ? res(arr.indexOf(sub)).subscriptionId : null;
  return { nombre: p.name, autor: p.authorName, garantiaDias: p.warrantyDays, tipo: p.type, categoria: p.categoryName, descripcion: String(p.description ?? ''), suscripcion };
}
const textoPlano = (s) => s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d|div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

async function hechos(slug) {
  const d = datos();
  const doc = d.cursos[slug];
  if (!doc) throw new Error(`${slug}: no está en el inventario del CMS`);
  const codigo = d.acerca[slug]?.producto || d.codigos.find((x) => x.curso === slug)?.codigo;
  if (!codigo) throw new Error(`${slug}: sin producto en Hotmart`);
  const url = `https://pay.hotmart.com/${codigo}?checkoutMode=10`;
  let p;
  for (let intento = 1; ; intento++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(40000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      p = productoDelCheckout(await r.text());
      break;
    } catch (e) { if (intento >= 3) throw new Error(`${slug}: ${e.message}`); await new Promise((res) => setTimeout(res, 4000 * intento)); }
  }
  const descripcion = textoPlano(p.descripcion);
  const creadorCsv = d.creadores.find((x) => x.slug === slug)?.creador?.replace(/[®™]/g, '').trim();
  const creador = /masterclasses/i.test(p.autor) ? 'MasterClasses.La' : creadorCsv || p.autor;
  const frasesCert = descripcion.split(/\n+/).map((l) => l.replace(/^[\s•*·\-–]+/, '').trim()).filter((l) => /certificad|certificaci[oó]n|diploma/i.test(l));
  const certificado = frasesCert.some((f) => /hotmart/i.test(f) && /seminarios/i.test(f)) ? 'hotmart-seminarios' : frasesCert.length ? 'pagina' : 'jp';
  const doce = d.docentes[slug];
  const dudosos = /maquillaje-permanente|primeros-auxilios|nutricion-practica|modisteria/;
  const out = {
    slug, leido_el: HOY, url, codigo, producto: p.nombre, autor: p.autor, creador, tipo: p.tipo, suscripcion: p.suscripcion,
    garantia_dias: p.garantiaDias, certificado, frases_certificado: frasesCert, descripcion,
    docente: doce && !dudosos.test(slug) ? { nombre: doce.name, oficio: doce.title, bio: doce.bio, fuente: 'equipo/2026-11-26/ficha-datos/docentes-carga.json' } : null,
  };
  writeFileSync(path.join(OUT, 'hechos', `${slug}.json`), JSON.stringify(out, null, 1));
  writeFileSync(path.join(OUT, 'fuentes-hotmart', `${slug}.txt`),
    `# ${slug}\nProducto Hotmart: ${codigo} · «${p.nombre}»\nFuente: ${url} (checkout público), leído el ${HOY}\nwarrantyDays: ${p.garantiaDias}\ntipo: ${p.tipo}\nautor: ${p.autor}\n\nDescripción del producto (texto del creador, literal):\n\n${descripcion}\n`);
  return out;
}

// ── 2 · Contexto para el modelo ───────────────────────────────────────────────────────────────
/** Los términos del planificador vienen sin tildes: se corrigen las que van a texto fijo. */
const TILDES = { unas: 'uñas', pestanas: 'pestañas', barberia: 'barbería', carpinteria: 'carpintería', sublimacion: 'sublimación', mecanica: 'mecánica', reparacion: 'reparación', depilacion: 'depilación', pasteleria: 'pastelería', reposteria: 'repostería', panaderia: 'panadería', fotografia: 'fotografía', decoracion: 'decoración', peluqueria: 'peluquería', joyeria: 'joyería', serigrafia: 'serigrafía', chocolateria: 'chocolatería', confeccion: 'confección', colorimetria: 'colorimetría', modisteria: 'modistería', ingles: 'inglés', frances: 'francés', japones: 'japonés', portugues: 'portugués', computacion: 'computación', ninos: 'niños', cocteleria: 'coctelería', nutricion: 'nutrición', instalacion: 'instalación', camaras: 'cámaras', macrame: 'macramé', molderia: 'moldería', diseno: 'diseño', banos: 'baños', remodelacion: 'remodelación', energia: 'energía', estetica: 'estética', linfatico: 'linfático', terapeuticos: 'terapéuticos', basica: 'básica', artistica: 'artística', fantasia: 'fantasía', bisuteria: 'bisutería', electronica: 'electrónica', computadora: 'computadora', musica: 'música', economia: 'economía', automaquillaje: 'automaquillaje' };
const conTildes = (t) => t.replace(/[a-zñáéíóú]+/gi, (w) => TILDES[w.toLowerCase()] ?? w);
function principalDe(slug) {
  const d = datos();
  const t = d.clusteres.find((x) => x.slug === slug && x.rol === 'principal')?.termino ?? d.cursos[slug]?.data.title.toLowerCase();
  return conTildes(t.replace(/^cursos /i, 'curso '));
}
const variantesDe = (slug) => datos().listas.locales.filter((l) => l.slug.startsWith(`${slug}--`)).map((l) => l.slug.split('--')[1]).filter((cc) => PAISES[cc]);

function contexto(slug) {
  const d = datos();
  const doc = d.cursos[slug].data;
  const h = leerJson(path.join(OUT, 'hechos', `${slug}.json`));
  const terminos = d.clusteres.filter((x) => x.slug === slug);
  const vol = (x) => Number(x.vol_total || 0);
  const canib = d.canib.filter((x) => x.paginas_en_conflicto.split('|').map((s) => s.trim()).includes(slug))
    .map((x) => ({ termino: x.termino_o_grupo, se_queda: x.pagina_que_se_queda, reparto: x.reorientacion_otra, enlaces: x.enlace_interno_ancla }));
  const enConflicto = new Set(d.canib.filter((x) => x.paginas_en_conflicto.includes(slug)).flatMap((x) => x.paginas_en_conflicto.split('|').map((s) => s.trim())));
  const publicados = d.listas.cursos.filter((c) => c.status === 'published' && c.slug !== slug).map((c) => c.slug);
  const relacionados = [...new Set([...publicados.filter((s) => enConflicto.has(s)), ...publicados.filter((s) => d.cursos[s]?.data.category === doc.category)])]
    .slice(0, 12).map((s) => ({ url: `/{cc}/${s}/`, tema: principalDe(s) }));
  const categoria = { url: `/{cc}/cursos/${doc.category}/`, tema: `cursos de ${doc.category.replaceAll('-', ' ')}` };
  const preguntas = [...new Set(d.faqs.filter((x) => x.slug === slug && !['ingresos', 'precio', 'constancia', 'gratis', 'duracion'].includes(x.tema) && !/\d|certificad|gratis|cu[aá]nto (cuesta|vale|gana|dura|cobra)/i.test(x.pregunta)).map((x) => x.pregunta))].slice(0, 14);
  const ccs = variantesDe(slug);
  const sensible = SENSIBLES.test(slug) || ['bienestar', 'cuidado-animal'].includes(doc.category);
  return {
    h, doc, ccs, sensible,
    permitidos: [...relacionados.map((r) => r.url), categoria.url],
    para_el_modelo: {
      titulo_actual_de_la_pagina: doc.title,
      palabra_clave_principal: principalDe(slug),
      variaciones: terminos.filter((x) => x.rol.startsWith('variaci') && !/\d/.test(x.termino)).sort((a, b) => vol(b) - vol(a)).slice(0, 8).map((x) => x.termino),
      complementarias: terminos.filter((x) => x.rol === 'complementaria' && !/\d|certificad|gratis|precio/i.test(x.termino)).sort((a, b) => vol(b) - vol(a)).slice(0, 8).map((x) => x.termino),
      reparto_entre_fichas: canib,
      enlaces_internos_permitidos: [...relacionados, categoria],
      preguntas_que_hace_la_gente: preguntas,
      fuente_hotmart: { nombre_del_producto: h.producto, creador: h.creador, descripcion_literal: h.descripcion },
      docente_verificado: h.docente ? { nombre: h.docente.nombre, oficio: h.docente.oficio, resumen: h.docente.bio } : null,
      tema_sensible: sensible,
      paises: ccs.length ? ccs.map((cc) => ({ codigo: cc, nombre: PAISES[cc][0], moneda: PAISES[cc][1] })) : [],
    },
  };
}

// Piezas de compra: deterministas, para que ningún dato de pago, garantía o certificado dependa del modelo.
const elegir = (slug, n) => [...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % n;
function piezas(slug, h, principal) {
  const N = h.garantia_dias;
  const cert = h.certificado === 'hotmart-seminarios'
    ? { corto: `Al completar el curso recibes un certificado digital de finalización, avalado por Hotmart y por Seminarios Online (${h.creador}). Acredita que lo terminaste; no es un título oficial.`,
      faq: `Sí. Al terminar recibes un certificado digital de finalización avalado por Hotmart y por Seminarios Online (${h.creador}). Puedes mostrarlo a quien te contrate o a tus clientes como constancia de que hiciste la formación. No es un título oficial ni una certificación profesional.` }
    : { corto: 'Al completar el curso recibes un certificado digital de finalización. Acredita que lo terminaste; no es un título oficial.',
      faq: 'Sí. Al terminar recibes un certificado digital de finalización que acredita que completaste la formación. Puedes mostrarlo a quien te contrate o a tus clientes. No es un título oficial ni una certificación profesional, así que no reemplaza lo que la ley pida para ejercer.' };
  cert.faq = cert.faq.replace(' como constancia de que hiciste la formación', ' para respaldar que hiciste la formación');
  const compra = [
    `Es de pago único en Hotmart, sin mensualidades ni cobros posteriores. Al confirmarse el pago recibes el acceso por correo y el curso queda en tu cuenta sin fecha de vencimiento. Si en los primeros ${N} días ves que no es lo que buscabas, pides allí el reembolso completo.`,
    `No es gratis y tampoco cobra mensualidad: haces un pago único en Hotmart. El acceso llega a tu correo cuando se confirma la compra y no tiene fecha de vencimiento. Tienes ${N} días de garantía para pedir en Hotmart la devolución total si el curso no te sirve.`,
    `Se compra una sola vez en Hotmart, con pago único y sin cuotas mensuales de suscripción. Recibes el acceso por correo al confirmarse el pago y conservas el curso sin fecha de vencimiento. Durante ${N} días puedes solicitar en Hotmart el reembolso del 100 %.`,
  ][elegir(slug, 3)];
  const sinCurso = principal.replace(/^curso (de |para )?/i, '');
  const sujeto = /^curso/i.test(principal) ? `El ${principal}` : `El curso de ${sinCurso}`;
  return {
    certificado: cert.corto,
    garantia: `Tienes ${N} días de garantía en Hotmart: si el curso no te convence, pides allí el reembolso del 100 %.`,
    faqs: [
      { q: `¿${sujeto} da certificado?`, a: cert.faq },
      { q: `¿${sujeto} es gratis o tiene mensualidades?`, a: compra },
    ],
  };
}

// ── 3 · Gemini ────────────────────────────────────────────────────────────────────────────────
let _clave;
const clave = () => (_clave ??= readFileSync(path.join(homedir(), '.config/connexis/marketing-secrets.env'), 'utf8').match(/^(?:export\s+)?GEMINI_API_KEY=["']?([^"'\s]+)/m)?.[1] ?? (() => { throw new Error('falta GEMINI_API_KEY'); })());
const LIBRO = path.join(OUT, 'gasto-gemini.jsonl');
export const gastado = () => (existsSync(LIBRO) ? readFileSync(LIBRO, 'utf8').trim().split('\n').filter(Boolean).reduce((s, l) => s + JSON.parse(l).usd, 0) : 0);

async function gemini({ slug, fase, sistema, usuario, esquema, nivel }) {
  if (gastado() >= TOPE_USD) throw new Error(`TOPE DE GASTO: van USD ${gastado().toFixed(2)}`);
  const cuerpo = {
    systemInstruction: { parts: [{ text: sistema }] },
    contents: [{ role: 'user', parts: [{ text: usuario }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: esquema, thinkingConfig: { thinkingLevel: nivel }, maxOutputTokens: 24000 },
  };
  for (let intento = 1; ; intento++) {
    let error;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': clave(), 'content-type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(300000),
      });
      const j = await r.json();
      if (!r.ok) { error = `HTTP ${r.status} ${j.error?.message?.slice(0, 200)}`; if (![429, 500, 502, 503, 504].includes(r.status)) intento = 99; }
      else {
        const u = j.usageMetadata ?? {};
        const [pe, ps] = PRECIOS[MODELO];
        const salida = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
        const usd = ((u.promptTokenCount ?? 0) * pe + salida * ps) / 1e6;
        appendFileSync(LIBRO, `${JSON.stringify({ hora: new Date().toISOString(), slug, fase, modelo: MODELO, entrada: u.promptTokenCount ?? 0, salida: u.candidatesTokenCount ?? 0, razonamiento: u.thoughtsTokenCount ?? 0, usd: Number(usd.toFixed(6)) })}\n`);
        const texto = j.candidates?.[0]?.content?.parts?.filter((p) => p.text && !p.thought).map((p) => p.text).join('') ?? '';
        try { return JSON.parse(texto); } catch { error = `respuesta sin JSON (${j.candidates?.[0]?.finishReason})`; }
      }
    } catch (e) { error = e.message; }
    if (intento >= 4) throw new Error(`${slug} ${fase}: ${error}`);
    await new Promise((res) => setTimeout(res, 8000 * intento));
  }
}

const ESTILO = `ESTILO (español de Latinoamérica, de una persona del oficio):
- De tú, sin voseo. Dato antes que adjetivo, verbos concretos del oficio, frases de largo variado, una idea por frase.
- Prohibido: «no solo… sino», «no es X, es Y», «más que un…», cierres de moraleja, tríos de adjetivos o beneficios de relleno, guion largo (— o –), emojis, negritas, preguntas retóricas de arranque, «imagina», «descubre», «sumérgete», «adéntrate», «desbloquea», «potencia», «optimiza», «increíble», «apasionante», «fascinante», «de primer nivel», «el siguiente nivel», «en el mundo actual», «la clave», «crucial», «fundamental», «integral», «además cabe destacar», gerundios colgados al final de la frase.
- No hables del texto ni de la ficha («en esta página», «a continuación»). No escribas que algo «se busca mucho».
- Habla del «curso» y de lo que haces en él. No rellenes con «programa», «temario», «formación», «metodología», «entrenamiento» ni «aquí». Nada de «a diferencia de» ni comparaciones con academias presenciales.
- Los consejos del oficio son pocos (dos o tres en todo el cuerpo y las respuestas), útiles y propios de ese oficio; nada de higiene o seguridad genérica pegada por cumplir. {tapabocas} solo si el oficio de verdad lo usa.
- El primer párrafo empieza diciendo qué es: «El curso de … online de (creador real) enseña…». No uses el nombre comercial interno del producto salvo que suene natural.
- Las viñetas no empiezan todas igual. No repitas la misma idea en dos secciones: cada sección y cada respuesta aportan algo nuevo.`;

const REGLAS = `REGLAS DE HECHOS (lo más importante; ante la duda, no lo afirmes):
- Lo único que puedes presentar como CONTENIDO DEL CURSO es lo que dice la descripción literal de Hotmart (o se deduce sin duda de ella). No inventes temas, técnicas, materiales incluidos, plantillas, bonos, soporte, ejercicios, evaluaciones, orden de las lecciones ni nivel.
- NUNCA digas duración, horas, número de lecciones, módulos o clases, aunque la fuente los mencione de pasada. Tampoco escribas cifras de ingresos, mercado, precios, descuentos, alumnos ni valoraciones.
- Conocimiento general del oficio: se permite como consejo prudente que cualquier profesional confirmaría («en el oficio…», «conviene…»), nunca atribuido al curso y sin cifras, temperaturas, dosis, proporciones ni normas legales concretas.
- Sin promesas de dinero, empleo, clientes ni resultados (en el negocio, el cuerpo o la salud). Las promesas de venta de la fuente no se repiten.
- Sin urgencia («cupos», «solo hoy»). No menciones precio, medios de pago, certificado ni garantía: de eso se encarga la plantilla con datos verificados.
- Escribes para el comprador: jamás comentes tu fuente ni tus dudas en el texto («la descripción dice», «el creador no menciona», «no consta», «ficha»). Lo que no consta simplemente no se escribe; la duda va solo en «dudas». No invites a escribir por WhatsApp ni hables como vendedor.
- Palabras prohibidas: «constancia», «certificado», «certificación», «afiliado», «productor», «catálogo», «plataforma líder».
- No describas la estructura ni el método del curso («dedica un bloque», «avanzas ensayando», «explicaciones paso a paso», «en video») si la descripción no lo dice. No menciones «la fuente» ni «Hotmart» como origen de la información.
- El creador se nombra como figura en la fuente. Un docente solo si viene en docente_verificado; no inventes nombres ni credenciales.
- Si la descripción de Hotmart trata algo distinto o más estrecho que el título actual de la página (por ejemplo, soldadura que en realidad es automotriz), escribe solo lo que dice Hotmart, deja claro el alcance y anótalo en «dudas».`;

const SENSIBLE_TXT = `TEMA SENSIBLE (salud, cuerpo, animales o estética con riesgo): ningún consejo médico ni veterinario, ningún efecto sobre la salud o el cuerpo aunque la fuente lo prometa (adelgazar, reducir medidas, curar, aliviar, eliminar, «sin dolor»). Nada de listas de contraindicaciones, síntomas, zonas que no se tocan, primeros auxilios paso a paso ni preguntas sobre embarazo o enfermedades. Como máximo UNA frase en el cuerpo que diga cuándo acudir a un profesional de la salud o veterinario y que el curso no lo reemplaza.`;

const sistemaRedaccion = (sensible) => `Redactas el contenido de la ficha de un curso online de un oficio para Sably, una plataforma de cursos online de oficios en español. Quien lee decide si compra y quiere saber qué va a aprender, para quién es y qué necesita. Asistentes de IA citan estas fichas: cada frase debe ser verificable.

${REGLAS}
${sensible ? `\n${SENSIBLE_TXT}\n` : ''}
${ESTILO}

PALABRAS CLAVE (la página vende UN curso: usa siempre el singular «curso de…»; nunca «cursos de…», salvo en el ancla del enlace a la categoría; una variación en plural se convierte al singular):
- La principal va en el primer párrafo del cuerpo y 1 o 2 veces más en todo el cuerpo (nunca más de 3 en total). Cada variación como mucho una vez, solo donde encaje con naturalidad. Las complementarias sirven de subtítulo o pregunta frecuente, nunca en serie. Corrige tildes y mayúsculas de los términos.
- No uses una variación que atribuya al curso algo que la fuente no dice (por ejemplo «profunda», «avanzado», «presencial», «con práctica», «a domicilio»).
- Respeta «reparto_entre_fichas»: lo que pertenece a otra ficha no lo posiciones aquí; enlázala.

QUÉ ENTREGAS (JSON):
- subtitulo: una frase de 15 a 30 palabras con lo que sabrás hacer, verbos del oficio.
- beneficios: exactamente 6 viñetas de 4 a 11 palabras sacadas de la lista de Hotmart, cada una empieza con palabra distinta, sin punto final.
- para_quien: exactamente 4 viñetas de máximo 12 palabras, sin punto final; la última dice para quién NO es y empieza con «No es para ti si».
- requisitos: exactamente 4 viñetas de máximo 12 palabras, sin punto final: experiencia previa (solo di que no hace falta si la fuente enseña desde cero; si no consta, no lo incluyas), materiales reales para practicar el oficio e internet con {celular} o {computador}.
- cuerpo: markdown de 440 a 560 palabras. Empieza con un párrafo sin título. Luego 4 a 6 secciones con «## » y subtítulos propios del oficio (no genéricos como «Introducción» ni «Conclusión»). Puede llevar una lista corta. Incluye entre 3 y 5 enlaces markdown, SOLO con URL de enlaces_internos_permitidos (copiadas tal cual, con {cc}), con ancla descriptiva; el último puede ser la categoría. No enlaces dos veces la misma URL. Nombra al creador una vez.
- faqs: exactamente 5 preguntas con las palabras con que las busca la gente (elige de preguntas_que_hace_la_gente las que puedas responder con hechos; adapta «en España», «en Perú»… a una pregunta sin país). Respuestas de 42 a 62 palabras; la primera frase contesta. PROHIBIDAS preguntas sobre certificado, precio, gratis, pago, mensualidades, garantía, duración, desde el celular, cuándo empieza, soporte o dudas, y cuánto se gana. Al menos una pregunta nombra la palabra principal.
- short_description: una frase de 120 a 150 caracteres que empieza por la palabra principal (con mayúscula inicial) y dice qué se aprende.
- meta_descriptions: una por cada país de «paises» (lista vacía si no hay países), cada una DISTINTA en redacción, de 136 a 150 caracteres contando espacios (cuenta con cuidado). Empieza por «Curso de …» (la principal o una variación en singular), dice dos o tres cosas que se aprenden, nombra el código de la moneda y no promete nada. Cierres naturales y variados entre países, por ejemplo «Pagas en COP y recibes certificado.» o «Incluye certificado y se paga en MXN.»; nunca «es con certificado» ni «aquí pagas».
- dudas: lista corta de lo que una persona debería comprobar (contradicciones, cosas que la fuente promete y omitiste, alcance distinto del título). Vacía si no hay.

Huecos: usa {computador}, {celular}, {tapabocas}, {pais} y {cc} donde corresponda (no escribas «computador», «computadora», «móvil», «celular» ni «tapabocas» sueltos en cuerpo, viñetas ni respuestas). Evita {pais} salvo que sea necesario.`;

const S = (o) => ({ type: 'OBJECT', properties: o, required: Object.keys(o), propertyOrdering: Object.keys(o) });
const STR = { type: 'STRING' };
const LISTA = (items) => ({ type: 'ARRAY', items });
const ESQUEMA = S({
  subtitulo: STR, beneficios: LISTA(STR), para_quien: LISTA(STR), requisitos: LISTA(STR), cuerpo: STR,
  faqs: LISTA(S({ q: STR, a: STR })), short_description: STR, meta_descriptions: LISTA(S({ codigo: STR, texto: STR })), dudas: LISTA(STR),
});
const ESQUEMA_AUDIT = S({ problemas: LISTA(S({ gravedad: { type: 'STRING', enum: ['bloquea', 'menor'] }, campo: STR, cita: STR, motivo: STR, arreglo: STR })) });

const sistemaAuditoria = (sensible) => `Eres el revisor adversario de la ficha de un curso. Tu trabajo es encontrar lo que está mal comparando el borrador con la fuente. No reescribes.

Marca «bloquea»:
1. Cualquier cosa presentada como contenido, material o característica del curso que no esté en la descripción literal de Hotmart (ni se deduzca sin duda), o que la contradiga.
2. Duración, horas, número de lecciones o módulos, cifras, precios, alumnos, valoraciones, nombres o credenciales sin fuente (el docente solo vale si coincide con docente_verificado).
3. Promesas de dinero, empleo, clientes o resultados; efectos sobre la salud o el cuerpo; urgencia.
4. Consejos del oficio peligrosos, falsos, discutibles o con datos concretos (temperaturas, dosis, normas).${sensible ? ' En este tema sensible, cualquier consejo médico o veterinario.' : ''}
5. Posicionar un término que el reparto asigna a otra ficha.
6. Cualquier frase que hable de la fuente, de la descripción del producto, de lo que el creador menciona o calla, de la «ficha», o que parezca una nota interna o un truco de palabra clave («también se conoce como… en varios países»).
Marca «menor»: frases de relleno o genéricas que servirían para cualquier curso, ideas repetidas entre secciones o respuestas, español poco natural o de España, calcos, «no solo… sino», cierres de moraleja, tríos de relleno, palabra clave forzada.

Las frases de consejo general prudente, marcadas como consejo y sin atribuirlas al curso, son válidas. La lista «requisitos» puede nombrar los materiales de práctica habituales del oficio y la conexión a internet aunque la fuente no los liste: solo es un problema si son raros, peligrosos o se presentan como incluidos en el curso. Los huecos {computador}, {celular}, {tapabocas}, {pais} y {cc} son correctos. Los textos de certificado, garantía y las dos preguntas de compra los pone la plantilla con datos verificados: no los revises. Que un hecho de la fuente se haya omitido no es un problema. No inventes problemas: si está bien, devuelve la lista vacía. En «cita» copia el fragmento exacto.`;

// ── 4 · Control por código ────────────────────────────────────────────────────────────────────
const plano = (md) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const nPalabras = (s) => plano(s).replace(/[#*>-]/g, ' ').split(/\s+/).filter(Boolean).length;
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const textosDe = (b) => [b.subtitulo, ...b.beneficios, ...b.para_quien, ...b.requisitos, b.cuerpo, ...b.faqs.flatMap((f) => [f.q, f.a]), b.short_description];

function frasesDeOtros(slug) {
  const m = new Map();
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.json') || f === `${slug}.json`) continue;
    const c = leerJson(path.join(DIR, f));
    for (const t of [c.base.cuerpo, ...c.base.faqs.slice(0, -2).map((x) => x.a)]) {
      for (const fr of plano(t).split(/(?<=[.!?])\s+|\n+/)) if (fr.split(/\s+/).length >= 10) m.set(norm(fr.trim()), c.slug);
    }
  }
  return m;
}

export function controlDeCodigo(slug, borrador, ctx) {
  const p = [];
  const mal = (campo, motivo) => p.push({ gravedad: 'bloquea', campo, cita: '', motivo, arreglo: '' });
  const b = borrador;
  if (b.beneficios?.length !== 6) mal('beneficios', 'deben ser exactamente 6');
  if (b.para_quien?.length !== 4) mal('para_quien', 'deben ser exactamente 4');
  else if (!/^No es para ti/i.test(b.para_quien[3])) mal('para_quien', 'la última empieza con «No es para ti si»');
  if (b.requisitos?.length !== 4) mal('requisitos', 'deben ser exactamente 4');
  [...(b.beneficios ?? []), ...(b.para_quien ?? []), ...(b.requisitos ?? [])].forEach((v) => { if (nPalabras(v) > 13) mal('viñeta', `«${v}» tiene más de 13 palabras`); });
  if (new Set((b.beneficios ?? []).map((v) => v.split(' ')[0].toLowerCase())).size < 5) mal('beneficios', 'varias empiezan igual');
  const n = nPalabras(b.cuerpo);
  if (n < 410 || n > 640) mal('cuerpo', `tiene ${n} palabras; deben ser 440 a 560`);
  if ((b.cuerpo.match(/^## /gm) ?? []).length < 3) mal('cuerpo', 'faltan subtítulos «## »');
  const enlaces = [...b.cuerpo.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
  for (const u of enlaces) if (!ctx.permitidos.includes(u)) mal('cuerpo', `enlace no permitido ${u}`);
  if (enlaces.length < 2 || enlaces.length > 6) mal('cuerpo', `${enlaces.length} enlaces; deben ser 3 a 5`);
  if (new Set(enlaces).size !== enlaces.length) mal('cuerpo', 'enlace repetido');
  if (b.faqs.length !== 5) mal('faqs', 'deben ser exactamente 5');
  b.faqs.forEach((f, i) => {
    const w = nPalabras(f.a);
    if (w < 36 || w > 72) mal(`faq ${i + 1}`, `la respuesta tiene ${w} palabras; deben ser 42 a 62`);
    if (/certificad|precio|cuesta|gratis|pago|mensualidad|garant[ií]a|reembolso|cu[aá]nto (dura|gana)/i.test(f.q)) mal(`faq ${i + 1}`, 'pregunta reservada a la plantilla o prohibida');
    if (/\b(Nequi|PSE|OXXO|SPEI|Mercado ?Pago|Yape|PayPal)\b|\$\s?\d|\d+\s?(USD|COP|MXN)/i.test(f.a)) mal(`faq ${i + 1}`, 'medio de pago o importe');
  });
  const fuente = norm(ctx.h.descripcion);
  for (const t of textosDe(b)) {
    const limpio = plano(t);
    for (const [patron, motivo] of VETADAS) if (patron.test(limpio)) mal('texto', `frase vetada: ${motivo} en «${limpio.slice(Math.max(0, limpio.search(patron) - 40), limpio.search(patron) + 60)}»`);
    if (/certificad|certificaci[oó]n/i.test(limpio)) mal('texto', 'no menciones certificado ni certificación (lo pone la plantilla)');
    for (const m of limpio.matchAll(/\d+(?:[.,]\d+)?/g)) if (!fuente.includes(m[0])) mal('texto', `cifra sin fuente «${limpio.slice(Math.max(0, m.index - 40), m.index + 30)}»`);
    for (const [patron, motivo] of INTERNAS) { const m = limpio.match(patron); if (m) mal('texto', `${motivo}: quita o reescribe la frase «${limpio.slice(Math.max(0, m.index - 70), m.index + 90)}»`); }
    if (/\b(\d+|varias|pocas|muchas|unas?) horas de (video|vídeo|contenido|clase|formaci[oó]n|curso)|\b(lecciones|m[oó]dulos) (en total)|\bdura (unas?|cerca de|aproximadamente)\b/i.test(limpio)) mal('texto', 'duración o número de lecciones');
  }
  if (ctx.sensible) {
    const todo = textosDe(b).map(plano).join(' ');
    const medicas = [...todo.matchAll(MEDICAS)];
    if (medicas.length > 2) mal('texto', `demasiado contenido médico (${[...new Set(medicas.map((m) => m[0]))].join(', ')}): deja como máximo UNA frase general en el cuerpo que diga cuándo acudir a un profesional, sin listas de contraindicaciones ni preguntas sobre salud o embarazo`);
    b.faqs.forEach((f, i) => { if (new RegExp(MEDICAS.source, 'i').test(f.q) || /no se (puede|debe)|qui[eé]n no|zonas? (que )?no/i.test(f.q)) mal(`faq ${i + 1}`, `pregunta de salud o contraindicaciones («${f.q}»): cámbiala por una sobre el oficio o el curso`); });
  }
  const crudos = [b.cuerpo, b.subtitulo, ...b.beneficios, ...b.para_quien, ...b.requisitos, ...b.faqs.map((f) => f.a)].map(plano).join(' ');
  const suelta = crudos.match(/(?<!\{)\b(computador[a]?|ordenador|tapabocas|cubrebocas|celular|móvil)(?:es|s)?\b(?!\})/i);
  if (suelta) mal('texto', `usa el hueco en vez de «${suelta[0]}»`);
  if (/\bcursos de (?!belleza|bienestar|cuidado|emprendimiento|gastronom|hosteler|hospitalidad|idiomas|manualidades|moda|m[uú]sica|oficios|panader)/i.test([b.cuerpo.replace(/\[[^\]]+\]\([^)]+\)/g, ''), b.short_description, b.subtitulo, ...b.faqs.map((f) => `${f.q} ${f.a}`), ...b.meta_descriptions.map((m) => m.texto)].join(' '))) mal('texto', 'usa «curso de…» en singular: nada de «cursos de…»');
  const principal = norm(principalDe(slug));
  const cuerpo = norm(plano(b.cuerpo));
  const veces = cuerpo.split(principal).length - 1;
  if (veces > 4) mal('cuerpo', `la principal aparece ${veces} veces; máximo 3`);
  const sd = b.short_description?.length ?? 0;
  if (sd < 90 || sd > 158) mal('short_description', `${sd} caracteres; deben ser 120 a 150`);
  for (const cc of ctx.ccs) {
    const m = b.meta_descriptions.find((x) => x.codigo === cc);
    if (!m) { mal(`meta ${cc}`, 'falta'); continue; }
    if (m.texto.length < 130 || m.texto.length > 158) mal(`meta ${cc}`, `${m.texto.length} caracteres; deben ser 136 a 152: «${m.texto}»`);
    if (!m.texto.includes(PAISES[cc][1])) mal(`meta ${cc}`, `falta el código ${PAISES[cc][1]}`);
    for (const [patron, motivo] of VETADAS) if (patron.test(m.texto)) mal(`meta ${cc}`, motivo);
  }
  const ds = ctx.ccs.map((cc) => b.meta_descriptions.find((x) => x.codigo === cc)?.texto);
  if (new Set(ds).size !== ds.length) mal('meta', 'descripciones repetidas entre países');
  const otros = frasesDeOtros(slug);
  for (const t of [b.cuerpo, ...b.faqs.map((f) => f.a)]) for (const fr of plano(t).split(/(?<=[.!?])\s+|\n+/)) { const k = otros.get(norm(fr.trim())); if (k) mal('texto', `frase idéntica a la de ${k}: «${fr.trim()}»; redáctala de otra forma`); }
  return p;
}

// ── 5 · Archivo final ─────────────────────────────────────────────────────────────────────────
function armar(slug, b, ctx, extra) {
  const principal = principalDe(slug);
  const pz = piezas(slug, ctx.h, principal);
  const ccs = ctx.ccs.length ? ctx.ccs : ['co'];
  const paises = Object.fromEntries(ccs.map((cc) => [cc, {
    pais: PAISES[cc][0], vocabulario: VOCABULARIO[cc],
    meta_description: b.meta_descriptions.find((x) => x.codigo === cc)?.texto ?? b.short_description,
  }]));
  const curso = {
    slug, estado: extra.estado, generado_con: extra.modelo,
    fuentes: [
      `Hotmart, checkout público del producto ${ctx.h.codigo} «${ctx.h.producto}» (${ctx.h.autor}), leído el ${ctx.h.leido_el}: descripción literal, warrantyDays = ${ctx.h.garantia_dias}, tipo ${ctx.h.tipo}`,
      ctx.h.certificado === 'jp' ? 'Certificado: la página de Hotmart no lo menciona; confirmación del propietario del sitio (25-nov)' : `Certificado: «${ctx.h.frases_certificado.join(' / ')}» (página de Hotmart)`,
      'Acceso sin fecha de vencimiento: confirmación del propietario del sitio (25-nov)',
      ...(ctx.h.docente ? [`Docente: ${ctx.h.docente.nombre} (${ctx.h.docente.fuente})`] : []),
      'Palabras clave: clusteres.csv, canibalizacion-decisiones.csv y faq-nuevas.csv del 25-nov',
    ],
    dudas: extra.dudas, sensible: ctx.sensible,
    ...(ctx.ccs.length ? {} : { variantes: false }),
    base: {
      h1: `${principal.charAt(0).toUpperCase()}${principal.slice(1)} online en {pais}`,
      subtitulo: b.subtitulo, beneficios: b.beneficios, para_quien: b.para_quien, requisitos: b.requisitos, cuerpo: b.cuerpo,
      faqs: [...b.faqs, ...pz.faqs], certificado: pz.certificado, garantia: pz.garantia,
      curso: { short_description: b.short_description },
    },
    paises,
  };
  writeFileSync(path.join(DIR, `${slug}.json`), `${JSON.stringify(curso, null, 2)}\n`);
  return curso;
}

/** Control + auditoría + arreglos. Devuelve el borrador final y lo que no se pudo resolver. */
async function depurar(slug, b, ctx, usuario) {
  const rondas = [];
  let pendientes = [];
  for (let ronda = 1; ronda <= 4; ronda++) {
    let problemas = controlDeCodigo(slug, b, ctx);
    let auditado = false;
    // La auditoría cuesta: solo se pide cuando el control por código ya pasa o en la primera ronda.
    if (ronda === 1 || !problemas.length) {
      const a = await gemini({ slug, fase: `auditoria-${ronda}`, nivel: ronda === 1 ? 'medium' : 'low', sistema: sistemaAuditoria(ctx.sensible), esquema: ESQUEMA_AUDIT,
        usuario: `FUENTE Y CONTEXTO:\n${JSON.stringify(ctx.para_el_modelo, null, 1)}\n\nBORRADOR:\n${JSON.stringify({ ...b, dudas: undefined }, null, 1)}` });
      auditado = true;
      // A partir de la tercera ronda solo se persigue lo que bloquea.
      problemas = [...problemas, ...a.problemas.filter((x) => ronda < 3 || x.gravedad === 'bloquea')];
    }
    rondas.push({ ronda, auditado, problemas });
    pendientes = problemas.filter((x) => x.gravedad === 'bloquea');
    const hayQueArreglar = ronda === 1 ? problemas.length : pendientes.length;
    if (!hayQueArreglar && auditado) break;
    if (ronda === 4) break;
    if (!hayQueArreglar) continue;
    const arreglado = await gemini({ slug, fase: `arreglo-${ronda}`, nivel: 'low', sistema: sistemaRedaccion(ctx.sensible), esquema: ESQUEMA,
      usuario: `${usuario}\n\nTU BORRADOR ANTERIOR:\n${JSON.stringify(b, null, 1)}\n\nCORRIGE SOLO ESTOS PROBLEMAS y devuelve el JSON completo (no cambies lo que no está señalado; si un hecho no tiene fuente, quítalo y completa la extensión con otra cosa que sí la tenga):\n${JSON.stringify(problemas, null, 1)}` });
    b = { ...arreglado, dudas: [...new Set([...(b.dudas ?? []), ...(arreglado.dudas ?? [])])] };
  }
  return { b, pendientes, rondas };
}

async function procesar(slug, modo) {
  if (!existsSync(path.join(OUT, 'hechos', `${slug}.json`)) || modo === 'revisar') await hechos(slug);
  const ctx = contexto(slug);
  const motivos = [];
  if (ctx.h.tipo !== 'NORMAL' || Number(ctx.h.suscripcion) > 0) motivos.push(`el producto no es de pago único (tipo ${ctx.h.tipo}, suscripción ${ctx.h.suscripcion})`);
  if (!(ctx.h.garantia_dias > 0)) motivos.push('sin días de garantía');
  if (ctx.h.descripcion.length < 300) motivos.push(`descripción de Hotmart demasiado corta (${ctx.h.descripcion.length} caracteres)`);
  if (motivos.length) {
    writeFileSync(path.join(OUT, 'revisiones', `${slug}.json`), JSON.stringify({ slug, estado: 'apartado', motivos }, null, 1));
    return { slug, estado: 'apartado', motivos };
  }
  const usuario = `DATOS DEL CURSO:\n${JSON.stringify(ctx.para_el_modelo, null, 1)}`;
  let borrador, dudasPrevias = [];
  if (modo === 'revisar') {
    const c = leerJson(path.join(DIR, `${slug}.json`));
    const quitar = (t) => String(t).replace(/\{(?!computador|celular|tapabocas|pais|cc)[a-z_]+\}/g, '');
    borrador = {
      subtitulo: c.base.subtitulo, beneficios: c.base.beneficios, para_quien: c.base.para_quien, requisitos: c.base.requisitos, cuerpo: quitar(c.base.cuerpo),
      faqs: c.base.faqs.filter((f) => !/certificad|constancia|gratis|mensualidad/i.test(f.q)).slice(0, 5),
      short_description: c.base.curso?.short_description ?? '',
      meta_descriptions: ctx.ccs.map((cc) => ({ codigo: cc, texto: c.paises[cc]?.meta_description ?? '' })), dudas: c.dudas ?? [],
    };
    dudasPrevias = c.dudas ?? [];
  } else {
    borrador = await gemini({ slug, fase: 'redaccion', nivel: 'low', sistema: sistemaRedaccion(ctx.sensible), usuario, esquema: ESQUEMA });
  }
  const { b, pendientes, rondas } = await depurar(slug, borrador, ctx, usuario);
  const curso = armar(slug, b, ctx, { estado: pendientes.length ? 'apartado' : 'listo', modelo: modo === 'revisar' ? `borrador del 25-nov revisado con ${MODELO}` : MODELO, dudas: [...new Set([...dudasPrevias, ...(b.dudas ?? [])])] });
  const fallos = validar(curso);
  const estado = pendientes.length || fallos.length ? 'apartado' : 'listo';
  if (estado === 'apartado' && curso.estado !== 'apartado') { curso.estado = 'apartado'; writeFileSync(path.join(DIR, `${slug}.json`), `${JSON.stringify(curso, null, 2)}\n`); }
  writeFileSync(path.join(OUT, 'revisiones', `${slug}.json`), JSON.stringify({ slug, estado, pendientes, validador: fallos, rondas }, null, 1));
  return { slug, estado, motivos: [...pendientes.map((x) => `${x.campo}: ${x.motivo}`), ...fallos] };
}

async function main() {
  const [orden, ...resto] = process.argv.slice(2);
  const opt = (n) => { const i = resto.indexOf(`--${n}`); return i < 0 ? undefined : resto[i + 1]; };
  const cursos = opt('cursos')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (orden === 'gasto') return console.log(`USD ${gastado().toFixed(2)}`);
  if (!['hechos', 'redactar', 'revisar'].includes(orden) || !cursos.length) { console.log('uso: hechos|redactar|revisar --cursos a,b [--paralelo 5] | gasto'); process.exit(2); }
  const cola = [...cursos]; let malos = 0;
  await Promise.all(Array.from({ length: Number(opt('paralelo') ?? (orden === 'hechos' ? 2 : 5)) }, async () => {
    for (let slug; (slug = cola.shift());) {
      try {
        if (orden === 'hechos') { const h = await hechos(slug); console.log(`✓ ${slug}: «${h.producto}» · ${h.creador} · garantía ${h.garantia_dias} · certificado ${h.certificado} · ${h.descripcion.length} car. · tipo ${h.tipo}/${h.suscripcion}`); await new Promise((r) => setTimeout(r, 900)); }
        else { const r = await procesar(slug, orden); console.log(`${r.estado === 'listo' ? '✓' : '✗'} ${slug}: ${r.estado}${r.motivos?.length ? `\n    ${r.motivos.slice(0, 6).join('\n    ')}` : ''} · gasto USD ${gastado().toFixed(2)}`); if (r.estado !== 'listo') malos++; }
      } catch (e) { malos++; console.error(`✗ ${slug}: ${e.message}`); }
    }
  }));
  if (orden !== 'hechos') console.log(`\nApartados o con error: ${malos} de ${cursos.length}. Gasto acumulado USD ${gastado().toFixed(2)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
