import assert from 'node:assert/strict';
import test from 'node:test';
import { auditarOnPage, encabezados, enlacesInternos, INSTRUCTORES_RELLENO } from './seo-onpage.mjs';
import { compararEnlaces } from './seo-test.mjs';

const url = 'https://sably.co/co/curso-de-masajes/';
const pagina = (cuerpo, cabeza = '') => `<!doctype html><html lang="es"><head><title>Curso de masajes en Colombia | Sably</title>
<meta name="description" content="Aprende masajes desde cero con clases en video, a tu ritmo y desde el celular. Temario, precio y garantía en la ficha.">
<meta property="og:image" content="https://sably.co/og.jpg">${cabeza}</head><body>${cuerpo}</body></html>`;
const sana = pagina(`<header><nav><p>Programas de estudio</p></nav></header>
<main><h1>Curso de masajes para emprender</h1><h2>Qué aprenderás en el Curso de Masajes</h2><h3>Técnica</h3><h2>Temario del Curso de Masajes</h2>
<img src="/a.jpg" alt="Curso de Masajes" width="480" height="320"></main><footer><p>Categorías</p></footer>
<script type="application/ld+json">{"@type":["Product","Course"],"name":"Curso de Masajes"}</script>`);
const errores = (html) => auditarOnPage(url, html).filter((h) => h.nivel === 'error').map((h) => h.regla);

test('una ficha bien construida no deja errores', () => {
  assert.deepEqual(errores(sana), []);
  assert.deepEqual(encabezados(sana).map((h) => h.nivel), [1, 2, 3, 2]);
});

test('los rótulos del menú no pueden ser encabezados antes del H1', () => {
  assert.deepEqual(errores(sana.replace('<p>Programas de estudio</p>', '<h2>Programas de estudio</h2>')), ['h1-primero']);
});

test('detecta H1 repetido o ausente, saltos de nivel y encabezados vacíos', () => {
  assert.deepEqual(errores(sana.replace('<h3>Técnica</h3>', '<h1>Otro</h1>')), ['h1-unico']);
  assert(errores(sana.replace(/<h1>[^<]+<\/h1>/, '')).includes('h1-unico'));
  assert.deepEqual(errores(sana.replace('<h3>Técnica</h3>', '<h4>Técnica</h4>')), ['sin-saltos']);
  assert.deepEqual(errores(sana.replace('<h3>Técnica</h3>', '<h3> </h3>')), ['encabezado-vacio']);
});

test('los encabezados dentro de script, style, template o comentarios no cuentan', () => {
  assert.deepEqual(errores(sana.replace('</main>', '<script>const x="<h1>no</h1>"</script><!-- <h1>no</h1> --><template><h5>no</h5></template></main>')), []);
});

test('detecta imágenes sin alt, marcado roto y nodos que se retiraron', () => {
  assert.deepEqual(errores(sana.replace(' alt="Curso de Masajes"', '')), ['img-alt']);
  assert.deepEqual(errores(sana.replace('"name":"Curso de Masajes"}', '')), ['json-ld']);
  assert.deepEqual(errores(sana.replace('"name":"Curso de Masajes"', '"instructor":{"@type":"Person","name":"X"}')), ['json-ld-person']);
  assert.deepEqual(errores(sana.replace('"name":"Curso de Masajes"', '"aggregateRating":{"@type":"AggregateRating"}')), ['json-ld-rating']);
});

test('los textos retirados por no ser ciertos no pueden volver', () => {
  for (const frase of ['<h2>Tu instructor</h2>', '<p>Enlace de afiliado</p>', '<p>¡Espera! Tu cupo sigue disponible</p>', '<p>50% solo hoy</p>',
    '<p>−50% en todos los cursos con el cupón 031016</p>', '<h2>El descuento más grande del año ya empezó</h2>',
    '<p>Resuelve tus dudas por WhatsApp con nuestro equipo en tu país.</p>'])
    assert(errores(sana.replace('</main>', `${frase}</main>`)).includes('texto-vetado'), frase);
});

