/** Editorial checks for Sably's CMS fields. No network, mutations or generated JSON-LD. */
export const COLLECTIONS = ['courses', 'course_locales', 'blog', 'pages', 'categories', 'countries', 'cities', 'creators', 'homologaciones'] as const;
export type Collection = typeof COLLECTIONS[number];
export type Severity = 'error' | 'warning' | 'info';
export interface Entry {
  id: string; slug: string | null; status: string; translationGroup?: string | null; data: Record<string, unknown>;
  seo?: { title?: string | null; description?: string | null; canonical?: string | null; noIndex?: boolean; image?: unknown };
}
export interface Issue { code: string; severity: Severity; message: string }
export interface AuditRow {
  id: string; collection: Collection; slug: string; title: string; description: string;
  titleLength: number; descriptionLength: number; generatedDescription: boolean; words: number; issues: Issue[]; editorUrl: string;
}
export interface AuditReport { scanned: number; errors: number; warnings: number; rows: AuditRow[]; generatedAt: string }
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const first = (...values: unknown[]) => values.map(text).find(Boolean) ?? '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const imageExists = (value: unknown): boolean => !!text(value) || !!first(object(value).src, object(value).url, object(value).id);

export function portableTextSummary(value: unknown): { words: number; imagesWithoutAlt: number } {
  const parts: string[] = []; let imagesWithoutAlt = 0, visited = 0;
  function visit(node: unknown, depth: number) {
    if (depth > 30 || ++visited > 30_000) throw new Error('Contenido demasiado complejo para el análisis editorial.');
    if (Array.isArray(node)) { for (const child of node) visit(child, depth + 1); return; }
    const block = object(node);
    if (block._type === 'span' && typeof block.text === 'string') parts.push(block.text);
    if (block._type === 'image' && !first(block.alt, object(block.image).alt, object(block.value).alt)) imagesWithoutAlt++;
    // Read actual rich-text blocks. Do not count URLs, source MDX or metadata as prose.
    for (const key of ['children', 'blocks', 'body', 'content', 'rows', 'cells']) if (Array.isArray(block[key])) visit(block[key], depth + 1);
  }
  visit(value, 0);
  return { words: parts.join(' ').trim().split(/\s+/u).filter(Boolean).length, imagesWithoutAlt };
}

export function analyzeEntry(collection: Collection, entry: Entry, parent?: Entry): AuditRow {
  const data = entry.data, inherited = parent?.data ?? {}, issues: Issue[] = [];
  const add = (code: string, severity: Severity, message: string) => issues.push({ code, severity, message });
  const title = first(entry.seo?.title, data.meta_title, data.title, data.name, data.h1, parent?.seo?.title, inherited.meta_title, inherited.title);
  const description = first(entry.seo?.description, data.meta_description, data.description, data.short_description, data.descripcion, data.bio, parent?.seo?.description, inherited.short_description);
  const generatedDescription = !description && (collection === 'countries' || collection === 'cities');
  const unresolvedParent = collection === 'course_locales' && !parent;
  const titleLength = [...title].length, descriptionLength = [...description].length;
  if (!title) add('missing-title', 'error', 'Falta título o título SEO.');
  else if (titleLength > 70) add('long-title', 'warning', 'Revisa si el título puede ser más claro y breve; supera 70 caracteres.');
  if (!description && !generatedDescription && !unresolvedParent) add('missing-description', 'error', 'Completa la descripción de la página o la descripción SEO.');
  else if (descriptionLength > 180) add('long-description', 'warning', 'La descripción supera 180 caracteres; revisa la vista previa de búsqueda.');
  if (entry.seo?.noIndex) add('noindex', 'info', 'Tiene noindex explícito. Confirma que sea intencional.');
  if (entry.seo?.canonical) {
    try {
      const url = new URL(entry.seo.canonical);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('protocol');
      if (!['sably.co', 'www.sably.co', 'dev.sably.co'].includes(url.hostname)) add('external-canonical', 'warning', 'La URL canónica apunta fuera de Sably; confirma la intención.');
      if (url.search || url.hash) add('canonical-query', 'warning', 'La URL canónica contiene parámetros o fragmento.');
    } catch { add('invalid-canonical', 'error', 'La URL canónica debe ser una URL HTTP o HTTPS absoluta.'); }
  }
  const pendingCheckout = collection === 'courses' && (!first(data.hotmart_url) || /PENDIENTE/i.test(first(data.hotmart_url)));
  if (pendingCheckout) add('pending-checkout', 'info', 'Curso sin checkout: permanece fuera del sitemap comercial.');
  const body = data.body ?? inherited.body;
  const summary = portableTextSummary(body);
  const needsBody = ['courses', 'course_locales', 'blog', 'pages'].includes(collection);
  if (unresolvedParent) add('inheritance-unavailable', 'info', 'La API editorial no expandió el curso relacionado; el análisis no puede comprobar sus valores heredados.');
  if (needsBody && !summary.words && !(Array.isArray(data.layout) && data.layout.length) && !pendingCheckout && !unresolvedParent) add('empty-body', 'warning', 'No se encontró texto en el cuerpo enriquecido. Revisa la página renderizada.');
  if (summary.imagesWithoutAlt) add('image-alt', 'warning', `${summary.imagesWithoutAlt} imagen(es) del cuerpo sin texto alternativo.`);
  const image = entry.seo?.image ?? data.cover_image ?? data.card_image ?? parent?.seo?.image ?? inherited.cover_image ?? inherited.card_image;
  if (!imageExists(image) && ['courses', 'course_locales', 'blog'].includes(collection) && !unresolvedParent) add('missing-image', 'warning', 'Sin imagen editorial explícita; la plantilla puede usar la imagen general del sitio.');
  return {
    id: entry.id, collection, slug: entry.slug ?? '', title, description, titleLength, descriptionLength, generatedDescription,
    words: summary.words, issues,
    editorUrl: `/_emdash/admin/content/${encodeURIComponent(collection)}/${encodeURIComponent(entry.id)}`,
  };
}

