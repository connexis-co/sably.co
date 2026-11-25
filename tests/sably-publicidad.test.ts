import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, LINEA_ADS_TXT, cuentaNueva, huecoHtml, ELEGIR_PUNTOS_JS, normalizarConfig, paginaPermitida, textoScript, reservar, validarConfig, type ConfigPublicidad } from '../src/plugins/sably-publicidad/model';
import { createPlugin, fragmentosPublicidad } from '../src/plugins/sably-publicidad/index';
import { motorScript, puertaScript } from '../src/plugins/sably-publicidad/runtime';

const encendida = (extra: Partial<ConfigPublicidad> = {}): ConfigPublicidad => validarConfig({ ...structuredClone(DEFAULT_CONFIG), enabled: true, cliente: 'ca-pub-6213862553989716', ...extra });
const articulo = { pageType: 'article', url: 'https://sably.co/blog/empezar-a-coser-en-casa/' };

test('apagado por defecto: sin configuración el hook no aporta nada y nada está permitido', async () => {
  assert.equal(DEFAULT_CONFIG.enabled, false);
  assert.ok(Object.values(DEFAULT_CONFIG.posiciones).every(p => !p.activa));
  assert.deepEqual(fragmentosPublicidad(DEFAULT_CONFIG, articulo), []);
  assert.equal(paginaPermitida(DEFAULT_CONFIG, 'article', '/blog/x/'), false);
  const plugin = createPlugin() as unknown as { hooks: Record<string, { handler?: Function } | Function> };
  const hook = plugin.hooks['page:fragments'];
  const fn = (typeof hook === 'function' ? hook : hook.handler) as Function;
  assert.equal(await fn({ page: articulo }, { kv: { get: async () => null } }), null);
  assert.equal(await fn({ page: articulo }, { kv: { get: async () => ({ ...DEFAULT_CONFIG }) } }), null);
});

test('solo blog y guías por defecto; fichas, caja, portada y listados exigen confirmación expresa', () => {
  const c = encendida();
  assert.equal(paginaPermitida(c, 'article', '/blog/x/'), true);
  assert.equal(paginaPermitida(c, 'blog', '/blog/'), true);
  for (const t of ['course', 'course_city', 'home', 'catalog', 'category']) assert.equal(paginaPermitida(c, t, '/co/x/'), false);
  assert.throws(() => encendida({ tiposPagina: ['article', 'course'] }), /confirma expresamente/);
  assert.equal(paginaPermitida(encendida({ tiposPagina: ['course'], confirmoProtegidos: true }), 'course', '/co/x/'), true);
  assert.equal(paginaPermitida(encendida({ exclusiones: ['/blog/privado/*'] }), 'article', '/blog/privado/a/'), false);
  assert.equal(paginaPermitida(c, 'article', '/_emdash/admin'), false);
});

test('fragmentos: CSS y puerta en <head>, motor al final; meta de verificación aparte', () => {
  const f = fragmentosPublicidad(encendida(), articulo);
  assert.deepEqual(f.map(x => `${x.placement}:${x.key}`), ['head:sably-publicidad-css', 'head:sably-publicidad-puerta', 'body:end:sably-publicidad-motor']);
  assert.deepEqual(fragmentosPublicidad(encendida(), { pageType: 'course', url: 'https://sably.co/co/curso-de-masajes/' }), []);
  const meta = fragmentosPublicidad({ ...DEFAULT_CONFIG, cliente: 'ca-pub-6213862553989716', metaVerificacion: true }, { pageType: 'home', url: 'https://sably.co/co/' });
  assert.equal(meta.length, 1);
  assert.match(meta[0].html!, /google-adsense-account" content="ca-pub-6213862553989716"/);
});

test('el motor solo pide anuncios en el dominio real y con permiso; nunca adsbygoogle.js en el HTML', () => {
  const m = motorScript(encendida());
  assert.match(m, /"dom":\["sably.co"\]/);
  assert.match(m, /"rc":true/);
  assert.doesNotMatch(fragmentosPublicidad(encendida(), articulo).map(x => x.html ?? '').join(''), /adsbygoogle\.js/);
  assert.match(puertaScript(encendida()), /sably_consent/);
});

test('tope por página y dispositivo', () => {
  const c = cuentaNueva();
  assert.equal(reservar(c, 2, 'ambos'), 'ambos');
  assert.equal(reservar(c, 2, 'escritorio'), 'escritorio');
  assert.equal(reservar(c, 2, 'ambos'), 'movil');
  assert.equal(reservar(c, 2, 'ambos'), null);
});

test('dentro del texto: tras el primer H2, lejos de listas, tablas y bloques, nunca al final', () => {
  const elegir = new Function(`return ${ELEGIR_PUNTOS_JS}`)() as (t: string[], c: number, m: number, a?: (i: number) => boolean) => number[];
  //            0   1   2   3    4   5   6   7    8   9  10  11  12      13  14  15  16  17
  const tags = ['p','p','p','h2','p','p','p','ul','p','p','p','p','aside','p','p','p','p','p'];
  // Párrafos: idx4=4º, idx8=7º, idx9=8º, idx13=11º, idx14=12º. Válidos: idx4 (p2·[h2]·p | p,p), idx9 (p,p | p,p),
  // idx14 (p,p | p,p). No: idx5/6 (pegados a la lista), idx10/11 (bloque de curso), idx16, y el último.
  assert.deepEqual(elegir(tags, 4, 5), [4, 9, 14]);
  assert.deepEqual(elegir(tags, 4, 1), [4]);
  assert.deepEqual(elegir(tags, 4, 5, i => i !== 4), [9, 14]);
  assert.deepEqual(elegir(['p','p','p','p','p','p'], 2, 5), [], 'sin H2 no hay anuncios en el texto');
  assert.ok(textoScript().includes(ELEGIR_PUNTOS_JS));
  assert.match(textoScript(), /getBoundingClientRect\(\)\.bottom>innerHeight/);
});

test('el hueco reserva el tamaño, lleva un rótulo permitido y no carga nada', () => {
  const c = encendida();
  const h = huecoHtml('articulo-final', c.posiciones['articulo-final'], 'ambos', { muestra: false, rotulo: c.rotulo });
  assert.match(h, /--sa-wm:300px;--sa-hm:250px;--sa-wd:336px;--sa-hd:280px/);
  assert.match(h, />Anuncios</);
  assert.doesNotMatch(h, /<script|<ins/);
});

test('validación: editor, unidad, in-feed, ads.txt; una configuración rota queda apagada', () => {
  assert.throws(() => encendida({ cliente: 'pub-123' }), /ca-pub-/);
  assert.throws(() => validarConfig({ ...DEFAULT_CONFIG, enabled: true }), /identificador de editor/);
  assert.throws(() => encendida({ adsTxt: 'esto no es ads.txt' }), /ads\.txt/);
  assert.equal(LINEA_ADS_TXT('ca-pub-6213862553989716'), 'google.com, pub-6213862553989716, DIRECT, f08c47fec0942fa0');
  assert.equal(encendida({ adsTxt: LINEA_ADS_TXT('ca-pub-6213862553989716') }).adsTxt.startsWith('google.com'), true);
  const posiciones = structuredClone(DEFAULT_CONFIG.posiciones);
  posiciones['blog-rejilla'] = { ...posiciones['blog-rejilla'], activa: true, formato: 'in-feed', unidad: '1234567890' };
  assert.throws(() => encendida({ posiciones }), /clave de diseño/);
  assert.equal(normalizarConfig({ enabled: true }).enabled, false);
  assert.equal(normalizarConfig(null), DEFAULT_CONFIG);
});
