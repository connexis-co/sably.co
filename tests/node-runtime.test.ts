import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteD1Database } from '../src/lib/node/d1-sqlite';
import { createNodeRequestHandler } from '../src/lib/node/request-handler';
import nodeCacheProvider, { invalidateNodePages } from '../src/lib/node/cache-provider';

test('local D1 compatibility preserves bindings, aggregates, returning and raw rows', async () => {
  const db = new SqliteD1Database(':memory:');
  try {
    await db.exec('CREATE TABLE sample (id INTEGER PRIMARY KEY, name TEXT, active INTEGER, payload BLOB)');
    const inserted = await db.prepare('INSERT INTO sample(name,active,payload) VALUES(?,?,?) RETURNING id,name').bind('uno',true,new Uint8Array([1,2])).all<{id:number;name:string}>();
    assert.equal(inserted.meta.changes, 1);
    assert.equal(inserted.results[0]?.name, 'uno');
    assert.equal(await db.prepare('SELECT name FROM sample').first('name'), 'uno');
    assert.equal(await db.prepare('SELECT name FROM sample WHERE id=?').bind(99).first(), null);
    assert.deepEqual(await db.prepare('SELECT id,name,active FROM sample').raw({columnNames:true}), [['id','name','active'],[1,'uno',1]]);
    assert.equal((await db.prepare('SELECT * FROM sample').all()).meta.changes, 0);
    const results = await db.batch([db.prepare('UPDATE sample SET name=? WHERE id=?').bind('dos',1),db.prepare('SELECT name FROM sample')]);
    assert.equal(results[0]?.meta.changes, 1);
    assert.deepEqual(results[1]?.results,[{name:'dos'}]);
  } finally { db.close(); }
});

test('batch rolls back all writes on failure and rejects cross-database statements', async () => {
  const cms = new SqliteD1Database(':memory:');
  const operational = new SqliteD1Database(':memory:');
  try {
    await cms.exec('CREATE TABLE sample (id INTEGER PRIMARY KEY)');
    await assert.rejects(cms.batch([cms.prepare('INSERT INTO sample VALUES (1)'),cms.prepare('INSERT INTO sample VALUES (1)')]));
    assert.equal(await cms.prepare('SELECT COUNT(*) AS count FROM sample').first('count'),0);
    await assert.rejects(cms.batch([operational.prepare('SELECT 1')]), /different database/);
  } finally { cms.close(); operational.close(); }
});

test('Node request boundary preserves canonical redirects and prevents unconfigured runtime', async () => {
  const handle = createNodeRequestHandler({env:{SABLY_ENVIRONMENT:'production'},redirects:'/old /co/nuevo/ 301',invalidate:()=>{}});
  const next = async () => {throw new Error('Redirect must avoid rendering');};
  const root = await handle(new Request('https://sably.co/?utm_source=test'),next);
  assert.equal(root.status,301); assert.equal(root.headers.get('location'),'https://sably.co/co/?utm_source=test');
  const legacy = await handle(new Request('https://www.sably.co/old'),next);
  assert.equal(legacy.headers.get('location'),'https://sably.co/co/nuevo/');
  const unconfigured = createNodeRequestHandler({env:{},redirects:'',invalidate:()=>{}});
  assert.equal((await unconfigured(new Request('https://sably.co/co/'),next)).status,503);
});

test('Node boundary protects sessions and setup, and invalidates successful operational writes', async () => {
  let invalidations = 0;
  const handle = createNodeRequestHandler({env:{SABLY_ENVIRONMENT:'production'},redirects:'',invalidate:()=>{invalidations++;}});
  const publicPage = await handle(new Request('https://sably.co/co/'),async()=>new Response('public',{headers:{'content-type':'text/html'}}));
  assert.equal(publicPage.headers.get('cache-control'),'max-age=0');
  assert.equal(publicPage.headers.get('cloudflare-cdn-cache-control'),'no-store');
  const editor = await handle(new Request('https://sably.co/co/',{headers:{cookie:'astro-session=abc'}}),async()=>new Response('editor',{headers:{'content-type':'text/html'}}));
  assert.equal(editor.headers.get('cache-control'),'private, no-store');
  const setup = await handle(new Request('https://sably.co/_emdash/api/setup'),async()=>new Response('should not happen'));
  assert.equal(setup.status,503);
  await handle(new Request('https://sably.co/_emdash/api/plugins/sably-operations/save-promo',{method:'POST'}),async()=>Response.json({ok:true}));
  assert.equal(invalidations,1);
  await handle(new Request('https://sably.co/_emdash/api/plugins/sably-operations/save-promo',{method:'POST'}),async()=>new Response('denied',{status:403}));
  assert.equal(invalidations,1);
});

