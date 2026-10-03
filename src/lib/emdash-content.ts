import { cmsImageUrl } from './cms-media';
import { normalizePagePath } from './page-path';
import type { ContentSeo } from 'emdash';
import type { CollectionEntry } from 'astro:content';
import type { Country, City } from './countries';
import type { Category } from './categories';
import type { ProgramaHomologacion } from './homologaciones';

type Data = Record<string, unknown>;
export interface ContentRef { collection: string; id: string; slug: string }
export interface RichBlock { _type: string; _key?: string; [key: string]: unknown }
export interface CmsMeta { isPreview?:boolean; coverImage?:unknown;cardImage?:unknown;template?:string; seo?: ContentSeo; contentRef: ContentRef; updatedAt: string; richBody: RichBlock[] | null; edit: Record<string, Record<string,string>> }
export type Course = CollectionEntry<'courses'> & CmsMeta;
export type CourseLocale = CollectionEntry<'courseLocales'> & CmsMeta;
export type BlogPost = CollectionEntry<'blog'> & CmsMeta;
export type CmsCountry = Country & CmsMeta & {heroImage?:unknown;template?:string};
export type CmsCity = City & CmsMeta;
export type CmsCategory = Category & CmsMeta & {coverImage?:unknown;cardImage?:unknown};
export type CmsProgram = ProgramaHomologacion & CmsMeta & {locations:Array<{city:string;region:string}>;coverImage?:unknown};
export interface CmsPage extends CmsMeta { id:string; title:string; description:string; heroHeading:string; heroLabel:string; heroText:string; path:string; template:string; layout:RichBlock[] }
export interface CmsCreator extends CmsMeta {slug:string;nombre:string;bio:string;desde?:number;verificado:boolean;bestSeller:boolean;foto?:string;badges:{verified:boolean;bestSeller:boolean};cursos:string[]}
export interface CmsEntry { isPreview?:boolean; references?: Record<string,{entries:CmsEntry[]}>; id:string; data:unknown; edit?:Record<string,Record<string,string>> }
export interface ContentReadResult {entry:CmsEntry|null;error?:Error;isPreview?:boolean}
export interface CollectionReadResult {entries:CmsEntry[];error?:Error;hasMore?:boolean;nextCursor?:string}
export interface RelationLink { relation:string;parentGroup:string;childGroup:string }
export interface ContentReader {
 links?():Promise<RelationLink[]>;
 relatedCourseLocales?(courseSlug:string):Promise<string[]>;
 entry(collection:string,slug:string):Promise<ContentReadResult>;
 collection(collection:string,filter:{limit:number;cursor?:string;locale:string;status:'published';where?:Record<string,string>}):Promise<CollectionReadResult>;
}
export interface ResolvedCourseContent {course:Course;locale:CourseLocale|null;sourceBody:string;richBody:RichBlock[]|null;source:'emdash'|'emdash-preview';localeSource:'emdash'|'emdash-preview'|'emdash-generic'}
function rows(value:unknown,context:string,field:string):Data[]{if(!Array.isArray(value)) invalid(context,field);return value.map(v=>record(v,context,field));}
function items(editor:unknown,legacy:unknown,context:string,field:string):string[]{return editor != null ? rows(editor,context,field).map(v=>text(v.text,context,field)) : strings(legacy,context,field);}
function optional(value:unknown):string|undefined{return typeof value==='string' && value ? value:undefined;}
function refId(value:unknown):string|undefined {if(typeof value==='string') return value;if(value && typeof value==='object') {const r=value as Data;return optional(r.id)??optional(r._ref);}return undefined;}
function meta(entry:CmsEntry,collection:string):CmsMeta {
 const d=record(entry.data,collection,'data'); const slug=optional(d.slug)??entry.id;
 const dateValue=d.updatedAt??d.updated_at??d.publishedAt??d.published_at??d.original_published_at??d.createdAt??d.created_at;
 const timestamp=dateValue instanceof Date?dateValue.toISOString():optional(dateValue);
 if(!timestamp || !Number.isFinite(Date.parse(timestamp))) invalid(`${collection}/${slug}`,'updated_at');
 return {isPreview:entry.isPreview,coverImage:d.cover_image,cardImage:d.card_image,template:optional(d.template),seo:d.seo as ContentSeo | undefined,contentRef:{collection,id:text(d.id,collection,'id'),slug},updatedAt:new Date(timestamp).toISOString(),richBody:d.body==null?null:(Array.isArray(d.body)?d.body as RichBlock[]:invalid(collection,'body')),edit:entry.edit??{}};
}
const relations:Record<string,Array<{field:string;relation:string;target:string}>>={
 courses:[{field:'category_record',relation:'courses_categories',target:'categories'},{field:'creator_record',relation:'courses_creators',target:'creators'}],
 course_locales:[{field:'course_record',relation:'variants_courses',target:'courses'},{field:'country_record',relation:'variants_countries',target:'countries'}],
 cities:[{field:'country_record',relation:'cities_countries',target:'countries'}],
 testimonials:[{field:'course_record',relation:'testimonials_courses',target:'courses'},{field:'country_record',relation:'testimonials_countries',target:'countries'}],
};
const liveReader:ContentReader = {
 async relatedCourseLocales(courseSlug){
  const [{getDb},{sql}]=await Promise.all([import('emdash/runtime'),import('kysely')]);
  const db=await getDb();
  const result=await sql<{slug:string}>`SELECT variant.slug FROM ec_course_locales AS variant
    INNER JOIN _emdash_content_references AS edge ON edge.parent_group = variant.translation_group
    INNER JOIN _emdash_relations AS relation ON relation.id = edge.relation_id
    INNER JOIN ec_courses AS course ON course.translation_group = edge.child_group
    WHERE relation.slug = 'variants_courses' AND course.slug = ${courseSlug} AND course.locale = 'es'
      AND course.status = 'published' AND course.deleted_at IS NULL
      AND variant.locale = 'es' AND variant.status = 'published' AND variant.deleted_at IS NULL
    ORDER BY variant.slug`.execute(db);
  return result.rows.map(row=>row.slug);
 },
 async links(){
  // EmDash 1.1 relation links use translation groups; one paginated join avoids
  // an N+1 getEmDashReferences call for every catalog card. Only published
  // target rows from the public query API are ever joined below.
  const {getDb}=await import('emdash/runtime');const db=await getDb();
  const result:RelationLink[]=[];let cursor:string|undefined;
  do {
   let query=db.selectFrom('_emdash_content_references as edge').innerJoin('_emdash_relations as relation','relation.id','edge.relation_id').select(['edge.id','relation.slug as relation','edge.parent_group as parentGroup','edge.child_group as childGroup']).orderBy('edge.id','asc').limit(500);
   if(cursor) query=query.where('edge.id','>',cursor);
   const rows=await query.execute();result.push(...rows);
   if(rows.length<500) break;cursor=rows.at(-1)!.id;
  }while(true);
  return result;
 },
 async entry(collection,slug){const {getEmDashEntry}=await import('emdash');const references=Object.fromEntries((relations[collection]??[]).map(r=>[r.field,true as const]));return getEmDashEntry(collection,slug,{locale:'es',references});},
 async collection(collection,filter){const {getEmDashCollection}=await import('emdash');return getEmDashCollection(collection,filter);},
};
/** Read every published page. Never cache across requests or recover from errors with archived source files. */
export async function readAllPublished(collection:string,reader:ContentReader=liveReader,where?:Record<string,string>):Promise<CmsEntry[]> {
 const entries:CmsEntry[]=[]; const cursors=new Set<string>(); let cursor:string|undefined;
 do {const result=await reader.collection(collection,{limit:100,cursor,locale:'es',status:'published',where});
 if(result.error) throw result.error;entries.push(...result.entries);
 if(!result.hasMore) break;
 if(!result.nextCursor || cursors.has(result.nextCursor)) throw new Error(`Invalid EmDash pagination for ${collection}`);
 cursor=result.nextCursor;cursors.add(cursor);
 } while(true);
 return entries;
}
function invalid(context: string, field: string): never {
  throw new Error(`Invalid EmDash content ${context}: ${field}`);
}

