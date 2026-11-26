import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aceptaCupon, proveedorDe, PROVEEDOR_DEFECTO } from '../src/lib/proveedores';

/*
 * Cada creador sin cupón está medido contra su checkout (mismo precio con y
 * sin `?offDiscount=031016`). Si uno de estos vuelve a aceptar el cupón por
 * error, la ficha anunciaría −50 % y el checkout cobraría el precio entero.
 */
const SIN_CUPON = ['cursosdecocina', 'peluqueria', 'soldadura', 'drenaje', 'enjoydigital', 'pollobroaster', 'premiumacademy'];

test('los creadores medidos sin cupón no reciben el cupón del sitio', () => {
  for (const id of SIN_CUPON) {
    assert.equal(proveedorDe(id), id, `${id} debe ser un proveedor conocido`);
    assert.equal(aceptaCupon(id), false, `${id} no acepta 031016`);
  }
});

test('un curso sin proveedor o con uno desconocido cae en MasterClasses, que sí acepta el cupón', () => {
  assert.equal(PROVEEDOR_DEFECTO, 'masterclasses');
  assert.equal(proveedorDe(undefined), 'masterclasses');
  assert.equal(proveedorDe('  PremiumAcademy '), 'premiumacademy');
  assert.equal(proveedorDe('premium-academy'), 'masterclasses');
  assert.equal(aceptaCupon(undefined), true);
});
