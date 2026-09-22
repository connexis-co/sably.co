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
    /**
     * Prueba social. OPCIONALES a propósito, y `rating` sin suelo.
     *
     * Antes eran obligatorios y `rating` exigía un mínimo de 3.5, así que no se
     * podía publicar una ficha sin ponerle una nota, un número de valoraciones,
     * unos alumnos y un instructor —existiera o no el producto—. Inventar no era
     * un descuido: era el único modo de pasar el esquema. El resultado fueron 23
     * cursos sin checkout publicando 7.581 valoraciones y 47.265 estudiantes que
     * nunca existieron, y un instructor con nombre y biografía que Google llegó a
     * indexar como persona real.
     *
     * Siendo opcionales, la ficha que no tiene el dato simplemente no lo muestra.
     * Y sin el suelo de 3.5 se puede escribir la nota verdadera cuando es más
     * baja (velas es 3,1 real) en lugar de redondearla hacia arriba.
     *
     * Cuando existan, salen de Hotmart y no del criterio de quien redacta:
     * `api-ask.hotmart.com/api/v1/survey/product/<idProducto>/rating` da `average`
     * y `totalAnswers`; el `totalUsers` de la ficha de marketplace da los alumnos.
     */
    rating: z.number().min(0).max(5).optional(),
    ratingCount: z.number().int().positive().optional(),
    students: z.number().int().positive().optional(),
    instructor: z
      .object({
        name: z.string(),
        title: z.string(),
        bio: z.string(),
      })
      .optional(),
    learnings: z.array(z.string()).min(5).max(8),
    audience: z.array(z.string()).min(3).max(5),
    faqs: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .min(4)
      .max(7),
    /**
     * Creador del curso, cuando su política comercial se aparta de la general.
     * Ver src/lib/proveedores.ts: hay creadores que no aceptan el cupón del
     * sitio porque el precio elegido ya viaja dentro de su acortador.
     */
    proveedor: z.string().optional(),
    /** TODO(JP): URL real de checkout Hotmart por curso. */
    hotmartUrl: z.string().url().default('https://pay.hotmart.com/PENDIENTE'),
    /**
     * Nombre del archivo del video de presentación en R2 (bucket sably-assets,
     * servido por cdn.sably.co). Sin él la tarjeta muestra solo la portada.
     */
    videoKey: z.string().optional(),
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
    /**
     * Preguntas frecuentes (opcional). Se renderizan VISIBLES en la ficha y se
     * emiten como FAQPage schema: el texto debe coincidir con el DOM (Google
     * sanciona el FAQPage cuyo contenido no está visible en la página). Formato
     * pensado para citeabilidad por LLMs: pregunta directa + respuesta concreta.
     */
    faq: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .min(2)
      .max(8)
      .optional(),
  }),
});

export const collections = { courses, courseLocales, testimonials, blog };
