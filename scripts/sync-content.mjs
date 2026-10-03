#!/usr/bin/env node
/** Copy published editorial content from production to development. Never writes to production. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Kysely, SqliteAdapter, SqliteQueryCompiler, SqliteIntrospector } from 'kysely';
import { applySeed, validateSeed } from 'emdash/seed';
import { ContentRepository, OptionsRepository } from 'emdash';
import { createR2Transport,exportSettingsMedia,applySettingsMedia,publicMediaIdentity } from './sync-media.mjs';
import { readTarget, validateTarget } from './environment-config.mjs';
import { reconcileDevelopmentCatalog } from './sync-catalog.mjs';
import { MIGRATION_COLLECTIONS, canonicalJson, normalizedStoredValue } from '../src/lib/emdash-migration-guard.ts';

const knownCollections = new Set(MIGRATION_COLLECTIONS);
const hash = (value) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const quote = (value) => { assert.match(value, /^[a-z][a-z0-9_]*$/); return `"${value}"`; };
const archiveField = (slug) => slug.startsWith('source_') || slug === 'generation_metadata';
const safeSystem = ['id', 'slug', 'locale', 'status', 'translation_group'];
const jsonTypes = new Set(['json', 'portableText', 'repeater', 'blocks', 'multiSelect', 'image', 'file']);
const mediaSettingNames = ['site:logo','site:favicon'];
const editorialSettings = ['title','tagline','postsPerPage','dateFormat','timezone','social','seo'];
const globalTables = ['_emdash_sections','_emdash_menus','_emdash_menu_items','_emdash_widget_areas','_emdash_widgets'];
const supportReads = new Set([...globalTables, '_emdash_collections', '_emdash_fields', '_emdash_relations', '_emdash_block_types', '_emdash_block_type_fields', '_emdash_block_type_versions', '_emdash_content_references', '_emdash_seo', 'media']);
const nativeTables = new Set([...supportReads, 'revisions', '_emdash_revision_prune_queue', '_emdash_media_usage_index_status', '_emdash_bylines', '_emdash_content_bylines', 'content_taxonomies', '_emdash_routes', '_emdash_route_artifacts', '_emdash_route_dirty', '_emdash_media_usage', '_emdash_media_usage_state', '_emdash_content_media_usage', '_emdash_content_media_usage_collections', '_emdash_object_cache_epochs']);

export function validateSyncTargets(production, development) {
  assert.equal(production.vars?.SABLY_CMS_READY, 'true', 'Production CMS is not ready: keep sync disabled until the reviewed production cutover');
  validateTarget('development', development, development);
  validateTarget('production', production, development);
  assert.notEqual(production.d1_databases.find((db) => db.binding === 'DB').database_id, development.d1_databases.find((db) => db.binding === 'DB').database_id);
}

export function assertSyncSql(sql, parameters = [], { source = false } = {}) {
  assert(!/;\s*\S/.test(sql) && !/--|\/\*/.test(sql), 'Only one generated SQL statement is allowed');
  const read = /^\s*(SELECT|PRAGMA)\b/i.test(sql);
  if (source) assert(read, 'Production is read-only');
  assert(!/\b(users|sessions|passkeys|api_tokens|auth_tokens|leads|orders|ventas|credentials|plugin_storage)\b/i.test(sql), 'Private tables are outside editorial sync');
  if (/\b["`]?options["`]?\b/i.test(sql)) {
    if(source)assert(/^SELECT value FROM options WHERE name = \?$/.test(sql)&&parameters.length===1,'Only explicit public setting values may be read');
    assert(parameters.some(value => typeof value === 'string' && (mediaSettingNames.includes(value)||editorialSettings.some(key => value === `site:${key}`))), 'Only whitelisted editorial settings may be accessed');
    assert(!/LIKE|OR\s+1/i.test(sql), 'Settings prefix scans are forbidden');
  }
  const tables = [...sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+["`]?([a-z_][a-z0-9_]*)["`]?/gi)].map((match) => match[1].toLowerCase()).filter((table) => table !== 'set');
  if (/^\s*PRAGMA\b/i.test(sql)) {
    assert(/^\s*PRAGMA table_info\("ec_[a-z_]+"\)\s*$/i.test(sql), 'Only editorial column introspection is allowed');
    const name = sql.match(/ec_([a-z_]+)/)[1]; assert(knownCollections.has(name));
    return;
  }
  assert(tables.length, 'SQL must name an editorial table');
  for (const table of tables) {
    if (table === 'options') continue;
    if (table.startsWith('ec_')) assert(knownCollections.has(table.slice(3)), 'Unknown editorial collection');
    else if (table.startsWith('fts_')) assert(!source && knownCollections.has(table.slice(4)), 'Unknown editorial search index');
    else assert((source ? supportReads : nativeTables).has(table), `Table ${table} is outside editorial sync`);
  }
}

export class D1Api {
  constructor(config, token, source, fetcher = fetch) {
    assert(token, 'CLOUDFLARE_API_TOKEN is required');
    this.url = `https://api.cloudflare.com/client/v4/accounts/${config.account_id}/d1/database/${config.d1_databases.find((db) => db.binding === 'DB').database_id}/query`;
    this.token = token; this.source = source; this.fetcher = fetcher;
  }
  async query(sql, parameters = []) {
    assertSyncSql(sql, parameters, { source: this.source });
    assert(parameters.length<=100,'D1 supports at most 100 bound parameters per statement');
    const response = await this.fetcher(this.url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params: parameters }),
    });
    assert(response.ok, `D1 sync request failed: HTTP ${response.status}`);
    const payload = await response.json();
    assert(payload.success && payload.result?.length === 1 && payload.result[0].success, 'D1 sync query failed; no request payload or credentials are logged');
    return payload.result[0];
  }
  async rows(sql, parameters = []) { return (await this.query(sql, parameters)).results; }
}

