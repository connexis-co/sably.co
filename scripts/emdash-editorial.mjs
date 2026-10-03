/** Editorial schema and deterministic adapters for trusted repository data. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { contactDefaults } from '../src/lib/contact-page.mjs';
import { structureInstitutionalPage } from './institutional-pages.mjs';
import { parse as parseAstro } from '@astrojs/compiler';
import { markdownToPortableText } from 'emdash/client';

export const field = (slug, label, type = 'string', extra = {}) => ({ slug, label, type, ...extra });
const textItems = (slug, label) => field(slug, label, 'repeater', {
  validation: { subFields: [field('text', 'Texto', 'text', { required: true })] },
});
const faqs = () => field('faq_items', 'Preguntas frecuentes', 'repeater', {
  validation: { subFields: [field('q', 'Pregunta', 'string', { required: true }), field('a', 'Respuesta', 'text', { required: true })] },
});
const template = () => field('template', 'Plantilla', 'select', {
  defaultValue: 'sably-classic', validation: { options: ['sably-classic'] },
});
const media = (slug, label) => field(slug, label, 'image');
const relationField = (slug, label, relation) => field(slug, label, 'reference', { validation: { relation } });
const provenance = [
  field('source_metadata', 'Archivo: datos originales', 'json'),
  field('source_path', 'Archivo: ruta de origen'),
  field('source_sha256', 'Archivo: SHA-256'),
];
const collection = (slug, label, fields, extra = {}) => ({
  slug, label, titleField: 'name', supports: ['drafts', 'revisions', ...(['categories', 'countries', 'cities', 'creators', 'homologaciones'].includes(slug) ? ['seo'] : [])],
  group: 'Sitio', fields: [...fields, ...provenance], ...extra,
});
const relation = (slug, parentCollection, childCollection, parentLabel, childLabel) => ({
  slug, parentCollection, childCollection, parentLabel, childLabel, maxChildrenPerParent: 1,
});

export const editorialRelations = [
  relation('courses_categories', 'courses', 'categories', 'Cursos', 'Categoría'),
  relation('courses_creators', 'courses', 'creators', 'Cursos', 'Creador'),
  relation('variants_courses', 'course_locales', 'courses', 'Variantes', 'Curso'),
  relation('variants_countries', 'course_locales', 'countries', 'Variantes', 'País'),
  relation('cities_countries', 'cities', 'countries', 'Ciudades', 'País'),
  relation('testimonials_courses', 'testimonials', 'courses', 'Testimonios', 'Curso'),
  relation('testimonials_countries', 'testimonials', 'countries', 'Testimonios', 'País'),
];

export const blockTypes = [
  { slug: 'sably_story', label: 'Historia con imagen', fields: [field('eyebrow', 'Antetítulo'), field('title', 'Título'), field('content', 'Texto', 'portableText'), media('image', 'Imagen')] },
  { slug: 'sably_cards', label: 'Grupo de tarjetas', fields: [field('eyebrow', 'Antetítulo'), field('title', 'Título'), field('background', 'Fondo', 'select', { validation: { options: ['white', 'soft'] } }), field('cards', 'Tarjetas', 'repeater', { validation: { subFields: [field('icon', 'Icono o emoji'), field('title', 'Título'), field('text', 'Texto', 'text'), field('button_label', 'Texto del enlace'), field('button_url', 'Enlace', 'url')] } })] },
  { slug: 'sably_contact', label: 'Formulario y canales de contacto', fields: Object.entries(contactDefaults).map(([slug, defaultValue]) => field(slug, ({form_title:'Formulario: título', name_label:'Campo: nombre', email_label:'Campo: correo', phone_label:'Campo: teléfono', country_label:'Campo: país', message_label:'Campo: mensaje', message_placeholder:'Ayuda del mensaje', submit_label:'Botón de envío', consent_text:'Autorización de datos (texto mostrado y registrado)', privacy_label:'Texto del enlace de privacidad', privacy_url:'Enlace a privacidad', channels_title:'Título de canales', email:'Correo público', whatsapp:'WhatsApp (vacío = número del país)', whatsapp_label:'Botón de WhatsApp', whatsapp_description:'Descripción de WhatsApp', hours:'Horario de atención (opcional)', help_title:'Título de ayuda', help_text:'Texto de ayuda', help_button_label:'Botón de ayuda', help_button_url:'Enlace de ayuda'})[slug], ['consent_text','help_text','whatsapp_description'].includes(slug)?'text':slug.endsWith('_url')?'url':'string', {defaultValue})) },
  { slug: 'sably_rich_text', label: 'Texto enriquecido', fields: [field('content', 'Contenido', 'portableText')] },
  { slug: 'sably_image', label: 'Imagen', fields: [media('image', 'Imagen'), field('caption', 'Leyenda', 'text')] },
  { slug: 'sably_hero', label: 'Cabecera', fields: [field('title', 'Título'), field('text', 'Texto', 'text'), media('image', 'Imagen'), field('button_label', 'Texto del botón'), field('button_url', 'Enlace del botón', 'url')] },
  { slug: 'sably_cta', label: 'Llamada a la acción', fields: [field('title', 'Título'), field('text', 'Texto', 'text'), field('button_label', 'Texto del botón'), field('button_url', 'Enlace del botón', 'url')] },
  { slug: 'sably_faq', label: 'Preguntas frecuentes', fields: [field('title', 'Título'), faqs()] },
].map(({ fields, ...type }) => ({ ...type, category: 'Sably', currentVersion: 1, versions: [{ version: 1, fields }] }));

export function extendCollections(base) {
  const bySlug = new Map(base.map((entry) => [entry.slug, entry]));
  const course = bySlug.get('courses');
  course.fields.push(
    template(), field('body', 'Descripción completa', 'portableText'),
    media('cover_image', 'Portada principal'), media('card_image', 'Portada de tarjeta'),
    field('curriculum', 'Temario', 'repeater', { validation: { subFields: [
      field('title', 'Módulo', 'string', { required: true }),
      field('lessons_text', 'Lecciones (una por línea)', 'text', { required: true }),
    ] } }),
    textItems('learning_items', 'Qué aprenderás'), textItems('audience_items', 'Para quién es'),
    textItems('keyword_items', 'Palabras clave'), faqs(),
    field('instructor_name', 'Nombre del instructor'), field('instructor_title', 'Cargo del instructor'),
    field('instructor_bio', 'Biografía del instructor', 'text'), field('creator_slug', 'Slug del creador'),
    relationField('category_record', 'Categoría vinculada', 'courses_categories'),
    relationField('creator_record', 'Creador vinculado', 'courses_creators'),
  );
  bySlug.get('course_locales').fields.push(
    field('body', 'Descripción completa', 'portableText'), faqs(), textItems('benefit_items', 'Beneficios'),
    textItems('audience_items', 'Para quién es'), textItems('requirement_items', 'Requisitos'),
    relationField('course_record', 'Curso vinculado', 'variants_courses'),
    relationField('country_record', 'País vinculado', 'variants_countries'),
  );
  bySlug.get('blog').fields.push(
    template(), field('body', 'Artículo', 'portableText'), faqs(), textItems('keyword_items', 'Palabras clave'),
    media('cover_image', 'Portada principal'), media('card_image', 'Portada de tarjeta'),
  );
  // Keep existing field types intact. Archived JSON never blocks creation in the friendly editor.
  const archived = {
    courses: new Set(['modules', 'learnings', 'audience', 'keywords', 'faqs', 'instructor']),
    course_locales: new Set(['descripcion', 'faqs', 'beneficios', 'para_quien', 'requisitos', 'generation_metadata']),
    blog: new Set(['keywords', 'faq']),
  };
  for (const entry of base) {
    const isArchived = (definition) => definition.slug.startsWith('source_') || archived[entry.slug].has(definition.slug);
    for (const definition of entry.fields) if (isArchived(definition)) {
      delete definition.required;
      definition.label = `Archivo — ${definition.label}`;
    }
    entry.fields.sort((a, b) => Number(isArchived(a)) - Number(isArchived(b)));
  }
  return [...base,
    collection('categories', 'Categorías', [
      field('name', 'Nombre', 'string', { required: true }), field('emoji', 'Emoji'), field('description', 'Descripción', 'text'),
      field('gradient_start', 'Color inicial'), field('gradient_end', 'Color final'), field('external_url', 'Web externa', 'url'),
      field('subcategories', 'Subcategorías', 'repeater', { validation: { subFields: [field('slug', 'Slug'), field('name', 'Nombre')] } }),
      media('cover_image', 'Portada principal'), media('card_image', 'Portada de tarjeta'),
    ], { group: 'Catálogo', sortOrder: 3 }),
    collection('countries', 'Países', [
      field('name', 'Nombre', 'string', { required: true }), field('code', 'Código de país', 'string', { required: true, unique: true }),
      field('flag', 'Bandera'), field('hreflang', 'Idioma regional'), field('currency', 'Moneda'), field('currency_symbol', 'Símbolo'),
      field('usd_rate', 'Tasa USD de respaldo', 'number'), field('price_round', 'Redondeo', 'number'),
      field('whatsapp', 'WhatsApp'), field('phone_display', 'Teléfono visible'), media('hero_image', 'Imagen de cabecera'), template(),
    ], { sortOrder: 4 }),
    collection('cities', 'Ciudades', [
      field('name', 'Nombre', 'string', { required: true }), field('city_slug', 'Slug de ciudad', 'string', { required: true }),
      field('country_code', 'Código de país', 'string', { required: true, indexed: true }),
      relationField('country_record', 'País', 'cities_countries'),
    ], { sortOrder: 5 }),
    collection('creators', 'Creadores', [
      field('name', 'Nombre', 'string', { required: true }), field('bio', 'Biografía', 'text'),
      field('since', 'En Hotmart desde', 'integer'), field('verified', 'Verificado en origen', 'boolean'),
      field('best_seller', 'Best seller en origen', 'boolean'), media('photo', 'Foto'), field('photo_url', 'Foto original', 'url'),
      field('course_slugs', 'Slugs de cursos de origen', 'multiSelect'),
    ], { group: 'Catálogo', sortOrder: 6, urlPattern: '/co/creadores/{slug}/' }),
    collection('testimonials', 'Testimonios editoriales', [
      field('name', 'Nombre', 'string', { required: true }), field('text', 'Testimonio', 'text', { required: true }),
      field('rating', 'Calificación original', 'number', { validation: { min: 0, max: 5 } }),
      field('city_slug', 'Slug de ciudad'), field('country_code', 'Código de país'), field('course_slug', 'Slug de curso'), field('category', 'Categoría'),
      relationField('country_record', 'País', 'testimonials_countries'), relationField('course_record', 'Curso', 'testimonials_courses'),
    ], { group: 'Catálogo', sortOrder: 7, description: 'Testimonios del archivo editorial original; no equivalen a reseñas verificadas de Hotmart ni a comentarios de visitantes.' }),
    collection('pages', 'Páginas', [
      field('title', 'Título SEO', 'string', { required: true }), field('description', 'Descripción SEO', 'text'),
      field('hero_heading', 'Título visible'), field('hero_label', 'Antetítulo de cabecera'), field('hero_text', 'Introducción de cabecera', 'text'), field('path', 'Ruta pública', 'string', { required: true }), template(),
      field('body', 'Contenido', 'portableText'),
      field('layout', 'Diseño de la página', 'blocks', { validation: { allowedTypes: blockTypes.map((b) => b.slug) } }),
    ], { titleField: 'title', sortOrder: 8, supports: ['drafts', 'revisions', 'seo'] }),
    collection('homologaciones', 'Homologaciones', [
      field('name', 'Nombre', 'string', { required: true }), field('emoji', 'Emoji'), field('cover_category', 'Categoría de portada'),
      field('short_description', 'Descripción corta', 'text'), field('keyword', 'Palabra clave'),
      textItems('audience_items', 'Para quién es'), textItems('evaluation_items', 'Qué se evalúa'),
      field('locations', 'Sedes', 'repeater', { validation: { subFields: [field('city', 'Ciudad'), field('region', 'Departamento')] } }),
      media('cover_image', 'Portada'), template(),
    ], { group: 'Catálogo', sortOrder: 9, urlPattern: '/homologaciones/{slug}/' }),
  ];
}

function literal(node) {
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map((property) => {
    assert(ts.isPropertyAssignment(property), 'Only literal TS property assignments may be imported');
    return [property.name.text, literal(property.initializer)];
  }));
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression);
  if (ts.isNewExpression(node) && node.expression.getText() === 'Set') return literal(node.arguments[0]);
  throw new Error(`Unsupported static expression in content source: ${node.getText().slice(0, 80)}`);
}

async function staticExport(root, path, name) {
  const raw = await readMigrationSource(root, path);
  const ast = ts.createSourceFile(path, raw, ts.ScriptTarget.Latest, true);
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText() === name) return { raw, path, data: literal(declaration.initializer) };
    }
  }
  throw new Error(`Missing static export ${name} in ${path}`);
}

export async function readMigrationSource(root, path) {
  const snapshot = JSON.parse(await readFile(join(root, 'scripts/migration-source/legacy-site.json'), 'utf8'));
  return snapshot.sources[path] ?? readFile(join(root, path), 'utf8');
}

export function portableBody(markdown) {
  // The official converter uses a module-level key counter. Re-key each document,
  // including annotation references, so the seed does not depend on call order.
  const blocks = markdownToPortableText(markdown);
  const keyMap = new Map();
  let keyCount = 0;
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value._key === 'string') keyMap.set(value._key, `s${(keyCount++).toString(36)}`);
    for (const item of Object.values(value)) if (typeof item === 'object') collect(item);
  }
  collect(blocks);
  return JSON.parse(JSON.stringify(blocks, (key, value) => {
    if (key === '_key') return keyMap.get(value) ?? value;
    if (key === 'marks') return value.map((mark) => keyMap.get(mark) ?? mark);
    return value;
  }));
}

const items = (values) => (values ?? []).map((text) => ({ text }));
const reference = (collection, slug) => [`$ref:${collection}:${slug}`];
const CDN = 'https://cdn.sably.co';
export function mediaReference(url, alt) {
  return { $media: { url, alt, filename: decodeURIComponent(new URL(url).pathname.split('/').at(-1)) } };
}
function entry(collection, slug, data, source, original) {
  return { id: `${collection}:${slug}`, slug, locale: 'es', status: 'published', data: {
    ...data, source_metadata: original,
    source_path: source.path,
    source_sha256: createHash('sha256').update(source.raw).digest('hex'),
  } };
}

/** Backfill editorial fields from CURRENT fields, including preserved pilot edits. */
export function enrichEditorialEntry(collection, data) {
  if (collection === 'courses') {
    data.template ??= 'sably-classic';
    data.body ??= portableBody(data.source_body ?? '');
    data.curriculum ??= (data.modules ?? []).map((module) => ({ title: module.title, lessons_text: module.lessons.join('\n') }));
    data.learning_items ??= items(data.learnings);
    data.audience_items ??= items(data.audience);
    data.keyword_items ??= items(data.keywords);
    data.faq_items ??= data.faqs ?? [];
    if (data.instructor) {
      data.instructor_name ??= data.instructor.name;
      data.instructor_title ??= data.instructor.title;
      data.instructor_bio ??= data.instructor.bio;
    }
  } else if (collection === 'course_locales') {
    data.body ??= portableBody(data.descripcion ?? '');
    data.faq_items ??= data.faqs ?? [];
    data.benefit_items ??= items(data.beneficios);
    data.audience_items ??= items(data.para_quien);
    data.requirement_items ??= items(data.requisitos);
  } else if (collection === 'blog') {
    data.template ??= 'sably-classic';
    data.body ??= portableBody(data.source_body ?? '');
    data.keyword_items ??= items(data.keywords);
    data.faq_items ??= data.faq ?? [];
  }
}

