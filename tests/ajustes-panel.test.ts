/**
 * Orden del panel (docs/equipo/2026-11-25/panel/ORDEN.md): reordenar y rotular no puede cambiar ninguna clave
 * guardada ni ningún valor permitido, ni lo que se lee de los ajustes guardados en producción.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { settingsSchema as operaciones, PESTANAS, cambiosAGuardar, AJUSTES_PELIGROSOS } from '../src/plugins/sably-operations/ajustes.ts';
import { settingsSchema as integraciones, readPublic } from '../src/plugins/sably-integrations/model.ts';
import { createPlugin, PAGINAS } from '../src/plugins/sably-operations/index.ts';
import { leerAjustesV2 } from '../src/lib/ajustes-tema.ts';
import { leerAjustesBlog } from '../src/lib/blog-ajustes.ts';

/** Claves, tipos, opciones y valores de fábrica tal como estaban en develop (5b8c4b1) antes de reordenar. */
const ANTES = {
  operaciones: {
    notificationEmail: ['email', null, undefined],
    temaPorDefecto: ['select', ['clasico', 'v2'], 'clasico'],
    cajaVariante: ['select', ['cuenta-clara', 'cabecera-oscura'], 'cuenta-clara'],
    cajaContador: ['select', ['barra', 'casillas', 'linea', 'tique'], 'barra'],
    cajaTitulo: ['string', null, 'Empieza {curso}'],
    cajaSubtitulo: ['string', null, 'Lecciones en vídeo, a tu ritmo.'],
    mostrarCreador: ['boolean', null, true],
    // Clave nueva (25-nov, punto C5): no reordena ni cambia ninguna de las anteriores.
    mostrarDocente: ['boolean', null, true],
    // Clave nueva (25-nov, ciudades en la ficha V2): tampoco reordena las anteriores.
    mostrarCiudades: ['boolean', null, true],
    estiloCampo: ['select', ['outlined', 'filled', 'underline'], 'outlined'],
    // Claves nuevas (cuenta, 25-nov): se añaden, no sustituyen a ninguna.
    cuentaActiva: ['boolean', null, true],
    cuentaGoogle: ['boolean', null, true],
    cuentaCorreo: ['boolean', null, true],
    cuentaClave: ['boolean', null, true],
    cuentaAcceso: ['select', ['ventana', 'pagina'], 'ventana'],
    // Claves nuevas (26-nov, barra de campaña V2, C7): se añaden, no sustituyen a ninguna.
    barraCampanaCierre: ['select', ['sesion', 'vista'], 'sesion'],
    barraCampanaFicha: ['boolean', null, true],
  },
  integraciones: {
    browserMode: ['select', ['off', 'gtm', 'direct'], 'off'],
    gtmId: ['string', null, ''],
    gtmDelay: ['boolean', null, true],
    ga4Id: ['string', null, ''],
    metaPixelId: ['string', null, ''],
    // Claves nuevas (25-nov, ChatGPT Ads): se añaden, no sustituyen a ninguna.
    openaiPixelId: ['string', null, ''],
    openaiCapiKey: ['secret', null, undefined],
    serverConversions: ['boolean', null, false],
    ga4ApiSecret: ['secret', null, undefined],
    metaCapiToken: ['secret', null, undefined],
    hotmartHottok: ['secret', null, undefined],
  },
} as const;

function huella(schema: Record<string, any>) {
  return Object.fromEntries(Object.entries(schema).map(([k, c]) => [k, [c.type, c.options ? c.options.map((o: any) => o.value) : null, c.default]]));
}

/** Claves añadidas después (clave nueva, nunca renombrada): aviso de cookies (25-nov). */
const NUEVAS = {
  integraciones: {
    consentNotice: ['select', ['discreto', 'completo', 'pie'], 'discreto'],
    consentEurope: ['boolean', null, true],
  },
} as const;
/** Claves nuevas desde el 25-nov (portada, blog y avisos de campaña): solo pueden ser nuevas y llevar su prefijo. */
const DE_PORTADA = /^(portada|blog|campana)[A-Z]/;

