#!/usr/bin/env node
/**
 * Afilia la cuenta de Hotmart a los cursos del club de Seminarios Online y crea
 * los dos acortadores de cada uno con la nomenclatura acordada.
 *
 * ---------------------------------------------------------------------------
 * QUÉ CAMBIA RESPECTO A LA v1 (scripts/hotmart-acortadores.v1.mjs)
 * ---------------------------------------------------------------------------
 * Los cuatro puntos siguientes se comprobaron en vivo contra el panel el
 * 2026-08-11. Cada uno rompía el resultado de forma silenciosa:
 *
 * 1. LÍMITE DE 50 CARACTERES. Hotmart rechaza el slug con "The customized link
 *    address must have a minimum of 3 characters and a maximum of 50
 *    characters." Como el sufijo `-curso-crashing` / `-curso-venta-SO` ocupa 15,
 *    la base no puede pasar de 35. 23 de los 84 cursos se pasaban. La v1 no
 *    miraba el error: pulsaba Next igual y seguía como si nada.
 *
 * 2. EL ORDEN DE LOS BLOQUES NO ES FIJO. La v1 cogía `conAp[0]` como crashing y
 *    `conAp[1]` como venta-SO. En "Kits Solares como Negocio" el de Seminarios
 *    viene ANTES que el de crashing, y "Aprende Francés" tiene un quinto bloque
 *    ("Checkout Limpio Order Bump"). Con el criterio de la v1 los dos enlaces
 *    salían intercambiados. Aquí se localizan por rótulo y, si el rótulo no
 *    aparece, se aborta ese curso en vez de adivinar.
 *
 * 3. EL BUSCADOR DE AFILIACIONES DISTINGUE TILDES. Buscar "Colorimetria" no
 *    encuentra "Colorimetría". La v1, además, se quedaba con el primer `ID \d+`
 *    de la página: si la búsqueda no devolvía nada, ese ID era el de la primera
 *    tarjeta del listado sin filtrar, o sea el producto equivocado. Así se
 *    generó el "Ceviche Peruano → 1009417" (que es Manicurista Profesional) del
 *    resultado del 2026-08-10. Aquí se carga el listado entero una vez y se
 *    cruza por nombre normalizado sin tildes.
 *
 * 4. LA MAYORÍA DE ACORTADORES YA EXISTEN. La v1 los daba por ERROR. Aquí se
 *    sondea `hotm.io/<slug>` antes de tocar el asistente: si ya resuelve y
 *    conserva el `ref` correcto, se marca YA_EXISTIA y no se toca nada.
 *
 * ---------------------------------------------------------------------------
 * FLUJO POR CURSO
 * ---------------------------------------------------------------------------
 *   1. Resolver idProducto: del listado "Soy Afiliado(a)" si ya está afiliado;
 *      si no, abrir app-vlc.hotmart.com/affiliate-recruiting/view/<codigo> y
 *      pulsar "Afiliarse Ahora", que redirige a /hotlinks/<id>.
 *   2. Leer los hotlinks de app.hotmart.com/hotlinks/<id>, localizando POR
 *      RÓTULO el bloque de "checkout limpio para crashing" y el de "checkout
 *      creado por Seminarios Online®" (el rótulo varía: "Seminarios.Online®.",
 *      "Seminarios Online®"... por eso se busca solo /seminarios/i).
 *   3. Sondear si el acortador ya existe. Si existe y su `ref` coincide con el
 *      hotlink de este producto → YA_EXISTIA.
 *   4. Si no existe, pasar el asistente: título → Next → slug → Next → End.
 *   5. Verificar que el acortador resuelve a pay.hotmart.com CON `ref=` y que
 *      ese `ref` es el del hotlink de este producto.
 *
 * ---------------------------------------------------------------------------
 * USO
 * ---------------------------------------------------------------------------
 *   1. Cierra Chrome del todo (Cmd+Q, no solo la ventana).
 *   2. /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *        --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-hotmart"
 *   3. Inicia sesión en https://app.hotmart.com con la cuenta afiliada.
 *   4. node scripts/hotmart-acortadores.mjs --dry        # no toca nada
 *      node scripts/hotmart-acortadores.mjs              # ejecuta
 *
 * Banderas:
 *   --dry           recorre y reporta sin afiliar ni crear nada
 *   --limit N       procesa solo los N primeros cursos pendientes
 *   --only SLUG     procesa un único curso (slugSably), repetible
 *   --rehacer       ignora el resultado previo y reevalúa todos
 *   --no-afiliar    no se afilia a nada; los no afiliados quedan PENDIENTE
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* puppeteer-core se carga bajo demanda: `--plan` solo valida slugs contra el
   TSV y no abre navegador, así que debe funcionar aunque la dependencia no
   esté instalada. Con el import en la cabecera, `--plan` moría con
   ERR_MODULE_NOT_FOUND antes de imprimir nada. */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSV = path.join(RAIZ, 'docs/data/afiliacion-seminarios.tsv');
