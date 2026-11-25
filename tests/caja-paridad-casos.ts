/**
 * Casos de la prueba de paridad del núcleo de caja (Sably ↔ academia). La misma función
 * se ejecuta contra el núcleo de la academia (`scripts/caja-paridad.mjs`, que guarda
 * `tests/fixtures/caja-paridad.json`) y contra la copia de Sably (`tests/caja-paridad.test.ts`).
 * Los textos son neutros a propósito: el vocabulario es lo único que cambia entre sitios.
 */
type Mod = Record<string, any>;
export interface Nucleo { model: Mod; fabrica: Mod; parche: Mod; resolver: Mod; validar: Mod; migrar: Mod }

const curso = (courseId: string, escuela: string | null = null, cajaElementos: readonly string[] | null = null) => ({ courseId, escuela, cajaElementos });

/** Sin los textos de fábrica: el vocabulario es lo que cambia entre sitios (la huella del archivo ya los cubre). */
const sinTextos = (doc: any) => JSON.parse(JSON.stringify(doc, (k, v) => (k === 'textos' ? undefined : v)));

export function ejecutar({ model, fabrica, parche, resolver, validar, migrar }: Nucleo) {
  const doc = sinTextos(fabrica.docFabrica());
  const out: Record<string, unknown> = {};
  out.version = model.CAJA_VERSION;
  out.zonas = model.ZONAS;
  out.iconos = model.ICONOS_CAJA;
  out.catalogo = Object.fromEntries(Object.entries(model.CATALOGO as Record<string, any>).map(([k, v]) => [k, { zonas: v.zonas, variantes: v.variantes.map((x: any) => x.id), maxPorZona: v.maxPorZona, obligatorio: v.obligatorio, items: v.items ?? null, opciones: v.opciones.map((o: any) => [o.clave, o.defecto]) }]));
  out.fabricaIds = (fabrica.PREAJUSTES_FABRICA as Array<() => any>).map((f) => f().id);
  out.validarFabrica = validar.validarCaja(doc);
  for (const z of model.ZONAS) out[`resolver-${z}`] = resolver.resolverZona({ doc, curso: curso('masajes'), zona: z });
  // Parche por curso y por escuela: reordena, apaga, cambia variante y agrega un texto propio.
  const conParches = { ...doc, escuelas: { e1: { preajuste: 'minima' } }, cursos: {
    c1: { bloques: { b8: { visible: false }, b4: { variante: 'chip' } }, orden: { caja: ['b5', 'b3'] }, extra: { caja: [{ id: 'x1', tipo: 'texto', visible: true, variante: 'nota', textos: { texto: 'Clases en video desde tu casa' }, despuesDe: 'b5' }] } },
    c2: { preajuste: 'no-existe' },
  } };
  out.validarParches = validar.validarCaja(conParches);
  out.resolverC1 = resolver.resolverZona({ doc: conParches, curso: curso('c1'), zona: 'caja' });
  out.resolverEscuela = resolver.resolverZona({ doc: conParches, curso: curso('c9', 'e1'), zona: 'caja' });
  out.resolverInexistente = resolver.resolverZona({ doc: conParches, curso: curso('c2'), zona: 'caja' });
  out.resolverElementos = resolver.resolverZona({ doc, curso: curso('c3', null, ['precio', 'boton', 'whatsapp']), zona: 'caja' });
  out.efectivoC1 = resolver.efectivo(conParches, curso('c1'));
  // Errores de forma: falta un obligatorio, variante desconocida, bloque en zona prohibida, demasiados separadores.
  const roto = JSON.parse(JSON.stringify(doc));
  roto.preajustes[0].zonas.caja = roto.preajustes[0].zonas.caja.filter((x: any) => x.tipo !== 'boton');
  roto.preajustes[0].zonas.caja[0].variante = 'inventada';
  roto.preajustes[0].zonas.barra.push({ id: 'z1', tipo: 'whatsapp', visible: true, variante: 'enlace' });
  for (let i = 0; i < 8; i++) roto.preajustes[1].zonas.caja.push({ id: `s${i}`, tipo: 'separador', visible: true, variante: 'linea' });
  roto.sitio = 'campana';
  out.validarRoto = validar.validarCaja(roto);
  out.resolverRoto = resolver.resolverZona({ doc: roto, curso: curso('c1'), zona: 'caja' });
  // Textos: cifras, porcentajes, urgencia (con y sin campaña con fechas), largo y variables desconocidas.
  const spec = { clave: 'texto', etiqueta: 'Texto', max: 40, variables: ['curso', 'escuela'] };
  out.textos = ['Inscríbete por $85.000', 'Ahorra 30 %', 'Termina en 3 horas', 'Aprende {curso} hoy', 'Aprende {precio} hoy', 'x'.repeat(41), 'Clases en video']
    .map((t) => [t, validar.problemasTexto(t, spec, undefined, {}, 'El texto'), validar.problemasTexto(t, spec, { campana: 'con-fechas' }, {}, 'El texto')]);
  // Migración y lectura.
  out.migrarFabrica = sinTextos(migrar.migrar());
  out.migrarApagados = sinTextos(migrar.migrar({ buyBoxWhatsapp: false, buyBoxRating: false, buyBoxDetails: false }));
  out.parcheDeElementos = [null, [], ['precio', 'boton'], ['boton', 'precio', 'cupon', 'whatsapp', 'garantia']].map((l) => migrar.parcheDeElementos(l));
  out.readCaja = [null, 'x', { v: 1 }, { ...doc, sitio: 'no-existe' }].map((v) => migrar.readCaja(v));
  out.aplicarParche = parche.aplicarParche(sinTextos(fabrica.clasica()), { bloques: { b7: { visible: false } }, orden: { caja: ['b3', 'b1'] } }, [], {});
  return JSON.parse(JSON.stringify(out));
}
