import type { APIRoute } from 'astro';
import { getContentRepository } from '@/lib/emdash-content';
import { aiCatalogCourses } from '@/lib/ai-catalog';
export const prerender = false;

import { SITE } from '@/lib/site';

/** llms-full.txt — catálogo completo para agentes/LLMs. */
export const GET: APIRoute = async () => {
  const cms = await getContentRepository();
  const [allCourses, categories] = await Promise.all([cms.getCourses(), cms.getCategories()]);
  const courses = aiCatalogCourses(allCourses);
  const getCategory = (slug:string) => categories.find(c=>c.slug===slug)!;
  const byCat = new Map<string, typeof courses>();
  for (const c of courses) {
    const cat = getCategory(c.data.category).name;
    byCat.set(cat, [...(byCat.get(cat) ?? []), c]);
  }
  const sections = [...byCat.entries()]
    .map(
      ([cat, items]) =>
        `## ${cat}\n` +
        items
          .map(
            (c) =>
              `- [${c.data.title}](${SITE.url}/co/${c.id}/): ${c.data.shortDescription}`,
          )
          .join('\n'),
    )
    .join('\n\n');
  const body = `# Sably — Catálogo completo de cursos\n\n> ${courses.length} cursos online con inscripción disponible y certificado para Latinoamérica.\n\n${sections}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
