#!/usr/bin/env node
/**
 * Menciones de duración en horas que quedan en el CMS: detectarlas, reescribir la frase y cargarla.
 *
 *   node scripts/horas-corregir.mjs volcar                      # lee cursos y variantes de producción (solo lectura)
 *   node scripts/horas-corregir.mjs detectar                    # menciones sobre el último volcado
 *   node scripts/horas-corregir.mjs redactar                    # Gemini decide si hablan de la duración del curso y reescribe
 *   node scripts/horas-corregir.mjs cargar --cursos a,b [--aplicar]
 *   node scripts/horas-corregir.mjs revertir --respaldo <carpeta> [--aplicar]
 *
 * Con medición (duracion-video.json del PR #354) la frase usa «1 h 10 min de vídeo»; sin ella, pierde la cifra.
 * Nunca escribe `title`, `h1` ni `meta_title`: esas menciones solo se listan.
 */
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = process.env.SABLY_DOCS ?? path.resolve(RAIZ, '../../../../docs');
const OUT = path.join(DOCS, 'equipo/2026-11-26/contenido');
const H = path.join(OUT, 'horas-correccion');
mkdirSync(H, { recursive: true });
const URL_ = 'https://sably.co';
const run = promisify(execFile);

const medicion = JSON.parse(readFileSync(path.join(H, 'duracion-video.json'), 'utf8')).cursos;
/** Mismo redondeo y formato que src/lib/duracion.ts del PR #354. */
export function medida(slug) {
  const s = medicion[slug];
  if (!s) return null;
  const m = Math.max(5, Math.round(s / 300) * 5), h = Math.floor(m / 60), r = m % 60;
  return `${h === 0 ? `${r} min` : r === 0 ? `${h} h` : `${h} h ${r} min`} de vídeo`;
}

// Mismo patrón que el detector del PR #354 (menciones.py).
const NUM = '(?:\\d+(?:[.,]\\d+)?|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|media)';
const RX = new RegExp(`(?<![\\wÀ-ÿ/])(?:m[aá]s de |unas |casi |hasta |cerca de |alrededor de )?${NUM}(?:\\s*(?:a|-|–|y)\\s*${NUM})?\\s*(?:horas?|hrs?\\.?|h)(?![\\wÀ-ÿ/])(?:\\s+(?:de|en)\\s+(?:contenido|v[ií]deo|clases?|formaci[oó]n|lecciones|pr[aá]ctica|curso|material))?`, 'gi');
/** Cifras de horas de un texto. La duración medida del curso (`m`) no cuenta: es la que debe decir. */
export function menciones(texto, m) {
  const t = m ? texto.replaceAll(m, ' ').replaceAll(m.replace(' de vídeo', ''), ' ') : texto;
  return [...t.matchAll(RX)].map((x) => x[0].trim()).filter((c) => !/^(24|48|72)\s*(h|horas?)/i.test(c) && !/^(una|un|media)\s*h$/i.test(c));
}
const CAMPOS = {
  courses: ['title', 'meta_title', 'short_description', 'body', 'source_body', 'curriculum', 'modules', 'learning_items', 'audience_items', 'faq_items', 'faqs', 'learnings', 'audience', 'instructor_bio', 'instructor'],
  course_locales: ['title', 'meta_title', 'meta_description', 'h1', 'subtitulo', 'certificado', 'garantia', 'body', 'faq_items', 'benefit_items', 'audience_items', 'requirement_items', 'descripcion', 'faqs', 'beneficios', 'para_quien', 'requisitos'],
};
const INTOCABLES = new Set(['title', 'meta_title', 'h1']);
const IGNORAR = new Set(['_type', '_key', 'style', 'marks', 'markDefs', 'id', 'slug', 'src', 'url', 'href']);

/** Recorre las cadenas de un campo (también JSON guardado como texto) y permite sustituirlas. */
export function recorrer(valor, f) {
  if (typeof valor === 'string') {
    if (/^\s*[[{]/.test(valor)) {
      try { const j = JSON.parse(valor); const n = recorrer(j, f); return JSON.stringify(n) === JSON.stringify(j) ? valor : JSON.stringify(n); } catch { /* texto normal */ }
    }
    return f(valor);
  }
  if (Array.isArray(valor)) return valor.map((v) => recorrer(v, f));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, IGNORAR.has(k) ? v : recorrer(v, f)]));
  return valor;
}
const frases = (t) => t.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9«"-])|\n+/).map((x) => x.trim()).filter(Boolean);

