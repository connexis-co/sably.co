import assert from 'node:assert/strict';import {test} from 'node:test';
import {clusterDeCurso,guiasDePortada,relatedGuides} from '../src/lib/related-guides';import type {BlogPost} from '../src/lib/emdash-content';
const post=(id:string,href:string,seo={})=>({id,seo,data:{publishedAt:new Date('2026-08-01')},richBody:[{_type:'block',markDefs:[{_type:'link',_key:'a',href}]}]}) as BlogPost;
test('course guide links reflect explicit CMS links and exclude unrelated/external/noindex articles',()=>{
 const posts=[post('solar','/co/curso-de-energia-solar/'),post('electricidad','/mx/curso-de-energia-solar/?ref=guia'),post('otro','/co/curso-de-peluqueria/'),post('externo','https://evil.invalid/co/curso-de-energia-solar/'),post('oculto','/co/curso-de-energia-solar/',{noIndex:true}),post('duplicado','/co/curso-de-energia-solar/',{canonical:'https://sably.co/blog/solar/'})];
 assert.deepEqual(relatedGuides(posts,'curso-de-energia-solar','https://sably.co').map(p=>p.id),['solar','electricidad']);
 posts[0]!.richBody=[];assert.deepEqual(relatedGuides(posts,'curso-de-energia-solar','https://sably.co').map(p=>p.id),['electricidad']);
});

const fechada=(id:string,hrefs:string[],fecha:string,seo={})=>({id,seo,data:{publishedAt:new Date(fecha)},richBody:[{_type:'block',markDefs:hrefs.map((href,i)=>({_type:'link',_key:String(i),href}))}]}) as BlogPost;

test('cluster guides only fill the gap after the course own guides',()=>{
 const posts=[
  fechada('microblading',['/co/curso-de-microblading/'],'2026-09-01'),
  fechada('cejas',['/co/curso-de-cejas-y-pestanas/'],'2026-08-01'),
  fechada('pestanas',['/mx/curso-de-extensiones-de-pestanas/'],'2026-10-01'),
  fechada('ajena',['/co/curso-de-soldadura/'],'2026-11-01'),
  fechada('oculta',['/co/curso-de-microblading/'],'2026-11-02',{noIndex:true}),
 ];
 const cluster=['curso-de-microblading','curso-de-extensiones-de-pestanas'];
 // Own guide first, then the cluster by date; never an unrelated or noindex post.
 assert.deepEqual(relatedGuides(posts,'curso-de-cejas-y-pestanas','https://sably.co',cluster).map(p=>p.id),['cejas','pestanas','microblading']);
 // Without a cluster the behaviour is the previous one: explicit links only.
 assert.deepEqual(relatedGuides(posts,'curso-de-cejas-y-pestanas','https://sably.co').map(p=>p.id),['cejas']);
 // A post that links the course itself and a cluster member counts once, as its own guide.
 assert.deepEqual(relatedGuides([fechada('doble',['/co/curso-de-cejas-y-pestanas/','/co/curso-de-microblading/'],'2026-08-01')],'curso-de-cejas-y-pestanas','https://sably.co',cluster).map(p=>p.id),['doble']);
});

test('the cluster is the pillar plus its specialisations, never the course itself',()=>{
 const courses=[
  {id:'curso-de-cejas-y-pestanas',data:{}},
  {id:'curso-de-microblading',data:{pillar:'curso-de-cejas-y-pestanas'}},
  {id:'curso-de-extensiones-de-pestanas',data:{pillar:'curso-de-cejas-y-pestanas'}},
  {id:'curso-de-soldadura',data:{pillar:null}},
 ];
 assert.deepEqual(clusterDeCurso(courses[0]!,courses),['curso-de-microblading','curso-de-extensiones-de-pestanas']);
 assert.deepEqual(clusterDeCurso(courses[1]!,courses),['curso-de-cejas-y-pestanas','curso-de-extensiones-de-pestanas']);
 assert.deepEqual(clusterDeCurso(courses[3]!,courses),[]);
});

test('country homes link every indexable guide, newest first',()=>{
 const posts=[fechada('vieja',[],'2026-01-01'),fechada('nueva',[],'2026-10-01'),fechada('oculta',[],'2026-11-01',{noIndex:true}),fechada('media',[],'2026-05-01')];
 assert.deepEqual(guiasDePortada(posts,'https://sably.co').map(p=>p.id),['nueva','media','vieja']);
});
