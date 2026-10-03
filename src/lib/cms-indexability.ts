import type {ContentSeo} from 'emdash';

/** A global course exclusion applies to all markets; a variant can narrow it further. */
export function courseSeo(parent?:ContentSeo, variant?:ContentSeo):ContentSeo|undefined {
 if(!parent&&!variant)return undefined;
 const overrides=Object.fromEntries(Object.entries(variant??{}).filter(([,value])=>value!==undefined&&value!==null));
 return {title:null,description:null,image:null,canonical:null,noIndex:false,...parent,...overrides,...(parent?.noIndex||variant?.noIndex?{noIndex:true}:{})};
}

/** Sitemap and hreflang must describe the same preferred, indexable URLs as the head. */
export function indexableAtPath(seo:ContentSeo|undefined,path:string,siteUrl:string):boolean {
 if(seo?.noIndex)return false;
 if(!seo?.canonical)return true;
 try {
  const canonical=new URL(seo.canonical,siteUrl),current=new URL(path,siteUrl);
  return ['https:','http:'].includes(canonical.protocol)&&canonical.href===current.href;
 }catch{return false;}
}
