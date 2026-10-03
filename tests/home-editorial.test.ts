import test from 'node:test';
import assert from 'node:assert/strict';
import type {Section} from 'emdash';
import {homeSectionContent} from '../src/lib/home-editorial';
import {homeSections} from '../src/themes/sably-classic/home-sections.mjs';

test('home copy and FAQ substitute the market without restoring old text',()=>{
 const section=structuredClone(homeSections.find(s=>s.slug==='sably-home-faq')) as unknown as Section;
 const result=homeSectionContent(section,{name:'Perú',currency:'PEN'});
 assert.equal(result.groups.length,5);assert.match(result.groups[0]!.title,/Perú/);assert.match(result.groups[0]!.body,/PEN/);
 section.content=section.content.slice(0,2);(section.content[1]!.children as {text:string}[])[0]!.text='Respuesta publicada desde EmDash';
 assert.deepEqual(homeSectionContent(section,{name:'Perú',currency:'PEN'}).groups,[{title:'¿Los cursos de Sably están disponibles en Perú?',body:'Respuesta publicada desde EmDash'}]);
});
test('deleting a hero paragraph yields empty editable text and does not resurrect archive copy',()=>{
 const section=structuredClone(homeSections.find(s=>s.slug==='sably-home-hero')) as unknown as Section;
 section.content=section.content.filter(b=>b._key!=='description');
 assert.equal(homeSectionContent(section,{name:'Colombia',currency:'COP'}).fields.description,'');
});
