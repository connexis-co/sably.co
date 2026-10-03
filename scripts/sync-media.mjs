/** Global settings require native local media IDs. Copy immutable objects into dev R2. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Kysely } from 'kysely';
import { MediaRepository, OptionsRepository } from 'emdash';
export const byteHash=bytes=>createHash('sha256').update(bytes).digest('hex');
const keys={logo:'site:logo',favicon:'site:favicon',defaultOgImage:'site:seo'};
const extensions={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg','image/gif':'gif','image/avif':'avif','image/x-icon':'ico','image/vnd.microsoft.icon':'ico'};
const maximumSize=10*1024*1024;
function safeKey(key){assert(typeof key==='string'&&key&&!key.startsWith('/')&&!/[\\\x00-\x1f]/.test(key)&&key.split('/').every(part=>part&&part!=='.'&&part!=='..'),'Invalid R2 storage key');return key;}

export function createR2Transport({production,development,folder,run=spawnSync}){
 const assets=resolve(folder,'media');mkdirSync(assets,{recursive:true,mode:0o700});const records=[];
 const buckets={production:production.r2_buckets.find(item=>item.binding==='MEDIA').bucket_name,development:development.r2_buckets.find(item=>item.binding==='MEDIA').bucket_name};
 assert.notEqual(buckets.production,buckets.development,'R2 buckets must be isolated');
 function call(args){const result=run(process.execPath,['node_modules/wrangler/bin/wrangler.js','r2','object',...args],{encoding:'utf8',env:process.env,timeout:120000});assert.equal(result.status,0,'R2 transfer failed; credentials and command output are not logged');}
 function store(bytes){const sha256=byteHash(bytes),path=join(assets,`${sha256}.bin`);if(!existsSync(path))writeFileSync(path,bytes,{mode:0o600});assert.equal(byteHash(readFileSync(path)),sha256,'Local media backup integrity failed');return {sha256,path};}
 return {records,
  async read(side,key){assert(side==='production'||side==='development');safeKey(key);const temporary=join(assets,`download-${randomUUID()}`);try{call(['get',`${buckets[side]}/${key}`,'--remote','--file',temporary]);const bytes=readFileSync(temporary);assert(bytes.length>0&&bytes.length<=maximumSize,'Global media exceeds 10 MiB or is empty');const saved=store(bytes);records.push({operation:'read',side,storageKey:key,sha256:saved.sha256,size:bytes.length,localFile:`media/${saved.sha256}.bin`});return bytes;}finally{rmSync(temporary,{force:true});}},
  async write(key,bytes,mimeType){safeKey(key);assert(key.startsWith('sync-public/'),'Writes must use the immutable sync prefix');assert(extensions[mimeType],'Unsupported global image MIME type');const saved=store(bytes);assert(key===`sync-public/${saved.sha256}.${extensions[mimeType]}`,'Object key must match its content hash');call(['put',`${buckets.development}/${key}`,'--remote','--file',saved.path,'--content-type',mimeType]);records.push({operation:'write',side:'development',storageKey:key,sha256:saved.sha256,size:bytes.length});},
 };
}

export async function exportSettingsMedia(api,{transport,side}){
 const result={};
 for(const [key,name] of Object.entries(keys)){
  const options=await api.rows('SELECT value FROM options WHERE name = ?',[name]);let ref=options[0]?JSON.parse(options[0].value):null;if(key==='defaultOgImage')ref=ref?.defaultOgImage;
  if(!ref){result[key]=null;continue;}
  assert(typeof ref.mediaId==='string','Global media setting must contain a native mediaId');
  const [row]=await api.rows("SELECT id,filename,mime_type,size,width,height,alt,caption,storage_key FROM media WHERE id = ? AND status = 'ready'",[ref.mediaId]);
  assert(row,'Global media setting references a missing ready asset');assert(extensions[row.mime_type],'Unsupported global image MIME type');assert(row.size===null||row.size<=maximumSize,'Global media exceeds 10 MiB');safeKey(row.storage_key);
  assert(transport,'R2 transport is required to copy configured global media');
  const bytes=await transport.read(side,row.storage_key);assert(bytes.length>0&&bytes.length<=maximumSize,'Global media exceeds 10 MiB or is empty');
  result[key]={mediaId:row.id,storageKey:row.storage_key,filename:row.filename,mimeType:row.mime_type,size:bytes.length,width:row.width,height:row.height,alt:ref.alt??row.alt??null,caption:row.caption??null,sha256:byteHash(bytes)};
 }
 return result;
}
export function publicMediaIdentity(settings){return Object.fromEntries(Object.entries(settings).map(([key,asset])=>[key,asset?{sha256:asset.sha256,mimeType:asset.mimeType,size:asset.size,width:asset.width,height:asset.height,alt:asset.alt}:null]));}

export async function applySettingsMedia(settings,api,{transport,dialect,log=()=>{}}){
 const db=new Kysely({dialect});const media=new MediaRepository(db),options=new OptionsRepository(db);const mapped={};
 try {
  for(const [key,asset] of Object.entries(settings)){
   if(!asset){mapped[key]=null;continue;}
   const bytes=await transport.read('production',asset.storageKey);assert.equal(byteHash(bytes),asset.sha256,'Production media changed after its backup');
   const objectKey=`sync-public/${asset.sha256}.${extensions[asset.mimeType]}`;
   let existing=await media.findByContentHash(asset.sha256);let reused=Boolean(existing);
   if(existing?.storageKey!==objectKey){existing=null;reused=false;}
   if(!existing){
    await transport.write(objectKey,bytes,asset.mimeType);
    assert.equal(byteHash(await transport.read('development',objectKey)),asset.sha256,'R2 copied object integrity failed');
    existing=await media.create({filename:asset.filename,mimeType:asset.mimeType,size:asset.size,width:asset.width??undefined,height:asset.height??undefined,alt:asset.alt??undefined,caption:asset.caption??undefined,storageKey:objectKey,contentHash:asset.sha256,status:'ready'});
   }else assert.equal(byteHash(await transport.read('development',objectKey)),asset.sha256,'Existing synchronized object integrity failed');
   mapped[key]={mediaId:existing.id,...(asset.alt!==null?{alt:asset.alt}:{})};
   log({globalMedia:key,id:existing.id,storageKey:objectKey,sha256:asset.sha256,reused});
  }
  for(const key of ['logo','favicon']){if(mapped[key])await options.set(keys[key],mapped[key]);else await api.query('DELETE FROM options WHERE name = ?',[keys[key]]);}
  const seo=await options.get('site:seo')??{};delete seo.defaultOgImage;if(mapped.defaultOgImage)seo.defaultOgImage=mapped.defaultOgImage;await options.set('site:seo',seo);
  return mapped;
 }finally{await db.destroy();}
}
