import assert from 'node:assert/strict';
import test from 'node:test';
import { dividirTexto } from '../src/lib/texto-largo';

const parrafo = (n: number) => `<p>${Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ')}</p>`;

test('el corte cae antes del primer subtítulo que supera el límite y no pierde nada', () => {
  const html = `${parrafo(120)}<h3>Primero, el espacio</h3>${parrafo(150)}<h3>Las maniobras</h3>${parrafo(150)}<h3>Tu servicio</h3>${parrafo(80)}`;
  const t = dividirTexto(html, 300);
  assert.equal(t.titulos.length, 3);
  assert.deepEqual(t.plegados, ['Tu servicio']);
  assert.match(t.visible, /id="texto-primero-el-espacio"/);
  assert.equal((t.visible + t.resto).replace(/ id="[^"]*"/g, ''), html, 'visible + resto = el texto entero');
});

test('un texto corto no se pliega', () => {
  const t = dividirTexto(`${parrafo(100)}<h3>Único</h3>${parrafo(50)}`);
  assert.equal(t.resto, '');
  assert.deepEqual(t.plegados, []);
});

test('ids únicos aunque se repita el subtítulo', () => {
  const t = dividirTexto('<h3>Repaso</h3><p>a</p><h3>Repaso</h3><p>b</p>');
  assert.deepEqual(t.titulos.map(x => x.id), ['texto-repaso', 'texto-repaso-2']);
});
