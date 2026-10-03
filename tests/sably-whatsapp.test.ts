import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,courseSlugFromPage,resolveWhatsApp,validateSettings,inSchedule,matchesPath,type WhatsAppContext} from '../src/plugins/sably-whatsapp/model';
import {createPlugin} from '../src/plugins/sably-whatsapp/index';
const context:WhatsAppContext={path:'/co/curso-de-barberia/',course:'curso-de-barberia',title:'Barbería',category:'belleza-online',country:'co',countryName:'Colombia',countryNumber:'573114574788',url:'https://dev.sably.co/co/curso-de-barberia/'};
test('course, category and country rules must all match; priority controls winner',()=>{
 const settings=validateSettings({...DEFAULT_SETTINGS,rules:[{id:'co',label:'Equipo Colombia',enabled:true,priority:10,courses:[],categories:[],countries:['co'],paths:[],number:'573000000000',message:'{titulo} en {pais}',startsAt:'',endsAt:''},{id:'course',label:'Barbería',enabled:true,priority:20,courses:['curso-de-barberia'],categories:['belleza-online'],countries:['co'],paths:[],number:'573100000000',message:'',startsAt:'',endsAt:''}]});
 assert.equal(resolveWhatsApp(settings,context)?.number,'573100000000');
 assert.equal(resolveWhatsApp(settings,{...context,category:'oficios'})?.number,'573000000000');
 assert.equal(resolveWhatsApp(settings,{...context,country:'mx'})?.number,context.countryNumber);
});
test('global exclusions and disabled state override rules',()=>{
 assert.equal(resolveWhatsApp({...DEFAULT_SETTINGS,enabled:false},context),null);
 assert.equal(resolveWhatsApp({...DEFAULT_SETTINGS,hiddenPaths:['/co/curso-*']},context),null);
 assert.equal(matchesPath('/co/x','/co/x/'),true);
 assert.equal(matchesPath('/co/x','/co/*'),true);
 assert.equal(matchesPath('/co/x','/mx/*'),false);
});
test('overnight schedule associates early hours with preceding selected weekday',()=>{
 const settings={...DEFAULT_SETTINGS,weekdays:[1],startTime:'22:00',endTime:'02:00',timezone:'UTC'};
 assert.equal(inSchedule(settings,new Date('2026-10-05T23:00:00Z')),true);
 assert.equal(inSchedule(settings,new Date('2026-10-06T01:00:00Z')),true);
 assert.equal(inSchedule(settings,new Date('2026-10-06T03:00:00Z')),false);
});
test('validates phone, dates, colors and timezone before storing',()=>{
 assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,number:'javascript:alert(1)'}));
 assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,color:'red;display:none'}));
 assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,timezone:'Fake/Zone'}));
 assert.equal(validateSettings({...DEFAULT_SETTINGS,number:'+57 311 457 4788'}).number,'573114574788');
});
test('messages are encoded and display context safely',()=>{
 const resolved=resolveWhatsApp(DEFAULT_SETTINGS,{...context,title:'Taller & diseño'});
 assert.match(resolved!.url,/Taller%20%26%20dise%C3%B1o/);
});
test('rejects inaccessible labels, invalid side and non-path targeting',()=>{
 for(const extra of [{label:''},{position:'fixed;left:0'},{hiddenPaths:['//another.example/path']},{hiddenPaths:['/co/?token=private']},{hiddenPaths:['/\\other.example']},{weekdays:null}])assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,...extra}));
});
test('path glob handles literal regex characters and repeated stars without regex backtracking',()=>{
 assert.equal(matchesPath('/co/curso.(test)/','/co/curso.(test)/*'),true);
 assert.equal(matchesPath('/co/cursoXtest/','/co/curso.(test)/*'),false);
 assert.equal(matchesPath('/co/*xa','/co/*a'),true);
 assert.equal(matchesPath('/'+ 'a'.repeat(10000),'/'+ '*a'.repeat(60)+'b'),false);
});
test('private save returns 400 validation errors without writing settings',async()=>{
 const plugin=createPlugin();let writes=0;
 for(const route of Object.values(plugin.routes)){assert.notEqual(route.public,true);assert.equal(route.permission,'settings:manage');}
 await assert.rejects(()=>plugin.routes.save!.handler({input:{...DEFAULT_SETTINGS,color:'<script>'},kv:{set:async()=>{writes++;}}} as any),(error:any)=>error.status===400);
 assert.equal(writes,0);
});
test('course context supports arbitrary slugs and does not mistake categories or articles for courses',()=>{
 assert.equal(courseSlugFromPage({url:'https://dev.sably.co/co/barberia-avanzada/',pageType:'course',content:{collection:'courses',slug:'barberia-avanzada'}}),'barberia-avanzada');
 assert.equal(courseSlugFromPage({url:'https://dev.sably.co/co/bogota/dise%C3%B1o-profesional/?promo=ads',pageType:'course_city'}),'diseño-profesional');
 assert.equal(courseSlugFromPage({url:'https://dev.sably.co/co/course-url/',pageType:'custom',content:{collection:'courses',slug:'canonical-course'}}),'canonical-course');
 assert.equal(courseSlugFromPage({url:'https://dev.sably.co/co/cursos/curso-belleza/',pageType:'category',content:{collection:'categories',slug:'curso-belleza'}}),'');
 assert.equal(courseSlugFromPage({url:'https://dev.sably.co/blog/curso-recomendado/',pageType:'article',content:{collection:'blog',slug:'curso-recomendado'}}),'');
 assert.equal(courseSlugFromPage({url:'https://dev.sably.co/co/bad%2Fslug/',pageType:'course'}),'');
});
