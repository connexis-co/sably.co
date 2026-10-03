import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Kysely} from 'kysely';
import {createDialect} from 'emdash/db/sqlite';
import {ContentRepository,SchemaRegistry} from 'emdash';
import {applySeed} from 'emdash/seed';
import {buildSeed} from './emdash-content.mjs';
import {upgradeInstitutionalPages} from './upgrade-institutional-pages.mjs';

test('native institutional upgrade preserves content and IDs, creates editable blocks, and never overwrites subsequent edits',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sably-pages-'));let db;
 try{
  const {seed}=await buildSeed('full');
  seed.content={pages:seed.content.pages,categories:seed.content.categories.filter(c=>c.slug==='oficios')};
  for(const page of seed.content.pages){delete page.data.hero_text;delete page.data.hero_label;page.data.layout=[{_type:'sably_rich_text',_version:1,_key:`page-${page.slug}`,content:page.data.body}];}
  const resolved=JSON.parse(JSON.stringify(seed,(_key,v)=>v?.$media?{provider:'external',id:'fixture-media',src:v.$media.url,alt:v.$media.alt}:v));
  const path=join(dir,'db.sqlite');await writeFile(join(dir,'seed.json'),JSON.stringify(resolved));
  execFileSync(process.execPath,['node_modules/emdash/dist/cli/index.mjs','seed',join(dir,'seed.json'),'--database',path],{stdio:'pipe'});
  db=new Kysely({dialect:createDialect({url:path})});const repo=new ContentRepository(db);
  const before=await repo.findBySlug('pages','nosotros','es');let backup;
  const result=await upgradeInstitutionalPages(db,{backup:async rows=>{backup=rows;}});
  assert.deepEqual(result.upgraded,['nosotros','contacto']);assert.equal(backup.length,2);
  const after=await repo.findBySlug('pages','nosotros','es'),contact=await repo.findBySlug('pages','contacto','es');
  assert.equal(after.id,before.id);assert.equal(after.slug,before.slug);assert.equal(after.data.hero_heading,before.data.hero_heading);assert.deepEqual(after.data.body,before.data.body);
  assert.equal(after.data.layout.length,4);assert.equal(after.data.layout[1].cards.length,4);assert.equal(after.data.layout[2].cards.length,3);assert.ok(after.data.layout[0].image);
  assert.equal(contact.data.layout[0].email,'contacto@sably.co');assert.equal(contact.data.layout[0].privacy_url,'/legal/privacidad/');
  const registry=new SchemaRegistry(db);assert.ok((await registry.getField('pages','layout')).validation.allowedTypes.includes('sably_contact'));
  await applySeed(db,{version:'1',content:{pages:[{id:contact.id,slug:'contacto',locale:'es',status:'published',data:{...contact.data,layout:[{...contact.data.layout[0],email:'edited@example.invalid',form_title:'Título editado'}]}}]}},{includeContent:true,onConflict:'update'});
  assert.deepEqual((await upgradeInstitutionalPages(db)).upgraded,[]);
  const edited=await repo.findBySlug('pages','contacto','es');assert.equal(edited.data.layout[0].email,'edited@example.invalid');
 }finally{await db?.destroy();await rm(dir,{recursive:true,force:true});}
});
