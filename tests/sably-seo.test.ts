import assert from 'node:assert/strict';
import { test } from 'node:test';
import { audit, createPlugin } from '../src/plugins/sably-seo/index';
import { COLLECTIONS, analyzeEntry, auditEntries, portableTextSummary, readAuditEntries, type Entry } from '../src/plugins/sably-seo/model';
import type { RouteContext } from 'emdash';
import { articleMetadata, type SablyArticlePage } from '../src/plugins/sably-seo/metadata';
import { generateBaseSeoContributions, resolvePageMetadata } from 'emdash/page';

const body = [{ _type: 'block', children: [{ _type: 'span', text: 'Este curso tiene contenido editorial útil.' }] }];
const entry = (patch: Partial<Entry> = {}): Entry => ({ id: 'course-1', slug: 'curso-de-barberia', status: 'published', data: { title: 'Curso de barbería', short_description: 'Aprende las técnicas de barbería con clases y práctica.', hotmart_url: 'https://hotmart.com/example', body, cover_image: { src: '/barberia.webp' } }, ...patch });

test('analyzes Sably fields and core SEO override, without expecting posts/excerpt/content fields', () => {
  const result = analyzeEntry('courses', entry({ seo: { title: 'Barbería profesional', description: 'Descripción SEO guardada' } }));
  assert.equal(result.title, 'Barbería profesional');
  assert.equal(result.description, 'Descripción SEO guardada');
  assert.equal(result.words, 6);
  assert.deepEqual(result.issues, []);
  const blog = analyzeEntry('blog', entry({ data: { title: 'Un artículo', description: 'Descripción editorial.', body, cover_image: { id: 'media-id' } } }));
  assert.deepEqual(blog.issues, []);
});

test('country variants inherit parent body and image through CMS references', () => {
  const parent = entry({ translationGroup: 'parent-group' });
  const variant = entry({ id: 'variant', slug: 'co-curso-de-barberia', data: { course_record: { id: 'parent-group' }, meta_title: 'Barbería en Colombia', meta_description: 'Una descripción local.' } });
  const report = auditEntries({ courses: [parent], course_locales: [variant] });
  const result = report.rows.find(row => row.id === 'variant')!;
  assert.equal(result.words, 6);
  assert.deepEqual(result.issues, []);
  assert.equal(result.title, 'Barbería en Colombia');
});

test('flags unsafe canonical and body image alt but treats noindex and pending checkout as informational', () => {
  const result = analyzeEntry('courses', entry({ seo: { canonical: 'javascript:alert(1)', noIndex: true }, data: { title: 'Curso pendiente', short_description: 'Información pendiente.', body: [{ _type: 'image', src: '/photo.webp' }] } }));
  assert.ok(result.issues.some(issue => issue.code === 'invalid-canonical' && issue.severity === 'error'));
  for (const code of ['noindex', 'pending-checkout']) assert.ok(result.issues.some(issue => issue.code === code && issue.severity === 'info'));
  assert.ok(result.issues.some(issue => issue.code === 'image-alt'));
  assert.ok(!result.issues.some(issue => issue.code === 'empty-body'));
  assert.equal(portableTextSummary([{ _type: 'block', children: [{ _type: 'span', text: 'Texto real' }], source_body: 'ignore lots of words' }]).words, 2);
});

test('follows all pages beyond forty entries and rejects repeated cursors instead of returning partial health', async () => {
  const called: string[] = [];
  const result = await readAuditEntries({ async list(collection, options) {
    called.push(collection); assert.equal(options.where.status, 'published');
    if (collection !== 'courses') return { items: [], hasMore: false };
    return options.cursor ? { items: [entry({ id: 'last' })], hasMore: false } : { items: Array.from({ length: 100 }, (_, i) => entry({ id: String(i) })), hasMore: true, cursor: 'page2' };
  } });
  assert.equal(result.courses?.length, 101);
  assert.deepEqual(new Set(called), new Set(COLLECTIONS));
  await assert.rejects(readAuditEntries({ async list() { return { items: [], hasMore: true, cursor: 'repeat' }; } }), /Paginación inválida/);
});

