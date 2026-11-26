import type { APIRoute } from 'astro';
import { getContentRepository } from '@/lib/emdash-content';
import { aiCatalogCourses } from '@/lib/ai-catalog';
import { conConstancia } from '@/lib/vocabulario';
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
              // La descripción corta viene del CMS: si quedó alguna fórmula de «constancia», se dice certificado.
              `- [${c.data.title}](${SITE.url}/co/${c.id}/): ${conConstancia(c.data.shortDescription)}`,
          )
          .join('\n'),
    )
    .join('\n\n');
  const body = `# Sably — Cursos de la plataforma\n\n> Sably es una plataforma de educación online para aprender oficios en español. ${courses.length} cursos seleccionados de creadores independientes, con inscripción disponible y certificado de finalización, para Latinoamérica y España.\n\n${sections}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
