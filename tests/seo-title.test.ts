import assert from 'node:assert/strict';
import {test} from 'node:test';
import {conciseTitle} from '../src/lib/seo-title';

test('keeps a concise editorial phrase and only adds the brand when it fits',()=>{
 assert.equal(conciseTitle('Curso de barbería en Colombia'),'Curso de barbería en Colombia | Sably');
 assert.equal(conciseTitle('Curso de barbería | Sably'),'Curso de barbería | Sably');
});
test('chooses complete phrases retaining the topic and market instead of cutting words',()=>{
 const result=conciseTitle('Curso de Reparación de Lavadoras | Curso Online con Certificado | Colombia',[
  'Curso de Reparación de Lavadoras en Colombia',
  'Reparación de Lavadoras | Colombia',
 ]);
 assert.equal(result,'Curso de Reparación de Lavadoras en Colombia | Sably');
 const long='Un nombre de programa excepcionalmente largo que debe permanecer íntegro';
 assert.equal(conciseTitle(long),long);
});
