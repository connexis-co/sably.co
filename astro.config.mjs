// @ts-check
import { defineConfig, sessionDrivers } from 'astro/config';
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';
import emdash, { local, memoryCache } from 'emdash/astro';
import { sqlite } from 'emdash/db';
import { d1, r2, sandbox, kvCache } from '@emdash-cms/cloudflare';
import { targetConfig } from './scripts/environment-config.mjs';
import { brevoPlugin } from './src/plugins/sably-brevo/index.mjs';
import { BLOQUES_ARTICULO } from './src/plugins/sably-operations/bloques-articulo.mjs';
const target = targetConfig();
const nodeRuntime = process.env.SABLY_RUNTIME === 'node';
const dataDirectory = process.env.SABLY_DATA_DIR || './data';
const localPath = relative => fileURLToPath(new URL(relative, import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: target.siteUrl,
  output: 'server',
  // Astro's Cloudflare provider plus the global page store generation (src/lib/page-store.ts).
  cache: { provider: nodeRuntime
    ? { name: 'sably-node', entrypoint: localPath('./src/lib/node/cache-provider.ts') }
    : { name: 'sably-cloudflare', entrypoint: localPath('./src/lib/sably-cache-provider.ts') } },
  adapter: nodeRuntime ? node({ mode: 'standalone' }) : cloudflare({ imageService: 'custom', configPath: target.configPath }),
  ...(nodeRuntime ? { session: { driver: sessionDrivers.fs({ base: `${dataDirectory}/sessions` }) } } : {}),
  ...(nodeRuntime ? { security: { allowedDomains: [
    { hostname: 'sably.co', protocol: 'https' },
    { hostname: 'www.sably.co', protocol: 'https' },
  ] } } : {}),
  image: {
    service: { entrypoint: './src/lib/cms-image-service.ts' },
    endpoint: { entrypoint: nodeRuntime ? 'astro/assets/endpoint/node' : '@astrojs/cloudflare/image-passthrough-endpoint' },
  },
  // EmDash APIs POST to slashless paths; public GET URLs are normalized in the Worker.
  trailingSlash: 'ignore',
  integrations: [
    react(),
    mdx(),
    emdash({
      database: nodeRuntime ? sqlite({ url: `file:${process.env.DATABASE_PATH || `${dataDirectory}/emdash.db`}` }) : d1({ binding: 'DB' }),
      // Native content/chrome cache; EmDash fences previews and invalidates
      // namespaces on editorial writes. Each environment owns its namespace.
      // EmDash retires entries by namespace epoch on every editorial write; defaultTtl is only the
      // backstop. At 300 s most renders found nothing (48–79 k KV misses/day) and fell back to D1.
      objectCache: nodeRuntime
        ? memoryCache({ defaultTtl: 86_400, maxEntries: 2000 })
        : kvCache({ binding: 'CACHE', defaultTtl: 86_400, revalidate: 1000, timeout: 1000 }),
      storage: nodeRuntime
        ? local({ directory: `${dataDirectory}/uploads`, baseUrl: '/_emdash/api/media/file' })
        : r2({ binding: 'MEDIA' }),
      siteUrl: target.siteUrl,
      sandboxRunner: nodeRuntime ? '@emdash-cms/sandbox-workerd/sandbox' : sandbox(),
      sandboxed: [brevoPlugin()],
      ...(nodeRuntime ? {
        middleware: { outer: localPath('./src/lib/node/middleware.ts') },
        trustedProxyHeaders: ['cf-connecting-ip'],
      } : {}),
      plugins: [
        // Orden del menú: «Ajustes del sitio» primero. Mover sably-operations no cambia el orden de los page:fragments
        // (solo lo registran integrations y whatsapp, que siguen en el mismo orden relativo).
        { id: 'sably-operations', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-operations/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-operations/admin.tsx', import.meta.url)), adminPages: [{ path: '/ajustes', label: 'Ajustes del sitio', icon: 'settings' }, { path: '/operations', label: 'Moderación y contactos', icon: 'sliders' }], portableTextBlocks: BLOQUES_ARTICULO },
        { id: 'sably-integrations', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-integrations/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-integrations/admin.tsx', import.meta.url)), adminPages: [{ path: '/integrations', label: 'Medición y conversiones', icon: 'chart-bar' }] },
        { id: 'sably-seo', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-seo/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-seo/admin.tsx', import.meta.url)), adminPages: [{ path: '/seo', label: 'Auditoría SEO', icon: 'search' }] },
        { id: 'sably-narracion', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-narracion/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-narracion/admin.tsx', import.meta.url)), adminPages: [{ path: '/narraciones', label: 'Narraciones', icon: 'headphones' }] },
        { id: 'sably-video', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-video/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-video/admin.tsx', import.meta.url)), adminPages: [{ path: '/video', label: 'Vídeo', icon: 'video' }] },
        { id: 'sably-whatsapp', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-whatsapp/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-whatsapp/admin.tsx', import.meta.url)), adminPages: [{ path: '/whatsapp', label: 'WhatsApp', icon: 'message-circle' }] },
        // Publicidad (AdSense): apagada por defecto; sin configuración guardada no cambia el HTML.
        { id: 'sably-publicidad', version: '1.0.0', entrypoint: fileURLToPath(new URL('./src/plugins/sably-publicidad/index.ts', import.meta.url)), adminEntry: fileURLToPath(new URL('./src/plugins/sably-publicidad/admin.tsx', import.meta.url)), adminPages: [{ path: '/publicidad', label: 'Publicidad', icon: 'megaphone' }] },
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
    resolve: { alias: { 'virtual:sably-runtime': nodeRuntime ? localPath('./src/lib/node/runtime-bindings.ts') : 'cloudflare:workers' } },
    // El codificador MP3 de las narraciones viaja dentro de dist: el despliegue por capa (crane) solo lleva app/dist.
    ssr: { noExternal: ['@breezystack/lamejs'] },
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
