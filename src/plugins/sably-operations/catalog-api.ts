import { availableOperationalDatabase, type OperationalBindings } from '../../lib/operational-environment';
import { readLimited, secretMatches } from '../../lib/emdash-migration-guard';
import { allowedHotmartUrl } from '../../lib/hotmart-catalog.mjs';
import { readPublishedCatalog, reconcileCatalog } from './catalog';

export interface CatalogBindings extends OperationalBindings { SABLY_SNAPSHOT_TOKEN?: string; }
const headers = { 'cache-control':'private, no-store', 'x-robots-tag':'noindex, nofollow, noarchive' };
const json = (data: unknown, status = 200) => Response.json(data,{status,headers});
async function authorized(request: Request, env: CatalogBindings): Promise<D1Database | Response> {
  const db = availableOperationalDatabase(env, request.url);
  if (!db || !env.DB || !env.SABLY_SNAPSHOT_TOKEN) return json({error:'Catálogo no disponible.'},503);
  if (!await secretMatches(request.headers.get('authorization') ?? '',`Bearer ${env.SABLY_SNAPSHOT_TOKEN}`)) return json({error:'No autorizado.'},401);
  return db;
}
export async function catalogResponse(request: Request, env: CatalogBindings): Promise<Response> {
  const db = await authorized(request,env);
  if (db instanceof Response) return db;
  try { return json({source:'emdash',courses:await reconcileCatalog(env.DB!,db)}); }
  catch { return json({error:'No se pudo consultar el catálogo CMS.'},503); }
}

/** Reject a capture if its publication state or source URL changed while it ran. */
export async function validateCaptureRequest(request: Request, env: CatalogBindings): Promise<Request | Response> {
  const db = await authorized(request,env);
  if (db instanceof Response) return db;
  try {
    const body = JSON.parse(new TextDecoder().decode(await readLimited(request,1_500_000)));
    const rows = await readPublishedCatalog(env.DB!,'course');
    const current = new Map(rows.filter(row=>allowedHotmartUrl(row.hotmart_url)).map(row=>[row.slug,row.hotmart_url]));
    const sources = body.sources;
    if (!sources || typeof sources !== 'object' || Array.isArray(sources)) return json({error:'Falta el catálogo de origen de la captura.'},400);
    for (const name of ['productos','precios','valoraciones']) {
      if (body[name] !== undefined && (!Array.isArray(body[name]) || body[name].length > 5000)) return json({error:'Lote inválido.'},400);
      for (const row of body[name] ?? []) {
        if (!row || typeof row.slug !== 'string' || !current.has(row.slug) || sources[row.slug] !== current.get(row.slug)) return json({error:'El catálogo cambió; vuelve a capturar los cursos publicados.'},409);
        if (name === 'productos' && (!allowedHotmartUrl(row.payUrl) || new URL(row.payUrl).hostname !== 'pay.hotmart.com')) return json({error:'Checkout no permitido.'},400);
      }
    }
    return new Request(request,{body:JSON.stringify(body)});
  } catch { return json({error:'No se pudo validar la captura CMS.'},400); }
}
