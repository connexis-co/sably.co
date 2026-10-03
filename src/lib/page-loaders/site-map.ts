import { getContentRepository } from '@/lib/emdash-content';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import type { PublicPageContext } from './types';

export async function load(Astro:PublicPageContext) {




/*
 * Mapa del sitio HTML: el hub que enlazan el footer y llms.txt, así que tiene
 * que llevar a TODO lo que se quiere indexado y a nada más.
 * - Todas las fichas comprables de /co/, sin recortar por categoría (antes solo
 *   6 por categoría: 68 de 121). Los otros países no repiten las 121 fichas:
 *   sus catálogos y categorías ya las enlazan.
 * - Sin cursos PENDIENTE: son páginas «Próximamente» sin checkout, fuera
 *   también de los sitemaps XML y del mega-menú.
 * - Sin los 36 hubs de ciudad: llevan noindex para Googlebot y canonical al
 *   país. Las fichas ciudad+curso siguen enlazadas desde cada ficha.
 */
const cms = await getContentRepository();

const [country,COUNTRIES,categories,PROGRAMAS] = await Promise.all([cms.getCountry(DEFAULT_COUNTRY),cms.getCountries(),cms.getCategories(),cms.getPrograms()]);

if (!country) return new Response('Not found',{status:404});

const INTERNAL_CATEGORIES = categories.filter(c => !c.externalUrl);

const courses = await cms.getCourses();

const comprables = courses.filter((c) => !/PENDIENTE/i.test(c.data.hotmartUrl));

const posts = (await cms.getBlogPosts()).sort(
  (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
);


const byCategory = INTERNAL_CATEGORIES.map((cat) => ({
  cat,
  courses: comprables
    .filter((c) => c.data.category === cat.slug)
    .sort((a, b) => a.data.title.localeCompare(b.data.title, 'es')),
})).filter((g) => g.courses.length > 0);


const title = 'Mapa del Sitio | Sably';

const description = `Navega todo Sably: ${comprables.length} cursos online en ${byCategory.length} categorías, disponibles en ${COUNTRIES.length} países.`;
return {cms,country,COUNTRIES,categories,PROGRAMAS,INTERNAL_CATEGORIES,courses,comprables,posts,byCategory,title,description};
}
