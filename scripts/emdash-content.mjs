#!/usr/bin/env node
/** Build and validate migration seeds locally. This script never opens a database or network. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { validateSeed } from 'emdash/seed';
import { blockTypes, buildEditorialContent, editorialRelations, extendCollections } from './emdash-editorial.mjs';
import { themeSeed } from '../src/themes/sably-classic/seed.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pilotCourse = 'curso-de-barberia';
const pilotPost = 'como-emprender-con-un-oficio-en-2026';
const countries = ['ar', 'cl', 'co', 'ec', 'es', 'mx', 'pe', 'us'];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const field = (slug, label, type = 'string', extra = {}) => ({ slug, label, type, ...extra });
const required = { required: true };

const provenanceFields = [
  field('source_metadata', 'Metadatos originales (archivo de migración)', 'json', required),
  field('source_path', 'Archivo de origen', 'string', required),
  field('source_sha256', 'SHA-256 del archivo de origen', 'string', required),
];
const sourceBodyField = field('source_body', 'Cuerpo MDX original (texto; no ejecutable)', 'text');

export const collections = extendCollections([
  {
    slug: 'courses', label: 'Cursos', labelSingular: 'Curso', titleField: 'title',
    description: 'Catálogo migrado de Astro. Los campos editoriales son la fuente activa; source_* conserva el original.',
    supports: ['drafts', 'revisions', 'seo'], urlPattern: '/co/{slug}/',
    sortOrder: 0, group: 'Catálogo', dateField: 'original_published_at',
    admin: { listColumns: ['category', 'price_usd', 'featured'] },
    fields: [
      field('title', 'Título', 'string', { ...required, searchable: true }),
      field('meta_title', 'Título SEO'),
      field('category', 'Categoría', 'string', { ...required, indexed: true }),
      field('pillar', 'Slug del curso pilar'),
      field('subcategory', 'Subcategoría', 'string', required),
      field('short_description', 'Descripción corta', 'text', { ...required, validation: { maxLength: 180 } }),
      field('level', 'Nivel', 'string', required),
      field('duration_hours', 'Duración (horas)', 'number', { ...required, validation: { min: 0.01 } }),
      field('lessons_count', 'Lecciones', 'integer', { ...required, validation: { min: 1 } }),
      field('modules', 'Temario: módulos y lecciones', 'json', required),
      field('price_usd', 'Precio USD', 'number', { ...required, validation: { min: 0.01 } }),
      field('original_price_usd', 'Precio original USD', 'number', { ...required, validation: { min: 0.01 } }),
      field('rating', 'Calificación verificada', 'number', { validation: { min: 0, max: 5 } }),
      field('rating_count', 'Valoraciones verificadas', 'integer', { validation: { min: 1 } }),
      field('students', 'Estudiantes verificados', 'integer', { validation: { min: 1 } }),
      field('instructor', 'Instructor', 'json'),
      field('learnings', 'Qué aprenderás', 'json', required),
      field('audience', 'Para quién es', 'json', required),
      field('faqs', 'Preguntas frecuentes', 'json', required),
      field('proveedor', 'Proveedor'),
      field('hotmart_url', 'Enlace Hotmart', 'url', required),
      field('video_key', 'Clave del video en R2'),
      field('featured', 'Destacado', 'boolean', { defaultValue: false }),
      field('keywords', 'Palabras clave', 'json', required),
      field('original_published_at', 'Publicación original', 'datetime', required),
      sourceBodyField, ...provenanceFields,
    ],
  },
  {
    slug: 'course_locales', label: 'Cursos por país', labelSingular: 'Variante por país', titleField: 'title',
    description: 'Variantes comerciales en español. El campo country conserva el país; no son traducciones de idioma.',
    supports: ['drafts', 'revisions'], sortOrder: 1, group: 'Catálogo',
    admin: { listColumns: ['country', 'course_slug'] },
    fields: [
      field('title', 'Título del registro', 'string', required),
      field('course_slug', 'Slug del curso', 'string', { ...required, indexed: true }),
      field('country', 'País (código)', 'string', { ...required, indexed: true }),
      field('angulo', 'Ángulo editorial', 'string', required),
      field('meta_title', 'Título SEO', 'string', required),
      field('meta_description', 'Descripción SEO', 'text', required),
      field('h1', 'Título de la página', 'string', required),
      field('subtitulo', 'Subtítulo', 'text', required),
      field('descripcion', 'Descripción (Markdown; no MDX)', 'text', required),
      field('faqs', 'Preguntas frecuentes', 'json', required),
      field('beneficios', 'Beneficios', 'json', required),
      field('para_quien', 'Para quién es', 'json', required),
      field('requisitos', 'Requisitos', 'json', required),
      field('certificado', 'Certificado', 'text', required),
      field('garantia', 'Garantía', 'text', required),
      field('generation_metadata', 'Metadatos de generación', 'json', required),
      ...provenanceFields,
    ],
  },
  {
    slug: 'blog', label: 'Artículos', labelSingular: 'Artículo', titleField: 'title',
    description: 'Artículos originales preservados para la adaptación editorial a contenido estructurado.',
    supports: ['drafts', 'revisions', 'seo'], urlPattern: '/blog/{slug}/',
    sortOrder: 2, dateField: 'original_published_at',
    fields: [
      field('title', 'Título', 'string', { ...required, searchable: true }),
      field('description', 'Descripción', 'text', { ...required, validation: { maxLength: 180 } }),
      field('category', 'Categoría', 'string', { indexed: true }),
      field('keywords', 'Palabras clave', 'json', required),
      field('faq', 'Preguntas frecuentes', 'json'),
      field('original_published_at', 'Publicación original', 'datetime', required),
      sourceBodyField, ...provenanceFields,
    ],
  },
]);

const courseMapping = {
  title: 'title', metaTitle: 'meta_title', category: 'category', pillar: 'pillar',
  subcategory: 'subcategory', shortDescription: 'short_description', level: 'level',
  durationHours: 'duration_hours', lessonsCount: 'lessons_count', modules: 'modules',
  priceUSD: 'price_usd', originalPriceUSD: 'original_price_usd', rating: 'rating',
  ratingCount: 'rating_count', students: 'students', instructor: 'instructor',
  learnings: 'learnings', audience: 'audience', faqs: 'faqs', proveedor: 'proveedor',
  hotmartUrl: 'hotmart_url', videoKey: 'video_key', featured: 'featured', keywords: 'keywords',
  publishedAt: 'original_published_at',
};
const blogMapping = {
  title: 'title', description: 'description', category: 'category', keywords: 'keywords',
  publishedAt: 'original_published_at', faq: 'faq',
};
const localeMapping = {
  course: 'course_slug', country: 'country', angulo: 'angulo', meta_title: 'meta_title',
  meta_description: 'meta_description', h1: 'h1', subtitulo: 'subtitulo', descripcion: 'descripcion',
  faqs: 'faqs', beneficios: 'beneficios', para_quien: 'para_quien', requisitos: 'requisitos',
  certificado: 'certificado', garantia: 'garantia', _meta: 'generation_metadata',
};

function mapMetadata(metadata, mapping, path) {
  assert(metadata && typeof metadata === 'object' && !Array.isArray(metadata), `${path}: expected an object`);
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => {
    assert(mapping[key], `${path}: unmapped metadata field ${key}; add it explicitly before migrating`);
    if (key === 'publishedAt') {
      const date = new Date(value);
      assert(Number.isFinite(date.valueOf()), `${path}: invalid publication date`);
      return [mapping[key], date.toISOString()];
    }
    return [mapping[key], value];
  }));
}

async function filesIn(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path, extension) : extname(path) === extension ? [path] : [];
  }));
  return nested.flat().sort();
}

async function readEntries(directory, extension, mapping, collection) {
  const base = join(root, 'src/content', directory);
  const files = await filesIn(base, extension);
  return Promise.all(files.map(async (path) => {
    const raw = await readFile(path, 'utf8');
    let metadata;
    let body;
    if (extension === '.mdx') {
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      assert(match, `${path}: missing YAML frontmatter`);
      const doc = parseDocument(match[1], { uniqueKeys: true, schema: 'core' });
      assert.equal(doc.errors.length, 0, `${path}: invalid YAML: ${doc.errors.map((e) => e.message).join('; ')}`);
      metadata = doc.toJS({ maxAliasCount: 100 });
      body = raw.slice(match[0].length); // Preserve every byte after the frontmatter delimiter.
    } else {
      metadata = JSON.parse(raw);
    }
    const slug = relative(base, path).slice(0, -extension.length).replaceAll('\\', '/');
    const data = mapMetadata(metadata, mapping, path);
    if (collection === 'courses') {
      data.featured ??= false;
      data.hotmart_url ??= 'https://pay.hotmart.com/PENDIENTE';
    }
    if (collection === 'course_locales') data.title = data.h1;
    if (body !== undefined) data.source_body = body;
    Object.assign(data, {
      source_metadata: metadata,
      source_path: relative(root, path).replaceAll('\\', '/'),
      source_sha256: hash(raw),
    });
    return { id: `${collection}:${slug}`, slug, status: 'published', locale: 'es', data };
  }));
}

/** Catch data errors which the official seed validator intentionally does not check. */
function validateData(seed) {
  for (const collection of seed.collections) {
    const fields = new Map(collection.fields.map((definition) => [definition.slug, definition]));
    for (const entry of seed.content[collection.slug] ?? []) {
      const context = `${collection.slug}/${entry.slug}`;
      for (const key of Object.keys(entry.data)) assert(fields.has(key), `${context}: unknown field ${key}`);
      for (const definition of fields.values()) {
        const value = entry.data[definition.slug];
        const label = `${context}.${definition.slug}`;
        if (definition.required) assert(value !== undefined && value !== null && value !== '', `${label}: required`);
        if (value === undefined || value === null) continue;
        switch (definition.type) {
          case 'string': case 'text': case 'url': case 'datetime':
            assert.equal(typeof value, 'string', `${label}: expected string`);
            if (definition.type === 'url') assert(['https:', 'http:'].includes(new URL(value).protocol), `${label}: unsafe URL`);
            if (definition.type === 'datetime') assert(Number.isFinite(Date.parse(value)), `${label}: invalid date`);
            if (definition.validation?.maxLength) assert(value.length <= definition.validation.maxLength, `${label}: too long`);
            break;
          case 'integer': assert(Number.isInteger(value), `${label}: expected integer`); // falls through
          case 'number':
            assert(typeof value === 'number' && Number.isFinite(value), `${label}: expected number`);
            if (definition.validation?.min !== undefined) assert(value >= definition.validation.min, `${label}: below minimum`);
            if (definition.validation?.max !== undefined) assert(value <= definition.validation.max, `${label}: above maximum`);
            break;
          case 'boolean': assert.equal(typeof value, 'boolean', `${label}: expected boolean`); break;
          case 'select':
            assert(definition.validation?.options?.includes(value), `${label}: invalid selection`); break;
          case 'multiSelect': assert(Array.isArray(value) && value.every((item) => typeof item === 'string'), `${label}: invalid selection list`); break;
          case 'repeater':
            assert(Array.isArray(value) && value.every((item) => item && typeof item === 'object'), `${label}: expected repeater rows`); break;
          case 'portableText': case 'blocks': assert(Array.isArray(value), `${label}: expected blocks`); break;
          case 'reference': assert(typeof value === 'string' || Array.isArray(value), `${label}: expected reference`); break;
          case 'image': assert(value && typeof value === 'object', `${label}: expected media reference`); break;
          case 'json': assert.deepEqual(JSON.parse(JSON.stringify(value)), value, `${label}: not lossless JSON`); break;
          default: throw new Error(`${label}: unvalidated field type ${definition.type}`);
        }
      }
    }
  }
  const courseSlugs = new Set(seed.content.courses?.map((entry) => entry.slug));
  for (const entry of seed.content.course_locales ?? []) {
    assert(courseSlugs.has(entry.data.course_slug), `${entry.slug}: orphan course variant`);
    assert(countries.includes(entry.data.country), `${entry.slug}: unknown country`);
    assert.equal(entry.slug, `${entry.data.course_slug}--${entry.data.country}`, 'Variant slug changed');
  }
  const ids = new Set(Object.values(seed.content).flat().map((entry) => entry.id));
  for (const entries of Object.values(seed.content)) for (const entry of entries) {
    const visit = (value) => {
      if (typeof value === 'string' && value.startsWith('$ref:')) assert(ids.has(value.slice(5)), `${entry.slug}: unresolved ${value}`);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(entry.data);
  }
}

/** Preserve content exported by EmDash, or Wrangler SELECT snapshots for the three pilot collections. */
function mergeExisting(content, snapshot) {
  if (!snapshot) return { entries: 0, changedFields: 0 };
  const rowsByCollection = Array.isArray(snapshot)
    ? Object.fromEntries(['courses', 'course_locales', 'blog'].map((slug, index) => [slug, snapshot[index]?.results ?? []]))
    : snapshot.content;
  assert(rowsByCollection && typeof rowsByCollection === 'object', 'Expected EmDash seed or Wrangler content snapshot');
  let merged = 0;
  let changed = 0;
  for (const [slug, rows] of Object.entries(rowsByCollection)) {
    const target = content[slug];
    if (!target) continue;
    const definitions = collections.find((collection) => collection.slug === slug).fields;
    for (const row of rows) {
      assert(!row.deleted_at && ['published', 'draft'].includes(row.status), `${slug}/${row.slug}: deleted or scheduled content needs a dedicated migration`);
      const source = row.data ?? row;
      const match = target.find((entry) => entry.slug === row.slug && (row.locale ?? 'es') === entry.locale);
      assert(match, `${slug}/${row.slug}: new or renamed CMS entry must be reconciled explicitly`);
      match.status = row.status;
      for (const definition of definitions) {
        if (!Object.hasOwn(source, definition.slug)) continue;
        let value = source[definition.slug];
        if (!row.data && value !== null) {
          if (['json', 'repeater', 'portableText', 'blocks', 'image', 'multiSelect'].includes(definition.type) && typeof value === 'string') value = JSON.parse(value);
          if (definition.type === 'boolean') value = Boolean(value);
        }
        if (JSON.stringify(match.data[definition.slug] ?? null) !== JSON.stringify(value)) changed++;
        if (value === null) delete match.data[definition.slug];
        else match.data[definition.slug] = value;
      }
      merged++;
    }
  }
  return { entries: merged, changedFields: changed };
}

export async function buildSeed(profile = 'pilot', existingSnapshot = null) {
  assert(['pilot', 'full', 'schema'].includes(profile), 'Profile must be pilot, full, or schema');
  const [courses, courseLocales, blog] = await Promise.all([
    readEntries('courses', '.mdx', courseMapping, 'courses'),
    readEntries('course-locales', '.json', localeMapping, 'course_locales'),
    readEntries('blog', '.mdx', blogMapping, 'blog'),
  ]);
  const initial = { courses, course_locales: courseLocales, blog };
  const merge = mergeExisting(initial, existingSnapshot);
  const seed = {
    ...themeSeed,
    version: '1', defaultLocale: 'es',
    meta: { name: 'Sably — migración a EmDash', description: 'Contenido importado de Astro para dev.sably.co. No ejecuta MDX.' },
    collections, blockTypes, relations: editorialRelations,
    content: await buildEditorialContent(root, initial),
  };
  const validation = validateSeed(seed);
  assert(validation.valid, validation.errors.join('\n'));
  assert.equal(validation.warnings.length, 0, validation.warnings.join('\n'));
  validateData(seed);
  const counts = Object.fromEntries(Object.entries(seed.content).map(([key, value]) => [key, value.length]));
  if (profile === 'pilot') {
    seed.content.courses = courses.filter((entry) => entry.slug === pilotCourse);
    seed.content.course_locales = courseLocales.filter((entry) => entry.data.course_slug === pilotCourse);
    seed.content.blog = blog.filter((entry) => entry.slug === pilotPost);
    seed.content.categories = seed.content.categories.filter((entry) => seed.content.courses.some((course) => course.data.category === entry.slug));
    seed.content.creators = seed.content.creators.filter((entry) => seed.content.courses.some((course) => course.data.creator_slug === entry.slug));
    for (const collection of ['cities', 'testimonials', 'pages', 'homologaciones']) seed.content[collection] = [];
    assert.equal(seed.content.courses.length, 1, 'Missing pilot course');
    assert.equal(seed.content.course_locales.length, countries.length, 'Missing pilot country variants');
    assert.equal(seed.content.blog.length, 1, 'Missing pilot blog entry');
  }
  if (profile === 'schema') seed.content = {};
  const selectedValidation = validateSeed(seed);
  assert(selectedValidation.valid, selectedValidation.errors.join('\n'));
  validateData(seed);
  return { seed, counts, merge };
}

async function main() {
  const args = process.argv.slice(2);
  let profile = 'pilot';
  let output = 'emdash.seed.json';
  let explicitOutput = false;
  let check = false;
  let existingPath;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--check') check = true;
    else if (arg === '--profile') profile = args[++index];
    else if (arg === '--output') { output = args[++index]; explicitOutput = true; }
    else if (arg === '--existing-seed') existingPath = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  assert(typeof output === 'string' && output.length, '--output requires a file path');
  assert(profile === 'pilot' || explicitOutput, 'Non-pilot profiles require --output to preserve the embedded pilot seed');
  const existing = existingPath ? JSON.parse(await readFile(resolve(root, existingPath), 'utf8')) : null;
  const { seed, counts, merge } = await buildSeed(profile, existing);
  const serialized = `${JSON.stringify(seed, null, 2)}\n`;
  const destination = resolve(root, output);
  if (check) {
    assert.equal(await readFile(destination, 'utf8'), serialized, 'Seed differs from sources; regenerate it before deployment');
  } else {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, serialized);
  }
  console.log(JSON.stringify({
    action: check ? 'validated' : 'generated', profile,
    sourceCounts: counts,
    preservedExisting: merge,
    seedCounts: Object.fromEntries(Object.entries(seed.content).map(([key, value]) => [key, value.length])),
    bytes: Buffer.byteLength(serialized), sha256: hash(serialized), output: relative(root, destination),
    validation: 'EmDash validateSeed + values + source relationships',
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
