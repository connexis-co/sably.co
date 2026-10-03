import {test} from 'node:test';import assert from 'node:assert/strict';
import {readTarget} from './environment-config.mjs';import {verifySearchProduction} from './search-console-sitemap.mjs';
const config=()=>{const c=readTarget('production');c.vars.SABLY_CMS_READY='true';c.vars.SABLY_PRODUCTION_ACTIVATED='true';c.routes=[{pattern:'sably.co',custom_domain:true}];return c;};
const fetcher=async url=>url.endsWith('robots.txt')?new Response('User-agent: *\nAllow: /\n\nUser-agent: Bytespider\nDisallow: /'):url.endsWith('.xml')?new Response('<sitemapindex><sitemap><loc>https://sably.co/sitemaps/sitemap-pages.xml</loc></sitemap></sitemapindex>'):new Response('<link rel="canonical" href="https://sably.co/co/curso-de-barberia/"><meta name="robots" content="index, follow">',{headers:{'X-Sably-Content-Source':'emdash'}});
test('Search Console submission preflight rejects inactive production without network',async()=>{
 const inactive=readTarget('production');inactive.vars.SABLY_CMS_READY='false';
 let requests=0;await assert.rejects(verifySearchProduction(inactive,async()=>{requests++;throw new Error('unexpected');}),/not ready/);assert.equal(requests,0);
});
test('production preflight reads reordered metadata and rejects duplicate canonicals',async()=>{
 const page=html=>async url=>url.endsWith('/curso-de-barberia/')?new Response(html,{headers:{'X-Sably-Content-Source':'emdash'}}):fetcher(url);
 const canonical='<link href="https://sably.co/co/curso-de-barberia/" rel="canonical">';
 assert.equal((await verifySearchProduction(config(),page(canonical+'<meta content="index,follow" name="robots">'))).children,1);
 await assert.rejects(verifySearchProduction(config(),page(canonical+'<meta content="none" name="GOOGLEBOT">')),/noindex/);
 await assert.rejects(verifySearchProduction(config(),page(canonical+canonical)),/exactly one canonical/);
});
test('production preflight accepts only public EmDash and rejects robots/noindex/development sitemaps',async()=>{
 assert.equal((await verifySearchProduction(config(),fetcher)).children,1);
 await assert.rejects(verifySearchProduction(config(),async url=>url.endsWith('robots.txt')?new Response('User-agent: *\nDisallow: /'):fetcher(url)),/Robots blocks/);
 await assert.rejects(verifySearchProduction(config(),async url=>url.endsWith('.xml')?new Response('<sitemapindex><loc>https://dev.sably.co/sitemap.xml</loc></sitemapindex>'):fetcher(url)),/Never submit/);
 await assert.rejects(verifySearchProduction(config(),async url=>url.endsWith('/curso-de-barberia/')?new Response('<meta name="robots" content="noindex">',{headers:{'X-Sably-Content-Source':'emdash'}}):fetcher(url)),/noindex/);
});
