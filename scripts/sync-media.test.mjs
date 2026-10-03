import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { byteHash,createR2Transport } from './sync-media.mjs';
import { readTarget } from './environment-config.mjs';
test('R2 transport reads either environment and only writes immutable development keys',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'sably-r2-')),calls=[],bytes=Buffer.from('<svg>Native global logo</svg>');
 const production=readTarget('production'),development=readTarget('development');
 try{
  const run=(_command,args)=>{calls.push(args);if(args.includes('get'))writeFileSync(args[args.indexOf('--file')+1],bytes);return {status:0};};
  const transport=createR2Transport({production,development,folder,run});
  assert.equal(byteHash(await transport.read('production','branding/logo.svg')),byteHash(bytes));
  const key=`sync-public/${byteHash(bytes)}.svg`;await transport.write(key,bytes,'image/svg+xml');
  assert.equal(calls[0][4],`${production.r2_buckets[0].bucket_name}/branding/logo.svg`);
  assert.equal(calls[1][4],`${development.r2_buckets[0].bucket_name}/${key}`);
  assert(calls.every(args=>args.includes('--remote')));
  assert(existsSync(join(folder,'media',`${byteHash(bytes)}.bin`)));
  assert.equal(byteHash(readFileSync(join(folder,'media',`${byteHash(bytes)}.bin`))),byteHash(bytes));
  await assert.rejects(transport.write('branding/old-logo.svg',bytes,'image/svg+xml'),/immutable sync prefix/);
  await assert.rejects(transport.write('sync-public/incorrect.svg',bytes,'image/svg+xml'),/content hash/);
  await assert.rejects(transport.read('production','../bad'),/Invalid R2/);
  assert.equal(calls.length,2,'Invalid transfers never reach Wrangler');
 }finally{rmSync(folder,{recursive:true,force:true});}
});
