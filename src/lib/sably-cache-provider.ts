import cloudflareCacheProvider from '@astrojs/cloudflare/cache/provider';
import type { CacheProviderFactory } from 'astro';
import { env } from 'cloudflare:workers';
import { bumpPageGeneration } from './page-store';

/**
 * Astro's Cloudflare cache provider plus the global page store. EmDash calls
 * `cache.invalidate({ tags })` on every publish, edit, menu or settings write;
 * besides purging Workers Cache, a new generation retires every page copy in
 * KV at once (see page-store.ts).
 */
const sablyCacheProvider: CacheProviderFactory = config => {
  const base = cloudflareCacheProvider(config);
  return {
    ...base,
    name: 'sably-cloudflare',
    async invalidate(options) {
      const kv = (env as unknown as { CACHE?: KVNamespace }).CACHE;
      await Promise.all([
        base.invalidate(options),
        kv ? bumpPageGeneration(kv).catch(() => console.error('Page store generation bump failed.')) : undefined,
      ]);
    },
  };
};

export default sablyCacheProvider;
