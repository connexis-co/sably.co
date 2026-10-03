import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildSeed } from './emdash-content.mjs';
import { applyPublished, applyGlobals, assertSyncSql, readModel, modelFingerprint, snapshot, publicSnapshot, nativeDialect, validateSyncTargets, publicMedia } from './sync-content.mjs';
import { applySettingsMedia,byteHash } from './sync-media.mjs';
import { readTarget } from './environment-config.mjs';
import { canonicalJson } from '../src/lib/emdash-migration-guard.ts';

function sqliteApi(db, source) { return {
 async query(sql, params = []) {
  assertSyncSql(sql, params, { source });assert(params.length<=100,'D1 parameter limit');
  const stmt = db.prepare(sql);
  if (/^\s*(select|pragma)\b/i.test(sql) || /\breturning\b/i.test(sql)) return { results: stmt.all(...params), meta: { changes: db.prepare('SELECT changes() AS n').get().n } };
  const result = stmt.run(...params); return { results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
 }, async rows(sql, params = []) { return (await this.query(sql, params)).results; }
}; }

test('sync requires active, isolated production before credentials or requests', () => {
 const inactive=readTarget('production');inactive.vars.SABLY_CMS_READY='false';
 assert.throws(() => validateSyncTargets(inactive, readTarget('development')), /Production CMS is not ready/);
 const production = structuredClone(readTarget('production')); production.vars.SABLY_CMS_READY = 'true';
 assert.doesNotThrow(() => validateSyncTargets(production, readTarget('development')));
 production.d1_databases[0].database_id = readTarget('development').d1_databases[0].database_id;
 assert.throws(() => validateSyncTargets(production, readTarget('development')));
});
test('SQL boundary denies private data and every source mutation', () => {
 for (const sql of ['SELECT * FROM users','SELECT * FROM sessions','SELECT * FROM revisions','SELECT * FROM plugin_storage', 'DELETE FROM ec_courses','UPDATE ec_courses SET title = ?', 'SELECT * FROM ec_courses; SELECT * FROM users']) assert.throws(() => assertSyncSql(sql, [], { source: true }));
 assert.doesNotThrow(() => assertSyncSql('SELECT slug,title FROM ec_courses WHERE status = ?', ['published'], { source: true }));
 assert.doesNotThrow(() => assertSyncSql('SELECT data FROM revisions WHERE id = ?', ['draft'], { source: false }));
 assert.throws(() => assertSyncSql('SELECT value FROM options WHERE key = ?', ['auth:token']));
});
test('local media is converted to public URLs without storage credentials', () => {
 const result = publicMedia({ provider:'local',id:'local',meta:{storageKey:'courses/a photo.webp',secret:'excluded'},alt:'Curso' },'https://sably.co');
 assert.equal(result.provider,'external'); assert.equal(result.src,'https://sably.co/_emdash/api/media/file/courses/a%20photo.webp'); assert.equal(result.meta, undefined);
});

test('native sync replaces edits, retains a draft backup, unpublishes extras, and copies SEO and references', async () => {
 const temporary = await mkdtemp(join(tmpdir(), 'sably-sync-')); let source, destination;
 try {
  const { seed } = await buildSeed('full');
  // Small representative graph, with all production schema and block types.
  for (const [collection, entries] of Object.entries(seed.content)) seed.content[collection] = entries.slice(0, 1);
  const present = new Set(Object.values(seed.content).flat().map((entry) => `$ref:${entry.id}`));
  const fixture = JSON.parse(JSON.stringify(seed, (_key, value) => value?.$media ? { provider:'external',id:'fixture',src:value.$media.url } : Array.isArray(value) && value.every((item) => typeof item === 'string' && item.startsWith('$ref:')) ? value.filter((item) => present.has(item)) : value));
  fixture.content.courses[0].data.category_record = [`$ref:${fixture.content.categories[0].id}`];
  fixture.sections=[{slug:'home-hero',title:'Hero producción',content:[{_type:'block',_key:'hero',style:'normal',markDefs:[],children:[{_type:'span',_key:'text',text:'Contenido global de producción',marks:[]}]}]}];
  fixture.menus=[{name:'primary',label:'Menú principal',locale:'es',items:[{type:'page',label:'Página CMS',collection:'pages',ref:fixture.content.pages[0].id}]}];
  fixture.widgetAreas=[{name:'footer_after',label:'Después del pie',widgets:[{type:'menu',menuName:'primary',title:'Navegación'}]}];
  const seedFile = join(temporary,'seed.json'); await writeFile(seedFile,JSON.stringify(fixture));
  for (const name of ['source','destination']) execFileSync(process.execPath, [resolve('node_modules/emdash/dist/cli/index.mjs'),'seed',seedFile,'--database',join(temporary,`${name}.db`)], { cwd:temporary,stdio:'pipe',timeout:120000 });
  source = new DatabaseSync(join(temporary,'source.db')); destination = new DatabaseSync(join(temporary,'destination.db'));
  const sourceApi = sqliteApi(source,true), destinationApi = sqliteApi(destination,false);
  const sourceModel = await readModel(sourceApi), destinationModel = await readModel(destinationApi);
  assert.equal(modelFingerprint(sourceModel),modelFingerprint(destinationModel));
  const course = source.prepare('SELECT id,slug FROM ec_courses').get();
  const target = destination.prepare('SELECT id FROM ec_courses').get();
  source.prepare("INSERT INTO _emdash_seo(collection,content_id,seo_title,seo_description,seo_image,seo_canonical,seo_no_index) VALUES ('courses',?,'Título SEO','Descripción SEO','/seo.webp','/curso-canonical/',1)").run(course.id);
  const liveCategory = destination.prepare('SELECT slug,translation_group FROM ec_categories').get();
  const categoryColumns = destination.prepare('PRAGMA table_info(ec_categories)').all().map(row => row.name);
  const categoryValues = categoryColumns.map(column => column === 'id' ? "'draft-category-id'" : column === 'slug' ? "'draft-category'" : column === 'translation_group' ? "'draft-category-group'" : column === 'status' ? "'draft'" : ['live_revision_id','draft_revision_id'].includes(column) ? 'NULL' : `"${column}"`);
  destination.prepare(`INSERT INTO ec_categories (${categoryColumns.map(column => `"${column}"`).join(',')}) SELECT ${categoryValues.join(',')} FROM ec_categories LIMIT 1`).run();
  destination.prepare("INSERT INTO revisions(id,collection,entry_id,data,author_id) VALUES ('draft-fixture','courses',?,?,NULL)").run(target.id,JSON.stringify({
   title:'Borrador privado de desarrollo',source_body:'archivo excluido',
   _references:{category_record:['draft-category-group'],creator_record:[]},
   _referencesBaseline:{category_record:[liveCategory.translation_group],creator_record:[]},
  }));
  destination.prepare("UPDATE ec_courses SET title='Título desarrollo', draft_revision_id='draft-fixture'").run();
  // Extra page must leave public catalog, but its stored content remains recoverable.
  const columns = destination.prepare('PRAGMA table_info(ec_pages)').all().map((row) => row.name);
  const values = columns.map((column) => column === 'id' ? "'extra-page'" : column === 'slug' ? "'extra-page'" : column === 'translation_group' ? "'extra-group'" : column === 'live_revision_id' || column === 'draft_revision_id' ? 'NULL' : `"${column}"`);
  destination.prepare(`INSERT INTO ec_pages (${columns.map((c)=>`"${c}"`).join(',')}) SELECT ${values.join(',')} FROM ec_pages LIMIT 1`).run();
  destination.prepare("UPDATE _emdash_sections SET title='Cambio dev'").run();
  source.prepare("INSERT INTO options(name,value,revision) VALUES ('site:title', '\"Sably CMS\"', 'fixture') ON CONFLICT(name) DO UPDATE SET value=excluded.value").run();
  const objects={production:new Map(),development:new Map()},writes=[];
  const transport={async read(side,key){const bytes=objects[side].get(key);assert(bytes,`Missing fake R2 ${side}/${key}`);return bytes;},async write(key,bytes,mime){assert(key.startsWith('sync-public/'));assert.equal(mime,'image/svg+xml');assert(!objects.development.has(key),'Never overwrite a previous dev object');objects.development.set(key,bytes);writes.push(key);}};
  const insertMedia=(database,id,key,bytes)=>database.prepare("INSERT INTO media(id,filename,mime_type,size,width,height,alt,storage_key,status) VALUES (?,?,'image/svg+xml',?,32,32,'Marca',?,'ready')").run(id,'brand.svg',bytes.length,key);
  for(const [index,key] of ['logo','favicon','defaultOgImage'].entries()){
   const storageKey=`branding/${key}.svg`,bytes=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><text>${key}</text></svg>`),id=`source-${index}`;
   objects.production.set(storageKey,bytes);insertMedia(source,id,storageKey,bytes);
   const name=key==='defaultOgImage'?'site:seo':`site:${key}`,value=key==='defaultOgImage'?{titleSeparator:'·',defaultOgImage:{mediaId:id}}:{mediaId:id};
   source.prepare("INSERT INTO options(name,value,revision) VALUES (?,?,'fixture') ON CONFLICT(name) DO UPDATE SET value=excluded.value").run(name,JSON.stringify(value));
  }
  const oldBytes=Buffer.from('<svg>Desarrollo anterior</svg>');objects.development.set('legacy/dev-logo.svg',oldBytes);insertMedia(destination,'dev-logo','legacy/dev-logo.svg',oldBytes);
  destination.prepare("INSERT INTO options(name,value,revision) VALUES ('site:logo',?, 'fixture') ON CONFLICT(name) DO UPDATE SET value=excluded.value").run(JSON.stringify({mediaId:'dev-logo'}));
  const before = await snapshot(destinationApi,destinationModel,'https://dev.sably.co',{drafts:true,mediaTransport:transport,side:'development'});
  assert.equal(before.drafts.courses[0].data.title,'Borrador privado de desarrollo'); assert.equal(before.drafts.courses[0].data.source_body,undefined); assert(!JSON.stringify(before).includes('author_id'));
  const pendingDraft = before.drafts.courses[0];
  assert.deepEqual(before.seed.content.courses[0].data.category_record,[`$ref:categories:${liveCategory.slug}`]);
  assert.deepEqual(pendingDraft.data.category_record,['$ref:categories:draft-category']);
  assert.deepEqual(pendingDraft.stagedReferences,{category_record:['$ref:categories:draft-category'],creator_record:[]});
  assert.deepEqual(pendingDraft.referenceBaselines,{category_record:[`$ref:categories:${liveCategory.slug}`],creator_record:[]});
  assert.equal(pendingDraft.data._references,undefined);
  assert(!JSON.stringify(pendingDraft).includes('draft-category-group'));
  const backupFile = join(temporary,'development-before.json');
  await writeFile(backupFile,JSON.stringify(before),{mode:0o600});
  const backupHash = byteHash(Buffer.from(canonicalJson(before)));
  const restoredBackup = JSON.parse(await readFile(backupFile,'utf8'));
  assert.equal(byteHash(Buffer.from(canonicalJson(restoredBackup))),backupHash,'Backup read from disk retains its verified hash');
  assert.deepEqual(restoredBackup.drafts.courses[0].data.category_record,['$ref:categories:draft-category']);
  const exported = await snapshot(sourceApi,sourceModel,'https://sably.co',{mediaTransport:transport,side:'production'});
  const totals = await applyPublished(exported.seed,destinationModel,destinationApi,()=>{},exported.seo);
  await applyGlobals(exported.globals,destinationApi);
  await applySettingsMedia(exported.mediaSettings,destinationApi,{transport,dialect:nativeDialect(destinationApi)});
  assert.equal(totals.unpublished,1); assert.equal(totals.skipped,0);
  assert.equal(destination.prepare("SELECT status FROM ec_pages WHERE id='extra-page'").get().status,'draft');
  assert.deepEqual(publicSnapshot(await snapshot(destinationApi,destinationModel,'https://dev.sably.co',{mediaTransport:transport,side:'development'})),publicSnapshot(exported));
  assert.equal(destination.prepare('SELECT draft_revision_id FROM ec_courses').get().draft_revision_id,null);
  // A second pass changes no identities and leaves the public snapshot identical.
  const again = await applyPublished(exported.seed,destinationModel,destinationApi,()=>{},exported.seo);
  await applyGlobals(exported.globals,destinationApi);
  await applySettingsMedia(exported.mediaSettings,destinationApi,{transport,dialect:nativeDialect(destinationApi)});
  assert.equal(writes.length,3,'Second pass reuses native media identities and immutable objects');
  assert(objects.development.has('legacy/dev-logo.svg'),'Old media used by dev drafts is retained');
  assert.equal(before.mediaSettings.logo.sha256,byteHash(oldBytes));
  const currentLogo=JSON.parse(destination.prepare("SELECT value FROM options WHERE name='site:logo'").get().value);assert.notEqual(currentLogo.mediaId,'source-0');assert.notEqual(currentLogo.mediaId,'dev-logo');
  assert.equal(again.created,0); assert.equal(again.unpublished,0);
  assert.deepEqual(publicSnapshot(await snapshot(destinationApi,destinationModel,'https://dev.sably.co',{mediaTransport:transport,side:'development'})),publicSnapshot(exported));
 } finally { source?.close(); destination?.close(); await rm(temporary,{recursive:true,force:true}); }
});
