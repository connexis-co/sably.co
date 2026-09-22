import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync } from 'node:fs';
import { getCollection } from 'astro:content';
import { COUNTRIES } from './countries';
import { INTERNAL_CATEGORIES } from './categories';
import { PROGRAMAS } from './homologaciones';
import { SITE, CDN_URL } from './site';
import { COURSE_VIDEOS, duracionIso } from './course-videos';
import { courseCover } from './categories';

/**
 * Sitemaps segmentados (docs/ARQUITECTURA_URLS.md §4.5): un archivo por país
 * para los cursos + pages/categorias/blog. Sin <priority> ni <changefreq>:
 * Google los ignora y lo único que orienta el re-crawl es un <lastmod> fiable.
 */
export interface UrlEntry {
  loc: string;
  /** ISO 8601. Señal de frescura para el re-crawl (IndexNow/Bing/Google). Es
      la fecha real del último cambio del contenido: ver fechaDe(). */
  lastmod: string;
  /** Extensión de vídeo. Solo en las páginas donde el vídeo se reproduce. */
  video?: VideoEntry;
}

export interface VideoEntry {
  titulo: string;
  descripcion: string;
  /** Absoluta. */
  miniatura: string;
  /** Absoluta, al MP4. */
  contenido: string;
  /** Segundos. Google la rechaza si pasa de 8 horas. */
  duracion: number;
  /** ISO 8601. */
  publicado: string;
}

/** El texto del curso va dentro del XML: sin escapar, un `&` rompe el sitemap. */
const xml = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

/** Fecha de build: fallback de lastmod cuando git no puede dar la fecha real
    (sin git, clon superficial o archivo aún sin commitear). Se calcula una vez
    por build (todas comparten el mismo sello). */
const BUILD_DATE = new Date().toISOString();

/**
 * Fecha del último commit que tocó cada archivo de contenido, en milisegundos.
 *
 * Antes todas las URLs llevaban BUILD_DATE, y el refresco diario de precios
 * (hotmart-live.yml) redespliega cada día: el lastmod cambiaba a diario sin que
 * cambiara nada, y Google solo usa el lastmod si es «consistently and verifiably
 * accurate». Con uno falso deja de mirarlo, también cuando un cambio es real.
 *
 * UNA sola llamada a git log para todo el build (no una por URL: son ~1.000).
 * `--first-parent` con el diff de cada merge contra su primer padre da la fecha
 * en que el cambio entró en la rama que se despliega, no la del commit original
 * de la rama de trabajo, que puede ser días anterior a su publicación.
 *
 * Si git no está o el clon es superficial (deploy-staging hace checkout de 1
 * commit: el único commit «tocaría» todos los archivos), el mapa queda vacío y
 * todo vuelve a BUILD_DATE. El deploy de producción y el CI usan fetch-depth: 0.
 */
const FECHAS_GIT: ReadonlyMap<string, number> = (() => {
  const fechas = new Map<string, number>();
  try {
    const opts: ExecFileSyncOptionsWithStringEncoding = {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    };
    const superficial = execFileSync('git', ['rev-parse', '--is-shallow-repository'], opts).trim();
    if (superficial !== 'false') return fechas;
    const log = execFileSync(
      'git',
      [
        'log',
        '--first-parent',
        '--diff-merges=first-parent',
        '--format=@%cI',
        '--name-only',
        '--',
        'src/content',
        'src/pages',
        'src/lib/homologaciones.ts',
      ],
      opts,
    );
    // Del más reciente al más antiguo: la primera vez que sale un archivo es su último cambio.
    let actual = 0;
    for (const linea of log.split('\n')) {
      if (linea.startsWith('@')) actual = Date.parse(linea.slice(1));
      else if (linea && !fechas.has(linea) && Number.isFinite(actual)) fechas.set(linea, actual);
    }
  } catch {
    fechas.clear();
  }
  return fechas;
})();

/**
 * El cambio más reciente (ms) entre los archivos de los que sale el contenido de
 * una URL, o null si git no lo sabe: sin historia, o algún archivo existe pero
 * aún no está commiteado (cambió ahora). Un archivo que no existe (p. ej. un
 * curso sin locale para ese país) no cuenta.
 */
function ultimoCambio(archivos: string[]): number | null {
  if (FECHAS_GIT.size === 0) return null;
  let max = 0;
  for (const archivo of archivos) {
    const fecha = FECHAS_GIT.get(archivo);
    if (fecha !== undefined) max = Math.max(max, fecha);
    else if (existsSync(archivo)) return null;
  }
  return max > 0 ? max : null;
}

