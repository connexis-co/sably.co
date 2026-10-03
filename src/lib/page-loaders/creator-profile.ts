import { getContentRepository } from '@/lib/emdash-content';
import { readOperationalRatings } from '@/plugins/sably-operations/public';
import { env } from 'cloudflare:workers';
import { countryAlternates, breadcrumbSchema, itemListSchema } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { PublicPageContext } from './types';

export async function load(Astro:PublicPageContext) {


const cms = await getContentRepository();
const ratings = await readOperationalRatings((env as unknown as {SABLY_DB:D1Database}).SABLY_DB, Astro.locals).catch(() => ({} as Awaited<ReturnType<typeof readOperationalRatings>>));
const valoracionReal = (slug:string) => ratings[slug] ?? null;

const [country, autor] = await Promise.all([cms.getCountry(Astro.params.country ?? ''), cms.getCreator(Astro.params.autor ?? '')]);

if (!country || !autor) return new Response('Not found', {status:404});

const cursos = (await cms.getCourses()).filter(c => autor.cursos.includes(c.id));

Astro.locals.sablyContent = autor.contentRef;

Astro.locals.sablySeo = autor.seo;

const base = `/${country.code}`;


/* Media real de las valoraciones de SUS cursos, no una cifra de catálogo. */
const valoraciones = cursos
  .map((c) => valoracionReal(c.id))
  .filter((v): v is NonNullable<typeof v> => v !== null);

const media = valoraciones.length
  ? Math.round((valoraciones.reduce((s, v) => s + v.rating, 0) / valoraciones.length) * 10) / 10
  : null;

const totalValoraciones = valoraciones.reduce((s, v) => s + v.total, 0);


const title = `Cursos de ${autor.nombre} | Sably ${country.name}`;

const description = `${autor.nombre}: ${cursos.length} cursos online con certificado en ${country.name}. ${autor.bio}`.slice(0, 158);


const schemas = [
  breadcrumbSchema([
    { name: 'Inicio', url: `${SITE.url}${base}/` },
    { name: 'Creadores', url: `${SITE.url}${base}/` },
    { name: autor.nombre, url: `${SITE.url}${base}/creadores/${autor.slug}/` },
  ]),
  // ProfilePage + Person: datos REALES capturados de Hotmart (nombre, bio, foto).
  // Da atribución de autor a los LLMs y refuerza E-E-A-T. Sin aggregateRating en
  // la Person (Google no lo usa ahí); las notas reales viven en cada Course.
  {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    dateModified: autor.updatedAt,
    mainEntity: {
      '@type': 'Person',
      name: autor.nombre,
      ...(autor.bio ? { description: autor.bio } : {}),
      ...(autor.foto ? { image: new URL(autor.foto,SITE.url).href } : {}),
      url: `${SITE.url}${base}/creadores/${autor.slug}/`,
    },
  },
  // Sus cursos como ItemList: asocia al creador con su catálogo real.
  itemListSchema(cursos.map((c) => ({ name: c.data.title, url: `${SITE.url}${base}/${c.id}/` }))),
];
return {cms,country,autor,cursos,base,valoraciones,media,totalValoraciones,title,description,schemas};
}