async function emdash(args) {
  for (let n = 1; ; n++) {
    try { return JSON.parse((await run('npx', ['--no-install', 'emdash', ...args, '--url', URL_, '--json'], { cwd: RAIZ, maxBuffer: 64 << 20 })).stdout); } catch (e) {
      if (n >= 3) throw new Error(`emdash ${args.slice(0, 4).join(' ')}: ${String(e.stderr || e.message).slice(-300)}`);
      await new Promise((r) => setTimeout(r, 5000 * n));
    }
  }
}
async function volcar() {
  const docs = [];
  for (const col of ['courses', 'course_locales']) {
    const slugs = []; let cursor;
    do { const r = await emdash(['content', 'list', col, '--limit', '100', ...(cursor ? ['--cursor', cursor] : [])]); slugs.push(...r.items.filter((i) => i.status === 'published')); cursor = r.nextCursor; } while (cursor);
    await Promise.all([1, 2, 3].map(async () => { for (let i; (i = slugs.shift());) { const d = await emdash(['content', 'get', col, i.slug, '--raw']); docs.push({ col, slug: i.slug, data: d.data }); } }));
  }
  writeFileSync(path.join(H, 'volcado.json'), JSON.stringify({ hora: new Date().toISOString(), docs }));
  console.log(`${docs.length} documentos`);
}

export function detectarEn(docs) {
  const filas = [];
  for (const { col, slug, data } of docs) {
    const curso = slug.split('--')[0];
    for (const campo of CAMPOS[col]) {
      if (data[campo] == null) continue;
      recorrer(data[campo], (t) => {
        for (const frase of frases(t)) for (const cifra of menciones(frase, medida(curso))) filas.push({ col, slug, curso, campo, cifra, frase });
        return t;
      });
    }
  }
  return filas;
}
function detectar() {
  const filas = detectarEn(JSON.parse(readFileSync(path.join(H, 'volcado.json'), 'utf8')).docs);
  writeFileSync(path.join(H, 'menciones.json'), JSON.stringify(filas, null, 1));
  const fijas = filas.filter((f) => INTOCABLES.has(f.campo));
  writeFileSync(path.join(H, 'en-titulos.json'), JSON.stringify(fijas, null, 1));
  const unicas = new Set(filas.map((f) => `${f.curso}|${f.frase}`));
  console.log(`${filas.length} menciones · ${unicas.size} frases distintas por curso · ${new Set(filas.map((f) => f.curso)).size} cursos · en title/h1/meta_title: ${fijas.length}`);
}