const OVERRIDES = path.join(RAIZ, 'docs/data/acortadores-slugs.json');
const SALIDA = path.join(RAIZ, 'docs/data/acortadores-resultado.json');
const CACHE_IDS = path.join(RAIZ, 'docs/data/.cache-afiliaciones.json');

const RECLUTA = 'https://app-vlc.hotmart.com/affiliate-recruiting/view';
const HOTLINKS = 'https://app.hotmart.com/hotlinks';
const SHORTENER = 'https://app.hotmart.com/shortener/form';
const AFILIACIONES = 'https://app.hotmart.com/products/affiliations';

/** Hotmart: mínimo 3, máximo 50 caracteres para el slug personalizado. */
const MAX_SLUG = 50;
const SUFIJO_CRASHING = '-curso-crashing';
const SUFIJO_VENTA_SO = '-curso-venta-SO';
/** Los dos sufijos miden 15, así que la base no puede pasar de 35. */
const MAX_BASE = MAX_SLUG - Math.max(SUFIJO_CRASHING.length, SUFIJO_VENTA_SO.length);

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const REHACER = args.includes('--rehacer');
const NO_AFILIAR = args.includes('--no-afiliar');
const LIMITE = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const SOLO = args.reduce((acc, a, i) => (a === '--only' ? [...acc, args[i + 1]] : acc), []);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const texto = (page) => page.evaluate(() => document.body.innerText || '');