function record(value: unknown, context: string, field: string): Data {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(context, field);
  return value as Data;
}

function text(value: unknown, context: string, field: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) invalid(context, field);
  return value;
}

function positive(value: unknown, context: string, field: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    invalid(context, field);
  }
  return value;
}

function strings(value: unknown, context: string, field: string): string[] {
  if (!Array.isArray(value)) invalid(context, field);
  return value.map((item) => text(item, context, field));
}

function faqs(value: unknown, context: string): Array<{ q: string; a: string }> {
  if (!Array.isArray(value)) invalid(context, 'faqs');
  return value.map((item) => {
    const faq = record(item, context, 'faqs');
    return { q: text(faq.q, context, 'faqs.q'), a: text(faq.a, context, 'faqs.a') };
  });
}

const courseFields = {
  title: 'title', metaTitle: 'meta_title', category: 'category', pillar: 'pillar',
  subcategory: 'subcategory', shortDescription: 'short_description', level: 'level',
  durationHours: 'duration_hours', lessonsCount: 'lessons_count', modules: 'modules',
  priceUSD: 'price_usd', originalPriceUSD: 'original_price_usd', rating: 'rating',
  ratingCount: 'rating_count', students: 'students', instructor: 'instructor',
  learnings: 'learnings', audience: 'audience', faqs: 'faqs', proveedor: 'proveedor',
  hotmartUrl: 'hotmart_url', videoKey: 'video_key', featured: 'featured', keywords: 'keywords',
  publishedAt: 'original_published_at',
} as const;

