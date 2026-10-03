/** One-time, additive native CMS upgrade. Never overwrites a redesigned layout or a draft. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Kysely} from 'kysely';
import {SchemaRegistry,ContentRepository} from 'emdash';
import {applySeed} from 'emdash/seed';
import {blockTypes} from './emdash-editorial.mjs';
import {structureInstitutionalPage} from './institutional-pages.mjs';
import {nativeDialect} from './sync-content.mjs';
import {readTarget} from './environment-config.mjs';

export async function upgradeInstitutionalPages(db,{backup=async()=>{}}={}) {
 const repo=new ContentRepository(db),registry=new SchemaRegistry(db);
 const targets=[];
 for(const slug of ['nosotros','contacto']) {
  const page=await repo.findBySlug('pages',slug,'es');
  if(!page)continue;
  const layout=page.data.layout;
  if(!Array.isArray(layout)||layout.length!==1||layout[0]._key!==`page-${slug}`||layout[0]._type!=='sably_rich_text')continue;
  const stored=await db.selectFrom('ec_pages').selectAll().where('id','=',page.id).executeTakeFirstOrThrow();
  assert(!stored.draft_revision_id || stored.draft_revision_id===stored.published_revision_id,`${slug}: hay un borrador pendiente; no se reemplazará`);
  const category=slug==='nosotros'?await repo.findBySlug('categories','oficios','es'):null;
  assert(slug!=='nosotros'||category?.data.cover_image,'Falta la imagen de oficios en la biblioteca nativa');
  const data={...page.data,...structureInstitutionalPage(slug,{...page.data,body:layout[0].content},category?.data.cover_image)};
  // Editors may have added these fields before running the upgrade.
  for(const key of ['hero_label','hero_text'])if(page.data[key]!=null)data[key]=page.data[key];
  targets.push({page,stored,data});
 }
 await backup(targets.map(({stored})=>stored));
 await applySeed(db,{version:'1',blockTypes:blockTypes.filter(b=>['sably_story','sably_cards','sably_contact'].includes(b.slug))},{onConflict:'skip'});
 for(const [slug,label,type] of [['hero_label','Antetítulo de cabecera','string'],['hero_text','Introducción de cabecera','text']]) {
  if(!await registry.getField('pages',slug))await registry.createField('pages',{slug,label,type});
 }
 const layoutField=await registry.getField('pages','layout');
 assert(layoutField,'Falta el campo nativo de bloques');
 const allowedTypes=[...new Set([...(layoutField.validation?.allowedTypes??[]),...blockTypes.map(b=>b.slug)])];
 if(JSON.stringify(layoutField.validation?.allowedTypes)!==JSON.stringify(allowedTypes))await registry.updateField('pages','layout',{validation:{...layoutField.validation,allowedTypes}});
 for(const {page,stored,data} of targets) {
  const current=await db.selectFrom('ec_pages').selectAll().where('id','=',page.id).executeTakeFirstOrThrow();
  assert.equal(JSON.stringify(current.layout),JSON.stringify(stored.layout),'La página se editó durante la migración');
  assert.equal(current.updated_at,stored.updated_at,'La página se editó durante la migración');
  await applySeed(db,{version:'1',defaultLocale:'es',content:{pages:[{id:page.id,slug:page.slug,locale:'es',status:page.status,data}]}},{includeContent:true,onConflict:'update'});
 }
 return {upgraded:targets.map(({page})=>page.slug)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 assert(process.argv.includes('--execute'),'Use --execute on development after reviewing and testing the upgrade');
 const config=await readTarget('development');
 assert.equal(config.name,'sably-emdash-dev');
 const database=config.d1_databases.find(binding=>binding.binding==='DB').database_id;
 assert.equal(database,'d9ed655d-1885-415f-a98e-74d6cd0a6263');
 assert(process.env.CLOUDFLARE_API_TOKEN,'Missing Cloudflare credential');
 const api={async query(sql,parameters=[]) {
  assert(!/\b(users|sessions|passkeys|api_tokens|auth_tokens|plugin_storage|lead|consent)\b/i.test(sql),'Private data is outside this upgrade');
  assert(!/\b(?:DROP|TRUNCATE)\b/i.test(sql),'Destructive schema changes are forbidden');
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/d1/database/${database}/query`,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params:parameters})});
  const result=await response.json();
  assert(response.ok&&result.success&&result.result?.[0]?.success,`Native page upgrade query failed (${response.status}): ${result.errors?.[0]?.message??'D1 error'}`);
  return result.result[0];
 }};
 const db=new Kysely({dialect:nativeDialect(api)});
 try {console.log(JSON.stringify(await upgradeInstitutionalPages(db,{backup:async rows=>{if(rows.length){await mkdir('.emdash',{recursive:true});await writeFile(`.emdash/institutional-pages-before-${Date.now()}.json`,JSON.stringify(rows,null,2),{mode:0o600});}}}))); }finally{await db.destroy();}
}