/** Normaliza para comparar nombres: sin tildes, sin puntuación, minúsculas. */
const norm = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Convierte el nombre del curso en el club en la base del slug. */
function slugificar(nombre) {
  return (nombre || '')
    .replace(/^[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]+/, '') // quita el ⚫ / 🔘 / 💥 inicial
    .trim()
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Plan de trabajo
// ---------------------------------------------------------------------------

/**
 * Lee el TSV y arma la lista de cursos a procesar.
 *
 * El slug del acortador se construye con el nombre del producto EN EL CLUB
 * (tercera columna), no con el slug de sably: es la convención que ya siguen
 * los acortadores existentes (p. ej. "Aprende Piano" → aprende-piano-curso-...).
 *
 * Para los 23 cursos cuyo nombre de club no cabe en 35 caracteres, el slug
 * viene dado a mano en docs/data/acortadores-slugs.json. No se recorta por
 * cuenta propia: un slug inventado manda al usuario a un enlace equivocado.
 */
function plan() {
  const overrides = fs.existsSync(OVERRIDES) ? JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')) : {};
  const porNombre = new Map(Object.entries(overrides).map(([k, v]) => [norm(k), v]));

  const filas = [];
  const problemas = [];

  for (const linea of fs.readFileSync(TSV, 'utf8').split('\n')) {
    if (!linea.trim() || linea.startsWith('#')) continue;
    const [slugSably, codigo, nombreClub = ''] = linea.split('\t').map((c) => (c ?? '').trim());
    if (!codigo) continue;
    if (codigo === 'VARIOS_CANDIDATOS' || codigo === 'NO_EXISTE_EN_CATALOGO') continue;

    const base = porNombre.get(norm(nombreClub)) ?? slugificar(nombreClub);
    if (!base) {
      problemas.push(`${slugSably}: no pude derivar el slug (nombre del club vacío)`);
      continue;
    }
    if (base.length > MAX_BASE) {
      problemas.push(
        `${slugSably}: "${base}" mide ${base.length}; con el sufijo pasa de ${MAX_SLUG}. ` +
          `Añade una entrada en docs/data/acortadores-slugs.json.`,
      );
      continue;
    }
    filas.push({
      slugSably,
      codigo,
      nombreClub,
      base,
      slugCrashing: base + SUFIJO_CRASHING,
      slugVentaSO: base + SUFIJO_VENTA_SO,
    });
  }

  // Un slug duplicado sobrescribiría el enlace de otro curso.
  const vistos = new Map();
  for (const f of filas) {
    if (vistos.has(f.base)) problemas.push(`slug duplicado "${f.base}": ${vistos.get(f.base)} y ${f.slugSably}`);
    vistos.set(f.base, f.slugSably);
  }

  return { filas, problemas };
}

// ---------------------------------------------------------------------------
// Mapa de afiliaciones (nombre normalizado → idProducto)
// ---------------------------------------------------------------------------

/**
 * Carga TODAS las afiliaciones confirmadas pulsando "Mostrar más" hasta agotar,
 * y devuelve un mapa nombre-normalizado → id.
 *
 * No se usa el buscador de la página: distingue tildes, así que "Colorimetria"
 * no encuentra "Colorimetría" y se acaba cogiendo el producto equivocado.
 */
async function mapaAfiliaciones(page, { usarCache = true } = {}) {
  if (usarCache && fs.existsSync(CACHE_IDS)) {
    const c = JSON.parse(fs.readFileSync(CACHE_IDS, 'utf8'));
    if (Date.now() - c.ts < 6 * 60 * 60 * 1000) return new Map(c.pares);
  }

  process.stdout.write('Cargando el listado de afiliaciones confirmadas… ');
  await page.goto(AFILIACIONES, { waitUntil: 'networkidle2' });

  /* La lista no tiene botón "Mostrar más": está virtualizada y solo mantiene
     ~12 tarjetas en el DOM, reciclándolas al hacer scroll. Por eso se recorre
     la página de arriba abajo acumulando lo que aparece, en vez de leerla de
     una vez. Y se espera a que haya alguna tarjeta antes de empezar: con un
     sleep fijo se leía el DOM vacío y se cacheaban 0 productos durante 6 h. */
  await page
    .waitForFunction(() => /ID\s+\d+/.test(document.body.innerText || ''), { timeout: 45000, polling: 500 })
    .catch(() => {});

  const acumulado = new Map();
  const cosechar = async () => {
    const pares = await page.evaluate(() => {
      const out = [];
      const re = /ID\s+(\d+)\s*\n+\s*([^\n]+)/g;
      const t = document.body.innerText;
      let m;
      while ((m = re.exec(t)) !== null) out.push([m[2].trim(), m[1]]);
      return out;
    });
    for (const [nombre, id] of pares) if (!acumulado.has(norm(nombre))) acumulado.set(norm(nombre), id);
  };

  await cosechar();
  let sinNovedad = 0;
  for (let y = 0; sinNovedad < 6 && y < 400; y++) {
    const antes = acumulado.size;
    await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.8)));
    await dormir(450);
    await cosechar();
    const alFinal = await page.evaluate(
      () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 40,
    );
    sinNovedad = acumulado.size === antes ? sinNovedad + 1 : 0;
    if (alFinal && sinNovedad >= 3) break;
  }

  if (acumulado.size === 0) {
    console.log('0 productos.');
    throw new Error(
      'el listado de afiliaciones salió vacío; sin él no se puede distinguir ' +
        'lo ya afiliado y todo daría ERROR. Revisa la sesión y vuelve a lanzarlo.',
    );
  }

  // Solo se cachea un listado con contenido: una caché vacía envenenaba 6 horas.
  fs.mkdirSync(path.dirname(CACHE_IDS), { recursive: true });
  fs.writeFileSync(CACHE_IDS, JSON.stringify({ ts: Date.now(), pares: [...acumulado] }, null, 2), 'utf8');
  console.log(`${acumulado.size} productos.`);
  return acumulado;
}

// ---------------------------------------------------------------------------
// Afiliación
// ---------------------------------------------------------------------------