test('los textos que JP decidió mantener (25-nov) no dan error', () => {
  for (const frase of ['<p>El pago se procesa de forma segura a través de Hotmart, la plataforma líder de cursos online en Latinoamérica.</p>',
    '<p>Si quieres comparar precios y temarios reales, el catálogo completo de cursos muestra todos los precios sin registrarte.</p>'])
    assert.deepEqual(errores(sana.replace('</main>', `${frase}</main>`)), [], frase);
});

test('título, descripción y lang ausentes son errores; las longitudes, avisos', () => {
  assert(errores(sana.replace(/<title>[^<]+<\/title>/, '')).includes('titulo'));
  assert(errores(sana.replace(/<meta name="description"[^>]+>/, '')).includes('descripcion'));
  assert(errores(sana.replace(' lang="es"', '')).includes('lang'));
  const avisos = auditarOnPage(url, sana.replace('Curso de masajes en Colombia | Sably', 'x'.repeat(80))).filter((h) => h.nivel === 'aviso').map((h) => h.regla);
  assert.deepEqual(avisos, ['titulo-largo']);
});

test('ignora encabezados dentro de comentarios y código aunque el cierre no sea el canónico', () => {
  const html = sana.replace('<main>', '<main><!-- <h2>viejo</h2> --!><script>document.write("<h2>no</h2>")</script ><template><h2>molde</h2></template\n>');
  assert.deepEqual(encabezados(html).map((h) => h.nivel), [1, 2, 3, 2]);
  assert.deepEqual(errores(html), []);
});

test('decodifica las entidades una sola vez', () => {
  const [h1] = encabezados('<h1>Corte &amp;quot;fade&amp;quot; &amp; barba</h1>');
  assert.equal(h1.texto, 'Corte &quot;fade&quot; & barba');
});

test('una Person solo vale si es el creador real con su perfil en Sably', () => {
  const creador = '"creator":{"@type":"Person","@id":"https://sably.co/co/creadores/mauricio-duque/#creador","name":"Mauricio Duque Zuluaga"}';
  assert.deepEqual(errores(sana.replace('"name":"Curso de Masajes"', creador)), []);
  assert.deepEqual(errores(sana.replace('"name":"Curso de Masajes"', '"creator":{"@type":"Person","name":"Daniela Osorio"}')), ['json-ld-person']);
});

// 24-nov-2026: la FAQ llamaba «precio de lista» al precio con cupón y el Offer
// publicaba el rebajado sin fecha de validez.
test('la caja de compra, la pregunta de precio y el Offer no se contradicen', () => {
  const ficha = (faq, oferta, extra = '') => sana
    .replace('</main>', `<section id="compra" data-purchase-panel data-base="$ 191.012 COP" data-reduced="$ 95.506 COP" data-until="1795651200000"${extra}><h2>Opciones de compra</h2></section><p>${faq}</p></main>`)
    .replace('"name":"Curso de Masajes"}', `"name":"Curso de Masajes","offers":${JSON.stringify(oferta)}}`);
  const bien = { '@type': 'Offer', price: 95506, priceCurrency: 'COP', priceValidUntil: '2026-11-25' };
  const crudos = ' data-base-amount="191012" data-reduced-amount="95506"';
  assert.deepEqual(errores(ficha('El precio de lista es $ 191.012 COP. Con el cupón 031016 queda en $ 95.506 COP.', bien, crudos)), []);
  assert.deepEqual(errores(ficha('El precio de lista es $ 95.506 COP. Si hay una promoción vigente…', bien, crudos)), ['precio-de-lista']);
  assert.deepEqual(errores(ficha('Sin pregunta de precio.', { ...bien, priceValidUntil: undefined }, crudos)), ['oferta-sin-fecha']);
  assert.deepEqual(errores(ficha('Sin pregunta de precio.', { ...bien, price: 93067 }, crudos)), ['oferta-precio']);
  // Una ficha anterior a los importes en crudo no se juzga por lo que no publica.
  assert.deepEqual(errores(ficha('Sin pregunta de precio.', { ...bien, price: 93067 })), []);
  // La caja V2 escribe el mismo importe con otro formato («$ 1,191.32 MXN» frente a «$1,191.32 MXN»).
  const mx = (faq) => ficha(faq, { ...bien, price: 595.66, priceCurrency: 'MXN' }).replace('data-base="$ 191.012 COP" data-reduced="$ 95.506 COP"', 'data-base="$ 1,191.32 MXN" data-reduced="$ 595.66 MXN"');
  assert.deepEqual(errores(mx('El precio de lista es $1,191.32 MXN. Con el cupón 031016 queda en $595.66 MXN.')), []);
  assert.deepEqual(errores(mx('El precio de lista es $595.66 MXN.')), ['precio-de-lista']);
  assert.deepEqual(errores(ficha('El precio de lista es $191.012,00 COP.', bien, crudos)), []);
  // La misma frase dentro del FAQPage también cuenta.
  const enJsonLd = ficha('Otra cosa.', bien, crudos).replace('</body>', '<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"¿Cuánto cuesta el curso?","acceptedAnswer":{"@type":"Answer","text":"El precio de lista es $ 95.506 COP."}}]}</script></body>');
  assert.deepEqual(errores(enJsonLd), ['precio-de-lista']);
});