test('Cloudflare keeps shareable copies to serve while the origin is down, and nothing else', async () => {
  // Crawl files and redirects: background refresh for a week; pages only up to the origin's expiry.
  const outage = 'public, max-age=300, stale-while-revalidate=604800, stale-if-error=604800';
  const page = /^public, max-age=300, stale-while-revalidate=(86099|86100), stale-if-error=604800$/;
  const handle = createNodeRequestHandler({env:{SABLY_ENVIRONMENT:'production'},redirects:'/old /co/nuevo/ 301',invalidate:()=>{}});
  const until = (seconds:number) => String(Math.floor(Date.now()/1000)+seconds);
  const html = (extra:Record<string,string>={},status=200) => async()=>new Response('page',{status,headers:{'content-type':'text/html',...extra}});
  const fresh = await handle(new Request('https://sably.co/co/'),html({'X-Sably-Fresh-Until':until(86400)}));
  assert.match(fresh.headers.get('cloudflare-cdn-cache-control')??'',page);
  assert.equal(fresh.headers.get('cache-control'),'max-age=0');
  assert.equal(fresh.headers.has('x-sably-fresh-until'),false);
  // A promotion boundary 90 s away: the edge may not call the copy fresh past it.
  const promo = await handle(new Request('https://sably.co/co/'),html({'X-Sably-Fresh-Until':until(90)}));
  assert.match(promo.headers.get('cloudflare-cdn-cache-control')??'',/^public, max-age=(89|90)(, stale-while-revalidate=1)?, stale-if-error=604800$/);
  const expired = await handle(new Request('https://sably.co/co/'),html({'X-Sably-Fresh-Until':until(-5)}));
  assert.equal(expired.headers.get('cloudflare-cdn-cache-control'),'no-store');
  // Pages that never opted into the origin cache, personal renders, queries and errors stay out.
  for (const [request,render] of [
    [new Request('https://sably.co/co/'),html()],
    [new Request('https://sably.co/co/',{headers:{cookie:'astro-session=abc'}}),html({'X-Sably-Fresh-Until':until(86400)})],
    [new Request('https://sably.co/co/?gclid=1'),html({'X-Sably-Fresh-Until':until(86400)})],
    [new Request('https://sably.co/co/'),html({'X-Sably-Fresh-Until':until(86400),'set-cookie':'a=b'})],
    [new Request('https://sably.co/co/no-existe/'),html({'X-Sably-Fresh-Until':until(86400)},404)],
    [new Request('https://sably.co/api/v1/config'),async()=>Response.json({})],
    [new Request('https://sably.co/health/'),async()=>Response.json({status:'ok'})],
  ] as const) {
    const response = await handle(request,render);
    assert.equal(response.headers.get('cloudflare-cdn-cache-control'),'no-store',request.url);
  }
  // Crawlers must always get robots.txt and the sitemaps.
  for (const path of ['/robots.txt','/sitemap.xml','/sitemap-index.xml','/sitemaps/sitemap-cursos-co.xml','/llms.txt']) {
    const response = await handle(new Request(`https://sably.co${path}`),async()=>new Response('ok',{headers:{'content-type':'text/plain','cache-control':'no-store'}}));
    assert.equal(response.headers.get('cloudflare-cdn-cache-control'),outage,path);
    assert.equal(response.headers.get('cache-control'),'public, max-age=300',path);
  }
  const brokenSitemap = await handle(new Request('https://sably.co/sitemap-index.xml'),async()=>new Response('fail',{status:500}));
  assert.equal(brokenSitemap.headers.get('cloudflare-cdn-cache-control'),'no-store');
  const root = await handle(new Request('https://sably.co/'),async()=>{throw new Error('Redirect must avoid rendering');});
  assert.equal(root.status,301);
  assert.equal(root.headers.get('cloudflare-cdn-cache-control'),outage);
  const development = createNodeRequestHandler({env:{SABLY_ENVIRONMENT:'development'},redirects:'',invalidate:()=>{}});
  const devRobots = await development(new Request('https://sably.co/robots.txt'),async()=>new Response('ok',{headers:{'content-type':'text/plain'}}));
  assert.equal(devRobots.headers.get('cloudflare-cdn-cache-control'),'no-store');
});

