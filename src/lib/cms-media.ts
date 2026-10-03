/** Resolve EmDash MediaValue without assuming a query includes an embed URL. */
export function cmsImageUrl(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const media = value as Record<string, unknown>;
  const url = typeof media.src === 'string' ? media.src : typeof media.url === 'string' ? media.url : undefined;
  if (!url) {
    const meta = media.meta as Record<string, unknown> | undefined;
    const key = meta?.storageKey;
    if ((!media.provider || media.provider === 'local') && typeof key === 'string' && key &&
        !key.startsWith('/') && !key.includes('\\') && !key.split('/').some(part => !part || part === '.' || part === '..')) {
      return '/_emdash/api/media/file/' + key.split('/').map(encodeURIComponent).join('/');
    }
    if ((!media.provider || media.provider === 'local') && typeof media.id === 'string' && /^[A-Za-z0-9_-]+$/.test(media.id)) {
      return '/_emdash/api/media/file/' + encodeURIComponent(media.id);
    }
    return undefined;
  }
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try { return ['https:', 'http:'].includes(new URL(url).protocol) ? url : undefined; } catch { return undefined; }
}
