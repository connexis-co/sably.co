import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFicha, sanitize, shortDescription, shortTitle, toCsv, validateRow } from './feed-openai-ads.mjs';

const ficha = ({ proveedor = 'masterclasses', panel = true, href = 'https://hotm.io/x?offDiscount=031016', cupon = 'aplicado', meta = 'Aprende a maquillarte paso a paso. Inscríbete hoy con PSE o Nequi.' } = {}) => `<!doctype html><html><head>
<meta name="description" content="${meta}">
<meta property="og:image" content="https://sably.co/_emdash/api/media/file/a.jpg">
<script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[{"name":"Inicio"},{"name":"Belleza Online"},{"name":"Curso de Maquillaje"}]}</script>
<script type="application/ld+json">{"@type":["Product","Course"],"name":"Curso de Maquillaje","description":"Curso con certificado.","about":"Belleza Online","creator":{"name":"MasterClasses.La®"},"offers":{"availability":"https://schema.org/InStock"}}</script>
</head><body data-country="co" data-page-type="course" data-proveedor="${proveedor}">
${panel ? `<section data-purchase-panel data-currency="COP" data-base-amount="374860" data-reduced-amount="187430" data-cupon="${cupon}">` : ''}
<a class="b" href="${href}" data-cta-hotmart="true">Inscribirme</a></body></html>`;

test('curso del creador con cupón: promo, UTM, precio y oferta de la ficha', () => {
  const { row } = parseFicha(ficha(), 'curso-de-maquillaje');
  assert.equal(row.url, 'https://sably.co/co/curso-de-maquillaje/?promo=ads50&utm_source=chatgpt_ads&utm_medium=cpc&utm_campaign=co_feed');
  assert.equal(row.price, '374860 COP');
  assert.equal(row.sale_price, '187430 COP');
  assert.equal(row.description, 'Aprende a maquillarte paso a paso.');
  assert.equal(row.product_category, 'Cursos online > Belleza Online');
  assert.equal(row.brand, 'Sably');
  assert.deepEqual(validateRow(row), []);
});

test('otro creador: sin promo=ads50 ni precio de oferta', () => {
  const { row } = parseFicha(ficha({ proveedor: 'otro', cupon: '' }), 'curso-de-maquillaje');
  assert.ok(!row.url.includes('promo='));
  assert.equal(row.sale_price, '');
  assert.deepEqual(validateRow(row), []);
});

test('fuera si no hay precio o checkout', () => {
  assert.match(parseFicha(ficha({ panel: false }), 'x').skip, /panel/);
  assert.match(parseFicha(ficha({ href: 'https://evil.example/pay' }), 'x').skip, /pago/);
  assert.match(parseFicha(ficha({ href: 'https://hotm.art/y' }), 'x').row.url, /promo=ads50/);
});

test('vocabulario de Sably', () => {
  assert.equal(sanitize('Con certificado incluido.'), 'Con certificado incluido.');
  assert.equal(sanitize('Un curso de MasterClasses.La. Aprende hoy.', ['MasterClasses.La®']), 'Aprende hoy.');
  assert.equal(sanitize('Del catálogo de afiliados. Aprende.'), 'Aprende.');
});

test('título y descripción breves', () => {
  assert.equal(shortTitle('Curso de Marketing Digital 360: Domina el Mundo Digital con tu Negocio'), 'Curso de Marketing Digital 360');
  assert.equal(shortDescription('Aprende algo. Paga con Nequi. Compra…'), 'Aprende algo.');
});

test('CSV con comillas', () => {
  assert.match(toCsv([{ item_id: 'a', title: 'Uno, "dos"' }]), /"Uno, ""dos"""/);
});

test('sincroniza disponibilidad: vigentes in_stock, retirados agotados, 503 se reintenta', async () => {
  const { syncAvailability } = await import('./feed-openai-ads.mjs');
  const patches = [];
  const api = async (path, opts = {}) => {
    if (path.endsWith('/items/query')) return { status: 200, data: { data: [{ item_id: 'co-a' }, { item_id: 'co-b' }], has_more: false } };
    patches.push(opts.body);
    return patches.length < 2 ? { status: 503, data: {} } : { status: 200, data: { accepted: true } };
  };
  const r = await syncAvailability('fd_1', ['co-a', 'co-c'], api);
  assert.deepEqual(r.retirados, ['co-b']);
  assert.equal(patches.length, 2);
  assert.deepEqual(patches[1].products.map((p) => [p.id, p.variants[0].availability.status]), [['co-a', 'in_stock'], ['co-c', 'in_stock'], ['co-b', 'out_of_stock']]);
});
