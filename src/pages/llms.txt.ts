import type { APIRoute } from 'astro';
import { getContentRepository } from '@/lib/emdash-content';
import { aiCatalogCourses } from '@/lib/ai-catalog';
export const prerender = false;


import { SITE } from '@/lib/site';

/** llms.txt — descripción del sitio para agentes/LLMs (llmstxt.org). */
export const GET: APIRoute = async () => {
  const cms = await getContentRepository();
  const [allCourses, categories, COUNTRIES] = await Promise.all([cms.getCourses(), cms.getCategories(), cms.getCountries()]);
  const courses = aiCatalogCourses(allCourses);
  const INTERNAL_CATEGORIES = categories.filter(c => !c.externalUrl);
  const body = `# Sably

> Plataforma de educación online en español para aprender oficios prácticos y habilidades que la IA
> no puede reemplazar (belleza, panadería, electricidad, gastronomía, idiomas y más), en 8 países de
> Latinoamérica y España.
> Reúne ${courses.length} cursos seleccionados de creadores independientes, con constancia de finalización,
> acceso de por vida y garantía de 7 días; guías gratuitas en el blog, vídeos de presentación de cada curso,
> orientación por WhatsApp antes de inscribirse y homologación de saberes con instituciones aliadas en Colombia.
> Cada curso lo dicta su creador; la inscripción y el pago se hacen en Hotmart. Sably se financia con una
> comisión del creador por cada inscripción, sin costo extra para el alumno. Cada ficha muestra el precio del
> checkout de su país, en moneda local o en dólares según el país.

Cada curso tiene una ficha por país (/{código-país}/{slug-del-curso}/). Las antiguas URLs de ciudad
redirigen con 301 a la ficha de su país. Países: ${COUNTRIES.map((c) => c.code).join(', ')}.

## Categorías
${INTERNAL_CATEGORIES.map((c) => `- [${c.name}](${SITE.url}/co/cursos/${c.slug}/): ${c.description}`).join('\n')}

## Páginas principales
- [Todos los cursos](${SITE.url}/co/cursos/)
- [Homologación de saberes](${SITE.url}/homologaciones/): certificación de experiencia con instituciones ETDH aliadas en Colombia
- [Sobre Sably](${SITE.url}/nosotros/)
- [Blog](${SITE.url}/blog/)
- [Vídeos de los cursos](${SITE.url}/videos/): presentaciones de los cursos con páginas de visualización individuales
- [Mapa del sitio](${SITE.url}/sitemap/)

## Optional
- [Listado completo de cursos](${SITE.url}/llms-full.txt)
- [Sitemap XML](${SITE.url}/sitemap-index.xml)
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
