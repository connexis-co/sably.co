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
    estiloCampo: ['select', ['outlined', 'filled', 'underline'], 'outlined'],
  },
  integraciones: {
    browserMode: ['select', ['off', 'gtm', 'direct'], 'off'],
    gtmId: ['string', null, ''],
    gtmDelay: ['boolean', null, true],
    ga4Id: ['string', null, ''],
    metaPixelId: ['string', null, ''],
    serverConversions: ['boolean', null, false],
    ga4ApiSecret: ['secret', null, undefined],
    metaCapiToken: ['secret', null, undefined],
    hotmartHottok: ['secret', null, undefined],
  },
} as const;

function huella(schema: Record<string, any>) {
  return Object.fromEntries(Object.entries(schema).map(([k, c]) => [k, [c.type, c.options ? c.options.map((o: any) => o.value) : null, c.default]]));
}

test('ninguna clave, tipo, opción ni valor de fábrica cambia al reordenar el panel', () => {
  assert.deepEqual(huella(operaciones), ANTES.operaciones);
  assert.deepEqual(huella(integraciones), ANTES.integraciones);
});

test('cada ajuste guardado está en una sola pestaña y todos tienen ayuda', () => {
  const vistas = PESTANAS.flatMap(p => p.claves);
  assert.deepEqual([...vistas].sort(), Object.keys(operaciones).sort());
  assert.equal(new Set(vistas).size, vistas.length);
  for (const [k, c] of Object.entries({ ...operaciones, ...integraciones })) {
    assert.ok((c as { description?: string }).description, `${k} sin ayuda`);
    assert.doesNotMatch(c.label, /^V2 ·/, `${k} conserva la jerga «V2 ·»`);
  }
  assert.deepEqual(PESTANAS.map(p => p.titulo), ['Sitio y tema', 'Campañas y cupones', 'Caja de compra', 'Cursos y contenido', 'Medios: audio y vídeo', 'SEO y medición', 'Integraciones', 'Avanzado']);
});

test('los ajustes guardados en la copia de producción se leen igual', async () => {
  const { filas } = JSON.parse(readFileSync(new URL('./fixtures/opciones-produccion-2026-11-25.json', import.meta.url), 'utf8')) as { filas: { name: string; value: string }[] };
  assert.deepEqual(leerAjustesV2(filas, 'clasico'), {
    temaPorDefecto: 'v2',
    caja: { variante: 'cuenta-clara', contador: 'barra', titulo: 'Empieza {curso}', subtitulo: 'Lecciones en vídeo, a tu ritmo.' },
    mostrarCreador: true,
    mostrarDocente: true,
    estiloCampo: 'outlined',
  });
  const prefijo = 'plugin:sably-integrations:settings:';
  const settings = { get: async (k: string) => { const f = filas.find(r => r.name === prefijo + k); return f ? JSON.parse(f.value) : null; } };
  assert.deepEqual(await readPublic(settings as never), { browserMode: 'gtm', gtmId: 'GTM-56LHZGMK', gtmDelay: true, ga4Id: 'G-RZF4MSX5B7', metaPixelId: '1711030209407213', serverConversions: false });
  // Todas las claves guardadas de estos dos plugins siguen existiendo en su esquema.
  for (const { name } of filas) {
    const [, plugin, , clave] = name.split(':');
    if (plugin === 'sably-operations') assert.ok(Object.hasOwn(operaciones, clave!), name);
    if (plugin === 'sably-integrations') assert.ok(Object.hasOwn(integraciones, clave!), name);
  }
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