test('el título del listado no vuelve a decir «Catálogo de 120+ cursos»', () => {
  assert(errores(sana.replace('Curso de masajes en Colombia | Sably', 'Catálogo de 120+ cursos online en Colombia | Sably')).includes('texto-vetado'));
  assert.deepEqual(errores(sana.replace('Curso de masajes en Colombia | Sably', 'Todos los cursos online en Colombia | Sably')), []);
  // «Catálogo» referido a lo que vende el alumno no es Sably descrito como catálogo.
  assert.deepEqual(errores(sana.replace('</main>', '<p>Arma tu primer catálogo de postres para vender.</p></main>')), []);
});

test('«certificado», no «constancia»: error en el JSON-LD, aviso en el texto visible', () => {
  const credencial = (nombre) => sana.replace('"name":"Curso de Masajes"', `"name":"Curso de Masajes","educationalCredentialAwarded":{"@type":"EducationalOccupationalCredential","name":"${nombre}","credentialCategory":"Certificate"}`);
  assert.deepEqual(errores(credencial('Certificado digital de finalización')), []);
  assert.deepEqual(errores(credencial('Constancia digital de finalización')), ['constancia-json-ld']);
  assert.deepEqual(errores(sana.replace('src="/a.jpg"', 'src="/certificado-sably.jpg"')), ['imagen-certificado']);
  const avisos = (html) => auditarOnPage(url, html).filter((h) => h.regla === 'constancia').map((h) => [h.nivel, h.detalle.match(/\d+/)[0]]);
  const conTexto = sana.replace('</main>', '<p>Constancia incluida. Obtén tu constancia digital.</p></main>');
  assert.deepEqual(errores(conTexto), []);
  assert.deepEqual(avisos(conTexto), [['aviso', '2']]);
  // «Certificado» ya no avisa, y «constancia» en otro sentido tampoco.
  assert.deepEqual(avisos(sana.replace('</main>', '<p>Certificado incluido. Obtén tu certificado digital.</p></main>')), []);
  assert.deepEqual(avisos(sana.replace('</main>', '<p>Practica con constancia. Guardamos la constancia de tu consentimiento.</p></main>')), []);
});

// 24-nov-2026: masajes CO decía «Andrés Villamil explica cada maniobra» y la
// ficha, «Creado por MasterClasses.La®». Hotmart nombra a Mauricio Duque Zuluaga.
test('un instructor de relleno no puede aparecer en la página ni en su FAQPage', () => {
  assert.equal(INSTRUCTORES_RELLENO.length, 106);
  assert(INSTRUCTORES_RELLENO.includes('Andrés Villamil') && INSTRUCTORES_RELLENO.includes('Isabel Munévar'));
  assert(!INSTRUCTORES_RELLENO.some((n) => /masterclasses|mauricio duque/i.test(n)), 'los creadores reales no están en la lista');
  assert.deepEqual(errores(sana.replace('</main>', '<p>Andrés Villamil explica cada maniobra paso a paso.</p></main>')), ['instructor-relleno']);
  const enFaq = sana.replace('</body>', '<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"¿Quién enseña?","acceptedAnswer":{"@type":"Answer","text":"Isabel Munévar enseña cada receta."}}]}</script></body>');
  assert.deepEqual(errores(enFaq), ['instructor-relleno']);
  assert.deepEqual(errores(sana.replace('</main>', '<p>Creado por MasterClasses.La®. El curso explica cada maniobra paso a paso.</p></main>')), []);
});