test('ninguna clave, tipo, opción ni valor de fábrica cambia al reordenar el panel', () => {
  const huellaOperaciones = huella(operaciones);
  assert.deepEqual(Object.fromEntries(Object.entries(huellaOperaciones).filter(([k]) => !DE_PORTADA.test(k))), ANTES.operaciones);
  for (const k of Object.keys(huellaOperaciones)) assert.ok(Object.hasOwn(ANTES.operaciones, k) || DE_PORTADA.test(k), `${k} no es una clave conocida ni de la portada`);
  assert.deepEqual(huella(integraciones), { ...ANTES.integraciones, ...NUEVAS.integraciones });
});

test('cada ajuste guardado está en una sola pestaña y todos tienen ayuda', () => {
  const vistas = PESTANAS.flatMap(p => p.claves);
  assert.deepEqual([...vistas].sort(), Object.keys(operaciones).sort());
  assert.equal(new Set(vistas).size, vistas.length);
  for (const [k, c] of Object.entries({ ...operaciones, ...integraciones })) {
    assert.ok((c as { description?: string }).description, `${k} sin ayuda`);
    assert.doesNotMatch(c.label, /^V2 ·/, `${k} conserva la jerga «V2 ·»`);
  }
  assert.deepEqual(PESTANAS.map(p => p.titulo), ['Sitio y tema', 'Campañas y cupones', 'Caja de compra', 'Portada', 'Cursos y contenido', 'Blog', 'Medios: audio y vídeo', 'SEO y medición', 'Cuenta', 'Integraciones', 'Avanzado']);
});

test('los ajustes guardados en la copia de producción se leen igual', async () => {
  const { filas } = JSON.parse(readFileSync(new URL('./fixtures/opciones-produccion-2026-11-25.json', import.meta.url), 'utf8')) as { filas: { name: string; value: string }[] };
  assert.deepEqual(leerAjustesV2(filas, 'clasico'), {
    temaPorDefecto: 'v2',
    caja: { variante: 'cuenta-clara', contador: 'barra', titulo: 'Empieza {curso}', subtitulo: 'Lecciones en vídeo, a tu ritmo.' },
    mostrarCreador: true,
    mostrarDocente: true,
    mostrarCiudades: true,
    estiloCampo: 'outlined',
    barraCampana: { cierre: 'sesion', enFicha: true },
    campana: { barra: 'contador', banda: 'contador', megamenu: 'contador', listado: 'contador' },
    portada: {
      bloques: ['cifras', 'categorias', 'convergen', 'destacados', 'promo', 'como-funciona', 'escenas', 'oficio', 'valorados', 'beneficios', 'videos', 'guias', 'preguntas', 'cierre'],
      heroe: { variante: 'muro', fondo: 'liso', botones: 'dos', tachar: true, rota: true, intervalo: 4500, orden: 'aleatorio', cursos: [] },
      pruebaHeroe: null,
      categoriasVariante: 'fotos',
      comoFuncionaAnimado: true,
      escenasAtenuar: true,
      escenasVariante: 'apiladas',
      valoradosMinimo: 20,
    },
    blog: leerAjustesBlog({}),
  });
  const prefijo = 'plugin:sably-integrations:settings:';
  const settings = { get: async (k: string) => { const f = filas.find(r => r.name === prefijo + k); return f ? JSON.parse(f.value) : null; } };
  assert.deepEqual(await readPublic(settings as never), { browserMode: 'gtm', gtmId: 'GTM-56LHZGMK', gtmDelay: true, ga4Id: 'G-RZF4MSX5B7', metaPixelId: '1711030209407213', openaiPixelId: '', serverConversions: false, consentNotice: 'discreto', consentEurope: true });
  // Todas las claves guardadas de estos dos plugins siguen existiendo en su esquema.
  for (const { name } of filas) {
    const [, plugin, , clave] = name.split(':');
    if (plugin === 'sably-operations') assert.ok(Object.hasOwn(operaciones, clave!), name);
    if (plugin === 'sably-integrations') assert.ok(Object.hasOwn(integraciones, clave!), name);
  }
});

