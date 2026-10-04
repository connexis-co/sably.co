import passthrough from 'astro/assets/services/noop';
import { cloudflareImageUrl, imageWidths } from './cloudflare-images';

/** Shared by astro:assets and EmDash's native Image/PortableText components. */
export function createCmsImageService(siteOrigin?: string) { return {
  ...passthrough,
  getURL(...args: Parameters<typeof passthrough.getURL>) {
    const [options] = args;
    const src = typeof options.src === 'string' ? options.src : options.src.src;
    const optimized = cloudflareImageUrl(src, Number(options.width), siteOrigin);
    if (optimized) return optimized;
    const url = new URL(src, 'https://local.invalid');
    if (url.pathname.startsWith('/_emdash/api/media/file/')) return src;
    return passthrough.getURL(...args);
  },
  getSrcSet(...args: Parameters<NonNullable<typeof passthrough.getSrcSet>>) {
    const [options, ...rest] = args;
    const src = typeof options.src === 'string' ? options.src : options.src.src;
    if (!cloudflareImageUrl(src, Number(options.width), siteOrigin)) return [];
    return passthrough.getSrcSet!({ ...options, densities: undefined, widths: imageWidths(Number(options.width)) }, ...rest);
  },
  getHTMLAttributes(...args: Parameters<NonNullable<typeof passthrough.getHTMLAttributes>>) {
    const [options] = args;
    const attributes = passthrough.getHTMLAttributes!(...args);
    return { ...attributes,
      ...(options.fetchpriority === 'high' ? { loading: 'eager' } : {}),
      ...(options.sizes || !options.width ? {} : { sizes: `(min-width: ${options.width}px) ${options.width}px, 100vw` }),
    };
  },
}; }

export default createCmsImageService(import.meta.env?.SITE);