/** lastmod de una URL a partir de sus archivos fuente; BUILD_DATE si git no lo sabe. */
function fechaDe(...archivos: string[]): string {
  const ms = ultimoCambio(archivos);
  return ms === null ? BUILD_DATE : new Date(ms).toISOString();
}

/* Rutas relativas a la raíz del repo, como las devuelve git log. */
const PAGINA = (ruta: string): string => `src/pages/${ruta}`;
const mdxCurso = (id: string): string => `src/content/courses/${id}.mdx`;
const localeCurso = (id: string, pais: string): string =>
  `src/content/course-locales/${id}--${pais}.json`;
const mdxPost = (id: string): string => `src/content/blog/${id}.mdx`;

/** Un curso sin checkout (hotmartUrl PENDIENTE) es una página «Próximamente»:
    sigue viva (200) porque ChatGPT aterriza en algunas, pero no se pide su
    indexación. Mismo criterio en el mega-menú y en el mapa HTML (/sitemap/). */
const esPendiente = (hotmartUrl: string): boolean => /PENDIENTE/i.test(hotmartUrl);

const u = (path: string, lastmod: string = BUILD_DATE): UrlEntry => ({
  loc: `${SITE.url}${path}`,
  lastmod,
});

export async function pagesUrls(): Promise<UrlEntry[]> {
  const mdxCursos = (await getCollection('courses')).map((c) => mdxCurso(c.id));
  const mdxPosts = (await getCollection('blog')).map((p) => mdxPost(p.id));
  const urls: UrlEntry[] = [];
  for (const c of COUNTRIES) {
    // La home y el catálogo muestran tarjetas de cursos: cambian cuando cambia un curso.
    urls.push(u(`/${c.code}/`, fechaDe(PAGINA('[country]/index.astro'), ...mdxCursos)));
    urls.push(u(`/${c.code}/cursos/`, fechaDe(PAGINA('[country]/cursos/index.astro'), ...mdxCursos)));
    // Las landings de ciudad NO van al sitemap: canonican a su página de país
    // (consolidación de la hiperlocalización). Siguen vivas (200) para usuarios
    // y LLMs, pero no se pide su indexación.
  }
  urls.push(u('/nosotros/', fechaDe(PAGINA('nosotros/index.astro'))));
  // El contenido de las homologaciones vive en src/lib/homologaciones.ts.
  const programas = 'src/lib/homologaciones.ts';
  urls.push(u('/homologaciones/', fechaDe(PAGINA('homologaciones/index.astro'), programas)));
  const fechaPrograma = fechaDe(PAGINA('homologaciones/[programa]/index.astro'), programas);
  for (const p of PROGRAMAS) urls.push(u(`/homologaciones/${p.slug}/`, fechaPrograma));
  urls.push(u('/legal/terminos/', fechaDe(PAGINA('legal/terminos/index.astro'))));
  urls.push(u('/legal/privacidad/', fechaDe(PAGINA('legal/privacidad/index.astro'))));
  urls.push(u('/sitemap/', fechaDe(PAGINA('sitemap/index.astro'), ...mdxCursos, ...mdxPosts)));
  return urls;
}

export async function categoriasUrls(): Promise<UrlEntry[]> {
  const courses = await getCollection('courses');
  const urls: UrlEntry[] = [];
  for (const cat of INTERNAL_CATEGORIES) {
    const lastmod = fechaDe(
      PAGINA('[country]/cursos/[category]/index.astro'),
      ...courses.filter((c) => c.data.category === cat.slug).map((c) => mdxCurso(c.id)),
    );
    for (const c of COUNTRIES) {
      urls.push(u(`/${c.code}/cursos/${cat.slug}/`, lastmod));
      // Categorías de ciudad: fuera del sitemap (canonican a la categoría de país).
    }
  }
  return urls;
}

export async function cursosUrls(countryCode: string): Promise<UrlEntry[]> {
  const courses = await getCollection('courses');
  const country = COUNTRIES.find((c) => c.code === countryCode);
  if (!country) return [];
  const urls: UrlEntry[] = [];
  for (const course of courses) {
    // «Próximamente»: fuera del sitemap (ver esPendiente).
    if (esPendiente(course.data.hotmartUrl)) continue;
    // La ficha sale del .mdx del curso y de su adaptación al país.
    const entrada = u(
      `/${country.code}/${course.id}/`,
      fechaDe(mdxCurso(course.id), localeCurso(course.id, country.code)),
    );
    const video = COURSE_VIDEOS[course.id];
    if (video) {
      // El vídeo se declara SOLO en la página de país, no en las 37 de ciudad:
      // el mismo archivo repetido en 45 URLs hace que Google elija una y
      // descarte el resto, y la que interesa es esta.
      entrada.video = {
        titulo: `${course.data.title} — presentación en vídeo`,
        descripcion: course.data.shortDescription,
        miniatura: new URL(courseCover(course.id, course.data.category), SITE.url).href,
        contenido: `${CDN_URL}/videos/${video.key}`,
        duracion: video.segundos,
        publicado: video.subido,
      };
    }
    urls.push(entrada);
    // Variantes ciudad+curso: fuera del sitemap (canonican al curso de país).
  }
  return urls;
}

