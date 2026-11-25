/**
 * Datos comunes de la cabecera, el megamenú y el pie V2. Salen de las mismas
 * fuentes que el tema clásico (menús nativos de EmDash, categorías, cursos,
 * países y valoraciones de Hotmart) para que ningún enlace se pierda al cambiar
 * de tema: las 12 áreas, sus subcategorías, los 8 países, los menús del pie,
 * el ecosistema y las redes.
 */
import { getMenu } from 'emdash';
import { env } from 'virtual:sably-runtime';
import { getContentRepository } from '@/lib/emdash-content';
import { marketMenuUrl, safeEditorialUrl } from '@/lib/sably-theme';
import { readOperationalRatings } from '@/plugins/sably-operations/public';
import { notaHotmart } from '@/lib/opiniones';
import { cmsImageUrl } from '@/lib/cms-media';
import { buildWhatsAppUrl } from '@/lib/hotmart';
import type { Country } from '@/lib/countries';
import type { Course } from '@/lib/emdash-content';
import { CATEGORIES } from '@/lib/categories';
import { FOTO_DE_AREA, type NombreFoto } from './fotos';

export interface CursoMenu { slug: string; titulo: string; area: string; nota: { cifra: string; texto: string } | null }
export interface AreaMenu {
  slug: string;
  nombre: string;
  descripcion: string;
  subcategorias: { slug: string; nombre: string }[];
  total: number;
  cursos: CursoMenu[];
  foto: NombreFoto | null;
  fotoCms: string | null;
}
export type Red = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'x';

/** «Belleza Online» → «Belleza»: el área se nombra sin el sufijo técnico. */
export const nombreArea = (nombre: string) => nombre.replace(/\s+Online$/i, '');

/** Un curso sin checkout (enlace PENDIENTE) no se destaca: es una página sin nada que comprar. */
export const comprable = (c: Course) => !/PENDIENTE/i.test(c.data.hotmartUrl);

function red(href: string): Red | null {
  let host: string;
  try { host = new URL(href).hostname.toLowerCase(); } catch { return null; }
  for (const [dominio, nombre] of [['instagram.com', 'instagram'], ['tiktok.com', 'tiktok'], ['facebook.com', 'facebook'], ['youtube.com', 'youtube'], ['youtu.be', 'youtube'], ['x.com', 'x'], ['twitter.com', 'x']] as const) {
    if (host === dominio || host.endsWith(`.${dominio}`)) return nombre;
  }
  return null;
}

export async function datosNavegacion(country: Country, scope: object) {
  const cms = await getContentRepository();
  const db = (env as unknown as { SABLY_DB: D1Database }).SABLY_DB;
  const [categorias, cursos, paises, primario, pie, social, ecosistema, valoraciones] = await Promise.all([
    cms.getCategories(), cms.getCourses(), cms.getCountries(),
    getMenu('primary', { locale: 'es' }), getMenu('footer', { locale: 'es' }), getMenu('social', { locale: 'es' }), getMenu('ecosystem', { locale: 'es' }),
    readOperationalRatings(db, scope).catch(() => ({} as Awaited<ReturnType<typeof readOperationalRatings>>)),
  ]);
  const base = `/${country.code}`;
  const nota = (slug: string) => notaHotmart(valoraciones[slug] ?? null);
  const total = (slug: string) => valoraciones[slug]?.total ?? 0;
  /* Orden honesto y explicable: primero los que el equipo marcó como destacados,
     después los que más calificaciones tienen en Hotmart. No hay datos de visitas. */
  const orden = (a: Course, b: Course) => Number(b.data.featured) - Number(a.data.featured) || total(b.id) - total(a.id);
  const aCurso = (c: Course): CursoMenu => ({ slug: c.id, titulo: c.data.title, area: c.data.category, nota: nota(c.id) });

  /* El orden editorial de siempre (src/lib/categories.ts); las áreas nuevas del CMS, al final. */
  const posicion = (slug: string) => { const i = CATEGORIES.findIndex(c => c.slug === slug); return i < 0 ? 99 : i; };
  const internas = categorias.filter(c => !c.externalUrl).sort((a, b) => posicion(a.slug) - posicion(b.slug));
  const areas: AreaMenu[] = internas.map(cat => {
    const delArea = cursos.filter(c => c.data.category === cat.slug);
    return {
      slug: cat.slug,
      nombre: nombreArea(cat.name),
      descripcion: cat.description,
      subcategorias: cat.subcategories.map(s => ({ slug: s.slug, nombre: s.name })),
      total: delArea.length,
      cursos: delArea.filter(comprable).sort(orden).slice(0, 4).map(aCurso),
      foto: FOTO_DE_AREA[cat.slug] ?? null,
      fotoCms: cmsImageUrl(cat.cardImage) ?? cmsImageUrl(cat.coverImage) ?? null,
    };
  });
  const externas = categorias.filter(c => c.externalUrl).map(c => ({ nombre: c.name, href: c.externalUrl! }));
  const nombreDeArea = new Map(areas.map(a => [a.slug, a.nombre]));
  const destacados = cursos.filter(comprable).sort(orden).slice(0, 4).map(aCurso);
  const enlaces = (menu: Awaited<ReturnType<typeof getMenu>>, mercado: boolean) => (menu?.items ?? []).flatMap(item => {
    const href = mercado ? marketMenuUrl(item.url, country.code) : safeEditorialUrl(item.url);
    return href ? [{ etiqueta: item.label, href, target: item.target || undefined }] : [];
  });
  const principal = enlaces(primario, true);
  return {
    base,
    areas,
    externas,
    nombreDeArea,
    destacados,
    totalCursos: cursos.length,
    comprables: cursos.filter(comprable).length,
    paises: paises.map(p => ({ code: p.code, nombre: p.name, moneda: p.currency })),
    /* «Cursos» abre el megamenú; los demás enlaces del menú principal van tal cual. */
    principal,
    enlaceCursos: principal.find(e => /\/cursos\/?$/.test(e.href)) ?? { etiqueta: 'Cursos', href: `${base}/cursos/` },
    pie: enlaces(pie, true),
    ecosistema: enlaces(ecosistema, false),
    redes: (social?.items ?? []).flatMap(item => {
      const url = safeEditorialUrl(item.url);
      return url ? [{ red: red(url), url, etiqueta: item.label }] : [];
    }),
    whatsapp: buildWhatsAppUrl(country.whatsapp, 'Hola, estoy interesado(a) y quiero más información sobre los cursos de Sably'),
  };
}
export type DatosNavegacion = Awaited<ReturnType<typeof datosNavegacion>>;