test('listing entities use name/bio/short_description and do not demand editorial body or generated country metadata', () => {
  for (const collection of ['countries', 'cities', 'categories', 'creators', 'homologaciones'] as const) {
    const data = { name: 'Nombre editorial', ...(collection === 'categories' ? { description: 'Descripción de categoría' } : collection === 'creators' ? { bio: 'Biografía del creador' } : collection === 'homologaciones' ? { short_description: 'Descripción del programa' } : {}) };
    const result = analyzeEntry(collection, entry({ data }));
    assert.equal(result.title, 'Nombre editorial');
    assert.deepEqual(result.issues, []);
  }
  const variant = analyzeEntry('course_locales', entry({ data: { title: 'Una variante nueva', course_record: [{ _ref: 'unresolved' }] } }));
  assert.deepEqual(variant.issues.map(issue => issue.code), ['inheritance-unavailable']);
  const pending = analyzeEntry('courses', entry({ data: { title: 'Curso pendiente', short_description: 'Descripción', hotmart_url: 'PENDIENTE', cover_image: { src: '/cover.webp' } } }));
  assert.deepEqual(pending.issues.map(issue => issue.code), ['pending-checkout']);
});

test('plugin is read-only and requires the authenticated editor role before any content access', async () => {
  const plugin = createPlugin();
  assert.deepEqual(plugin.capabilities, ['content:read']);
  assert.deepEqual(Object.keys(plugin.hooks), ['page:metadata']);
  assert.deepEqual(Object.keys(plugin.routes), ['audit']);
  assert.equal(plugin.routes.audit.permission, 'content:read');
  for (const user of [undefined, { role: 20 }, { role: 30 }]) {
    await assert.rejects(audit({ user, content: { list() { assert.fail('Unauthorized content read'); } } } as unknown as RouteContext), /editor o administrador/);
  }
  const result = await audit({ user: { role: 40 }, content: { async list() { return { items: [], hasMore: false }; } }, log: { error() {} } } as unknown as RouteContext);
  assert.equal(result.scanned, 0);
});

test('native metadata composition emits one article and preserves CMS fields and safe serialization', () => {
  const page: SablyArticlePage = {
    url: 'https://dev.sably.co/blog/articulo/', path: '/blog/articulo/', locale: 'es', kind: 'content', pageType: 'article',
    title: 'Título editorial', pageTitle: 'Título editorial', description: 'Descripción del CMS', canonical: 'https://dev.sably.co/blog/articulo/', image: '/_emdash/api/media/file/photo.webp', siteName: 'Sably', siteUrl: 'https://dev.sably.co',
    content: { collection: 'blog', id: 'post-1', slug: 'articulo' },
    seo: { ogTitle: 'Título SEO </script><script>attack()</script>' },
    articleMeta: { publishedTime: '2026-01-01T00:00:00Z', modifiedTime: '2026-10-03T00:00:00Z', author: 'https://dev.sably.co/#organization' },
    sablyArticle: { '@context': 'https://schema.org', '@type': 'Article', headline: 'Anterior', description: 'Anterior', author: { '@id': 'https://dev.sably.co/#organization' }, publisher: { '@id': 'https://dev.sably.co/#organization' }, inLanguage: 'es', wordCount: 800, timeRequired: 'PT4M', keywords: 'oficios,barbería', isPartOf: { '@id': 'https://dev.sably.co/blog/#blog' } },
  };
  const resolved = resolvePageMetadata([...(articleMetadata(page) ?? []), ...generateBaseSeoContributions(page)]);
  assert.equal(resolved.jsonld.length, 1);
  const schema = JSON.parse(resolved.jsonld[0]!.json);
  assert.equal(schema['@type'], 'Article');
  assert.equal(schema.headline, page.seo!.ogTitle);
  assert.equal(schema.description, page.description);
  assert.equal(schema.wordCount, 800);
  assert.equal(schema.dateModified, page.articleMeta!.modifiedTime);
  assert.equal(schema.image, 'https://dev.sably.co/_emdash/api/media/file/photo.webp');
  assert.deepEqual(schema.author, page.sablyArticle!.author);
  assert.doesNotMatch(resolved.jsonld[0]!.json, /<\/script>/);
  assert.equal(articleMetadata({ ...page, pageType: 'course', content: { collection: 'courses', id: 'a', slug: 'a' } }), null);
});