test('tema V2: sin emojis de interfaz, cada hecho una vez fuera de la caja y el texto largo en el HTML', () => {
  const v2 = (cuerpo) => pagina(`<main><h1>Curso de masajes</h1>
<section id="compra" data-purchase-panel data-base="191.012 COP"><h2>Caja</h2><p>7 días para pedir reembolso</p><p>Certificado de finalización</p></section>
${cuerpo}
<section id="mas"><h2>Más sobre el curso</h2><div data-texto-largo><p>${'palabra '.repeat(200)}</p></div></section></main>`).replace('<body>', '<body data-tema="v2">');
  assert.deepEqual(errores(v2('<h2>Cómo funciona</h2><p>Garantía de 7 días</p>')), []);
  assert.deepEqual(errores(v2('<h2>Cómo funciona</h2><p>Garantía de 7 días</p><p>Garantía de 7 días · Acceso de por vida</p>')), ['v2-hecho-repetido']);
  assert.deepEqual(errores(v2('<h2>Cómo funciona</h2><p>✅ Acceso de por vida</p>')), ['v2-emoji']);
  assert.deepEqual(errores(v2('<p>Lo dicta MasterClasses.La® · Sably™</p>')), [], '© ® ™ no son emojis');
  // En las preguntas (texto del CMS) los hechos y los emojis no cuentan como plantilla.
  assert.deepEqual(errores(v2('<section data-cms><h2>Preguntas</h2><p>Garantía de 7 días 🙂</p><p>Garantía de 7 días</p></section><p>Garantía de 7 días</p>')), []);
  assert.deepEqual(errores(v2('').replace(/<section id="mas">[\s\S]*<\/section>/, '')), ['v2-texto-largo']);
  // El tema clásico no pasa por estas reglas.
  assert.deepEqual(errores(v2('<p>✅ Acceso de por vida</p><p>Acceso de por vida</p>').replace('<body data-tema="v2">', '<body>')), []);
});

test('una URL de imagen con comas en src o srcset es error (Bing corta en la coma)', () => {
  const conComa = sana.replace('<img src="/a.jpg" alt="Curso de Masajes" width="480" height="320">',
    '<img src="/cdn-cgi/image/width=480,quality=80/a.jpg" srcset="/cdn-cgi/image/width=96,quality=80/a.jpg 96w, /cdn-cgi/image/width=480,quality=80/a.jpg 480w" alt="Curso de Masajes" width="480" height="320">');
  assert.deepEqual(errores(conComa), ['img-url-coma']);
  const codificada = conComa.replaceAll('width=96,quality', 'width=96%2Cquality').replaceAll('width=480,quality', 'width=480%2Cquality');
  assert.deepEqual(errores(codificada), []);
});

test('tema V2: las reglas cubren también la cabecera y el pie (todo el <body>)', () => {
  const v2 = (fuera) => pagina(`<header>${fuera}</header><main><h1>Cursos online en Colombia</h1><h2>Áreas</h2></main>`).replace('<body>', '<body data-tema="v2">');
  assert.ok(errores(v2('<p>🎓 Cursos</p>')).includes('v2-emoji'), 'un emoji en la cabecera V2 es un error');
  assert.ok(errores(v2('<p>Acceso de por vida</p><p>Acceso de por vida</p>')).includes('v2-hecho-repetido'));
  // El documento de muestra del certificado es ilustrativo: no cuenta como hecho repetido.
  const doc = '<figure role="img" data-constancia-ejemplo><p>Certificado de finalización</p></figure>';
  assert.ok(!errores(v2(`<p>Hotmart emite un certificado digital de finalización</p>${doc}`)).includes('v2-hecho-repetido'));
  assert.ok(errores(v2(`<p>Certificado de finalización</p><p>Certificado de finalización</p>${doc}`)).includes('v2-hecho-repetido'));
  assert.ok(errores(v2(`<p>Certificado de finalización</p><p>Constancia de finalización</p>${doc}`)).includes('v2-hecho-repetido'), 'las dos palabras son el mismo hecho');
});

