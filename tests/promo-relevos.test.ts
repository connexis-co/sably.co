import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finDelTramo, mejorPromocion, promocionSiguiente, type Promocion } from '../src/lib/promo.ts';
import { fechaCorta, fechaDia } from '../src/lib/cuenta-atras.ts';

/* Calendario del cupón 031016 que JP confirmó el 25-nov-2026, tal como está en el panel
   (segundos del panel × 1000, como los entrega readActivePromos). Hora de Bogotá, UTC−5. */
const bogota = (iso: string) => Date.parse(`${iso}-05:00`);
const base = { pct: 50, cupon: '031016', proveedores: ['masterclasses'], incluir: [], excluir: [], paises: [], prioridad: 70 };
const promos: Promocion[] = [
  { ...base, id: 'black-november-2026', nombre: 'Black Friday', etiqueta: 'Black Friday', titular: 'Black Friday hasta el domingo 29 de noviembre', desde: bogota('2026-11-03T00:00:00'), hasta: bogota('2026-11-29T23:59:59') },
  { ...base, id: 'cyber-monday-2026', nombre: 'Cyber Monday', etiqueta: 'Cyber Monday', titular: 'Cyber Monday: solo este lunes 30 de noviembre', desde: bogota('2026-11-29T23:59:59'), hasta: bogota('2026-11-30T23:59:59') },
  { ...base, id: 'promo-navidena-2026', nombre: 'Promoción navideña', etiqueta: 'Promoción navideña', titular: 'Promoción navideña en Sably', desde: bogota('2026-11-30T23:59:59'), hasta: null },
  { ...base, id: 'ads-50', nombre: 'Oferta especial', titular: 'Tu descuento está activo', desde: bogota('2026-08-01T00:00:00'), hasta: bogota('2027-06-30T23:59:59'), prioridad: 25, urlKey: 'ads50' },
];
const ctx = { countryCode: 'co', proveedor: 'masterclasses', courseSlug: 'curso-de-masajes', urlKey: null };
const en = (ms: number) => mejorPromocion(promos, { ...ctx, now: ms })?.id ?? null;

test('relevo 29-nov 23:59:59 → 30-nov 00:00:00: Black Friday pasa a Cyber Monday sin hueco', () => {
  assert.equal(en(bogota('2026-11-29T23:59:58')), 'black-november-2026');
  assert.equal(en(bogota('2026-11-29T23:59:59')), 'cyber-monday-2026');
  assert.equal(en(bogota('2026-11-30T00:00:00')), 'cyber-monday-2026');
  for (let ms = bogota('2026-11-29T23:59:00'); ms <= bogota('2026-11-30T00:01:00'); ms += 500) assert.notEqual(en(ms), null);
});

test('relevo 30-nov 23:59:59 → 1-dic 00:00:00: Cyber Monday pasa a la promoción navideña sin hueco', () => {
  assert.equal(en(bogota('2026-11-30T23:59:58')), 'cyber-monday-2026');
  assert.equal(en(bogota('2026-11-30T23:59:59')), 'promo-navidena-2026');
  assert.equal(en(bogota('2026-12-01T00:00:00')), 'promo-navidena-2026');
  assert.equal(en(bogota('2027-03-01T00:00:00')), 'promo-navidena-2026');
  for (let ms = bogota('2026-11-30T23:59:00'); ms <= bogota('2026-12-01T00:01:00'); ms += 500) assert.notEqual(en(ms), null);
});

test('la caja sabe qué campaña sigue y no promete «después vuelve a…»', () => {
  const bf = promos[0]!, cyber = promos[1]!, navidad = promos[2]!;
  assert.equal(promocionSiguiente(promos, bf, ctx)?.id, 'cyber-monday-2026');
  assert.equal(promocionSiguiente(promos, cyber, ctx)?.id, 'promo-navidena-2026');
  assert.equal(promocionSiguiente(promos, navidad, ctx), null);
  // Sin campaña a continuación, sí vuelve el precio normal.
  assert.equal(promocionSiguiente(promos.filter(p => p.id !== 'cyber-monday-2026'), bf, ctx), null);
  // Otro país fuera de la siguiente: tampoco hay relevo.
  const soloMx = promos.map(p => p.id === 'cyber-monday-2026' ? { ...p, paises: ['mx'] } : p);
  assert.equal(promocionSiguiente(soloMx, bf, ctx), null);
});

test('el precio rebajado dura todo el tramo con el mismo cupón', () => {
  const bf = promos[0]!;
  // Black Friday → Cyber Monday → navidad sin cierre: el precio no se retira en ningún relevo.
  assert.equal(finDelTramo(promos, bf, ctx), null);
  // Si Cyber Monday tuviera otro descuento, el precio de Black Friday acaba con Black Friday.
  const otroPct = promos.map(p => p.id === 'cyber-monday-2026' ? { ...p, pct: 25, cupon: '010775' } : p);
  assert.equal(finDelTramo(otroPct, bf, ctx), bf.hasta);
  // Sin navidad, el tramo acaba con Cyber Monday.
  assert.equal(finDelTramo(promos.filter(p => p.id !== 'promo-navidena-2026'), bf, ctx), promos[1]!.hasta);
});

test('textos del cierre en hora de Colombia', () => {
  assert.equal(fechaCorta(promos[0]!.hasta!), '29 nov., 11:59 p. m.');
  assert.equal(fechaDia(promos[0]!.hasta!), '29 nov.');
  assert.equal(fechaDia(promos[1]!.hasta!), '30 nov.');
});