export async function blogUrls(): Promise<UrlEntry[]> {
  const posts = await getCollection('blog');
  /* Un post cambia al publicarse o al editarse después: gana la fecha más
     reciente. Si git no sabe, queda publishedAt, como antes. */
  const fechaPost = (p: (typeof posts)[number]): number =>
    Math.max(new Date(p.data.publishedAt).getTime(), ultimoCambio([mdxPost(p.id)]) ?? 0);
  /* El índice lista todos los posts: cambia con cualquiera de ellos. */
  const indice = ultimoCambio([PAGINA('blog/index.astro'), ...posts.map((p) => mdxPost(p.id))]);
  const fechaIndice =
    indice === null ? BUILD_DATE : new Date(Math.max(indice, ...posts.map(fechaPost))).toISOString();
  return [
    u('/blog/', fechaIndice),
    ...posts.map((p) => u(`/blog/${p.id}/`, new Date(fechaPost(p)).toISOString())),
  ];
}

export function renderUrlset(urls: UrlEntry[]): string {
  const body = urls
    .map((x) => {
      const v = x.video
        ? `<video:video>` +
          `<video:thumbnail_loc>${xml(x.video.miniatura)}</video:thumbnail_loc>` +
          `<video:title>${xml(x.video.titulo)}</video:title>` +
          `<video:description>${xml(x.video.descripcion)}</video:description>` +
          `<video:content_loc>${xml(x.video.contenido)}</video:content_loc>` +
          `<video:duration>${x.video.duracion}</video:duration>` +
          `<video:publication_date>${x.video.publicado}</video:publication_date>` +
          `<video:family_friendly>yes</video:family_friendly>` +
          `<video:requires_subscription>no</video:requires_subscription>` +
          `</video:video>`
        : '';
      return `<url><loc>${x.loc}</loc><lastmod>${x.lastmod}</lastmod>${v}</url>`;
    })
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${body}</urlset>`
  );
}

export const SITEMAP_NAMES = [
  'pages',
  'categorias',
  'blog',
  ...COUNTRIES.map((c) => `cursos-${c.code}`),
];

/**
 * TEMPORAL — retirar después del 2026-11-15 (6-8 semanas tras el despliegue).
 *
 * Las 504 páginas de ciudad que llevan `<meta name="googlebot" content="noindex,
 * follow">` (36 hubs, 36 catálogos y 432 ciudad×categoría; ver Seo.astro). Salieron
 * de los sitemaps el 10-sep y Google tarda meses en volver a rastrearlas por su
 * cuenta, así que no vería el noindex. Este sitemap existe solo para forzar ese
 * rastreo: lastmod = fecha de build.
 *
 * Va APARTE de SITEMAP_NAMES a propósito: no sale en /sitemap-index.xml, ni en
 * /sitemap.xml, ni en robots.txt, y no se manda por IndexNow. Se envía solo a
 * Google por la API de Search Console. Mientras esté, GSC avisará de «Enviada
 * marcada como noindex»: es lo esperado. Para retirarlo, borrarlo de GSC, quitar
 * esta constante, ciudadesNoindexUrls() y su rama en src/pages/sitemaps/[name].xml.ts.
 * Las fichas ciudad+curso NO van aquí: no llevan el noindex.
 */
export const SITEMAPS_TEMPORALES = ['temporal-ciudades-noindex'];

export function ciudadesNoindexUrls(): UrlEntry[] {
  const urls: UrlEntry[] = [];
  for (const c of COUNTRIES) {
    for (const city of c.cities) {
      const raiz = `/${c.code}/${city.slug}`;
      // lastmod = BUILD_DATE a propósito (el valor por defecto de u()): aquí sí
      // se quiere que Google vea «cambiado» y vuelva a rastrear.
      urls.push(u(`${raiz}/`));
      urls.push(u(`${raiz}/cursos/`));
      for (const cat of INTERNAL_CATEGORIES) urls.push(u(`${raiz}/cursos/${cat.slug}/`));
    }
  }
  return urls;
}