/**
 * Busca un producto por nombre en "Soy Afiliado(a)" y devuelve su id, o null.
 *
 * El listado solo mantiene ~12 tarjetas en el DOM y no carga más al hacer
 * scroll, así que para el resto hay que pasar por el buscador. El peligro es
 * que, cuando la búsqueda no encuentra nada, la página NO se queda vacía:
 * vuelve a pintar el listado completo. Quedarse con el primer `ID \d+` de ahí
 * devuelve un producto cualquiera — así salió el "Ceviche Peruano → 1009417",
 * que en realidad es Manicurista Profesional. Por eso se exige que el nombre
 * del resultado coincida, y si no, se devuelve null.
 */
async function idPorBusqueda(page, nombreClub) {
  const limpio = nombreClub.replace(/^[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]+/, '').trim();
  if (!limpio) return null;

  if (!/\/products\/affiliations/.test(page.url())) {
    await page.goto(AFILIACIONES, { waitUntil: 'networkidle2' });
    await dormir(2500);
  }

  const escrito = await page.evaluate((q) => {
    const inp = document.querySelector('input[type="text"],input[type="search"]');
    if (!inp) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    inp.focus();
    set.call(inp, '');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    set.call(inp, q);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 13 }));
    return true;
  }, limpio);
  if (!escrito) return null;
  await dormir(3500);

  const pares = await page.evaluate(() => {
    const out = [];
    const re = /ID\s+(\d+)\s*\n+\s*([^\n]+)/g;
    const t = document.body.innerText;
    let m;
    while ((m = re.exec(t)) !== null) out.push([m[1], m[2].trim()]);
    return out;
  });

  const objetivo = norm(limpio);
  const exacto = pares.find(([, n]) => norm(n) === objetivo);
  return exacto ? exacto[0] : null;
}

/**
 * Devuelve { id, afiliadoAhora }. Si ya estaba afiliado el id sale del mapa
 * (o del buscador); si no, se pulsa "Afiliarse Ahora" y el id sale de la URL
 * /hotlinks/<id> a la que Hotmart redirige.
 */
async function resolverProducto(page, fila, mapa) {
  const id = mapa.get(norm(fila.nombreClub));
  if (id) return { id, afiliadoAhora: false };

  // El listado solo trae ~12 de las ~300 afiliaciones: el resto, por buscador.
  const buscado = await idPorBusqueda(page, fila.nombreClub);
  if (buscado) {
    mapa.set(norm(fila.nombreClub), buscado); // no repetir la búsqueda
    return { id: buscado, afiliadoAhora: false };
  }

  await page.goto(`${RECLUTA}/${fila.codigo}`, { waitUntil: 'networkidle2' });
  await dormir(2500);

  const cuerpo = await texto(page);
  if (/ya eres afiliado/i.test(cuerpo)) {
    // Afiliado pero con otro nombre en el listado: no se adivina.
    throw new Error(
      'ya afiliado pero no lo encuentro en el listado por nombre; ' +
        'revisa cómo se llama en "Soy Afiliado(a)" y añade el nombre al TSV',
    );
  }
  if (NO_AFILIAR) throw new Error('no afiliado y se pasó --no-afiliar');
  if (DRY) return { id: null, afiliadoAhora: false, dry: true };

  const pulsado = await page.evaluate(() => {
    const el = [...document.querySelectorAll('button,a,input[type=submit]')].find((x) =>
      /Afiliarse Ahora|Afiliarme|Ingresa para afiliarte/i.test((x.innerText || x.value || '').trim()),
    );
    if (!el) return false;
    el.click();
    return true;
  });
  if (!pulsado) throw new Error('no encontré el botón "Afiliarse Ahora"');

  for (let i = 0; i < 25 && !/\/hotlinks\/\d+/.test(page.url()); i++) await dormir(1000);
  const m = page.url().match(/\/hotlinks\/(\d+)/);
  if (!m) throw new Error('afilié pero Hotmart no redirigió a /hotlinks/<id>');
  return { id: m[1], afiliadoAhora: true };
}

// ---------------------------------------------------------------------------
// Hotlinks
// ---------------------------------------------------------------------------

/**
 * Devuelve { crashing, ventaSO, codigoHotlink } leyendo la página de hotlinks.
 *
 * Los bloques se localizan por su rótulo, NUNCA por posición: el orden cambia
 * entre productos y algunos tienen un quinto bloque ("Checkout Limpio Order
 * Bump") que no debe tocarse.
 */