function courseData(value: unknown, context: string): { data: Course['data']; sourceBody: string } {
  const entry = record(value, context, 'data');
  const data: Data = {};
  // Every editable field supersedes the preserved source metadata, including cleared optional fields.
  for (const [target, source] of Object.entries(courseFields)) data[target] = entry[source] ?? undefined;
  for (const field of ['title', 'category', 'subcategory', 'shortDescription', 'level', 'hotmartUrl']) {
    data[field] = text(data[field], context, field);
  }
  for (const field of ['metaTitle', 'pillar', 'proveedor', 'videoKey']) {
    if (data[field] !== undefined) text(data[field], context, field, true);
  }
  if (!['Principiante', 'Intermedio', 'Avanzado', 'Todos los niveles'].includes(data.level as string)) {
    invalid(context, 'level');
  }
  for (const field of ['durationHours', 'priceUSD', 'originalPriceUSD']) positive(data[field], context, field);
  positive(data.lessonsCount, context, 'lessonsCount', true);
  if (typeof data.featured !== 'boolean') invalid(context, 'featured');
  for (const [field, editor] of [['learnings', 'learning_items'], ['audience', 'audience_items'], ['keywords', 'keyword_items']]) data[field!] = items(entry[editor!], data[field!], context, field!);
  data.faqs = faqs(entry.faq_items ?? data.faqs, context);
  if (entry.curriculum != null) data.modules = rows(entry.curriculum, context, 'curriculum').map(m => ({title: m.title, lessons: text(m.lessons_text, context, 'lessons_text', true).split(/\r?\n/).map(s=>s.trim()).filter(Boolean)}));
  if (entry.instructor_name != null) data.instructor = entry.instructor_name ? {name:entry.instructor_name, title:entry.instructor_title ?? '',bio:entry.instructor_bio ?? ''} : undefined;
  data.creatorSlug = entry.creator_slug;
  data.creatorManaged = 'creator_record' in entry;
  data.coverImage = entry.cover_image;
  data.video = entry.video;
  if (!Array.isArray(data.modules)) invalid(context, 'modules');
  data.modules = data.modules.map((item) => {
    const module = record(item, context, 'modules');
    return {
      title: text(module.title, context, 'modules.title'),
      lessons: strings(module.lessons, context, 'modules.lessons'),
    };
  });
  if (data.instructor !== undefined) {
    const instructor = record(data.instructor, context, 'instructor');
    for (const field of ['name', 'title', 'bio']) text(instructor[field], context, `instructor.${field}`, field !== 'name');
  }
  if (data.rating !== undefined && (typeof data.rating !== 'number' || !Number.isFinite(data.rating) || data.rating < 0 || data.rating > 5)) {
    invalid(context, 'rating');
  }
  for (const field of ['ratingCount', 'students']) {
    if (data[field] !== undefined) positive(data[field], context, field, true);
  }
  let checkout: URL;
  try { checkout = new URL(data.hotmartUrl as string); } catch { invalid(context, 'hotmartUrl'); }
  if (!['https:', 'http:'].includes(checkout.protocol)) invalid(context, 'hotmartUrl');
  const date = new Date(text(data.publishedAt, context, 'original_published_at'));
  if (!Number.isFinite(date.valueOf())) invalid(context, 'original_published_at');
  data.publishedAt = date;
  return {
    data: data as Course['data'],
    sourceBody: typeof entry.source_body === 'string' ? entry.source_body : '',
  };
}