export function nativeDialect(api) {
  const connection = { async executeQuery(query) {
    const result = await api.query(query.sql, query.parameters.map((value) => typeof value === 'boolean' ? Number(value) : value));
    return { rows: result.results ?? [], numAffectedRows: BigInt(result.meta?.changes ?? 0), ...(result.meta?.last_row_id ? { insertId: BigInt(result.meta.last_row_id) } : {}) };
  }, async *streamQuery() { throw new Error('Streaming is not supported'); } };
  return {
    createAdapter: () => new SqliteAdapter(), createQueryCompiler: () => new SqliteQueryCompiler(), createIntrospector: (db) => new SqliteIntrospector(db),
    createDriver: () => ({ init: async () => {}, acquireConnection: async () => connection, releaseConnection: async () => {}, destroy: async () => {},
      beginTransaction: async () => { throw new Error('Transactions are not supported'); }, commitTransaction: async () => { throw new Error('Transactions are not supported'); }, rollbackTransaction: async () => { throw new Error('Transactions are not supported'); } }),
  };
}

export async function readModel(api) {
  const model = {};
  for (const collection of MIGRATION_COLLECTIONS) {
    const rows = await api.rows('SELECT id,slug FROM _emdash_collections WHERE slug = ?', [collection]);
    assert.equal(rows.length, 1, `Collection ${collection} must exist in both CMS databases`);
    const fields = await api.rows('SELECT slug,type,required,validation FROM _emdash_fields WHERE collection_id = ? ORDER BY slug', [rows[0].id]);
    const columns = await api.rows(`PRAGMA table_info("ec_${collection}")`);
    model[collection] = { fields: fields.map((field) => ({ ...field, validation: normalizedStoredValue(field.validation) })), columns: columns.map((column) => ({ name: column.name, type: column.type })).sort((a, b) => a.name.localeCompare(b.name)) };
  }
  const relations = await api.rows('SELECT id,slug,parent_collection,child_collection FROM _emdash_relations ORDER BY slug');
  const blocks=await api.rows('SELECT b.slug,b.current_version,v.version,v.fingerprint FROM _emdash_block_types AS b INNER JOIN _emdash_block_type_versions AS v ON v.block_type_id = b.id ORDER BY b.slug,v.version');
  return { collections: model, relations,blocks };
}

