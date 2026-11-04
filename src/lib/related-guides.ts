import type {BlogPost,RichBlock} from './emdash-content';
import {indexableAtPath} from './cms-indexability';

const MAX_GUIDES=3;

/** Course slugs a post links to through explicit `link` marks on this site. */
function linkedCourses(blocks:RichBlock[]|null,siteUrl:string):Set<string> {
 const origins=[new URL(siteUrl).origin,'https://sably.co'];
 const slugs=new Set<string>();
 for(const block of blocks??[]){
  const marks=Array.isArray(block.markDefs)?block.markDefs:[];
  for(const mark of marks as Record<string,unknown>[]){
   if(mark._type!=='link'||typeof mark.href!=='string')continue;
   try{const link=new URL(mark.href,siteUrl);const parts=link.pathname.split('/').filter(Boolean);if(origins.includes(link.origin)&&parts.length===2&&/^[a-z]{2}$/.test(parts[0]??''))slugs.add(parts[1]!);}catch{/* not a URL */}
  }
 }
 return slugs;
}

/**
 * Reverse the editor's explicit course links; no guessed keyword/category associations.
 *
 * Posts that link to this course come first. When they are fewer than three,
 * posts that link to its cluster (`cluster`: pillar and specialisations, which
 * the editor set explicitly with `pillar`) fill the rest. The cluster is an
 * editorial relation, not a guess: «Qué es el microblading» links to the
 * microblading course and therefore belongs on its pillar «Cejas y pestañas».
 */
export function relatedGuides(posts:BlogPost[],courseSlug:string,siteUrl:string,cluster:readonly string[]=[]):BlogPost[] {
 const candidates=posts
  .filter(post=>indexableAtPath(post.seo,`/blog/${post.id}/`,siteUrl))
  .map(post=>({post,links:linkedCourses(post.richBody,siteUrl)}))
  .sort((a,b)=>b.post.data.publishedAt.getTime()-a.post.data.publishedAt.getTime());
 const direct=candidates.filter(c=>c.links.has(courseSlug));
 const related=candidates.filter(c=>!c.links.has(courseSlug)&&cluster.some(slug=>slug!==courseSlug&&c.links.has(slug)));
 return [...direct,...related].slice(0,MAX_GUIDES).map(c=>c.post);
}

/**
 * Courses in the same editorial cluster: its pillar (or itself, if it is the
 * pillar) and every course whose `pillar` points there. Excludes the course.
 */
export function clusterDeCurso(course:{id:string;data:{pillar?:string|null}},courses:readonly {id:string;data:{pillar?:string|null}}[]):string[] {
 const root=course.data.pillar||course.id;
 return courses.filter(c=>c.id!==course.id&&(c.id===root||c.data.pillar===root)).map(c=>c.id);
}

/** Every indexable guide, newest first: what a country home links to. */
export function guiasDePortada(posts:BlogPost[],siteUrl:string):BlogPost[] {
 return posts
  .filter(post=>indexableAtPath(post.seo,`/blog/${post.id}/`,siteUrl))
  .sort((a,b)=>b.data.publishedAt.getTime()-a.data.publishedAt.getTime());
}
