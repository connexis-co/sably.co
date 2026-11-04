/**
 * Creador real de cada curso: quién lo hizo, con nombre y página propia.
 *
 * Solo hay creador cuando consta de verdad: la relación del CMS o el autor que
 * Hotmart publica en la página del producto (scripts/hotmart-autores.mjs). Si
 * no consta ninguno, no se pinta nada. En agosto se retiraron instructores de
 * relleno que el JSON-LD declaraba como `Person` y Google llegó a indexar; un
 * creador inventado es exactamente eso otra vez.
 *
 * Vive aquí, y no en cada página, para que la ficha, la página del creador, el
 * catálogo y el sitemap digan lo mismo: el fallo de agosto vivía en la costura
 * entre dos fuentes que nadie comparaba.
 */

export type TipoCreador = 'Person' | 'Organization';

export interface PerfilCreador {
  slug: string;
  nombre: string;
  bio?: string;
}

/**
 * ¿Persona u organización?
 *
 * Hotmart no lo dice en un campo: publica nombre y biografía. Se clasifica con
 * lo que el propio creador declara —una marca registrada o «Escuela…» en el
 * nombre, o una biografía que se presenta como empresa o escuela— y, si no
 * declara nada, es persona. MasterClasses.La® («es una empresa desarrolladora
 * de cursos») es lo primero; Mauricio Duque Zuluaga, lo segundo.
 */
export function tipoDeCreador(creador: Pick<PerfilCreador, 'nombre' | 'bio'>): TipoCreador {
  if (/[®™]|^(?:escuela|academia|instituto)\b/i.test(creador.nombre.trim())) return 'Organization';
  const bio = creador.bio ?? '';
  if (/\b(?:es|somos)\b[^.]{0,40}?\b(?:una?|la|el)\s+(?:empresa|compañía|academia|escuela|instituto|organización)\b/i.test(bio)) return 'Organization';
  return 'Person';
}

/** Página del creador en el país de la ficha: misma URL que su ProfilePage. */
export function urlCreador(siteUrl: string, countryCode: string, slug: string): string {
  return `${siteUrl.replace(/\/$/, '')}/${countryCode}/creadores/${slug}/`;
}

/**
 * Nodo schema.org del creador. El `@id` es el mismo en la ficha (`creator` del
 * Course) y en su página (`mainEntity` del ProfilePage): así Google une las dos
 * apariciones en una sola entidad en vez de ver dos homónimos.
 */
export function creadorSchema(creador: PerfilCreador, url: string) {
  return {
    '@type': tipoDeCreador(creador),
    '@id': `${url}#creador`,
    name: creador.nombre,
    url,
  };
}

/**
 * Propiedad `creator` del Course: un nodo si hay un creador, lista si hay
 * varios y nada si no consta ninguno (nunca se rellena).
 */
export function creatorDelCurso(creadores: readonly (PerfilCreador & { url: string })[] | undefined) {
  if (!creadores?.length) return {};
  const nodos = creadores.map((c) => creadorSchema(c, c.url));
  return { creator: nodos.length === 1 ? nodos[0]! : nodos };
}

/** Separador que va delante del elemento `i` de una lista de `total`: '', ', ' o ' y '. */
export function separadorDeLista(i: number, total: number): string {
  if (i <= 0) return '';
  return i === total - 1 ? ' y ' : ', ';
}

/** «A», «A y B», «A, B y C»: la línea visible «Creado por …». */
export function nombresCreadores(nombres: readonly string[]): string {
  return nombres.map((n, i) => `${separadorDeLista(i, nombres.length)}${n}`).join('');
}

export interface CreadorConCursos {
  slug: string;
  /** `course_slugs` del CMS: lista de origen de la migración. */
  courseSlugs: readonly string[];
}

export interface CursoConCreador {
  id: string;
  /** Creador resuelto desde la relación nativa (`creator_record`) o `creator_slug`. */
  creatorSlug?: string;
  /** El curso trae el campo de relación, aunque esté vacío. */
  creatorManaged?: boolean;
}

/**
 * Cursos de cada creador, en este orden de precedencia por curso:
 *
 * 1. La relación del CMS (`creator_record` / `creator_slug`): la decide el editor.
 * 2. `course_slugs` del creador, solo en cursos sin campo de relación (regla
 *    previa a la relación nativa, se conserva igual).
 * 3. El autor que Hotmart publica para el producto, si existe ese creador.
 *
 * El tercer paso existe porque la relación está vacía en todo el catálogo: el
 * refresco del 12-ago-2026 borró `productos[].autor` y la migración a EmDash
 * heredó creadores sin cursos. Una relación vacía no distingue «sin creador»
 * de «no se importó», y el dato de Hotmart es el real. Cuando el CMS tenga la
 * relación, manda el CMS y este paso deja de intervenir.
 */
export function asignarCursos(
  creadores: readonly CreadorConCursos[],
  cursos: readonly CursoConCreador[],
  autorHotmart?: (courseSlug: string) => string | null | undefined,
): Map<string, string[]> {
  const existentes = new Set(creadores.map((c) => c.slug));
  const asignacion = new Map<string, string[]>(creadores.map((c) => [c.slug, []]));
  for (const curso of cursos) {
    let duenos: string[] = [];
    if (curso.creatorSlug) duenos = [curso.creatorSlug];
    else if (!curso.creatorManaged) duenos = creadores.filter((c) => c.courseSlugs.includes(curso.id)).map((c) => c.slug);
    if (!duenos.length) {
      const autor = autorHotmart?.(curso.id);
      if (autor && existentes.has(autor)) duenos = [autor];
    }
    for (const dueno of duenos) asignacion.get(dueno)?.push(curso.id);
  }
  return asignacion;
}