test('enlaces internos: ruta y ancla, sin consulta, sin rutas técnicas ni externas', () => {
  const html = `<a href="/co/cursos/">a</a><a href="/co/cursos/?tema=v2">b</a><a href="https://sably.co/co/cursos/belleza/#unas">c</a>
<a href="#">x</a><a href="#preguntas">y</a><a href="https://academiadebelleza.edu.co">d</a><a href="/_emdash/api/media/file/x.jpg">e</a><!-- <a href="/oculto/">f</a> --><a href="/blog/">g</a>`;
  assert.deepEqual([...enlacesInternos(html)].sort(), ['/blog/', '/co/cursos/', '/co/cursos/belleza/#unas']);
});

test('V2 no puede tener menos enlaces internos que el clásico', () => {
  const clasico = new Set(['/co/', '/co/cursos/', '/blog/']);
  assert.deepEqual(compararEnlaces('/co/', new Set(['/co/', '/co/cursos/', '/blog/', '/videos/']), clasico), []);
  assert.deepEqual(compararEnlaces('/co/', new Set(['/co/', '/co/cursos/', '/videos/']), clasico).map(h => h.regla), ['v2-enlace-perdido']);
  assert.deepEqual(compararEnlaces('/co/', new Set(['/co/']), clasico).map(h => `${h.nivel} ${h.regla}`), ['error v2-enlaces', 'aviso v2-enlace-perdido']);
});

test('señales de spam: enlaces ocultos, compra sin sponsored y webs propias follow', () => {
  const con = (html) => errores(sana.replace('<footer>', `${html}<footer>`));
  // El bloque de la red (cx-res-alt) y un contenedor ocultado con estilo en línea.
  assert.deepEqual(con('<div class="cx-res-alt" aria-hidden="true" style="position:absolute;width:1px;height:1px;clip:rect(0 0 0 0)"><a href="https://sably.co/co/">curso de uñas</a></div>'), ['enlace-oculto']);
  assert.deepEqual(con('<p style="display:none"><a href="https://ejemplo.com">x</a></p>'), ['enlace-oculto']);
  // Lo oculto sin enlaces (decoración, GTM) no cuenta.
  assert.deepEqual(con('<p aria-hidden="true" class="absolute">50 %</p><noscript><iframe src="https://www.googletagmanager.com/ns.html" style="display:none;visibility:hidden"></iframe></noscript>'), []);
  assert.deepEqual(con('<a href="https://hotm.io/x" rel="noopener nofollow">Inscribirme</a>'), ['compra-sin-sponsored']);
  assert.deepEqual(con('<a href="https://hotm.io/x" rel="noopener nofollow sponsored">Inscribirme</a>'), []);
  assert.deepEqual(con('<a href="https://academiadebelleza.edu.co" target="_blank" rel="noopener">Belleza</a>'), ['red-propia-follow']);
  assert.deepEqual(con('<a href="https://www.cursodeglobosonline.com/" rel="noopener nofollow">Globos</a>'), []);
  assert.deepEqual(con('<a href="https://www.instagram.com/sably.academy" rel="noopener">Instagram</a>'), []);
});

test('Review en el JSON-LD es error: no hay reseñas propias', () => {
  const conReview = sana.replace('"name":"Curso de Masajes"}', '"name":"Curso de Masajes","review":{"@type":"Review","reviewBody":"Bueno"}}');
  assert.deepEqual(errores(conReview), ['json-ld-review']);
});
