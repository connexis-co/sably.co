#!/usr/bin/env node
/**
 * Comprueba en el HTML renderizado (no en el archivo) que la ficha muestra el contenido de
 * contenido/cursos/<slug>.json: H1, promesa, subtítulos y frases del texto largo, preguntas (visibles
 * y en FAQPage), `teaches` del JSON-LD, sin frases vetadas y sin errores de seo-onpage.
 *
 *   node scripts/verificar-contenido.mjs --base https://sably.co --cursos a,b --paises co,mx [--fresco] [--tema v2]
 *
 * `--fresco` añade ?verif=<hora> para saltar la caché de página (la primera visita a la URL limpia
 * puede devolver la copia vieja de Cloudflare). En dev.sably.co usa SABLY_DEV_PASSWORD si existe.
 */
import { leerCursos, campos, camposCurso, VETADAS, leer } from './contenido-cursos.mjs';
import { auditarOnPage } from './seo-onpage.mjs';
import { cabecerasEntorno } from './seo-test.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i < 0 ? undefined : args[i + 1]; };
const BASE = (opt('base') ?? 'https://sably.co').replace(/\/$/, '');
const paises = opt('paises')?.split(',') ?? ['co', 'mx'];
const fresco = args.includes('--fresco');
const tema = opt('tema');

const texto = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').replace(/ (?=[.,;:!?)])/g, '');
const plano = (md) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '');
const jsonld = (html) => [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
  try { const j = JSON.parse(m[1]); return (Array.isArray(j) ? j : j['@graph'] ?? [j]).flatMap((n) => n['@graph'] ?? [n]); } catch { return [{ _roto: true }]; }
});
const tipo = (n, t) => [].concat(n['@type'] ?? []).includes(t);

let fallosTotales = 0;
for (const curso of leerCursos(opt('cursos')?.split(','))) {
  const general = await camposCurso(curso);
  for (const cc of paises) {
    const query = [fresco && `verif=${Date.now()}`, tema && `tema=${tema}`].filter(Boolean).join('&');
    const url = `${BASE}/${cc}/${curso.slug}/${query ? `?${query}` : ''}`;
    const r = await fetch(url, { headers: { 'user-agent': 'sably-verificar-contenido/1.0', ...cabecerasEntorno(BASE) } });
    const html = await r.text();
    const fuente = r.headers.get('x-sably-locale-source');
    // Sin variante en el CMS, el país pinta el documento del curso aunque el JSON traiga ese país.
    // Sin la cabecera (servidor local en modo dev) se pregunta al CMS si la variante existe.
    const existe = () => { try { leer(BASE, 'course_locales', `${curso.slug}--${cc}`); return true; } catch { return false; } };
    const conVariante = Boolean(curso.paises[cc]) && (fuente ? fuente !== 'emdash-generic' : existe());
    const esperado = conVariante ? await campos(curso, cc) : null;
    const visible = texto(html);
    const fallos = [];
    const falta = (que, s) => { if (!visible.includes(texto(s).trim())) fallos.push(`falta ${que}: «${s.slice(0, 60)}»`); };
    if (r.status !== 200) fallos.push(`HTTP ${r.status}`);
    const h1 = texto(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '').trim();
    if (!h1) fallos.push('sin H1'); // el H1 no se escribe: que no cambie lo comprueba foto-fichas.mjs
    // Sin variante se pinta el documento del curso: huecos con el vocabulario neutro (el de Colombia).
    const voc = { computador: 'computador', tapabocas: 'tapabocas', celular: 'celular', ...(curso.paises.co?.vocabulario ?? {}) };
    const cuerpo = conVariante ? esperado.descripcion : plano(Object.entries(voc).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), curso.base.cuerpo));
    if (conVariante) falta('promesa', esperado.subtitulo);
    for (const t of cuerpo.match(/^## .+$/gm) ?? []) falta('subtítulo', t.slice(3));
    const parrafos = cuerpo.split(/\n\n/).filter((p) => !p.startsWith('#') && !p.startsWith('- ') && p.length > 80);
    for (const p of [parrafos[0], parrafos.at(-1)].filter(Boolean)) falta('párrafo', plano(p).split('. ')[0]);
    // En la variante, la pregunta de medios de pago la sustituye la plantilla por precio + pago verificado.
    const faqs = conVariante ? esperado.faqs.filter((f) => !/medios de pago acepta/.test(f.q)) : general.faqs;
    for (const f of faqs) { falta('pregunta', f.q); falta('respuesta', f.a.split('. ')[0]); }
    for (const b of conVariante ? esperado.beneficios : general.learnings) falta('qué aprenderás', b);
    // JSON-LD
    const nodos = jsonld(html);
    if (nodos.some((n) => n._roto)) fallos.push('JSON-LD que no se puede leer');
    const faqPage = nodos.find((n) => tipo(n, 'FAQPage'));
    const qs = (faqPage?.mainEntity ?? []).map((q) => q.name);
    for (const f of faqs) if (!qs.includes(f.q)) fallos.push(`FAQPage sin «${f.q}»`);
    // Respuestas de compra que no se pueden perder: precio (variante) y medios de pago (siempre).
    if (conVariante && !qs.includes('¿Cuánto cuesta el curso?')) fallos.push('falta la pregunta de precio');
    if (!qs.some((q) => /^¿Cómo puedo pagar desde /.test(q))) fallos.push('falta la pregunta de medios de pago');
    const visibles = [...html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>|<h3[^>]*>([\s\S]*?)<\/h3>|<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => texto(m[1] ?? m[2] ?? m[3] ?? '').trim());
    for (const q of qs) if (!visibles.some((v) => v.includes(q)) && !visible.includes(q)) fallos.push(`FAQPage con pregunta no visible «${q}»`);
    const cursoLd = nodos.find((n) => tipo(n, 'Course'));
    if (cursoLd?.teaches && JSON.stringify(cursoLd.teaches) !== JSON.stringify(general.learnings)) fallos.push('teaches del JSON-LD ≠ Qué aprenderás del curso');
    if (/constancia/i.test(JSON.stringify(cursoLd?.educationalCredentialAwarded ?? ''))) fallos.push('JSON-LD dice «constancia»');
    // Frases vetadas en lo que escribimos (la pregunta de certificado es la excepción admitida).
    const nuestro = [cuerpo, ...faqs.map((f) => f.a), ...(conVariante ? [esperado.subtitulo] : [])].join(' ');
    for (const [patron, motivo] of VETADAS) if (patron.test(nuestro)) fallos.push(`vetada en el contenido: ${motivo}`);
    // Reglas on-page del proyecto (solo errores).
    for (const h of auditarOnPage(url, html).filter((h) => h.nivel === 'error')) fallos.push(`seo-onpage ${h.regla}: ${h.detalle}`);
    fallosTotales += fallos.length;
    console.log(`${fallos.length ? '✗' : '✓'} ${url} (${fuente ?? 'sin cabecera'})${fallos.map((f) => `\n    ${f}`).join('')}`);
  }
}
process.exit(fallosTotales ? 1 : 0);