export function auditEntries(entries: Partial<Record<Collection, Entry[]>>, now = new Date()): AuditReport {
  const courses = new Map<string, Entry>();
  for (const course of entries.courses ?? []) {
    courses.set(course.id, course); if (course.slug) courses.set(course.slug, course);
    const group = first(course.translationGroup, course.data.translation_group); if (group) courses.set(group, course);
  }
  const rows = COLLECTIONS.flatMap(collection => (entries[collection] ?? []).map(entry => {
    const reference = entry.data.course_record;
    const parentKey = first(reference, object(reference).id, object(reference)._ref, entry.data.course_slug);
    return analyzeEntry(collection, entry, collection === 'course_locales' ? courses.get(parentKey) ?? courses.get(text(entry.data.course_slug)) : undefined);
  }));
  const rank = (row: AuditRow) => row.issues.some(issue => issue.severity === 'error') ? 0 : row.issues.some(issue => issue.severity === 'warning') ? 1 : 2;
  rows.sort((a, b) => rank(a) - rank(b) || a.collection.localeCompare(b.collection) || a.title.localeCompare(b.title, 'es'));
  return { scanned: rows.length, errors: rows.filter(row => row.issues.some(issue => issue.severity === 'error')).length, warnings: rows.filter(row => row.issues.some(issue => issue.severity === 'warning')).length, rows, generatedAt: now.toISOString() };
}

export interface Reader { list(collection: string, options: { limit: number; cursor?: string; where: { status: string } }): Promise<{ items: Entry[]; hasMore: boolean; cursor?: string }> }
export async function readAuditEntries(reader: Reader): Promise<Partial<Record<Collection, Entry[]>>> {
  const result: Partial<Record<Collection, Entry[]>> = {};
  for (const collection of COLLECTIONS) {
    const rows: Entry[] = [], seen = new Set<string>(); let cursor: string | undefined;
    do {
      const page = await reader.list(collection, { limit: 100, cursor, where: { status: 'published' } });
      rows.push(...page.items);
      if (rows.length > 10_000) throw new Error(`La colección ${collection} supera el límite de esta auditoría; no se presentó un resultado parcial.`);
      if (!page.hasMore) break;
      if (!page.cursor || seen.has(page.cursor)) throw new Error(`Paginación inválida en ${collection}; no se presentó un resultado parcial.`);
      seen.add(page.cursor); cursor = page.cursor;
    } while (true);
    result[collection] = rows;
  }
  return result;
}