async function leerHotlinks(page, id) {
  if (!new RegExp(`/hotlinks/${id}\\b`).test(page.url())) {
    await page.goto(`${HOTLINKS}/${id}`, { waitUntil: 'networkidle2' });
  }

  // La página monta los bloques en varias fases; se espera a que el número de
  // rótulos coincida con el de botones "Acortar link".
  const bloques = await page.waitForFunction(
    () => {
      const rot = [];
      const vistos = new Set();
      for (const e of document.querySelectorAll('p,span,div,label,strong,h3,h4')) {
        const t = (e.innerText || '').trim();
        if (!t || t.length > 140) continue;
        if (!/^(Página de (Ventas|Producto)$|Hotlink que lleva|Checkout )/.test(t)) continue;
        if (vistos.has(t) || e.querySelector('button')) continue;
        vistos.add(t);
        rot.push(t);
      }
      const btns = [...document.querySelectorAll('button')].filter((b) => /Acortar link/i.test(b.innerText || ''));
      if (!rot.length || rot.length !== btns.length) return false;
      const inputs = [...document.querySelectorAll('input')].map((i) => i.value || '');
      const urls = inputs.filter((v) => /go\.hotmart\.com/.test(v));
      if (urls.length < rot.length) return false;
      return { rotulos: rot, urls };
    },
    { timeout: 45000, polling: 700 },
  );

  const { rotulos, urls } = await bloques.jsonValue();

  /* El rótulo del checkout limpio no siempre dice "crashing": hay productos que
     lo llaman "checkout de compra limpio. (Usuarios avanzados)". Se acepta
     cualquiera de las dos formas, pero SIEMPRE excluyendo el de Seminarios, que
     también contiene la palabra "checkout" y es el otro enlace que buscamos. */
  const esSeminarios = (t) => /seminarios/i.test(t);
  const iSO = rotulos.findIndex(esSeminarios);
  const iCrash = rotulos.findIndex(
    (t) => !esSeminarios(t) && (/crashing/i.test(t) || /checkout.*limpi/i.test(t)),
  );
  if (iCrash < 0) throw new Error(`no hay bloque de checkout limpio. Rótulos: ${rotulos.join(' | ')}`);
  if (iSO < 0) throw new Error(`no hay bloque de Seminarios. Rótulos: ${rotulos.join(' | ')}`);
  if (iCrash === iSO) throw new Error(`ambos rótulos apuntan al mismo bloque: ${rotulos[iCrash]}`);

  const crashing = urls[iCrash];
  const ventaSO = urls[iSO];
  if (!crashing || !ventaSO) throw new Error('los rótulos existen pero no encontré sus URLs');

  const cod = crashing.match(/go\.hotmart\.com\/([A-Z0-9]+)/i);
  return { crashing, ventaSO, codigoHotlink: cod ? cod[1] : null };
}

// ---------------------------------------------------------------------------
// Asistente de acortado
// ---------------------------------------------------------------------------

/**
 * Rellena un input de React. Asignar `.value` a secas no dispara el onChange de
 * React: hay que usar el setter nativo del prototipo y emitir los eventos.
 * Se pasa como string a page.evaluate porque se ejecuta en el navegador.
 */
const FIJAR = `(el, v) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}`;

/**
 * Pasa el asistente de tres pasos. Devuelve 'CREADO' o 'YA_TOMADO'.
 *
 * Los campos se localizan por sus propiedades, no por coordenadas: la ventana
 * puede cambiar de tamaño a mitad de la ejecución.
 */
