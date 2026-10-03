import type { MediaReference, SiteSettings } from 'emdash';
import { cmsImageUrl } from './cms-media';
const keys=['title','tagline','url','postsPerPage','dateFormat','timezone','social','seo','logo','favicon'] as const;
interface SettingRow { name:string;value:string }
interface PublicMedia { id:string;storageKey:string;mimeType:string;width:number|null;height:number|null }
export interface SettingsReader { settings():Promise<SettingRow[]>;media(id:string):Promise<PublicMedia|null> }

/** Native getSiteSettings caches for the isolate lifetime. Public templates require
 * fresh content after a CMS edit/sync, so only this request's readers share data. */
export function createRequestSettingsLoader(reader:SettingsReader){
 const requests=new WeakMap<object,Promise<Partial<SiteSettings>>>();
 async function load():Promise<Partial<SiteSettings>>{
  const settings:Record<string,unknown>={};
  for(const row of await reader.settings()){const key=row.name.replace(/^site:/,'');if(keys.includes(key as typeof keys[number]))settings[key]=JSON.parse(row.value);}
  async function resolve(value:unknown):Promise<MediaReference|undefined>{
   if(!value||typeof value!=='object'||typeof (value as MediaReference).mediaId!=='string')return undefined;
   const reference=value as MediaReference,media=await reader.media(reference.mediaId);if(!media)return {mediaId:reference.mediaId,...(reference.alt?{alt:reference.alt}:{})};
   const url=cmsImageUrl({provider:'local',id:media.id,meta:{storageKey:media.storageKey}});
   return {mediaId:reference.mediaId,...(reference.alt?{alt:reference.alt}:{}),...(url?{url}:{}),contentType:media.mimeType,...(media.width!==null?{width:media.width}:{}),...(media.height!==null?{height:media.height}:{})};
  }
  const seo=settings.seo&&typeof settings.seo==='object'?settings.seo as SiteSettings['seo']:undefined;
  const [logo,favicon,defaultOgImage]=await Promise.all([resolve(settings.logo),resolve(settings.favicon),resolve(seo?.defaultOgImage)]);
  if(settings.logo)settings.logo=logo;if(settings.favicon)settings.favicon=favicon;
  if(seo?.defaultOgImage)settings.seo={...seo,defaultOgImage};
  return settings as Partial<SiteSettings>;
 }
 return (context?:object):Promise<Partial<SiteSettings>>=>{if(!context)return load();if(!requests.has(context))requests.set(context,load());return requests.get(context)!;};
}
const getSettings=createRequestSettingsLoader({
 async settings(){const {getDb}=await import('emdash/runtime');return (await getDb()).selectFrom('options').select(['name','value']).where('name','in',keys.map(key=>`site:${key}`)).execute();},
 async media(id){const [{getDb},{MediaRepository}]=await Promise.all([import('emdash/runtime'),import('emdash')]);return new MediaRepository(await getDb()).findById(id);},
});
export async function getLiveSiteSettings(){const {getRequestContext}=await import('emdash/request-context');return getSettings(getRequestContext()??undefined);}
