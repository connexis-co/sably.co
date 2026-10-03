import type { APIRoute } from 'astro';
import { getContentRepository } from '@/lib/emdash-content';
export const prerender = false;


import { SITE } from '@/lib/site';

/** llms.txt — descripción del sitio para agentes/LLMs (llmstxt.org). */
export const GET: APIRoute = async () => {
  const cms = await getContentRepository();
  const [courses, categories, COUNTRIES] = await Promise.all([cms.getCourses(), cms.getCategories(), cms.getCountries()]);
  const INTERNAL_CATEGORIES = categories.filter(c => !c.externalUrl);
  const getCategory = (slug:string) => categories.find(c=>c.slug===slug)!;
  const body = `# Sably

> Marketplace de cursos online en español para Latinoamérica: oficios prácticos y habilidades
> que la IA no puede reemplazar (belleza, panadería, electricidad, gastronomía, idiomas y más).
> ${courses.length} cursos con certificado, acceso de por vida y garantía de 7 días, impartidos
> vía Hotmart. Precios en moneda local de ${COUNTRIES.length} países.

Los cursos existen a nivel país (/{código-país}/{slug-del-curso}/) y a nivel ciudad
(/{código-país}/{ciudad}/{slug-del-curso}/). Países: ${COUNTRIES.map((c) => c.code).join(', ')}.

## Categorías
${INTERNAL_CATEGORIES.map((c) => `- [${c.name}](${SITE.url}/co/cursos/${c.slug}/): ${c.description}`).join('\n')}

## Páginas principales
- [Catálogo completo](${SITE.url}/co/cursos/)
- [Homologación de saberes](${SITE.url}/homologaciones/): certificación de experiencia con instituciones ETDH aliadas en Colombia
- [Sobre Sably](${SITE.url}/nosotros/)
- [Blog](${SITE.url}/blog/)
- [Mapa del sitio](${SITE.url}/sitemap/)

## Optional
- [Listado completo de cursos](${SITE.url}/llms-full.txt)
- [Sitemap XML](${SITE.url}/sitemap-index.xml)
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
