import assert from 'node:assert/strict';
import { parseEnv } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const origin='https://dev.sably.co';
const local=existsSync('.dev.vars')?parseEnv(readFileSync('.dev.vars','utf8')):{};
const password=process.env.SABLY_DEV_PASSWORD||local.SABLY_DEV_PASSWORD;
assert.ok(password,'Missing SABLY_DEV_PASSWORD');
const paths=[
 ['/co/',false,401],['/favicon.svg',false,401],['/_emdash/admin/',false,401],
 ['/co/',true,200],['/co/curso-de-barberia/',true,200],['/mx/curso-de-unas/',true,200],
 ['/co/bogota/curso-de-barberia/',true,200],['/co/curso-de-panaderia/',true,200],
 ['/co/cursos/',true,200],['/co/cursos/belleza-online/',true,200],['/blog/',true,200],
 ['/blog/como-emprender-con-un-oficio-en-2026/',true,200],['/nosotros/',true,200],
 ['/contacto/',true,200],['/legal/terminos/',true,200],['/legal/privacidad/',true,200],
 ['/homologaciones/',true,200],['/co/no-existe/',true,404],
 ['/api/v1/config',true,200],['/api/v1/promo?curso=curso-de-barberia&pais=co',true,200],
 ['/_emdash/api/plugins/sably-whatsapp/config',true,401],
 ['/_emdash/api/plugins/sably-operations/summary',true,401],
 ['/co/curso-de-barberia',true,301],['/api/hotmart-webhook/',true,503],
 ['/robots.txt',true,200],['/sitemap-index.xml',true,200],
 ['/internal/migrate-emdash',true,404],['/_emdash/api/plugins/sably-seo/audit',true,401],
];
const results=[];
for(const[path,authenticated,status]of paths){
 const response=await fetch(origin+path,{headers:{'User-Agent':'SablyDevelopmentValidation/2.0',...(authenticated?{'X-Sably-Preview-Token':password}:{})},redirect:'manual'});
 const body=await response.text();const actual=response.status;
 const result={path,authenticated,status:actual,expected:status,ok:actual===status};results.push(result);
 assert.match(response.headers.get('X-Robots-Tag')||'',/noindex/,path);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store',path);
 if(response.headers.get('Content-Type')?.includes('text/html')&&actual===200){
  assert.doesNotMatch(body,/googletagmanager.com\/(?:gtm.js|gtag\/js|ns.html)/,'Development must not send production tracking');
  assert.equal((body.match(/<title(?:\s[^>]*)?>/g)||[]).length,1,`${path}: one title`);
  assert.equal((body.match(/<link[^>]+rel="canonical"/g)||[]).length,1,`${path}: one canonical`);
  for(const match of body.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g))JSON.parse(match[1]);
 }
 if(path==='/co/curso-de-barberia/'&&actual===200){
  assert.match(body,/id="sably-whatsapp"/,'Native WhatsApp page hook must render');
  assert.match(body,/\/_emdash\/api\/media\/file\//,'Course images must use the native media library');
  for(const image of body.matchAll(/<img\b[^>]*>/g))assert.match(image[0],/\ssrc="[^"]+"/,'Every rendered image must have a source');
 }
 if(path==='/robots.txt')assert.match(body,/Disallow: \//);
 console.log(JSON.stringify(result));
}
writeFileSync('docs/emdash-dev-http-checks.json',JSON.stringify({checkedAt:new Date().toISOString(),origin,results},null,2)+'\n');
assert.ok(results.every(r=>r.ok),'Unexpected HTTP status; see docs/emdash-dev-http-checks.json');
