// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import { cacheCloudflare } from '@astrojs/cloudflare/cache';
import emdash from 'emdash/astro';
import { d1, r2, sandbox, kvCache } from '@emdash-cms/cloudflare';
import { targetConfig } from './scripts/environment-config.mjs';
import { brevoPlugin } from './src/plugins/sably-brevo/index.mjs';
const target = targetConfig();

// https://astro.build/config
export default defineConfig({
  site: target.siteUrl,
  output: 'server',
  cache: { provider: cacheCloudflare() },
  adapter: cloudflare({ imageService: 'custom', configPath: target.configPath }),
  image: {
    service: { entrypoint: './src/lib/cms-image-service.ts' },
    endpoint: { entrypoint: '@astrojs/cloudflare/image-passthrough-endpoint' },
  },
  // EmDash APIs POST to slashless paths; public GET URLs are normalized in the Worker.
  trailingSlash: 'ignore',
  integrations: [
    react(),
    mdx(),
    emdash({
      database: d1({ binding: 'DB' }),
      // Native content/chrome cache; EmDash fences previews and invalidates
      // namespaces on editorial writes. Each environment owns its namespace.
      objectCache: kvCache({ binding: 'CACHE', defaultTtl: 300, revalidate: 1000, timeout: 1000 }),
      storage: r2({ binding: 'MEDIA' }),
      siteUrl: target.siteUrl,
      sandboxRunner: sandbox(),
      sandboxed: [brevoPlugin()],
      plugins: [
        { id: 'sably-integrations', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-integrations/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-integrations/admin.tsx', import.meta.url)), adminPages: [{ path: '/integrations', label: 'Sably · integraciones', icon: 'settings' }] },
        { id: 'sably-seo', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-seo/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-seo/admin.tsx', import.meta.url)), adminPages: [{ path: '/seo', label: 'Sably · SEO', icon: 'search' }] },
        { id: 'sably-operations', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-operations/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-operations/admin.tsx', import.meta.url)), adminPages: [{ path: '/operations', label: 'Sably · operaciones', icon: 'sliders' }] },
        { id: 'sably-whatsapp', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-whatsapp/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-whatsapp/admin.tsx', import.meta.url)), adminPages: [{ path: '/whatsapp', label: 'Sably · WhatsApp', icon: 'message-circle' }] },
      ],
    }),
  ],
  // En Cloudflare Pages manda public/_redirects (también 301); esto queda para
  // que el HTML de reserva que genera Astro y el dev server digan lo mismo.
  redirects: {
    '/': { status: 301, destination: '/co/' },
  },
  server: {
    // Astro se queda en 4321 y salta al siguiente libre si está ocupado, lo que
    // deja al que lanzó el servidor sin saber en qué puerto quedó. Respetar PORT
    // hace que el puerto asignado sea el que de verdad escucha.
    port: Number(process.env.PORT) || 4321,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