export function modelFingerprint(model) {
  return hash({ collections: model.collections,blocks:model.blocks, relations: model.relations.map(({ id: _id, ...relation }) => relation) });
}

export function publicMedia(value, origin) {
  if (Array.isArray(value)) return value.map((child) => publicMedia(child, origin));
  if (!value || typeof value !== 'object') return value;
  if (value.provider === 'local' && typeof value.meta?.storageKey === 'string') {
    const path = value.meta.storageKey.split('/').map(encodeURIComponent).join('/');
    return { provider: 'external', id: `public-${hash(value.meta.storageKey).slice(0, 26)}`, src: `${origin}/_emdash/api/media/file/${path}`,
      ...(value.alt !== undefined ? { alt: value.alt } : {}), ...(value.width ? { width: value.width } : {}), ...(value.height ? { height: value.height } : {}), ...(value.mimeType ? { mimeType: value.mimeType } : {}) };
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, publicMedia(child, origin)]));
}

export async function exportPublished(api, model, origin) {
  const content = {}, identities = new Map();
  for (const collection of MIGRATION_COLLECTIONS) {
    const definition = model.collections[collection];
    const columnNames = new Set(definition.columns.map((column) => column.name));
    const fields = definition.fields.filter((field) => !archiveField(field.slug) && columnNames.has(field.slug));
    const selected = [...safeSystem, ...fields.map((field) => field.slug)];
    const entries = [];
    let lastId = '';
    while (true) {
      const rows = await api.rows(`SELECT ${selected.map(quote).join(',')} FROM ec_${collection} WHERE status = 'published' AND deleted_at IS NULL AND id > ? ORDER BY id LIMIT 50`, [lastId]);
      for (const row of rows) {
        assert.equal(row.locale, 'es', 'Additional locales need an explicit sync mapping');
        const data = Object.fromEntries(fields.map((field) => {
          let value = row[field.slug];
          if (jsonTypes.has(field.type)) value = normalizedStoredValue(value);
          if (field.type === 'boolean' && value !== null) value = Boolean(value);
          return [field.slug, publicMedia(value, origin)];
        }));
        const entry = { id: `${collection}:${row.slug}`, slug: row.slug, locale: row.locale, status: 'published', data };
        entries.push(entry);
        identities.set(row.translation_group, { collection, slug: row.slug, id: row.id, entry });
      }
      if (rows.length < 50) break;
      lastId = rows.at(-1).id;
    }
    content[collection] = entries.sort((a, b) => a.slug.localeCompare(b.slug));
  }
  for (const [collection, definition] of Object.entries(model.collections)) {
    for (const field of definition.fields.filter((field) => field.type === 'reference' && field.validation?.relation)) {
      const relation = model.relations.find((item) => item.slug === field.validation.relation);
      assert(relation && relation.parent_collection === collection && knownCollections.has(relation.child_collection), 'Unsupported relation in editorial sync');
      for (const entry of content[collection]) entry.data[field.slug] = [];
      const links = await api.rows('SELECT parent_group,child_group,sort_order FROM _emdash_content_references WHERE relation_id = ? ORDER BY parent_group,sort_order,id', [relation.id]);
      for (const link of links) {
        const parent = identities.get(link.parent_group), child = identities.get(link.child_group);
        if (!parent) continue;
        assert(child && child.collection === relation.child_collection, 'Published content references unpublished content; resolve it before syncing');
        parent.entry.data[field.slug].push(`$ref:${child.collection}:${child.slug}`);
      }
    }
  }
  return { version: '1', defaultLocale: 'es', content };
}

