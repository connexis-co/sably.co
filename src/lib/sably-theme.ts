/** A CMS URL is data, never an executable protocol. */
export function safeEditorialUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const url = value.trim();
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('#')) return url;
  try { return ['https:', 'http:', 'mailto:', 'tel:'].includes(new URL(url).protocol) ? url : null; }
  catch { return null; }
}

/** Stored menus use /co as their neutral market; render them in the selected market. */
export function marketMenuUrl(value: string, country: string): string | null {
  const url = safeEditorialUrl(value);
  return url?.replace(/^\/co(?=\/|$)/, `/${country}`) ?? null;
}
