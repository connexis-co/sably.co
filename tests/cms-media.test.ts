import test from 'node:test';import assert from 'node:assert/strict';import {cmsImageUrl} from '../src/lib/cms-media';
test('native library media resolves before an embed URL has been enriched',()=>{
 assert.equal(cmsImageUrl({provider:'local',id:'01ABC',meta:{storageKey:'migration/file name.webp'}}),'/_emdash/api/media/file/migration/file%20name.webp');
 assert.equal(cmsImageUrl({provider:'local',id:'01ABC'}),'/_emdash/api/media/file/01ABC');
 assert.equal(cmsImageUrl({provider:'url',src:'https://sably.co/image.jpg'}),'https://sably.co/image.jpg');
});
test('image URLs cannot escape the local media path or execute scripts',()=>{
 assert.equal(cmsImageUrl({provider:'local',meta:{storageKey:'../secret'}}),undefined);
 assert.equal(cmsImageUrl({src:'javascript:alert(1)'}),undefined);
 assert.equal(cmsImageUrl({src:'//evil.example/image'}),undefined);
});