/** Includes only editorial draft payloads, never author IDs or production revisions. */
export async function exportDevelopmentDrafts(api, model) {
  const result = {};
  for (const collection of MIGRATION_COLLECTIONS) {
    const allowed = new Set(model.collections[collection].fields.filter((f) => !archiveField(f.slug)).map((f) => f.slug));
    const fields = model.collections[collection].fields.filter((f) => allowed.has(f.slug) && model.collections[collection].columns.some((c) => c.name === f.slug));
    const rows = await api.rows(`SELECT slug,locale,status,translation_group,deleted_at,draft_revision_id,${fields.map((f) => quote(f.slug)).join(',')} FROM ec_${collection} WHERE status != 'published' OR deleted_at IS NOT NULL OR draft_revision_id IS NOT NULL ORDER BY slug`);
    result[collection] = [];
    for (const row of rows) {
      const stored = row.draft_revision_id ? await api.rows('SELECT data FROM revisions WHERE id = ? AND collection = ?', [row.draft_revision_id, collection]) : [];
      assert(!row.draft_revision_id || stored.length === 1, 'Draft revision is missing; refuse an incomplete development backup');
      const data = stored[0] ? normalizedStoredValue(stored[0].data) : Object.fromEntries(fields.map((f) => [f.slug, jsonTypes.has(f.type) ? normalizedStoredValue(row[f.slug]) : f.type === 'boolean' ? Boolean(row[f.slug]) : row[f.slug]]));
      const stagedReferences = {}, referenceBaselines = {};
      // EmDash 1.1 stages selections as translation groups in revision metadata;
      // reference edges contain only the live selection. Keep empty selections
      // (an intentional removal) and their baseline, without exporting raw IDs.
      for (const key of ['_references', '_referencesBaseline']) {
        assert(data[key] === undefined || data[key] && typeof data[key] === 'object' && !Array.isArray(data[key]), 'Invalid staged reference metadata');
      }
      for (const field of model.collections[collection].fields.filter(field => field.type === 'reference')) {
        const relation = model.relations.find(item => item.slug === field.validation?.relation);
        const childSide = field.validation?.relationSide === 'child';
        const targetCollection = childSide ? relation?.parent_collection : relation?.child_collection;
        assert(relation && knownCollections.has(targetCollection), 'Unknown draft reference relation');
        assert.equal(childSide ? relation.child_collection : relation.parent_collection, collection, 'Draft reference is bound to a different collection');
        const resolveGroups = async groups => {
          assert(Array.isArray(groups) && groups.every(group => typeof group === 'string'), 'Invalid staged reference selection');
          const references = [];
          for (const group of groups) {
            // Drafts may intentionally point at another draft or trashed item.
            const targets = await api.rows(`SELECT slug FROM ec_${targetCollection} WHERE translation_group = ? AND locale = ?`, [group, row.locale]);
            assert.equal(targets.length, 1, 'Staged reference target is missing; refuse an incomplete development backup');
            references.push(`$ref:${targetCollection}:${targets[0].slug}`);
          }
          return references;
        };
        if (Object.hasOwn(data._references ?? {}, field.slug)) {
          stagedReferences[field.slug] = await resolveGroups(data._references[field.slug]);
          data[field.slug] = stagedReferences[field.slug];
        } else {
          const targetColumn = childSide ? 'parent_group' : 'child_group';
          const ownerColumn = childSide ? 'child_group' : 'parent_group';
          const links = await api.rows(`SELECT target.slug FROM _emdash_content_references AS edge INNER JOIN ec_${targetCollection} AS target ON target.translation_group = edge.${targetColumn} WHERE edge.relation_id = ? AND edge.${ownerColumn} = ? AND target.locale = ? ORDER BY edge.sort_order,edge.id`, [relation.id, row.translation_group, row.locale]);
          data[field.slug] = links.map(item => `$ref:${targetCollection}:${item.slug}`);
        }
        if (Object.hasOwn(data._referencesBaseline ?? {}, field.slug)) referenceBaselines[field.slug] = await resolveGroups(data._referencesBaseline[field.slug]);
      }
      result[collection].push({ slug: row.slug, locale: row.locale, status: row.status, trashed: Boolean(row.deleted_at),
        data: Object.fromEntries(Object.entries(data).filter(([key]) => allowed.has(key))),
        ...(Object.keys(stagedReferences).length ? { stagedReferences } : {}),
        ...(Object.keys(referenceBaselines).length ? { referenceBaselines } : {}),
      });
    }
  }
  return result;
}

