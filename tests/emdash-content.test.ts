import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSeed } from '../scripts/emdash-content.mjs';
import { createContentRepository, readAllPublished, type ContentReader, type CmsEntry, type RelationLink } from '../src/lib/emdash-content.ts';
import { prepareRichContent, richText } from '../src/lib/rich-content.ts';
import { renderMarkdown } from '../src/lib/markdown.ts';

const {seed}=await buildSeed('full');
const changedAt='2026-10-02T16:30:00.000Z';
function fixture() {
 const content:Record<string,CmsEntry[]>={};
 const edges:RelationLink[]=[];
 const bindings:Record<string,string>={category_record:'courses_categories',creator_record:'courses_creators',course_record:'variants_courses',country_record:'variants_countries'};
 for(const [collection,entries] of Object.entries(seed.content) as [string,Array<{id:string;slug:string;data:Record<string,unknown>}>][]){
  content[collection]=entries.map(e=>({id:e.slug,data:{...structuredClone(e.data),id:e.id,slug:e.slug,translationGroup:e.id,updatedAt:new Date(changedAt)}}));
 }
 for(const [collection,entries] of Object.entries(content)) for(const e of entries){
  const d=e.data as Record<string,unknown>;
  for(const [key,value] of Object.entries(d)){
   if(Array.isArray(value) && typeof value[0]==='string' && value[0].startsWith('$ref:')){
    const ref=value[0].slice(5);
    const relation=collection==='cities'?'cities_countries':collection==='testimonials'?(key==='course_record'?'testimonials_courses':'testimonials_countries'):bindings[key];
    if(relation) edges.push({relation,parentGroup:d.id as string,childGroup:ref});
    delete d[key]; // Native reference fields have no data column.
   }
  }
 }
 const calls:Array<{collection:string;cursor?:string;where?:Record<string,string>}>=[];
 const reader:ContentReader={
  async relatedCourseLocales(courseSlug){calls.push({collection:'relatedCourseLocales',where:{courseSlug}});const course=content.courses?.find(e=>e.id===courseSlug);if(!course)return [];const groups=new Set(edges.filter(e=>e.relation==='variants_courses'&&e.childGroup===(course.data as any).translationGroup).map(e=>e.parentGroup));return (content.course_locales??[]).filter(e=>groups.has((e.data as any).translationGroup)).map(e=>e.id);},
  async entry(collection,slug){return {entry:content[collection]?.find(e=>e.id===slug)??null};},
  async collection(collection,filter){
   assert.equal(filter.locale,'es');assert.equal(filter.status,'published');
   calls.push({collection,cursor:filter.cursor,where:filter.where});
   const entries=(content[collection]??[]).filter(e=>Object.entries(filter.where??{}).every(([key,value])=>(e.data as Record<string,unknown>)[key]===value));
   const offset=Number(filter.cursor??0);const page=entries.slice(offset,offset+filter.limit);const hasMore=offset+page.length<entries.length;
   return {entries:page,hasMore,nextCursor:hasMore?String(offset+page.length):undefined};
  },
  async links(){return edges;},
 };
 return {content,edges,calls,reader,cms:createContentRepository(reader)};
}

test('every migrated published collection maps without files or pilot exceptions',async()=>{
 const {cms}=fixture();
 const [courses,locales,countries,categories,posts,creators,testimonials,programs,pages]=await Promise.all([cms.getCourses(),cms.getCourseLocales(),cms.getCountries(),cms.getCategories(),cms.getBlogPosts(),cms.getCreators(),cms.getTestimonials(),cms.getPrograms(),cms.getPages()]);
 assert.equal(courses.length,seed.content.courses.length);
 assert.equal(locales.length,seed.content.course_locales.length);
 assert.equal(countries.reduce((n,c)=>n+c.cities.length,0),seed.content.cities.length);
 assert.equal(categories.length,seed.content.categories.length);
 assert.equal(posts.length,seed.content.blog.length);assert.equal(creators.length,seed.content.creators.length);
 assert.equal(testimonials.length,seed.content.testimonials.length);assert.equal(programs.length,seed.content.homologaciones.length);assert.equal(pages.length,seed.content.pages.length);
 assert.equal(courses[0]!.updatedAt,changedAt);
 assert.ok(courses.every(c=>c.contentRef.id!==c.id&&c.data.publishedAt instanceof Date));
});

