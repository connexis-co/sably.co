import assert from 'node:assert/strict';import {test} from 'node:test';
import {relatedGuides} from '../src/lib/related-guides';import type {BlogPost} from '../src/lib/emdash-content';
const post=(id:string,href:string,seo={})=>({id,seo,data:{publishedAt:new Date('2026-08-01')},richBody:[{_type:'block',markDefs:[{_type:'link',_key:'a',href}]}]}) as BlogPost;
test('course guide links reflect explicit CMS links and exclude unrelated/external/noindex articles',()=>{
 const posts=[post('solar','/co/curso-de-energia-solar/'),post('electricidad','/mx/curso-de-energia-solar/?ref=guia'),post('otro','/co/curso-de-peluqueria/'),post('externo','https://evil.invalid/co/curso-de-energia-solar/'),post('oculto','/co/curso-de-energia-solar/',{noIndex:true}),post('duplicado','/co/curso-de-energia-solar/',{canonical:'https://sably.co/blog/solar/'})];
 assert.deepEqual(relatedGuides(posts,'curso-de-energia-solar','https://sably.co').map(p=>p.id),['solar','electricidad']);
 posts[0]!.richBody=[];assert.deepEqual(relatedGuides(posts,'curso-de-energia-solar','https://sably.co').map(p=>p.id),['electricidad']);
});
