import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { INTERNAL_CATEGORIES } from './lib/categories';

const categorySlugs = INTERNAL_CATEGORIES.map((c) => c.slug) as [string, ...string[]];

const courses = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/courses' }),
  schema: z.object({
    title: z.string(),
    metaTitle: z.string().optional(),
    category: z.enum(categorySlugs),
    /**
     * Slug del curso general del que este es una especialización. Marca al curso
     * como satélite: el pilar es el único que apunta al head term y el satélite
     * enlaza hacia él para sumar señal en vez de competir por la misma keyword.
     */
    pillar: z.string().optional(),
    subcategory: z.string(),
    shortDescription: z.string().max(180),
    level: z.enum(['Principiante', 'Intermedio', 'Avanzado', 'Todos los niveles']),
    durationHours: z.number().positive(),
    lessonsCount: z.number().int().positive(),
    modules: z
      .array(
        z.object({
          title: z.string(),
          lessons: z.array(z.string()).min(2),
        }),
      )
      .min(3),
    priceUSD: z.number().positive(),
    originalPriceUSD: z.number().positive(),
    rating: z.number().min(3.5).max(5),
    ratingCount: z.number().int().positive(),
    students: z.number().int().positive(),
    instructor: z.object({
      name: z.string(),
      title: z.string(),
      bio: z.string(),
    }),
    learnings: z.array(z.string()).min(5).max(8),
    audience: z.array(z.string()).min(3).max(5),
    faqs: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .min(4)
      .max(7),
    /** TODO(JP): URL real de checkout Hotmart por curso. */
    hotmartUrl: z.string().url().default('https://pay.hotmart.com/PENDIENTE'),
    /**
     * Código `ref` del afiliado para este producto. Es lo que acredita la comisión:
     * sin él, la venta se acredita al productor. Lo emite Hotmart por producto y se
     * lee del acortador (`hotm.art/<slug>-curso-crashing` → `?ref=XXXX`).
     */
    hotmartRef: z.string().optional(),
    featured: z.boolean().default(false),
    keywords: z.array(z.string()).min(3),
    publishedAt: z.coerce.date(),
  }),
});

const testimonials = defineCollection({
  loader: file('./src/content/testimonials.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    citySlug: z.string(),
    countryCode: z.string(),
    courseSlug: z.string().optional(),
    category: z.string().optional(),
    text: z.string().max(320),
    rating: z.number().min(4).max(5),
  }),
});

/**
 * Variante por país de cada curso, generada con Gemini y validada por
 * scripts/generar-catalogo.py. Un archivo por (curso, país); si falta,
 * la página usa el contenido genérico del MDX — la variante es opcional
 * por diseño para que el build nunca dependa del lote completo.
 */
const courseLocales = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/course-locales' }),
  schema: z.object({
    course: z.string(),
    country: z.string(),
    angulo: z.string(),
    meta_title: z.string(),
    meta_description: z.string(),
    h1: z.string(),
    subtitulo: z.string(),
    descripcion: z.string(),
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).min(4),
    beneficios: z.array(z.string()).min(4),
    para_quien: z.array(z.string()).min(3),
    requisitos: z.array(z.string()).min(2),
    certificado: z.string(),
    garantia: z.string(),
    _meta: z.object({ usd: z.number(), fallos: z.array(z.string()).nullable() }).passthrough(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(180),
    category: z.string().optional(),
    keywords: z.array(z.string()).min(3),
    publishedAt: z.coerce.date(),
  }),
});

export const collections = { courses, courseLocales, testimonials, blog };