test('all pages are fetched and single-course variant query is filtered in the CMS',async()=>{
 const {cms,calls}=fixture();
 const locales=await cms.getCourseLocales();assert.ok(locales.length>100);
 assert.ok(calls.filter(c=>c.collection==='course_locales').length>1);
 calls.length=0;await cms.getCourseLocales('curso-de-barberia');
 assert.deepEqual(calls.find(c=>c.collection==='relatedCourseLocales')?.where,{courseSlug:'curso-de-barberia'});
 assert.equal(calls.filter(c=>c.collection==='course_locales').length,0);
});

test('editorial fields and rich body override archived copies without executing MDX',async()=>{
 const {content,cms}=fixture();const entry=content.courses!.find(e=>e.id==='curso-de-barberia')!;const d=entry.data as Record<string,unknown>;
 d.title='Título CMS nuevo';d.short_description='Descripción CMS';d.price_usd=41;d.curriculum=[{title:'Módulo nuevo',lessons_text:'Uno\nDos'}];d.learning_items=[];d.instructor_name='';d.source_body='<script>alert(1)</script>\n{process.env.SECRET}';
 const result=await cms.resolveCourseContent(entry.id,'co');assert.equal(result?.course.data.title,d.title);assert.equal(result?.course.data.priceUSD,41);
 assert.deepEqual(result?.course.data.modules,[{title:'Módulo nuevo',lessons:['Uno','Dos']}]);assert.deepEqual(result?.course.data.learnings,[]);assert.equal(result?.course.data.instructor,undefined);
 assert.ok(result?.richBody);assert.ok(renderMarkdown(result!.sourceBody).includes('&lt;script&gt;'));
});

test('missing/unpublished courses return null and missing variants use generic CMS content',async()=>{
 const {content,cms}=fixture();content.courses=content.courses!.filter(e=>e.id!=='curso-de-barberia');assert.equal(await cms.resolveCourseContent('curso-de-barberia','co'),null);
 const another=fixture();another.content.course_locales=another.content.course_locales!.filter(e=>e.id!=='curso-de-barberia--co');
 const result=await another.cms.resolveCourseContent('curso-de-barberia','co');assert.equal(result?.locale,null);assert.equal(result?.localeSource,'emdash-generic');assert.equal(result?.richBody,result?.course.richBody);
});

test('native category reference edits override the archived scalar and unpublished categories hide their courses',async()=>{
 const {content,edges,cms}=fixture();const entry=content.courses!.find(e=>e.id==='curso-de-barberia')!;const edge=edges.find(e=>e.relation==='courses_categories'&&e.parentGroup===(entry.data as any).id)!;
 const target=content.categories!.find(e=>e.id==='oficios')!;edge.childGroup=(target.data as any).id;
 assert.equal((await cms.getCourse(entry.id))?.data.category,'oficios');
 const other=fixture();other.content.categories=other.content.categories!.filter(e=>e.id!=='belleza-online');
 assert.equal(await other.cms.getCourse(entry.id),null);
});

test('malformed existing content and CMS errors fail visibly rather than restoring source',async()=>{
 const {content,cms}=fixture();(content.courses!.find(e=>e.id==='curso-de-barberia')!.data as any).title='';
 await assert.rejects(cms.getCourse('curso-de-barberia'),/Invalid EmDash content/);
 const broken=fixture();broken.reader.collection=async()=>({entries:[],error:new Error('D1 unavailable')});
 await assert.rejects(createContentRepository(broken.reader).getCourses(),/D1 unavailable/);
});

