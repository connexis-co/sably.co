import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {DEFAULT_SETTINGS,courseSlugFromPage,resolveWhatsApp,resolvePriceLink,PRICE_LINK_ORIGIN,validateSettings,inSchedule,matchesPath,withDefaults,type WhatsAppContext} from '../src/plugins/sably-whatsapp/model';
import {createPlugin,renderButton,CSS,SCRIPT} from '../src/plugins/sably-whatsapp/index';
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
test('floating bubble: scroll reveal, waves and label are configurable and old saved settings keep working',()=>{
 const {reveal:_r,revealAfter:_a,tooltip:_t,...antiguo}=DEFAULT_SETTINGS;
 const migrado=validateSettings(antiguo);
 assert.equal(migrado.reveal,true);assert.equal(migrado.revealAfter,400);assert.equal(migrado.tooltip,'¿Dudas? Escríbenos');
 assert.deepEqual(withDefaults({enabled:false}),{...DEFAULT_SETTINGS,enabled:false});
 assert.equal(validateSettings({...DEFAULT_SETTINGS,reveal:false,revealAfter:0,tooltip:''}).tooltip,'');
 for(const extra of [{revealAfter:-1},{revealAfter:5000},{revealAfter:1.5},{reveal:'si'},{tooltip:'x'.repeat(41)}])assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,...extra}));
});
test('bubble never shows on sign-in or the account area',()=>{
 for(const path of ['/ingresar/','/ingresar/correo/','/mi-cuenta/','/mi-cuenta/borrar/'])assert.equal(resolveWhatsApp(DEFAULT_SETTINGS,{...context,path}),null,path);
 assert.ok(resolveWhatsApp(DEFAULT_SETTINGS,{...context,path:'/co/'}));
});
test('bubble markup: hidden until scroll, two waves, accessible link, flotante origin and escaped label',()=>{
 const resolved=resolveWhatsApp(DEFAULT_SETTINGS,context)!;
 const html=renderButton({...DEFAULT_SETTINGS,tooltip:'<b>¿Dudas?</b>'},resolved);
 assert.match(html,/<div id="sably-whatsapp"[^>]*data-al-bajar[^>]*data-oculta[^>]*data-ondas/);
 assert.match(html,/data-umbral="400"/);
 assert.equal(html.match(/class="sw-onda"/g)?.length,2);
 assert.match(html,/<a class="sw-a" href="https:\/\/wa\.me\/573114574788\?text=[^"]+" target="_blank" rel="noopener nofollow" aria-label="Escríbenos por WhatsApp" data-whatsapp-origen="flotante">/);
 assert.doesNotMatch(html,/<b>/);
 assert.match(html,/style="[^"]*right:20px"/);
 const quieto=renderButton({...DEFAULT_SETTINGS,reveal:false,animate:false,tooltip:'',position:'left'},resolved).split('</style>')[1]!;
 assert.doesNotMatch(quieto,/data-oculta|data-ondas|sw-onda"|sw-aviso/);
 assert.match(quieto,/data-lado="left"[^>]*style="[^"]*left:20px"/);
 assert.match(CSS,/prefers-reduced-motion:reduce\)\{\.sw-onda\{display:none\}/);
 assert.match(CSS,/translate:0 calc\(-1 \* var\(--fijo-inferior,0px\)\)/);
 assert.match(SCRIPT,/event:'click_whatsapp',page_type:[^}]*whatsapp_rule:regla,whatsapp_origen:origen/);
 assert.match(SCRIPT,/enviar\(w\.dataset\.rule,'flotante'\)/);
 // Con la píldora de compra de escritorio visible, el aviso va encima de la burbuja (no al lado, sobre «Inscribirme»).
 assert.match(CSS,/body:has\(\.v2-fija-abajo:not\(\[data-oculta\]\)\) #sably-whatsapp \.sw-aviso\{top:auto;bottom:calc\(100% \+ 12px\)/);
 assert.match(CSS,/:has\(\.v2-subir:not\(\[hidden\]\)\) #sably-whatsapp \.sw-aviso\{display:none!important\}/);
});
test('price link: same number and rules as the bubble, fixed message, and gone whenever the bubble is',()=>{
 const burbuja=resolveWhatsApp(DEFAULT_SETTINGS,context)!;
 const enlace=resolvePriceLink(DEFAULT_SETTINGS,context,'del Curso de Barbería & Barba')!;
 assert.equal(new URL(enlace.url).pathname,new URL(burbuja.url).pathname);
 assert.equal(new URL(enlace.url).searchParams.get('text'),'Hola, quiero más información del Curso de Barbería & Barba');
 assert.deepEqual({rule:enlace.rule,origin:enlace.origin,mobile:enlace.mobile,desktop:enlace.desktop},{rule:'default',origin:PRICE_LINK_ORIGIN,mobile:true,desktop:true});
 assert.equal(PRICE_LINK_ORIGIN,'ficha_precio');
 // El mensaje es fijo: no hereda el del panel ni sustituye llaves que traiga el nombre del curso.
 assert.equal(new URL(resolvePriceLink({...DEFAULT_SETTINGS,message:'Otro {titulo}'},context,'de {titulo}')!.url).searchParams.get('text'),'Hola, quiero más información de {titulo}');
 const regla={id:'co',label:'Equipo Colombia',enabled:true,priority:1,courses:[],categories:[],countries:['co'],paths:[],number:'573000000000',message:'Mensaje de la regla',startsAt:'',endsAt:''};
 const conRegla=resolvePriceLink({...DEFAULT_SETTINGS,number:'573100000000',rules:[regla]},context,'del Curso')!;
 assert.match(conRegla.url,/^https:\/\/wa\.me\/573000000000\?text=Hola/);assert.equal(conRegla.rule,'co');
 assert.match(resolvePriceLink({...DEFAULT_SETTINGS,number:'573100000000'},{...context,country:'mx'},'del Curso')!.url,/wa\.me\/573100000000\?/);
 assert.deepEqual([resolvePriceLink({...DEFAULT_SETTINGS,mobile:false},context,'del Curso')!.mobile,resolvePriceLink({...DEFAULT_SETTINGS,desktop:false},context,'del Curso')!.desktop],[false,false]);
 for(const apagada of [{enabled:false},{mobile:false,desktop:false},{hiddenPaths:['/co/curso-*']},{weekdays:[]}])
  assert.equal(resolvePriceLink({...DEFAULT_SETTINGS,...apagada},context,'del Curso'),null,JSON.stringify(apagada));
 assert.equal(resolvePriceLink(DEFAULT_SETTINGS,{...context,countryNumber:''},'del Curso'),null);
});
test('click_whatsapp: the bubble sends flotante and marked links send their own origin and rule',()=>{
 const oyentes=(el:any)=>{el.oyentes={};el.addEventListener=(tipo:string,f:()=>void)=>{(el.oyentes[tipo]??=[]).push(f);};el.click=()=>(el.oyentes.click??[]).forEach((f:()=>void)=>f());return el;};
 const flotante=oyentes({dataset:{whatsappOrigen:'flotante'},focus(){}});
 const ficha=oyentes({dataset:{whatsappOrigen:'ficha_precio',whatsappRule:'co'}});
 const sinRegla=oyentes({dataset:{whatsappOrigen:'ficha_precio'}});
 const w={dataset:{rule:'default',umbral:'400',espera:'0'},hasAttribute:()=>true,toggleAttribute(){},removeAttribute(){},setAttribute(){},querySelector:(q:string)=>q==='a'?flotante:null};
 const window:any={};
 const document={getElementById:(id:string)=>id==='sably-whatsapp'?w:null,querySelector:()=>null,querySelectorAll:(q:string)=>q==='a[data-whatsapp-origen]'?[flotante,ficha,sinRegla]:[],body:{dataset:{pageType:'course'}},documentElement:{scrollHeight:4000}};
 vm.runInNewContext(SCRIPT,{window,document,addEventListener(){},requestAnimationFrame:()=>1,setTimeout,innerHeight:800,scrollY:0});
 flotante.click();ficha.click();sinRegla.click();
 // Los objetos nacen en otro contexto (vm): se comparan por valor.
 assert.deepEqual(JSON.parse(JSON.stringify(window.dataLayer)),[
  {event:'click_whatsapp',page_type:'course',whatsapp_rule:'default',whatsapp_origen:'flotante'},
  {event:'click_whatsapp',page_type:'course',whatsapp_rule:'co',whatsapp_origen:'ficha_precio'},
  {event:'click_whatsapp',page_type:'course',whatsapp_rule:'default',whatsapp_origen:'ficha_precio'},
 ]);
 assert.equal(flotante.oyentes.click.length,1,'la burbuja no envía el evento dos veces');
});