test('ajustes del blog: de fábrica el diseño aprobado y nunca un valor fuera de las opciones', async () => {
  const { leerAjustesBlog: leer, redesCompartir, posicionesCompartir } = await import('../src/lib/blog-ajustes.ts');
  const fabrica = leer({});
  assert.equal(fabrica.blogCabecera, 'automatica');
  assert.equal(fabrica.blogIndiceEscritorio, 'lateral-fija');
  assert.equal(fabrica.blogTarjeta, 'borde');
  assert.equal(fabrica.blogProgreso, true);
  assert.deepEqual(redesCompartir(fabrica), ['whatsapp', 'facebook', 'x', 'correo', 'copiar']);
  assert.deepEqual(posicionesCompartir(fabrica), ['metadatos', 'carril', 'final']);
  const raro = leer({ blogCabecera: 'z', blogProgreso: 'no', blogCompartirRedes: ' Copiar, tiktok, whatsapp, copiar ' });
  assert.equal(raro.blogCabecera, 'automatica');
  assert.equal(raro.blogProgreso, true);
  assert.deepEqual(redesCompartir(raro), ['copiar', 'whatsapp']);
  assert.equal(leer({ blogCabecera: 'd', blogProgreso: false }).blogCabecera, 'd');
});

test('la página solo guarda lo que cambió, nunca claves ajenas, y el tema exige confirmación', () => {
  const actuales = { temaPorDefecto: 'v2', estiloCampo: 'outlined', mostrarCreador: true, cajaTitulo: 'Empieza {curso}' };
  assert.deepEqual(cambiosAGuardar({ estiloCampo: 'outlined', mostrarCreador: true }, actuales), {}, 'sin cambios no se fija ningún valor de fábrica');
  assert.deepEqual(cambiosAGuardar({ estiloCampo: 'filled', cajaTitulo: 'Empieza {curso}' }, actuales), { estiloCampo: 'filled' });
  assert.throws(() => cambiosAGuardar({ temaPorDefecto: 'clasico' }, actuales), /Confirma/);
  assert.deepEqual(cambiosAGuardar({ temaPorDefecto: 'clasico' }, actuales, true), { temaPorDefecto: 'clasico' });
  assert.throws(() => cambiosAGuardar({ temaPorDefecto: 'oscuro' }, actuales, true), /opciones/);
  assert.throws(() => cambiosAGuardar({ otraClave: 'x' } as never, actuales), /no es un ajuste/);
  assert.throws(() => cambiosAGuardar({ mostrarCreador: 'no' }, actuales), /encendido o apagado/);
  assert.throws(() => cambiosAGuardar({ notificationEmail: 'no es correo' }, actuales), /correo/);
  assert.deepEqual(AJUSTES_PELIGROSOS, ['temaPorDefecto']);
});

test('el menú declarado en astro.config.mjs coincide con las páginas del plugin', () => {
  const config = readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
  const plugin = createPlugin() as unknown as { admin: { pages: typeof PAGINAS } };
  assert.deepEqual(plugin.admin.pages, PAGINAS);
  for (const p of PAGINAS) assert.ok(config.includes(`{ path: '${p.path}', label: '${p.label}', icon: '${p.icon}' }`), p.label);
  assert.ok(config.indexOf("id: 'sably-operations'") < config.indexOf("id: 'sably-integrations'"), '«Ajustes del sitio» va primero');
  assert.ok(config.indexOf("id: 'sably-integrations'") < config.indexOf("id: 'sably-whatsapp'"), 'los fragmentos de página conservan su orden');
});

test('prueba A/B del héroe: solo con dos o tres variantes válidas', async () => {
  const { leerPruebaHeroe } = await import('../src/lib/prueba-heroe.ts');
  assert.equal(leerPruebaHeroe(false, 'collage, buscador', 'iguales', ''), null);
  assert.equal(leerPruebaHeroe(true, 'collage', 'iguales', ''), null);
  assert.equal(leerPruebaHeroe(true, 'collage, mosaico', 'iguales', ''), null);
  assert.deepEqual(leerPruebaHeroe(true, 'Collage, buscador, collage', 'iguales', '2026-12-01'), { variantes: ['collage', 'buscador'], pesos: [0.5, 0.5], inicio: '2026-12-01' });
  const p = leerPruebaHeroe(true, 'collage, buscador, muro, cintas', '70', 'mañana')!;
  assert.deepEqual(p.variantes, ['collage', 'buscador', 'muro']);
  assert.equal(p.inicio, '');
  assert.ok(Math.abs(p.pesos.reduce((a, b) => a + b) - 1) < 1e-9 && p.pesos[0] === 0.7);
});
