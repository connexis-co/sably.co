import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizePagePath,pagePathAvailable} from '../src/lib/page-path.ts';
test('new CMS pages accept flat and nested local paths',()=>{
 for(const path of ['/nueva-pagina/','/legal/nueva/','/ayuda/pagos/tarjetas/'])assert(pagePathAvailable(path,['co','mx']));
 assert.equal(normalizePagePath('/legal/nueva'),'/legal/nueva/');
});
test('CMS pages cannot shadow countries, reserved application paths or invalid URLs',()=>{
 for(const path of ['/co/curso-nuevo/','/mx/','/blog/post/','/api/leads/','/_emdash/admin/','https://example.com/','//example.com/','/a/../b/','/a%2fb/','/a?b/'])assert(!pagePathAvailable(path,['co','mx']),path);
});
