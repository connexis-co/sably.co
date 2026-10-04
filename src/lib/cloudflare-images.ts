/** Public delivery variants; source URLs stored in EmDash remain unchanged. */
export const IMAGE_WIDTHS = [96, 160, 320, 480, 768, 1024, 1280, 1600];

export function cloudflareImageUrl(src: string, width: number, siteOrigin?: string): string | undefined {
  const origin = siteOrigin?.replace(/\/+$/, '');
  // Cloudflare's origin fetch cannot authenticate against the private dev gate.
  if (origin !== 'https://sably.co' || !Number.isFinite(width) || width <= 0) return undefined;
  if (src.startsWith('//')) return undefined;
  let source: URL;
  try { source = new URL(src, origin); } catch { return undefined; }
  if (!['https://sably.co', 'https://cdn.sably.co'].includes(source.origin) || source.username || source.password || source.search || source.hash) return undefined;
  const native = source.origin === origin && source.pathname.startsWith('/_emdash/api/media/file/');
  const publicAsset = /^\/(?:covers|heroes)\//.test(source.pathname) || source.pathname === '/certificado-sably.jpg';
  if ((!native && !publicAsset) || /\.(?:svg|gif)$/i.test(source.pathname)) return undefined;
  const path = source.origin === origin ? source.pathname.slice(1) : source.href;
  return `/cdn-cgi/image/width=${Math.min(Math.round(width), 1600)},quality=80,format=auto,fit=scale-down,onerror=redirect/${path}`;
}

export function imageWidths(width: number): number[] {
  if (!Number.isFinite(width) || width <= 0) return [];
  const max = Math.min(Math.round(width), 1600);
  return [...new Set([...IMAGE_WIDTHS.filter(w => w < max), max])];
}
