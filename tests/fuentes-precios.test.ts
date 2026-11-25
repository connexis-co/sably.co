import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import fuentes from '../src/data/fuentes-precios.json';

test('la oferta de cada fuente es la de su huella: la cotización pide la oferta que compra el visitante', () => {
  const conOferta = Object.entries(fuentes as Record<string, { ofertaSha256: string; oferta?: string }>).filter(([, f]) => f.oferta);
  assert.ok(conOferta.length >= 2, 'drenaje linfático y barista llevan su oferta');
  for (const [slug, f] of conOferta) assert.equal(createHash('sha256').update(f.oferta!).digest('hex'), f.ofertaSha256, slug);
});