export async function exportSeo(api, model, origin) {
  const seo = {};
  for (const collection of MIGRATION_COLLECTIONS) {
    const rows = await api.rows(`SELECT c.slug,s.seo_title,s.seo_description,s.seo_image,s.seo_canonical,s.seo_no_index FROM ec_${collection} AS c LEFT JOIN _emdash_seo AS s ON s.collection = ? AND s.content_id = c.id WHERE c.status = 'published' AND c.deleted_at IS NULL ORDER BY c.slug`, [collection]);
    seo[collection] = Object.fromEntries(rows.map((r) => [r.slug, { title: r.seo_title ?? null, description: r.seo_description ?? null, image: r.seo_image?.startsWith('/') ? new URL(r.seo_image, origin).href : r.seo_image ?? null, canonical: r.seo_canonical ?? null, noIndex: Boolean(r.seo_no_index) }]));
  }
  return seo;
}

export async function exportGlobals(api, origin) {
  const sections=(await api.rows('SELECT slug,title,description,keywords,content,source FROM _emdash_sections ORDER BY slug')).map(row=>({slug:row.slug,title:row.title,...(row.description?{description:row.description}:{}),keywords:normalizedStoredValue(row.keywords)??[],content:publicMedia(normalizedStoredValue(row.content),origin),source:row.source}));
  const menus=[];
  for(const menu of await api.rows('SELECT id,name,label,locale FROM _emdash_menus ORDER BY name,locale')){
    assert.equal(menu.locale,'es','Additional menu locales need an explicit mapping');
    const rows=await api.rows('SELECT id,parent_id,type,label,custom_url,reference_collection,reference_id,target,title_attr,css_classes,sort_order FROM _emdash_menu_items WHERE menu_id = ? ORDER BY sort_order,id',[menu.id]);
    async function children(parentId){return Promise.all(rows.filter(row=>row.parent_id===parentId).map(async row=>{
      let reference;
      if(row.reference_id){assert(knownCollections.has(row.reference_collection),'Menu references must target a public collection');const target=await api.rows(`SELECT slug FROM ec_${row.reference_collection} WHERE translation_group = ? AND locale = 'es' AND status = 'published' AND deleted_at IS NULL`,[row.reference_id]);assert.equal(target.length,1,'Menu reference must be published');reference={collection:row.reference_collection,slug:target[0].slug};}
      const nested=await children(row.id);
      return {type:row.type,label:row.label,...(row.custom_url?{url:row.custom_url}:{}),...(reference?{reference}:{}),...(row.reference_collection&&!reference?{collection:row.reference_collection}:{}),...(row.target?{target:row.target}:{}),...(row.title_attr?{titleAttr:row.title_attr}:{}),...(row.css_classes?{cssClasses:row.css_classes}:{}),...(nested.length?{children:nested}:{})};
    }));}
    menus.push({name:menu.name,label:menu.label,locale:menu.locale,items:await children(null)});
  }
  const widgetAreas=[];
  for(const area of await api.rows('SELECT id,name,label,description FROM _emdash_widget_areas ORDER BY name')){
    const rows=await api.rows('SELECT type,title,content,menu_name,component_id,component_props FROM _emdash_widgets WHERE area_id = ? ORDER BY sort_order,id',[area.id]);
    widgetAreas.push({name:area.name,label:area.label,...(area.description?{description:area.description}:{}),widgets:rows.map(row=>({type:row.type,...(row.title?{title:row.title}:{}),...(row.content?{content:publicMedia(normalizedStoredValue(row.content),origin)}:{}),...(row.menu_name?{menuName:row.menu_name}:{}),...(row.component_id?{componentId:row.component_id}:{}),...(row.component_props?{props:normalizedStoredValue(row.component_props)}:{})}))});
  }
  const settings={seo:{}};
  for(const key of editorialSettings){const rows=await api.rows('SELECT value FROM options WHERE name = ?',[`site:${key}`]);if(!rows.length)continue;let value=JSON.parse(rows[0].value);if(key==='seo')value=Object.fromEntries(['titleSeparator','robotsTxt','googleVerification','bingVerification'].filter(name=>typeof value?.[name]==='string').map(name=>[name,value[name]]));if(key==='social')value=Object.fromEntries(['twitter','github','facebook','instagram','linkedin','youtube'].filter(name=>typeof value?.[name]==='string').map(name=>[name,value[name]]));settings[key]=value;}
  return {sections,menus,widgetAreas,settings};
}

