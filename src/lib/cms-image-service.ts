import passthrough from 'astro/assets/services/noop';

/** Keep native R2 images on EmDash's file route, including migration subdirectories. */
export default {
  ...passthrough,
  getURL(...args: Parameters<typeof passthrough.getURL>) {
    const [options] = args;
    const src = typeof options.src === 'string' ? options.src : options.src.src;
    const url = new URL(src, 'https://local.invalid');
    if (url.pathname.startsWith('/_emdash/api/media/file/')) return src;
    return passthrough.getURL(...args);
  },
};
