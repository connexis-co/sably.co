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
  redirects: {
    '/': '/co/',
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