const pageSpecs = [
  { slug: 'nosotros', path: '/nosotros/', file: 'src/pages/nosotros/index.astro' },
  { slug: 'contacto', path: '/contacto/', file: 'src/pages/contacto/index.astro' },
  { slug: 'privacidad', path: '/legal/privacidad/', file: 'src/pages/legal/privacidad/index.astro' },
  { slug: 'terminos', path: '/legal/terminos/', file: 'src/pages/legal/terminos/index.astro' },
];

async function pageEntry(root, spec) {
  const raw = await readMigrationSource(root, spec.file);
  const { ast } = await parseAstro(raw);
  const paragraphs = [];
  const anchors = new Map();
  let heading = '';
  let title = '';
  let description = '';
  const attribute = (node, name) => node.attributes?.find((attr) => attr.name === name)?.value ?? '';
  const inline = (node) => {
    if (node.type === 'text') return node.value;
    if (node.type === 'expression') return node.children?.map((n) => n.value).join('').trim() === 'COUNTRIES.length' ? '8' : '';
    const text = (node.children ?? []).map(inline).join('');
    if (node.name === 'strong') return `**${text}**`;
    if (node.name === 'a') {
      const href = attribute(node, 'href');
      return href && !href.includes('{') && /^(https?:|\/)/.test(href) ? `[${text}](${href})` : text;
    }
    return text;
  };
  const walk = (node) => {
    if (['frontmatter', 'comment'].includes(node.type) || ['script', 'style', 'form', 'nav'].includes(node.name)) return;
    if (node.name === 'BaseLayout') { title = attribute(node, 'title'); description = attribute(node, 'description'); }
    if (node.name === 'SectionHeading') {
      const value = attribute(node, 'title');
      if (value) paragraphs.push(`## ${value}`);
      return;
    }
    if (/^h[1-6]$/.test(node.name ?? '') || ['p', 'li'].includes(node.name)) {
      const text = inline(node).replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (node.name === 'h1') heading ||= text;
      else {
        paragraphs.push(`${node.name.startsWith('h') ? '#'.repeat(Number(node.name[1])) + ' ' : node.name === 'li' ? '- ' : ''}${text}`);
        if (node.name.startsWith('h') && attribute(node, 'id')) anchors.set(text, attribute(node, 'id'));
      }
      return;
    }
    if (node.type === 'expression') {
      // Extract static cards from literal array.map expressions without executing JS.
      const source = node.children?.filter((child) => child.type === 'text').map((child) => child.value).join('') ?? '';
      const opening = source.indexOf('[');
      const closing = source.indexOf('].map');
      if (opening >= 0 && closing > opening) {
        const fragment = ts.createSourceFile('cards.ts', `const cards = ${source.slice(opening, closing + 1)}`, ts.ScriptTarget.Latest, true);
        const cards = literal(fragment.statements[0].declarationList.declarations[0].initializer);
        for (const card of cards) if (card.title && card.text) paragraphs.push(`### ${card.title}\n\n${card.text}`);
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(ast);
  const frontmatter = ast.children.find((node) => node.type === 'frontmatter')?.value ?? '';
  const metadataAst = ts.createSourceFile('metadata.ts', frontmatter, ts.ScriptTarget.Latest, true);
  for (const statement of metadataAst.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (['title', 'description'].includes(declaration.name.getText()) && declaration.initializer && ts.isStringLiteralLike(declaration.initializer)) {
        if (declaration.name.getText() === 'title') title = literal(declaration.initializer);
        else description = literal(declaration.initializer);
      }
    }
  }
  assert(title && heading && paragraphs.length, `${spec.file}: could not extract editable page content`);
  const body = portableBody(paragraphs.join('\n\n'));
  for (const block of body) {
    const anchor = anchors.get(block.children?.map((span) => span.text).join(''));
    if (anchor) block.anchor = anchor;
  }
  const data = {title, description, hero_heading: heading, path: spec.path, template: 'sably-classic', body, layout: [{ _type: 'sably_rich_text', _version: 1, _key: `page-${spec.slug}`, content: body }]};
  Object.assign(data, structureInstitutionalPage(spec.slug, data, mediaReference(`${CDN}/covers/oficios.jpg`, 'Estudiante de oficios trabajando con sus manos')));
  return entry('pages', spec.slug, data, { path: spec.file, raw }, { title, description, path: spec.path, original_template: raw });
}

export async function buildEditorialContent(root, content) {
  const [categories, countries, covers, heroes, programs, locations] = await Promise.all([
    staticExport(root, 'src/lib/categories.ts', 'CATEGORIES'), staticExport(root, 'src/lib/countries.ts', 'COUNTRIES'),
    staticExport(root, 'src/lib/course-covers.ts', 'COURSE_COVERS'), staticExport(root, 'src/lib/hero-assets.ts', 'HERO_ASSETS'),
    staticExport(root, 'src/lib/homologaciones.ts', 'PROGRAMAS'), staticExport(root, 'src/lib/homologaciones.ts', 'SEDES'),
  ]);
  const hotmart = { path: 'src/data/hotmart-live.json', raw: await readFile(join(root, 'src/data/hotmart-live.json'), 'utf8') };
  const live = JSON.parse(hotmart.raw);
  const testimony = { path: 'src/content/testimonials.json', raw: await readFile(join(root, 'src/content/testimonials.json'), 'utf8') };
  const knownCourses = new Set(content.courses.map((course) => course.slug));
  const categoryData = categories.data.map((category) => entry('categories', category.slug, {
    name: category.name, emoji: category.emoji, description: category.description,
    gradient_start: category.gradient[0], gradient_end: category.gradient[1], subcategories: category.subcategories,
    ...(category.externalUrl ? { external_url: category.externalUrl } : {}),
    cover_image: mediaReference(`${CDN}/covers/${category.slug}.jpg`, category.name),
    card_image: mediaReference(`${CDN}/covers/${category.slug}-card.jpg`, category.name),
  }, categories, category));
  const countryData = countries.data.map((country) => entry('countries', country.code, {
    name: country.name, code: country.code, flag: country.flag, hreflang: country.hreflang,
    currency: country.currency, currency_symbol: country.currencySymbol, usd_rate: country.usdRate,
    price_round: country.priceRound, whatsapp: country.whatsapp, phone_display: country.phoneDisplay,
    hero_image: mediaReference(`${CDN}/heroes/${heroes.data[country.code]}`, `Cursos de oficios en ${country.name}`),
    template: 'sably-classic',
  }, countries, country));
  const cityData = countries.data.flatMap((country) => country.cities.map((city) => entry('cities', `${country.code}--${city.slug}`, {
    name: city.name, city_slug: city.slug, country_code: country.code, country_record: reference('countries', country.code),
  }, countries, city)));
  const creatorData = Object.entries(live.autores ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([slug, author]) => {
    const photo = author.foto ? new URL(author.foto, 'https://sably.co').href : author.avatar;
    return entry('creators', slug, {
      name: author.nombre, bio: author.bio, ...(author.desde ? { since: author.desde } : {}),
      verified: author.verificado, best_seller: author.bestSeller,
      ...(photo ? { photo: mediaReference(photo, author.nombre), photo_url: photo } : {}),
      course_slugs: Object.entries(live.productos ?? {}).filter(([course, product]) => knownCourses.has(course) && product.autor === slug).map(([course]) => course).sort(),
    }, hotmart, author);
  });
  const coverSet = new Set(covers.data);
  for (const course of content.courses) {
    enrichEditorialEntry('courses', course.data);
    const prefix = coverSet.has(course.slug) ? `covers/cursos/${course.slug}` : `covers/${course.data.category}`;
    course.data.cover_image ??= mediaReference(`${CDN}/${prefix}.jpg`, course.data.title);
    course.data.card_image ??= mediaReference(`${CDN}/${prefix}-card.jpg`, course.data.title);
    course.data.category_record ??= reference('categories', course.data.category);
    const creator = live.productos?.[course.slug]?.autor;
    if (creatorData.some((entry) => entry.slug === creator)) {
      course.data.creator_slug ??= creator;
      course.data.creator_record ??= reference('creators', creator);
    }
  }
  for (const variant of content.course_locales) {
    enrichEditorialEntry('course_locales', variant.data);
    variant.data.course_record ??= reference('courses', variant.data.course_slug);
    variant.data.country_record ??= reference('countries', variant.data.country);
  }
  for (const post of content.blog) {
    enrichEditorialEntry('blog', post.data);
    const category = categories.data.find((category) => !category.externalUrl && [category.name.toLowerCase(), category.slug].includes((post.data.category ?? '').toLowerCase()))?.slug ?? 'emprendimiento';
    post.data.cover_image ??= mediaReference(`${CDN}/covers/${category}.jpg`, post.data.title);
    post.data.card_image ??= mediaReference(`${CDN}/covers/${category}-card.jpg`, post.data.title);
  }
  const testimonialData = JSON.parse(testimony.raw).map((item) => entry('testimonials', item.id, {
    name: item.name, text: item.text, rating: item.rating, city_slug: item.citySlug, country_code: item.countryCode,
    ...(item.courseSlug ? { course_slug: item.courseSlug } : {}), ...(item.category ? { category: item.category } : {}),
    country_record: reference('countries', item.countryCode),
    ...(knownCourses.has(item.courseSlug) ? { course_record: reference('courses', item.courseSlug) } : {}),
  }, testimony, item));
  const homologaciones = programs.data.map((program) => entry('homologaciones', program.slug, {
    name: program.name, emoji: program.emoji, cover_category: program.coverCategory,
    short_description: program.shortDescription, keyword: program.keyword,
    audience_items: items(program.audience), evaluation_items: items(program.evaluacion), locations: locations.data,
    cover_image: mediaReference(`${CDN}/covers/${program.coverCategory}.jpg`, program.name), template: 'sably-classic',
  }, programs, program));
  return {
    categories: categoryData, countries: countryData, creators: creatorData, cities: cityData,
    courses: content.courses, course_locales: content.course_locales, blog: content.blog,
    testimonials: testimonialData, pages: await Promise.all(pageSpecs.map((spec) => pageEntry(root, spec))), homologaciones,
  };
}
