/** Submit only after the reviewed production cutover. No credentials are persisted. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSign} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readTarget,validateTarget} from './environment-config.mjs';

export const property='sc-domain:sably.co';
export const sitemap='https://sably.co/sitemap-index.xml';

function attributes(tag) {
 const values={};
 for(const match of tag.matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))values[match[1].toLowerCase()]=match[2]??match[3]??match[4];
 return values;
}

export async function verifySearchProduction(config,fetcher=fetch) {
 validateTarget('production',config);
 assert.equal(config.vars.SABLY_CMS_READY,'true','Production CMS is not ready');
 assert.equal(config.vars.SABLY_PRODUCTION_ACTIVATED,'true','Production has not been activated');
 assert(config.routes.some(route=>route.pattern==='sably.co'),'Production domain route is absent');
 const page=await fetcher('https://sably.co/co/curso-de-barberia/',{redirect:'manual'});
 assert.equal(page.status,200,'The production course must respond directly with HTTP 200');
 assert.equal(page.headers.get('X-Sably-Content-Source'),'emdash','The public site is not serving EmDash');
 assert(!/\b(noindex|none)\b/i.test(page.headers.get('X-Robots-Tag')??''),'Production sends a noindex header');
 const html=(await page.text()).replace(/<!--[\s\S]*?-->/g,'');
 const meta=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>attributes(m[0]));
 assert(!meta.some(m=>/^(robots|googlebot)$/i.test(m.name??'')&&/\b(noindex|none)\b/i.test(m.content??'')),'Production page is noindex');
 const canonicals=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>attributes(m[0])).filter(m=>m.rel?.toLowerCase()==='canonical');
 assert.equal(canonicals.length,1,'Production must have exactly one canonical');
 assert.equal(canonicals[0].href,'https://sably.co/co/curso-de-barberia/','Unexpected production canonical');
 const response=await fetcher(sitemap,{redirect:'manual'});assert.equal(response.status,200,'Sitemap must return HTTP 200');
 const xml=await response.text();assert.match(xml,/<sitemapindex\b/);
 const children=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);assert(children.length>0);
 for(const url of children){assert.equal(new URL(url).origin,'https://sably.co','Never submit development or another domain');assert(!/temporal|noindex/.test(url),'The submitted index must contain only indexable content');}
 const robotsResponse=await fetcher('https://sably.co/robots.txt',{redirect:'manual'});assert.equal(robotsResponse.status,200);
 const robots=await robotsResponse.text();
 let agents=[],rules=false;const groups=[];
 for(const raw of robots.split(/\r?\n/)){const line=raw.split('#')[0].trim();const ua=line.match(/^User-agent:\s*(.+)$/i);if(ua){if(rules){agents=[];rules=false;}agents.push(ua[1].toLowerCase());continue;}const directive=line.match(/^(Allow|Disallow):\s*(.*)$/i);if(directive){rules=true;groups.push({agents:[...agents],directive:directive[1].toLowerCase(),path:directive[2].trim()});}}
 const google=groups.filter(g=>g.agents.includes('googlebot')),applicable=google.length?google:groups.filter(g=>g.agents.includes('*'));
 assert(!applicable.some(g=>g.directive==='disallow'&&['/','/*'].includes(g.path)),'Robots blocks Googlebot');
 return {property,sitemap,children:children.length};
}

async function accessToken(path) {
 const key=JSON.parse(await readFile(path,'utf8'));assert.equal(key.type,'service_account');
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');const now=Math.floor(Date.now()/1000);
 const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:key.client_email,scope:'https://www.googleapis.com/auth/webmasters',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const jwt=unsigned+'.'+createSign('RSA-SHA256').update(unsigned).sign(key.private_key,'base64url');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})});
 const data=await r.json();assert(r.ok&&data.access_token,`Google authorization failed (${r.status})`);return data.access_token;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(!process.argv.includes('--execute'))console.log(JSON.stringify({mode:'plan',property,sitemap,requires:'Activated EmDash production; GOOGLE_APPLICATION_CREDENTIALS points to a private service-account file. No submission has been made.'}));
 else {
  const verified=await verifySearchProduction(readTarget('production'));
  assert(process.env.GOOGLE_APPLICATION_CREDENTIALS,'Set the path to the authorized service account');
  const token=await accessToken(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const response=await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemap)}`,{method:'PUT',redirect:'error',headers:{Authorization:`Bearer ${token}`}});
  assert(response.ok,`Sitemap submission failed (${response.status})`);
  console.log(JSON.stringify({...verified,submittedAt:new Date().toISOString(),status:response.status}));
 }
}