// ── Gemini ────────────────────────────────────────────────────────────────────────────────────
const LIBRO = path.join(OUT, 'gasto-gemini.jsonl');
const gastado = () => readFileSync(LIBRO, 'utf8').trim().split('\n').reduce((s, l) => s + JSON.parse(l).usd, 0);
async function gemini(curso, usuario) {
  if (gastado() >= 28.5) throw new Error('TOPE DE GASTO');
  const clave = readFileSync(path.join(homedir(), '.config/connexis/marketing-secrets.env'), 'utf8').match(/^(?:export\s+)?GEMINI_API_KEY=["']?([^"'\s]+)/m)[1];
  const sistema = `Revisas frases publicadas en la ficha de un curso online que mencionan horas. Para cada frase decide si AFIRMA LA DURACIÓN DEL CURSO (cuánto dura, cuántas horas de contenido, formación, clases o estudio tiene o certifica, o la duración de sus módulos). Hablar del tiempo que alguien dedica a practicar, de la duración de un servicio, evento o proceso del oficio, de plazos de acceso o de respuesta NO es la duración del curso.

Si NO lo es: es_duracion=false y nueva = cadena vacía.
Si lo es: es_duracion=true y reescribe SOLO lo imprescindible de esa frase, en el mismo español, tono y persona, para que quede natural:
- Si «duracion_medida» tiene valor, la única cifra de duración permitida es exactamente ese texto (por ejemplo «1 h 10 min de vídeo»), escrito una sola vez, o ninguna si queda más natural sin ella.
- Si es null, la frase queda sin ninguna cifra de horas ni de duración.
- Quita también cifras que dependan de la duración falsa (horas semanales para terminarlo, semanas, «a lo largo de X horas»). No cambies ni añadas otros hechos. No uses «constancia». Conserva las demás cifras, nombres, enlaces markdown y puntuación final.
- Si la frase entera solo servía para decir la duración y no hay medida, reescríbela con lo que quede cierto (por ejemplo, que avanzas a tu ritmo); nunca la dejes vacía.`;
  const S = { type: 'OBJECT', properties: { frases: { type: 'ARRAY', items: { type: 'OBJECT', properties: { n: { type: 'INTEGER' }, es_duracion: { type: 'BOOLEAN' }, nueva: { type: 'STRING' } }, required: ['n', 'es_duracion', 'nueva'] } } }, required: ['frases'] };
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-4-carbon:generateContent', { method: 'POST', headers: { 'x-goog-api-key': clave, 'content-type': 'application/json' }, signal: AbortSignal.timeout(300000),
    body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: 'user', parts: [{ text: usuario }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: S, thinkingConfig: { thinkingLevel: 'low' }, maxOutputTokens: 30000 } }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${j.error?.message?.slice(0, 200)}`);
  const u = j.usageMetadata ?? {};
  appendFileSync(LIBRO, `${JSON.stringify({ hora: new Date().toISOString(), slug: curso, fase: 'horas', modelo: 'gemini-4-carbon', entrada: u.promptTokenCount ?? 0, salida: u.candidatesTokenCount ?? 0, razonamiento: u.thoughtsTokenCount ?? 0, usd: Number((((u.promptTokenCount ?? 0) * 2 + ((u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0)) * 10) / 1e6).toFixed(6)) })}\n`);
  return JSON.parse(j.candidates[0].content.parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('')).frases;
}

/** Por qué una reescritura no vale, o null. */
export function rechazo(vieja, nueva, m) {
  if (!nueva?.trim()) return 'vacía';
  const sin = m ? nueva.replace(m, '') : nueva;
  if (menciones(sin).length || /\d+\s*h\b|\d+\s*min\b/i.test(sin)) return 'queda una cifra de duración';
  if (m && nueva.split(m).length > 2) return 'repite la duración';
  const permitidas = new Set([...(vieja.match(/\d+/g) ?? []), ...(m?.match(/\d+/g) ?? [])]);
  if ((nueva.match(/\d+/g) ?? []).some((x) => !permitidas.has(x))) return 'cifra nueva';
  if (/constancia/i.test(nueva) && !/constancia/i.test(vieja)) return 'constancia';
  const enl = (t) => JSON.stringify(t.match(/\]\([^)]+\)/g) ?? []);
  if (enl(vieja) !== enl(nueva)) return 'cambia enlaces';
  if (nueva.length > vieja.length * 1.5 + 40 || nueva.length < vieja.length * 0.3) return 'longitud';
  return null;
}

async function redactar() {
  const filas = JSON.parse(readFileSync(path.join(H, 'menciones.json'), 'utf8')).filter((f) => !INTOCABLES.has(f.campo));
  const fichero = path.join(H, 'reescrituras.json');
  const hechas = existsSync(fichero) ? JSON.parse(readFileSync(fichero, 'utf8')) : {};
  const porCurso = new Map();
  for (const f of filas) if (!hechas[`${f.curso}|${f.frase}`]) porCurso.set(f.curso, new Set([...(porCurso.get(f.curso) ?? []), f.frase]));
  const cola = [...porCurso].map(([curso, s]) => [curso, [...s]]);
  console.log(`${cola.length} cursos, ${cola.reduce((n, [, s]) => n + s.length, 0)} frases por revisar`);
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let item; (item = cola.shift());) {
      const [curso, lista] = item;
      const m = medida(curso);
      let pendientes = lista.map((frase) => ({ frase, motivo: null }));
      for (let ronda = 1; ronda <= 3 && pendientes.length; ronda++) {
        const siguiente = [];
        for (let i = 0; i < pendientes.length; i += 25) {
          const lote = pendientes.slice(i, i + 25);
          try {
            const r = await gemini(curso, JSON.stringify({ curso, duracion_medida: m, frases: lote.map((p, n) => ({ n, frase: p.frase, ...(p.motivo ? { intento_anterior_rechazado_porque: p.motivo } : {}) })) }));
            lote.forEach((p, n) => {
              const x = r.find((y) => y.n === n);
              if (!x) return siguiente.push({ ...p, motivo: 'faltó en la respuesta' });
              if (!x.es_duracion) { hechas[`${curso}|${p.frase}`] = { es_duracion: false }; return; }
              const no = rechazo(p.frase, x.nueva, m);
              if (no) siguiente.push({ ...p, motivo: no }); else hechas[`${curso}|${p.frase}`] = { es_duracion: true, nueva: x.nueva.trim() };
            });
          } catch (e) { console.error(`${curso}: ${e.message}`); lote.forEach((p) => siguiente.push(p)); }
        }
        pendientes = siguiente;
      }
      for (const p of pendientes) hechas[`${curso}|${p.frase}`] = { es_duracion: null, motivo: p.motivo };
      writeFileSync(fichero, JSON.stringify(hechas, null, 1));
    }
  }));
  const v = Object.values(hechas);
  console.log(`duración del curso: ${v.filter((x) => x.es_duracion === true).length} · no lo son: ${v.filter((x) => x.es_duracion === false).length} · sin resolver: ${v.filter((x) => x.es_duracion === null).length} · gasto USD ${gastado().toFixed(2)}`);
}

// ── Carga ─────────────────────────────────────────────────────────────────────────────────────
export function corregir(col, slug, data, reescrituras) {
  const curso = slug.split('--')[0];
  const nuevo = { ...data }; const cambian = []; let n = 0;
  for (const campo of CAMPOS[col]) {
    if (INTOCABLES.has(campo) || data[campo] == null) continue;
    const v = recorrer(data[campo], (t) => {
      let s = t;
      for (const frase of frases(t)) { const r = reescrituras[`${curso}|${frase}`]; if (r?.es_duracion && menciones(frase, medida(curso)).length && s.includes(frase)) { s = s.replace(frase, () => r.nueva); n++; } }
      return s;
    });
    if (JSON.stringify(v) !== JSON.stringify(data[campo])) { nuevo[campo] = v; cambian.push(campo); }
  }
  return { nuevo, cambian, n };
}
async function cargar(cursos, aplicar) {
  const re = JSON.parse(readFileSync(path.join(H, 'reescrituras.json'), 'utf8'));
  const filas = JSON.parse(readFileSync(path.join(H, 'menciones.json'), 'utf8'));
  const objetivos = [...new Map(filas.filter((f) => (!cursos || cursos.includes(f.curso)) && !INTOCABLES.has(f.campo) && re[`${f.curso}|${f.frase}`]?.es_duracion).map((f) => [`${f.col}/${f.slug}`, f])).values()];
  const respaldo = path.join(H, 'respaldos', new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(respaldo, { recursive: true });
  const registro = [];
  for (const { col, slug } of objetivos) {
    const actual = await emdash(['content', 'get', col, slug, '--raw']);
    const { nuevo, cambian, n } = corregir(col, slug, actual.data, re);
    if (!cambian.length) continue;
    writeFileSync(path.join(respaldo, `${col}__${slug}.json`), JSON.stringify(actual, null, 1));
    if (aplicar) {
      const tmp = path.join(respaldo, '.escritura.json');
      writeFileSync(tmp, JSON.stringify(nuevo));
      await emdash(['content', 'update', col, slug, '--file', tmp, '--rev', actual._rev]);
    }
    registro.push({ col, slug, cambian, frases: n, hora: new Date().toISOString() });
    console.log(`${aplicar ? '✓' : '~'} ${col}/${slug}: ${n} frases (${cambian.join(', ')})`);
  }
  writeFileSync(path.join(respaldo, 'registro.json'), JSON.stringify({ aplicar, registro }, null, 1));
  console.log(`${registro.length} documentos, ${registro.reduce((s, r) => s + r.frases, 0)} sustituciones. Respaldo: ${respaldo}`);
}
async function revertir(dir, aplicar) {
  const { readdirSync } = await import('node:fs');
  for (const f of readdirSync(dir).filter((x) => x.includes('__'))) {
    const viejo = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
    const [col, slug] = f.replace(/\.json$/, '').split('__');
    const actual = await emdash(['content', 'get', col, slug, '--raw']);
    const datos = { ...viejo.data };
    for (const k of INTOCABLES) if (k in actual.data) datos[k] = actual.data[k];
    if (aplicar) { const tmp = path.join(dir, '.escritura.json'); writeFileSync(tmp, JSON.stringify(datos)); await emdash(['content', 'update', col, slug, '--file', tmp, '--rev', actual._rev]); }
    console.log(`${aplicar ? '↩' : '~'} ${col}/${slug}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [orden, ...resto] = process.argv.slice(2);
  const opt = (k) => { const i = resto.indexOf(`--${k}`); return i < 0 ? undefined : resto[i + 1]; };
  const aplicar = resto.includes('--aplicar');
  if (orden === 'volcar') await volcar();
  else if (orden === 'detectar') detectar();
  else if (orden === 'redactar') await redactar();
  else if (orden === 'cargar') await cargar(opt('cursos')?.split(','), aplicar);
  else if (orden === 'revertir') await revertir(opt('respaldo'), aplicar);
  else { console.log('uso: volcar | detectar | redactar | cargar [--cursos] [--aplicar] | revertir --respaldo <dir> [--aplicar]'); process.exit(2); }
}