export async function applyGlobals(globals, destinationApi) {
 const db=new Kysely({dialect:nativeDialect(destinationApi)});
 try {
  const seedItems=items=>items.map(({reference,...item})=>({...item,...(reference?{ref:`${reference.collection}:${reference.slug}`,collection:reference.collection}:{}),...(item.children?{children:seedItems(item.children)}:{})}));
  const globalsSeed={version:'1',defaultLocale:'es',sections:globals.sections,menus:globals.menus.map(menu=>({...menu,items:seedItems(menu.items)})),widgetAreas:globals.widgetAreas};
  await applySeed(db,globalsSeed,{includeContent:true,onConflict:'update'});
  // Seed replaces items but intentionally leaves menu/area labels untouched; copy
  // these editorial fields too, and remap native menu references by translation group.
  for(const menu of globals.menus){
   const [stored]=await destinationApi.rows('SELECT id FROM _emdash_menus WHERE name = ? AND locale = ?',[menu.name,menu.locale]);
   await destinationApi.query('UPDATE _emdash_menus SET label = ? WHERE id = ?',[menu.label,stored.id]);
   async function remap(items,parentId){
    const rows=await destinationApi.rows('SELECT id FROM _emdash_menu_items WHERE menu_id = ? AND parent_id IS ? ORDER BY sort_order,id',[stored.id,parentId]);assert.equal(rows.length,items.length);
    for(let index=0;index<items.length;index++){const item=items[index],row=rows[index];if(item.reference){const target=item.reference;assert(knownCollections.has(target.collection));const [entry]=await destinationApi.rows(`SELECT translation_group FROM ec_${target.collection} WHERE slug = ? AND locale = 'es' AND status = 'published' AND deleted_at IS NULL`,[target.slug]);assert(entry,'Missing copied menu reference');await destinationApi.query('UPDATE _emdash_menu_items SET reference_collection = ?,reference_id = ? WHERE id = ?',[target.collection,entry.translation_group,row.id]);}await remap(item.children??[],row.id);}
   }
   await remap(menu.items,null);
  }
  for(const area of globals.widgetAreas)await destinationApi.query('UPDATE _emdash_widget_areas SET label = ?,description = ? WHERE name = ?',[area.label,area.description??null,area.name]);
  for(const [table,key,expected] of [['_emdash_sections','slug',globals.sections.map(item=>item.slug)],['_emdash_menus','name',globals.menus.map(item=>item.name)],['_emdash_widget_areas','name',globals.widgetAreas.map(item=>item.name)]]){
   const rows=await destinationApi.rows(`SELECT id,${key} FROM ${table}`);
   for(const row of rows)if(!expected.includes(row[key]))await destinationApi.query(`DELETE FROM ${table} WHERE id = ?`,[row.id]);
  }
  const options=new OptionsRepository(db);
  for(const key of editorialSettings){
   let value=globals.settings[key];
   if(key==='seo'){const stored=await options.get('site:seo');value={...(value??{}),...(stored?.defaultOgImage?{defaultOgImage:stored.defaultOgImage}:{})};}
   if(value===undefined)await destinationApi.query('DELETE FROM options WHERE name = ?',[`site:${key}`]);else await options.set(`site:${key}`,value);
  }
 }finally{await db.destroy();}
}

export async function snapshot(api, model, origin, { drafts = false,mediaTransport,side } = {}) {
  return { mediaSettings:await exportSettingsMedia(api,{transport:mediaTransport,side}),globals:await exportGlobals(api,origin), seed: await exportPublished(api, model, origin), seo: await exportSeo(api, model, origin), ...(drafts ? { drafts: await exportDevelopmentDrafts(api, model) } : {}) };
}

