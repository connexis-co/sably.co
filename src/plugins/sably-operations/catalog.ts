import { allowedHotmartUrl } from '../../lib/hotmart-catalog.mjs';

type Kind = 'course' | 'blog';
interface CatalogRow { id: string; slug: string; title: string; hotmart_url: string; }
interface TrackedRow { content_id: string; slug: string; source_url: string; }
export interface PublishedCourse { slug: string; titulo: string; url: string; }

export async function readPublishedCatalog(cms: D1Database, kind: Kind): Promise<CatalogRow[]> {
  // The live columns retain the published revision while an editor has a draft.
  const table = kind === 'course' ? 'ec_courses' : 'ec_blog';
  const url = kind === 'course' ? 'hotmart_url' : "'' AS hotmart_url";
  const result = await cms.prepare(`SELECT id,slug,title,${url} FROM ${table} WHERE status='published' AND deleted_at IS NULL AND locale='es' ORDER BY slug`).all<CatalogRow>();
  return result.results;
}

/** Rebuild only derived public lookup data; never delete subjects or private activity. */
export async function reconcileCatalog(cms: D1Database, db: D1Database, kinds: Kind[] = ['course','blog']): Promise<PublishedCourse[]> {
  let courses: PublishedCourse[] = [];
  for (const kind of kinds) {
    const rows = await readPublishedCatalog(cms, kind);
    const previous = (await db.prepare('SELECT content_id,slug,source_url FROM sably_cms_catalog WHERE kind=?').bind(kind).all<TrackedRow>()).results;
    const current = new Map(rows.map(row => [row.id,row]));
    const statements: D1PreparedStatement[] = [];
    for (const old of previous) {
      const next = current.get(old.content_id);
      if (kind === 'course' && (!next || next.slug !== old.slug || next.hotmart_url !== old.source_url)) {
        // These are disposable public captures, not sales, reviews or user votes.
        for (const table of ['hotmart_producto','hotmart_precio','hotmart_valoracion']) statements.push(db.prepare(`DELETE FROM ${table} WHERE slug=?`).bind(old.slug));
      }
    }
    for (const row of rows) {
      statements.push(db.prepare('INSERT INTO sably_cms_catalog(kind,content_id,slug,source_url) VALUES(?,?,?,?) ON CONFLICT(kind,content_id) DO UPDATE SET slug=excluded.slug,source_url=excluded.source_url').bind(kind,row.id,row.slug,row.hotmart_url ?? ''));
      statements.push(db.prepare('INSERT INTO subject(id,kind,slug,is_active) VALUES(?,?,?,1) ON CONFLICT(kind,slug) DO UPDATE SET is_active=1').bind(`${kind}:${row.slug}`,kind,row.slug));
    }
    // Bounded D1 batches. Deactivation occurs only after every live row was stored.
    for (let offset = 0; offset < statements.length; offset += 50) await db.batch(statements.slice(offset,offset+50));
    await db.batch([
      db.prepare('DELETE FROM sably_cms_catalog WHERE kind=? AND content_id NOT IN (SELECT value FROM json_each(?))').bind(kind,JSON.stringify(rows.map(row=>row.id))),
      db.prepare('UPDATE subject SET is_active=EXISTS(SELECT 1 FROM sably_cms_catalog c WHERE c.kind=subject.kind AND c.slug=subject.slug) WHERE kind=?').bind(kind),
    ]);
    if (kind === 'course') {
      courses = rows.filter(row => allowedHotmartUrl(row.hotmart_url)).map(row=>({slug:row.slug,titulo:row.title,url:row.hotmart_url}));
      // Also remove stale baseline captures which predate CMS identity tracking.
      await db.batch(['hotmart_producto','hotmart_precio','hotmart_valoracion'].map(table=>db.prepare(`DELETE FROM ${table} WHERE slug NOT IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(courses.map(row=>row.slug)))));
    }
  }
  return courses;
}