async function acortar(page, hotlink, titulo, slug) {
  await page.goto(`${SHORTENER}?link=${encodeURIComponent(hotlink)}`, { waitUntil: 'networkidle2' });

  // Paso 1 — título. El hotlink ya viene puesto por la query string.
  await page.waitForFunction(
    () => [...document.querySelectorAll('input')].some((i) => /title/i.test(i.placeholder || '')),
    { timeout: 30000, polling: 500 },
  );
  await page.evaluate(
    (ti, fn) => {
      const fijar = eval(fn);
      const inp = [...document.querySelectorAll('input')].find((i) => /title/i.test(i.placeholder || ''));
      fijar(inp, ti);
    },
    titulo,
    FIJAR,
  );
  await dormir(600);
  if (!(await pulsar(page, /^Next$|^Siguiente$/i))) throw new Error('paso 1: no encontré "Next"');

  // Paso 2 — slug. Hotmart precarga uno aleatorio; se sustituye entero.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('input[type=text],input:not([type])')].some(
        (i) => !/title/i.test(i.placeholder || '') && !/go\.hotmart/.test(i.value || ''),
      ),
    { timeout: 30000, polling: 500 },
  );
  await page.evaluate(
    (s, fn) => {
      const fijar = eval(fn);
      const inp = [...document.querySelectorAll('input[type=text],input:not([type])')].find(
        (i) => !/title/i.test(i.placeholder || '') && !/go\.hotmart/.test(i.value || ''),
      );
      fijar(inp, s);
    },
    slug,
    FIJAR,
  );
  await dormir(3200); // la disponibilidad se valida contra el servidor

  const error = await page.evaluate(() => {
    const m = (document.body.innerText || '').match(/^.*(not available|minimum of 3 characters|maximum of).*$/im);
    return m ? m[0].trim() : null;
  });
  if (error) {
    if (/not available/i.test(error)) return 'YA_TOMADO';
    throw new Error(`Hotmart rechaza el slug: ${error}`);
  }

  const puesto = await page.evaluate(
    (s) =>
      [...document.querySelectorAll('input[type=text],input:not([type])')].some(
        (i) => (i.value || '') === s,
      ),
    slug,
  );
  if (!puesto) throw new Error('paso 2: el campo no se quedó con el slug pedido');

  if (!(await pulsar(page, /^Next$|^Siguiente$/i))) throw new Error('paso 2: no encontré "Next"');

  // Paso 3 — resumen. Se confirma que el resumen muestra NUESTRO slug antes de
  // rematar: el resumen lo pinta dentro de un <input>, no en el texto.
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => /^End$|^Finalizar$/i.test((b.innerText || '').trim())),
    { timeout: 30000, polling: 500 },
  );
  const coincide = await page.evaluate(
    (s) => [...document.querySelectorAll('input')].some((i) => (i.value || '').includes(s)),
    slug,
  );
  if (!coincide) throw new Error('paso 3: el resumen no muestra el slug pedido; no confirmo');

  if (!(await pulsar(page, /^End$|^Finalizar$/i))) throw new Error('paso 3: no encontré "End"');
  await dormir(2500);
  return 'CREADO';
}

async function pulsar(page, re) {
  return page.evaluate((src, flags) => {
    const r = new RegExp(src, flags);
    const b = [...document.querySelectorAll('button')].find((x) => r.test((x.innerText || '').trim()));
    if (!b) return false;
    b.click();
    return true;
  }, re.source, re.flags);
}

// ---------------------------------------------------------------------------
// Verificación
// ---------------------------------------------------------------------------

/**
 * Un acortador solo vale si acaba en pay.hotmart.com CON `ref=`, y si ese `ref`
 * es el hotlink de ESTE producto. Sin `ref` la venta se le acredita al
 * productor; con el `ref` de otro producto, el enlace lleva al sitio que no es.
 */
async function verificar(slug, codigoHotlink, intentos = 3) {
  const url = `https://hotm.io/${slug}`;
  let ultimo = { existe: false, ok: false, destino: null, ref: null };

  /* hotm.io responde de forma inestable: para un mismo slug inexistente puede
     devolver su página de fallback o, de vez en cuando, un destino ajeno
     (se vio "coljuegos.gov.co" en un slug libre). Tomar ese destino por bueno
     marcaba el acortador como "ya existía" y NO se creaba, dejando el curso sin
     enlace. Por eso solo cuenta como existente si acaba en pay.hotmart.com, y
     un destino raro se reintenta antes de darlo por bueno. */
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      const destino = r.url;
      const esCheckout = /^https:\/\/pay\.hotmart\.com\//.test(destino);
      const esFallback = /static\.hotmart\.com\/shortener/.test(destino);
      const ref = (destino.match(/[?&]ref=([^&]+)/) || [])[1] ?? null;

      ultimo = {
        existe: esCheckout,
        ok: esCheckout && !!ref && (!codigoHotlink || ref === codigoHotlink),
        destino,
        ref,
      };
      // Respuesta concluyente: es nuestro checkout, o el fallback de "no existe".
      if (esCheckout || esFallback) return ultimo;
    } catch (e) {
      ultimo = { existe: false, ok: false, destino: null, ref: null, error: String(e).slice(0, 120) };
    }
    await dormir(800);
  }
  return ultimo;
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

