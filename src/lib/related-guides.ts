import type {BlogPost,RichBlock} from './emdash-content';
import {indexableAtPath} from './cms-indexability';

/** Reverse the editor's explicit course links; no guessed keyword/category associations. */
export function relatedGuides(posts:BlogPost[],courseSlug:string,siteUrl:string):BlogPost[] {
 const linksCourse=(blocks:RichBlock[]|null):boolean=>(blocks??[]).some(block=>{
  const marks=Array.isArray(block.markDefs)?block.markDefs:[];
  return marks.some((mark:Record<string,unknown>)=>{
   if(mark._type!=='link'||typeof mark.href!=='string')return false;
   try{const link=new URL(mark.href,siteUrl);const parts=link.pathname.split('/').filter(Boolean);return [new URL(siteUrl).origin,'https://sably.co'].includes(link.origin)&&parts.length===2&&/^[a-z]{2}$/.test(parts[0]??'')&&parts[1]===courseSlug;}catch{return false;}
  });
 });
 return posts.filter(post=>indexableAtPath(post.seo,`/blog/${post.id}/`,siteUrl)&&linksCourse(post.richBody)).sort((a,b)=>b.data.publishedAt.getTime()-a.data.publishedAt.getTime()).slice(0,3);
}