test('pagination cannot loop forever on a missing or repeated cursor',async()=>{
 const {reader}=fixture();reader.collection=async()=>({entries:[],hasMore:true,nextCursor:'same'});
 await assert.rejects(readAllPublished('courses',reader),/pagination/);
 reader.collection=async()=>({entries:[],hasMore:true});await assert.rejects(readAllPublished('courses',reader),/pagination/);
});

test('new editor entries do not require legacy metadata, body or JSON fields',async()=>{
 const {content,cms}=fixture();const entry=content.courses!.find(e=>e.id==='curso-de-barberia')!;const d=entry.data as Record<string,unknown>;
 for(const key of ['source_body','source_metadata','modules','learnings','audience','keywords','faqs','instructor']) delete d[key];
 const variant=content.course_locales!.find(e=>e.id==='curso-de-barberia--co')!.data as Record<string,unknown>;
 for(const key of ['source_metadata','descripcion','faqs','beneficios','para_quien','requisitos','generation_metadata']) delete variant[key];
 assert.ok(await cms.resolveCourseContent(entry.id,'co'));
});

test('blog anchors match earlier MDX heading slugs and retain native inline editor metadata',()=>{
 const value=[{_type:'block',style:'h2',children:[{_type:'span',text:'Cómo empezar'}]},{_type:'block',style:'h2',children:[{_type:'span',text:'Cómo empezar'}]}];
 const symbol=Symbol('emdash:edit');const metadata={collection:'blog',id:'native-id',field:'body'};Object.defineProperty(value,symbol,{value:metadata});
 const {blocks,headings}=prepareRichContent(value);assert.deepEqual(headings.map(h=>h.slug),['cómo-empezar','cómo-empezar-1']);assert.equal((blocks as any)[symbol],metadata);assert.equal(richText(value),'Cómo empezar\n\nCómo empezar');
});

 test('explicit editor anchors override generated text slugs',()=>{
 const {headings}=prepareRichContent([{_type:'block',style:'h2',anchor:'mi-ancla',children:[{_type:'span',text:'Texto cambiado'}]}]);
 assert.equal(headings[0]?.slug,'mi-ancla');
 });

 test('variants resolve through native relations with arbitrary slugs and absent or stale legacy identity',async()=>{
  const {content,cms,edges,calls}=fixture();
  const entry=content.course_locales!.find(e=>e.id==='curso-de-barberia--co')!;
  entry.id='barberia-colombia-editorial';const d=entry.data as any;d.slug=entry.id;delete d.course_slug;d.country='mx';
  const result=await cms.resolveCourseContent('curso-de-barberia','co');
  assert.equal(result?.locale?.id,'barberia-colombia-editorial');assert.equal(result?.locale?.data.country,'co');assert.equal(result?.locale?.data.course,'curso-de-barberia');
  assert.equal(calls.filter(c=>c.collection==='course_locales').length,0);
  const other=fixture();const changed=other.content.course_locales!.find(e=>e.id==='curso-de-barberia--co')!;
  const edge=other.edges.find(e=>e.relation==='variants_courses'&&e.parentGroup===(changed.data as any).translationGroup)!;
  const target=other.content.courses!.find(e=>e.id!=='curso-de-barberia')!;edge.childGroup=(target.data as any).translationGroup;
  assert.equal((await other.cms.resolveCourseContent('curso-de-barberia','co'))?.locale,null);
 });

test('native creator photo updates replace the archived Hotmart photo',async()=>{
 const {content,cms}=fixture();const row=content.creators![0]!;const d=row.data as any;
 d.photo={provider:'local',id:'image-id',meta:{storageKey:'creators/new photo.webp'}};
 d.photo_url='https://old.example.com/photo.webp';
 assert.equal((await cms.getCreator(row.id))?.foto,'/_emdash/api/media/file/creators/new%20photo.webp');
});