export async function applyPublished(seed, model, destinationApi, log = () => {}, seo = {}) {
  const db = new Kysely({ dialect: nativeDialect(destinationApi) });
  const repo = new ContentRepository(db);
  const total = { created: 0, updated: 0, skipped: 0, unpublished: 0 };
  try {
    for (const collection of MIGRATION_COLLECTIONS) {
      const existing=await destinationApi.rows(`SELECT id,slug,deleted_at FROM ec_${collection} WHERE locale = 'es'`);
      const bySlug=new Map(existing.map(row=>[row.slug,row]));
      const referenceFields=model.collections[collection].fields.filter(field=>field.type==='reference');
      const targets=new Map();
      for(const field of referenceFields){const relation=model.relations.find(item=>item.slug===field.validation?.relation);assert(relation&&knownCollections.has(relation.child_collection));if(!targets.has(relation.child_collection)){const rows=await destinationApi.rows(`SELECT id,slug FROM ec_${relation.child_collection} WHERE locale = 'es' AND status = 'published' AND deleted_at IS NULL`);targets.set(relation.child_collection,new Map(rows.map(row=>[row.slug,row.id])));}}
      const entries=[];
      for(const entry of seed.content[collection]){
        if(bySlug.get(entry.slug)?.deleted_at)await repo.restore(collection,bySlug.get(entry.slug).id);
        const data=structuredClone(entry.data);
        for(const field of referenceFields)data[field.slug]=(data[field.slug]??[]).map(ref=>{const [target,...parts]=ref.slice(5).split(':');const id=targets.get(target)?.get(parts.join(':'));assert(id,'Sync dependency must be published in development');return id;});
        entries.push({...entry,data});
      }
      log({collection,started:entries.length});
      const result=await applySeed(db,{version:'1',defaultLocale:'es',content:{[collection]:entries}},{includeContent:true,onConflict:'update'});
      assert.equal(result.content.skipped,0,'Native importer skipped an entry');
      for(const key of ['created','updated','skipped'])total[key]+=result.content[key];
      const ids=new Map((await destinationApi.rows(`SELECT id,slug FROM ec_${collection} WHERE locale = 'es' AND status = 'published' AND deleted_at IS NULL`)).map(row=>[row.slug,row.id]));
      for(const entry of entries)if(seo[collection]?.[entry.slug]){
        const value=seo[collection][entry.slug],now=new Date().toISOString();
        // Native SEO storage is pinned to EmDash 1.1 and covered by SQLite tests.
        await destinationApi.query('INSERT INTO _emdash_seo (collection,content_id,seo_title,seo_description,seo_image,seo_canonical,seo_no_index,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(collection,content_id) DO UPDATE SET seo_title=excluded.seo_title,seo_description=excluded.seo_description,seo_image=excluded.seo_image,seo_canonical=excluded.seo_canonical,seo_no_index=excluded.seo_no_index,updated_at=excluded.updated_at',[collection,ids.get(entry.slug),value.title,value.description,value.image,value.canonical,Number(value.noIndex),now,now]);
      }
      log({collection,...result.content});
    }
    // Reverse dependency order: remove children from the public copy first. Native
    // unpublish preserves their drafts and historical revisions for recovery.
    for (const collection of [...MIGRATION_COLLECTIONS].reverse()) {
      const published = await destinationApi.rows(`SELECT id,slug FROM ec_${collection} WHERE status = 'published' AND deleted_at IS NULL`);
      const expected = new Set(seed.content[collection].map((entry) => entry.slug));
      for (const entry of published.filter((entry) => !expected.has(entry.slug))) {
        await repo.unpublish(collection, entry.id); total.unpublished++;
        log({ collection, slug: entry.slug, unpublished: true });
      }
    }
    return total;
  } finally { await db.destroy(); }
}

