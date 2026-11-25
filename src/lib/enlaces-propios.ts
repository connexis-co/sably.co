/**
 * Enlaces a webs del mismo dueño.
 *
 * Sably enlazaba desde la cabecera, el pie y el listado de cada página a
 * academiadebelleza.edu.co y cursodeglobosonline.com con enlaces follow, y esas
 * webs forman parte de una red que llevó enlaces ocultos hacia Sably hasta el
 * 20-nov-2026. Enlazado cruzado de sitio entero entre webs propias se lee como
 * esquema de enlaces (políticas de spam de Google), así que los enlaces siguen
 * para las personas y salen con `nofollow`. `scripts/seo-onpage.mjs` (regla
 * `red-propia-follow`) falla si vuelve uno follow.
 */
export const DOMINIOS_PROPIOS = [
  'academiadebelleza.edu.co',
  'academiadebelleza.co',
  'cursodeglobosonline.com',
  'connexis.co',
] as const;

export function esWebPropia(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const host = new URL(href).hostname.replace(/^www\./, '');
    return (DOMINIOS_PROPIOS as readonly string[]).some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** `rel` de un enlace: `nofollow` hacia webs propias y `noopener` si abre otra pestaña. */
export function relDe(href: string | undefined, target?: string): string | undefined {
  if (esWebPropia(href)) return 'noopener nofollow';
  return target === '_blank' ? 'noopener' : undefined;
}
