// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://sably.co',
  trailingSlash: 'always',
  integrations: [
    react(),
    mdx(),
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