export function publicSnapshot(value){return {...value,mediaSettings:publicMediaIdentity(value.mediaSettings)};}
export async function main(args = process.argv.slice(2)) {
  assert(args.every((arg) => ['--dry-run', '--execute'].includes(arg)), 'Usage: sync-content.mjs [--dry-run|--execute]');
  assert(!(args.includes('--dry-run') && args.includes('--execute')), 'Choose either --dry-run or --execute');
  const production = readTarget('production'), development = readTarget('development');
  validateSyncTargets(production, development); // Fail closed before reading credentials or making any request.
  const productionApi = new D1Api(production, process.env.CLOUDFLARE_API_TOKEN, true);
  const developmentApi = new D1Api(development, process.env.CLOUDFLARE_API_TOKEN, false);
  const sourceModel = await readModel(productionApi), destinationModel = await readModel(developmentApi);
  assert.equal(modelFingerprint(sourceModel), modelFingerprint(destinationModel), 'CMS schemas differ; deploy the matching model before content sync');
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = join('.emdash', 'sync', runId); await mkdir(folder, { recursive: true, mode: 0o700 });
  const mediaTransport=createR2Transport({production,development,folder});
  const source = await snapshot(productionApi, sourceModel, 'https://sably.co',{mediaTransport,side:'production'});
  const seed = source.seed;
  assert(seed.content.courses.length && seed.content.countries.length && seed.content.categories.length,'Refuse an empty production catalog');
  const validation = validateSeed(seed); assert(validation.valid, 'Published export is not a valid EmDash seed');
  const backup = await snapshot(developmentApi, destinationModel, 'https://dev.sably.co', { drafts: true,mediaTransport,side:'development' });
  const digest = hash(publicSnapshot(source)), backupDigest = hash(backup);
  await writeFile(join(folder, 'production-published.json'), `${JSON.stringify(source, null, 2)}\n`, { mode: 0o600 });
  await writeFile(join(folder, 'development-before.json'), `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });
  const report = { mode: args.includes('--execute') ? 'execute' : 'dry-run', source: 'production', destination: 'development', schemaHash: modelFingerprint(sourceModel), sourceHash: digest, backupHash: backupDigest, counts: Object.fromEntries(Object.entries(seed.content).map(([name, entries]) => [name, entries.length])), media: 'public field URLs; global images copied to immutable dev R2 keys', folder };
  await writeFile(join(folder, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  assert.equal(hash(JSON.parse(await readFile(join(folder,'development-before.json'),'utf8'))),backupDigest,'Stored backup integrity check failed');
  console.log(JSON.stringify(report, null, 2));
  await writeFile(join(folder,'media-transfers.json'),`${JSON.stringify(mediaTransport.records,null,2)}\n`,{mode:0o600});
  if (!args.includes('--execute')) return;
  assert.equal(hash(publicSnapshot(await snapshot(productionApi, sourceModel, 'https://sably.co',{mediaTransport,side:'production'}))), digest, 'Production changed during export; run again');
  assert.equal(hash(await snapshot(developmentApi, destinationModel, 'https://dev.sably.co', { drafts: true,mediaTransport,side:'development' })), backupDigest, 'Development changed during backup; run again');
  const events = [];
  try {
    report.completed = await applyPublished(seed, destinationModel, developmentApi, (event) => events.push(event), source.seo);
    await applyGlobals(source.globals,developmentApi);
    await applySettingsMedia(source.mediaSettings,developmentApi,{transport:mediaTransport,dialect:nativeDialect(developmentApi),log:event=>events.push(event)});
    const verified = await snapshot(developmentApi, destinationModel, 'https://dev.sably.co',{mediaTransport,side:'development'});
    report.afterHash = hash(publicSnapshot(verified));
    assert.equal(report.afterHash, digest, 'Post-sync editorial integrity failure; inspect the backup and event log before retrying');
    // Native CLI imports do not emit runtime plugin hooks. Rebuild only the
    // public operational lookup from the verified development CMS, never prod ops.
    events.push({ phase: 'development-catalog', started: true });
    report.catalog = await reconcileDevelopmentCatalog(development, process.env.CLOUDFLARE_API_TOKEN);
    events.push({ phase: 'development-catalog', ...report.catalog });
    report.verified = true;
  } finally {
    await writeFile(join(folder,'media-transfers.json'),`${JSON.stringify(mediaTransport.records,null,2)}\n`,{mode:0o600});
    await writeFile(join(folder, 'events.json'), `${JSON.stringify(events, null, 2)}\n`, { mode: 0o600 });
    await writeFile(join(folder, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(JSON.stringify({ completed: report.completed, verified: report.verified, folder }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