function cargarPrevio() {
  if (REHACER || !fs.existsSync(SALIDA)) return new Map();
  try {
    const arr = JSON.parse(fs.readFileSync(SALIDA, 'utf8'));
    return new Map(arr.map((r) => [r.slugSably, r]));
  } catch {
    return new Map();
  }
}

async function main() {
  const { filas, problemas } = plan();
  if (problemas.length) {
    console.error('\nEl plan tiene problemas que hay que resolver a mano antes de seguir:\n');
    for (const p of problemas) console.error(`  · ${p}`);
    console.error('\nNo creo nada hasta que estén resueltos.\n');
    process.exit(1);
  }

  // --plan: enseña qué se va a crear y termina, sin abrir Chrome ni tocar nada.
  if (args.includes('--plan')) {
    const previo = cargarPrevio();
    console.log(`${filas.length} cursos. Slug máximo permitido: ${MAX_SLUG} (base ${MAX_BASE}).\n`);
    for (const f of filas) {
      const p = previo.get(f.slugSably);
      const marca = p && p.estado === 'OK' ? '·' : '→';
      console.log(
        `${marca} ${f.slugSably.padEnd(46)} ${String(f.slugCrashing.length).padStart(2)}  ${f.slugCrashing}`,
      );
    }
    const cerrados = filas.filter((f) => previo.get(f.slugSably)?.estado === 'OK').length;
    console.log(`\n· ya cerrados: ${cerrados}   → por procesar: ${filas.length - cerrados}`);
    console.log('Sin colisiones y todos dentro del límite.');
    return;
  }

  let puppeteer;
  try {
    ({ default: puppeteer } = await import('puppeteer-core'));
  } catch {
    console.error('Falta puppeteer-core. Instálalo con:  npm install --save-dev puppeteer-core');
    process.exit(1);
  }

  let navegador;
  try {
    navegador = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  } catch {
    console.error(
      'No pude conectar con Chrome en :9222. Con Chrome cerrado del todo:\n' +
        '  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\n' +
        '    --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-hotmart"\n' +
        'y luego inicia sesión en https://app.hotmart.com',
    );
    process.exit(1);
  }

  const page = await navegador.newPage();
  page.setDefaultTimeout(45000);
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  // Si la sesión se ha caído, parar: este script no inicia sesión nunca.
  await page.goto(AFILIACIONES, { waitUntil: 'networkidle2' });
  await dormir(2500);
  if (/sso\.hotmart\.com|\/auth\/login/.test(page.url())) {
    console.error('La sesión de Hotmart no está iniciada en ese Chrome. Entra a mano y vuelve a lanzarlo.');
    await page.close();
    navegador.disconnect();
    process.exit(1);
  }

  const mapa = await mapaAfiliaciones(page);
  const previo = cargarPrevio();

  let pendientes = filas.filter((f) => {
    if (SOLO.length) return SOLO.includes(f.slugSably);
    const p = previo.get(f.slugSably);
    // Solo se salta lo ya cerrado. Ojo con `!p.estado === 'OK'`: el `!` liga
    // antes que el `===`, así que esa forma siempre da false y hacía que
    // cualquier fila con resultado previo (YA_EXISTIA, ERROR, PENDIENTE…)
    // se saltara para siempre en vez de reintentarse.
    return !p || p.estado !== 'OK';
  });
  if (LIMITE !== Infinity) pendientes = pendientes.slice(0, LIMITE);

  console.log(
    `${filas.length} cursos en el plan · ${filas.length - pendientes.length} ya cerrados · ` +
      `${pendientes.length} por procesar${DRY ? ' (dry-run: no toco nada)' : ''}\n`,
  );

  const resultados = new Map(previo);
  const guardar = () => {
    const orden = filas.map((f) => resultados.get(f.slugSably)).filter(Boolean);
    fs.writeFileSync(SALIDA, JSON.stringify(orden, null, 2) + '\n', 'utf8');
  };

  let n = 0;
  for (const f of pendientes) {
    n++;
    const fila = {
      slugSably: f.slugSably,
      codigo: f.codigo,
      nombreClub: f.nombreClub,
      idProducto: null,
      hotlink: null,
      crashing: null,
      ventaSO: null,
      checkoutFinal: null,
      estado: 'PENDIENTE',
      nota: '',
    };

    try {
      const { id, afiliadoAhora, dry } = await resolverProducto(page, f, mapa);
      if (dry) {
        fila.estado = 'DRY';
        fila.nota = 'no afiliado; con --dry no se afilia';
        console.log(`· ${f.slugSably}: sin afiliar (dry)`);
        resultados.set(f.slugSably, fila);
        guardar();
        continue;
      }
      fila.idProducto = id;

      const { crashing, ventaSO, codigoHotlink } = await leerHotlinks(page, id);
      fila.hotlink = `https://go.hotmart.com/${codigoHotlink}`;

      const trabajos = [
        { clave: 'crashing', hotlink: crashing, slug: f.slugCrashing, titulo: `${f.nombreClub} crashing` },
        { clave: 'ventaSO', hotlink: ventaSO, slug: f.slugVentaSO, titulo: `${f.nombreClub} venta SO` },
      ];

      const notas = [];
      if (afiliadoAhora) notas.push('afiliación creada por el script');

      for (const t of trabajos) {
        const previa = await verificar(t.slug, codigoHotlink);
        if (previa.existe) {
          fila[t.clave] = `https://hotm.io/${t.slug}`;
          notas.push(previa.ok ? `${t.clave}: ya existía y verifica` : `${t.clave}: ya existía PERO ${previa.destino}`);
          if (t.clave === 'crashing') fila.checkoutFinal = previa.destino;
          continue;
        }
        if (DRY) {
          notas.push(`${t.clave}: falta (dry)`);
          continue;
        }

        const r = await acortar(page, t.hotlink, t.titulo, t.slug);
        fila[t.clave] = `https://hotm.io/${t.slug}`;
        const post = await verificar(t.slug, codigoHotlink);
        if (t.clave === 'crashing') fila.checkoutFinal = post.destino;
        if (r === 'YA_TOMADO') notas.push(`${t.clave}: el slug ya estaba tomado`);
        if (!post.ok) notas.push(`${t.clave}: SIN ATRIBUCIÓN → ${post.destino}`);
      }

      fila.nota = notas.join(' · ');
      if (DRY) fila.estado = 'DRY';
      else {
        const cr = await verificar(f.slugCrashing, codigoHotlink);
        const so = await verificar(f.slugVentaSO, codigoHotlink);
        if (cr.ok && so.ok) fila.estado = 'OK';
        else if ((cr.existe || so.existe) && !(cr.ok && so.ok)) fila.estado = 'SIN_ATRIBUCION';
        else fila.estado = 'PENDIENTE';
      }
      console.log(`${fila.estado === 'OK' ? '✓' : '⚠'} [${n}/${pendientes.length}] ${f.slugSably} — ${fila.estado}`);
    } catch (e) {
      fila.estado = 'ERROR';
      fila.nota = String(e.message ?? e).slice(0, 240);
      console.log(`✗ [${n}/${pendientes.length}] ${f.slugSably} — ${fila.nota}`);
    }

    resultados.set(f.slugSably, fila);
    guardar(); // tras CADA curso: si se corta, no se pierde nada
    await dormir(700);
  }

  const todas = [...resultados.values()];
  const cuenta = todas.reduce((a, r) => ((a[r.estado] = (a[r.estado] ?? 0) + 1), a), {});
  console.log(`\nResumen: ${JSON.stringify(cuenta)}`);
  const malos = todas.filter((r) => !['OK', 'DRY'].includes(r.estado));
  if (malos.length) {
    console.log('\nSin cerrar:');
    for (const r of malos) console.log(`  · ${r.slugSably} [${r.estado}] ${r.nota}`);
  }
  console.log(`\nResultado en ${path.relative(RAIZ, SALIDA)}`);
  console.log('Después: python3 scripts/aplicar-acortadores.py para volcarlo al catálogo.');

  await page.close();
  navegador.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
