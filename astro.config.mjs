// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import emdash from 'emdash/astro';
import { d1, r2, sandbox } from '@emdash-cms/cloudflare';
import { targetConfig } from './scripts/environment-config.mjs';
const target = targetConfig();

// https://astro.build/config
export default defineConfig({
  site: target.siteUrl,
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough', configPath: target.configPath }),
  // EmDash APIs POST to slashless paths; public GET URLs are normalized in the Worker.
  trailingSlash: 'ignore',
  integrations: [
    react(),
    mdx(),
    emdash({
      database: d1({ binding: 'DB' }),
      storage: r2({ binding: 'MEDIA' }),
      siteUrl: target.siteUrl,
      sandboxRunner: sandbox(),
      plugins: [
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