function localeData(value: unknown, courseId: string, countryCode: string): CourseLocale['data'] {
  const context = `course_locales/${courseId}--${countryCode}`;
  const entry = record(value, context, 'data');
  const data: Data = {};
  for (const field of [
    'country', 'angulo', 'meta_title', 'meta_description', 'h1', 'subtitulo',
    'certificado', 'garantia',
  ]) data[field] = text(entry[field], context, field);
  data.descripcion = typeof entry.descripcion === 'string' ? entry.descripcion : '';
  data.course = text(entry.course_slug, context, 'course_slug');
  if (data.course !== courseId || data.country !== countryCode) invalid(context, 'course/country identity');
  for (const [field, editor] of [['beneficios','benefit_items'], ['para_quien','audience_items'], ['requisitos','requirement_items']]) data[field!] = items(entry[editor!], entry[field!], context, field!);
  data.faqs = faqs(entry.faq_items ?? entry.faqs, context);
  data._meta = entry.generation_metadata ?? {usd:0,fallos:null};
  return data as CourseLocale['data'];
}


export function createContentRepository(reader:ContentReader=liveReader) {
  // Instantiate per request to coalesce reads; this instance is never shared globally.
  const pending=new Map<string,Promise<CmsEntry[]>>();
  const rawAll=(name:string,where?:Record<string,string>)=>{const key=JSON.stringify([name,where]);if(!pending.has(key)) pending.set(key,readAllPublished(name,reader,where));return pending.get(key)!;};
  let links:Promise<RelationLink[]>|undefined;
  const hydrate=async(name:string,entries:CmsEntry[])=>{
    if(!reader.links || !relations[name]) return entries;
    links??=reader.links();const edges=await links;
    const targets=await Promise.all(relations[name]!.map(r=>rawAll(r.target)));
    const targetMaps=targets.map(rows=>new Map(rows.map(row=>[(row.data as Data).translationGroup,row])));
    const edgeMaps=relations[name]!.map(r=>new Map(edges.filter(edge=>edge.relation===r.relation).map(edge=>[edge.parentGroup,edge.childGroup])));
    return entries.map(e=>{
      const data={...record(e.data,name,'data')};
      relations[name]!.forEach((r,i)=>{
        const referencePage=e.references?.[r.field];
        const target=referencePage ? referencePage.entries[0] : targetMaps[i]!.get(edgeMaps[i]!.get(data.translationGroup as string));
        data[r.field]=target ? (target.data as Data).id : null;
        if(name==='course_locales'){if(r.field==='course_record') data.course_slug=target?.id;else data.country=target?(target.data as Data).code:undefined;}
        if(name==='testimonials'&&target){if(r.field==='course_record') data.course_slug=target.id;else data.country_code=(target.data as Data).code;}
      });
      return {...e,data};
    });
  };
  const hydrated=new Map<string,Promise<CmsEntry[]>>();
  const all=(name:string,where?:Record<string,string>)=>{const key=JSON.stringify([name,where]);if(!hydrated.has(key))hydrated.set(key,rawAll(name,where).then(entries=>hydrate(name,entries)));return hydrated.get(key)!;};
  const one=async(name:string,slug:string)=>{const result=await reader.entry(name,slug);if(result.error) throw result.error;if(result.entry) result.entry=(await hydrate(name,[result.entry]))[0]!;return result;};
  const category=(e:CmsEntry):CmsCategory=>{const d=record(e.data,'categories','data');return {...meta(e,'categories'),slug:e.id,name:text(d.name,'categories','name'),emoji:text(d.emoji,'categories','emoji'),description:text(d.description,'categories','description'),gradient:[text(d.gradient_start,'categories','gradient_start'),text(d.gradient_end,'categories','gradient_end')],subcategories:rows(d.subcategories??[],'categories','subcategories').map(s=>({slug:text(s.slug,'categories','slug'),name:text(s.name,'categories','name')})),externalUrl:optional(d.external_url),coverImage:d.cover_image,cardImage:d.card_image};};
  const country=(e:CmsEntry,cities:CmsEntry[],countries:CmsEntry[]):CmsCountry=>{const d=record(e.data,'countries','data');const code=text(d.code,'countries','code');return {...meta(e,'countries'),code,name:text(d.name,code,'name'),flag:text(d.flag,code,'flag'),hreflang:text(d.hreflang,code,'hreflang'),currency:text(d.currency,code,'currency'),currencySymbol:text(d.currency_symbol,code,'currency_symbol',true),usdRate:positive(d.usd_rate,code,'usd_rate'),priceRound:positive(d.price_round,code,'price_round'),whatsapp:text(d.whatsapp,code,'whatsapp'),phoneDisplay:text(d.phone_display,code,'phone_display'),heroImage:d.hero_image,template:optional(d.template),cities:cities.filter(c=>{const x=c.data as Data;const ref=refId(x.country_record);return 'country_record' in x ? countries.find(r=>(r.data as Data).id===ref)?.id===e.id : x.country_code===code;}).map(c=>{const x=c.data as Data;return {...meta(c,'cities'),slug:text(x.city_slug,'cities','city_slug'),name:text(x.name,'cities','name')};})};};
  const mappedCourse=(e:CmsEntry,categories:CmsCategory[],creators:CmsEntry[]):Course|null=>{
    const raw=record(e.data,`courses/${e.id}`,'data');const d={...raw};
    const categoryRef=refId(d.category_record);if('category_record' in d) d.category=categories.find(c=>c.contentRef.id===categoryRef)?.slug;
    if(!categories.some(c=>c.slug===d.category && !c.externalUrl)) return null;
    const creatorRef=refId(d.creator_record);if('creator_record' in d) d.creator_slug=creators.find(c=>(c.data as Data).id===creatorRef)?.id;
    const {data,sourceBody}=courseData(d,`courses/${e.id}`);
    return {id:e.id,collection:'courses',data,body:sourceBody,...meta(e,'courses')};
  };
  const locale=(e:CmsEntry):CourseLocale=>{const d=record(e.data,'course_locales','data');return {id:e.id,collection:'courseLocales',data:localeData(d,text(d.course_slug,e.id,'course_slug'),text(d.country,e.id,'country')),...meta(e,'course_locales')};};
  const blog=(e:CmsEntry):BlogPost=>{const d=record(e.data,'blog','data');const publishedAt=new Date(text(d.original_published_at,e.id,'original_published_at'));if(!Number.isFinite(publishedAt.valueOf())) invalid(e.id,'original_published_at');return {id:e.id,collection:'blog',body:typeof d.source_body==='string'?d.source_body:'',data:{title:text(d.title,e.id,'title'),description:text(d.description,e.id,'description'),category:optional(d.category),keywords:items(d.keyword_items,d.keywords,e.id,'keywords'),publishedAt,faq:d.faq_items!=null?faqs(d.faq_items,e.id):d.faq!=null?faqs(d.faq,e.id):undefined},...meta(e,'blog')};};
  const program=(e:CmsEntry):CmsProgram=>{const d=record(e.data,'homologaciones','data');return {...meta(e,'homologaciones'),slug:e.id,name:text(d.name,e.id,'name'),emoji:text(d.emoji,e.id,'emoji'),coverCategory:text(d.cover_category,e.id,'cover_category'),shortDescription:text(d.short_description,e.id,'short_description'),keyword:text(d.keyword,e.id,'keyword'),audience:items(d.audience_items,[],e.id,'audience'),evaluacion:items(d.evaluation_items,[],e.id,'evaluation'),locations:rows(d.locations??[],e.id,'locations').map(v=>({city:text(v.city,e.id,'city'),region:text(v.region,e.id,'region')})),coverImage:d.cover_image};};
  const page=(e:CmsEntry):CmsPage=>{const d=record(e.data,'pages','data');return {...meta(e,'pages'),id:e.id,title:text(d.title,e.id,'title'),description:text(d.description,e.id,'description'),heroHeading:text(d.hero_heading||d.title,e.id,'hero_heading'),heroLabel:optional(d.hero_label)??'',heroText:optional(d.hero_text)??'',path:text(d.path,e.id,'path'),template:text(d.template,e.id,'template'),layout:rows(d.layout??[],e.id,'layout') as RichBlock[]};};
  const localizedEntries=new Map<string,Promise<CourseLocale[]>>();
  const api={
    async getCategories(){return (await all('categories')).map(category);},
    async getCategory(slug:string){const {entry}=await one('categories',slug);return entry?category(entry):null;},
    async getCountries(){const [countries,cities]=await Promise.all([all('countries'),all('cities')]);return countries.map(e=>country(e,cities,countries));},
    async getCountry(code:string){return (await api.getCountries()).find(c=>c.code===code)??null;},
    async getCourses(){const [entries,categories,creators]=await Promise.all([all('courses'),api.getCategories(),all('creators')]);return entries.map(e=>mappedCourse(e,categories,creators)).filter((c):c is Course=>c!==null);},
    async getCourse(slug:string){const [result,categories,creators]=await Promise.all([one('courses',slug),api.getCategories(),all('creators')]);const course=result.entry?mappedCourse(result.entry,categories,creators):null;return course?{...course,isPreview:result.isPreview}:null;},
    async getCourseLocales(courseSlug?:string):Promise<CourseLocale[]>{
      const key=courseSlug??'*';
      if(!localizedEntries.has(key)) localizedEntries.set(key,(async()=>{
        const entries=courseSlug&&reader.relatedCourseLocales
          ? (await Promise.all((await reader.relatedCourseLocales(courseSlug)).map(slug=>one('course_locales',slug)))).flatMap(result=>result.entry?[{...result.entry,isPreview:result.isPreview}]:[])
          : await all('course_locales');
        const selected=entries.filter(e=>{const d=e.data as Data;return typeof d.course_slug==='string' && typeof d.country==='string' && (!courseSlug||d.course_slug===courseSlug);});
        const unique=new Set<string>();
        return selected.map(e=>{const variant=locale(e);const identity=`${variant.data.course}/${variant.data.country}`;if(unique.has(identity))invalid(identity,'duplicate course/country variant');unique.add(identity);return variant;});
      })());
      return localizedEntries.get(key)!;
    },
    async resolveCourseContent(slug:string,countryCode:string):Promise<ResolvedCourseContent|null>{
      const [course,variants]=await Promise.all([api.getCourse(slug),api.getCourseLocales(slug)]);
      if(!course) return null;
      const variant=variants.find(variant=>variant.data.country===countryCode)??null;
      return {course,locale:variant,sourceBody:course.body??'',richBody:variant?.richBody??course.richBody,source:course.isPreview?'emdash-preview':'emdash',localeSource:variant?(variant.isPreview?'emdash-preview':'emdash'):'emdash-generic'};
    },
    async getBlogPosts(){return (await all('blog')).map(blog);},
    async getBlogPost(slug:string){const {entry}=await one('blog',slug);return entry?blog(entry):null;},
    async getTestimonials():Promise<(CollectionEntry<'testimonials'>&CmsMeta)[]>{return (await all('testimonials')).map(e=>{const d=record(e.data,e.id,'data');const rating=d.rating;if(typeof rating!=='number'||rating<0||rating>5) invalid(e.id,'rating');return {id:e.id,collection:'testimonials',data:{id:e.id,name:text(d.name,e.id,'name'),text:text(d.text,e.id,'text'),rating,citySlug:text(d.city_slug,e.id,'city_slug'),countryCode:text(d.country_code,e.id,'country_code'),courseSlug:optional(d.course_slug),category:optional(d.category)},...meta(e,'testimonials')};});},
    async getCreators():Promise<CmsCreator[]>{const [entries,courses]=await Promise.all([all('creators'),api.getCourses()]);return entries.map(e=>{const d=record(e.data,e.id,'data');return {...meta(e,'creators'),slug:e.id,nombre:text(d.name,e.id,'name'),bio:text(d.bio??'',e.id,'bio',true),desde:typeof d.since==='number'?d.since:undefined,verificado:d.verified===true,bestSeller:d.best_seller===true,foto:cmsImageUrl(d.photo)??cmsImageUrl({src:d.photo_url}),badges:{verified:d.verified===true,bestSeller:d.best_seller===true},cursos:courses.filter(c=>(c.data as unknown as Data).creatorSlug===e.id || (!((c.data as unknown as Data).creatorManaged) && !((c.data as unknown as Data).creatorSlug) && Array.isArray(d.course_slugs)&&d.course_slugs.includes(c.id))).map(c=>c.id)};});},
    async getCreator(slug:string){return (await api.getCreators()).find(c=>c.slug===slug)??null;},
    async getPrograms(){return (await all('homologaciones')).map(program);},
    async getProgram(slug:string){const {entry}=await one('homologaciones',slug);return entry?program(entry):null;},
    async getPages(){return (await all('pages')).map(page);},
    async getPageByPath(path:string){const normalized=normalizePagePath(path);if(!normalized)return null;const matches=(await api.getPages()).filter(page=>normalizePagePath(page.path)===normalized);if(matches.length>1)invalid(normalized,'duplicate page path');return matches[0]??null;},
    async getPage(slug:string){const {entry}=await one('pages',slug);return entry?page(entry):null;},
  };
  return api;
}
const requestRepositories=new WeakMap<object,ReturnType<typeof createContentRepository>>();
export async function getContentRepository(){
 const {getRequestContext}=await import('emdash/request-context');const context=getRequestContext();
 if(!context) return createContentRepository();
 let repo=requestRepositories.get(context);if(!repo){repo=createContentRepository();requestRepositories.set(context,repo);}return repo;
}
export const getCategories=async()=>(await getContentRepository()).getCategories();
export const getCategory=async(slug:string)=>(await getContentRepository()).getCategory(slug);
export const getCountries=async()=>(await getContentRepository()).getCountries();
export const getCountry=async(code:string)=>(await getContentRepository()).getCountry(code);
export const getCourses=async()=>(await getContentRepository()).getCourses();
export const getCourse=async(slug:string)=>(await getContentRepository()).getCourse(slug);
export const getCourseLocales=async(slug?:string)=>(await getContentRepository()).getCourseLocales(slug);
export const resolveCourseContent=async(slug:string,country:string)=>(await getContentRepository()).resolveCourseContent(slug,country);
export const getBlogPosts=async()=>(await getContentRepository()).getBlogPosts();
export const getBlogPost=async(slug:string)=>(await getContentRepository()).getBlogPost(slug);
export const getTestimonials=async()=>(await getContentRepository()).getTestimonials();
export const getCreators=async()=>(await getContentRepository()).getCreators();
export const getCreator=async(slug:string)=>(await getContentRepository()).getCreator(slug);
export const getPrograms=async()=>(await getContentRepository()).getPrograms();
export const getProgram=async(slug:string)=>(await getContentRepository()).getProgram(slug);
export const getPages=async()=>(await getContentRepository()).getPages();
export const getPage=async(slug:string)=>(await getContentRepository()).getPage(slug);

export const getPageByPath=async(path:string)=>(await getContentRepository()).getPageByPath(path);
