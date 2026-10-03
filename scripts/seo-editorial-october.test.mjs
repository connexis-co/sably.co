import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Kysely} from 'kysely';
import {createDialect} from 'emdash/db/sqlite';
import {ContentRepository} from 'emdash';
import {buildSeed} from './emdash-content.mjs';
import {applyEditorialSeo,editorialSeo} from './seo-editorial-october.mjs';

test('editorial SEO copy uses the native panel, preserves manual values and is idempotent',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'sably-editorial-seo-'));let db;
 try{
  const {seed}=await buildSeed('full');seed.content={pages:seed.content.pages};
  const resolved=JSON.parse(JSON.stringify(seed,(_key,value)=>value?.$media?{provider:'external',id:'fixture',src:value.$media.url}:value));
  const path=join(folder,'cms.db'),file=join(folder,'seed.json');await writeFile(file,JSON.stringify(resolved));
  execFileSync(process.execPath,['node_modules/emdash/dist/cli/index.mjs','seed',file,'--database',path],{stdio:'pipe'});
  db=new Kysely({dialect:createDialect({url:path})});const content=new ContentRepository(db);
  const before=await content.findBySlug('pages','nosotros','es');
  await db.insertInto('_emdash_seo').values({collection:'pages',content_id:before.id,seo_title:'Título del editor',seo_no_index:1,seo_canonical:'https://sably.co/nosotros/'}).execute();
  let backup;const plan=await applyEditorialSeo(db,{backup:async rows=>{backup=rows;}});
  assert.equal(plan.updated,0);assert.equal(backup.length,2);
  await applyEditorialSeo(db,{execute:true});
  const after=await db.selectFrom('_emdash_seo').selectAll().where('content_id','=',before.id).executeTakeFirstOrThrow();
  assert.equal(after.seo_title,'Título del editor');assert.equal(after.seo_no_index,1);assert.equal(after.seo_canonical,'https://sably.co/nosotros/');
  assert.deepEqual((await content.findBySlug('pages','nosotros','es')).data,before.data);
  assert.equal((await applyEditorialSeo(db,{execute:true})).updated,0);
  for(const entries of Object.values(editorialSeo))for(const values of Object.values(entries)){
   if(values.title)assert(values.title.length<=60);if(values.description)assert(values.description.length>=100&&values.description.length<=160);
  }
 }finally{await db?.destroy();await rm(folder,{recursive:true,force:true});}
});