test('the page cache provider, which wraps the boundary, has the last word on the edge policy', async () => {
  const previous = process.env.SABLY_ENVIRONMENT;
  process.env.SABLY_ENVIRONMENT='production';
  try {
    invalidateNodePages();
    const cache=nodeCacheProvider(undefined);
    const context=(url:string,headers?:HeadersInit)=>({request:new Request(url,{headers}),url:new URL(url),logger:{info(){},warn(){},error(){}}});
    const until=String(Math.floor(Date.now()/1000)+86400);
    // What the boundary hands back for a page: no-store at the edge, then Astro adds the cache headers.
    const page=(status=200,extra:Record<string,string>={})=>async()=>new Response('page',{status,headers:{'content-type':'text/html','Cache-Control':status===200?'max-age=0':'private, no-store','Cloudflare-CDN-Cache-Control':'no-store','CDN-Cache-Control':'max-age=86400','X-Sably-Fresh-Until':until,...extra}});
    for (const hit of [false,true]) {
      const response=await cache.onRequest!(context('https://sably.co/mx/'),page());
      assert.match(response.headers.get('cloudflare-cdn-cache-control')??'',/^public, max-age=300, stale-while-revalidate=(86099|86100), stale-if-error=604800$/,`hit=${hit}`);
      assert.equal(response.headers.has('x-sably-fresh-until'),false);
    }
    const missing=await cache.onRequest!(context('https://sably.co/mx/no-existe/'),page(404));
    assert.equal(missing.headers.get('cloudflare-cdn-cache-control'),'no-store');
    const personal=await cache.onRequest!(context('https://sably.co/pe/'),page(200,{'set-cookie':'a=b'}));
    assert.equal(personal.headers.get('cloudflare-cdn-cache-control'),'no-store');
    const redirect=await cache.onRequest!(context('https://sably.co/co/viejo/'),async()=>new Response(null,{status:301,headers:{location:'https://sably.co/co/nuevo/','Cloudflare-CDN-Cache-Control':'public, max-age=300, stale-if-error=604800'}}));
    assert.equal(redirect.headers.get('cloudflare-cdn-cache-control'),'public, max-age=300, stale-if-error=604800');
  } finally {
    if (previous===undefined) delete process.env.SABLY_ENVIRONMENT;
    else process.env.SABLY_ENVIRONMENT=previous;
  }
});

test('Node HTML cache bypasses credentials, previews and errors; writes retire in-flight fills', async () => {
  const previous = process.env.SABLY_ENVIRONMENT;
  process.env.SABLY_ENVIRONMENT='production';
  try {
    const cache=nodeCacheProvider(undefined);
    const set=cache.setHeaders!({maxAge:60,swr:604800},new Request('https://sably.co/co/'));
    assert.equal(set.get('CDN-Cache-Control'),'max-age=60');
    assert.ok(Math.abs(Number(set.get('X-Sably-Fresh-Until'))-(Math.floor(Date.now()/1000)+60))<=1);
    const context=(url='https://sably.co/co/',headers?:HeadersInit)=>({request:new Request(url,{headers}),url:new URL(url),logger:{info(){},warn(){},error(){}}});
    let renders=0;
    const render=async()=>{renders++;return new Response(String(renders),{headers:{'content-type':'text/html','CDN-Cache-Control':'max-age=300','Cache-Control':'max-age=0','Cache-Tag':'sably:public'}});};
    assert.equal(await (await cache.onRequest!(context(),render)).text(),'1');
    assert.equal(await (await cache.onRequest!(context(),render)).text(),'1');
    assert.equal(await (await cache.onRequest!(context(undefined,{cookie:'astro-session=abc'}),render)).text(),'2');
    assert.equal(await (await cache.onRequest!(context('https://sably.co/co/?_edit=1'),render)).text(),'3');
    await cache.invalidate({tags:'sably:public'});
    assert.equal(await (await cache.onRequest!(context(),render)).text(),'4');
    invalidateNodePages();
    let resume!:()=>void;
    const pause=new Promise<void>(resolve=>{resume=resolve;});
    const pending=cache.onRequest!(context(),async()=>{await pause;return render();});
    invalidateNodePages(); resume(); await pending;
    assert.equal(await (await cache.onRequest!(context(),render)).text(),'6');
    assert.equal(await (await cache.onRequest!(context(),render)).text(),'6');
    let failures=0;
    const error=async()=>{failures++;return new Response('unavailable',{status:503,headers:{'CDN-Cache-Control':'max-age=300'}});};
    await cache.onRequest!(context('https://sably.co/co/missing/'),error);
    await cache.onRequest!(context('https://sably.co/co/missing/'),error);
    assert.equal(failures,2);
    let privateRenders=0;
    const privatePage=async()=>{privateRenders++;return new Response('private',{headers:{'CDN-Cache-Control':'max-age=300','Cache-Control':'private, no-store'}});};
    await cache.onRequest!(context('https://sably.co/co/private/'),privatePage);
    await cache.onRequest!(context('https://sably.co/co/private/'),privatePage);
    assert.equal(privateRenders,2);
  } finally {
    if (previous===undefined) delete process.env.SABLY_ENVIRONMENT;
    else process.env.SABLY_ENVIRONMENT=previous;
  }
});

test('la vista de revisión del tema (?tema=) nunca se indexa ni se guarda en el borde', async () => {
  const handle = createNodeRequestHandler({env:{SABLY_ENVIRONMENT:'production'},redirects:'',invalidate:()=>{}});
  const html = async () => new Response('<h1>Ficha</h1>',{headers:{'content-type':'text/html'}});
  const forzada = await handle(new Request('https://sably.co/co/curso-de-masajes/?tema=v2'),html);
  assert.equal(forzada.headers.get('x-robots-tag'),'noindex, follow');
  assert.equal(forzada.headers.get('cloudflare-cdn-cache-control'),'no-store');
  const normal = await handle(new Request('https://sably.co/co/curso-de-masajes/'),html);
  assert.equal(normal.headers.get('x-robots-tag'),null);
});
