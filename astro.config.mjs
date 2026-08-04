// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Front-end estático servido desde Cloudflare (edge).
// El futuro backend (Laravel 13 + Octane en Hetzner/Connexis) se consumirá
// vía API — ver src/data/* como capa a reemplazar por fetch() al API.
export default defineConfig({
  site: 'https://sably.co',
  trailingSlash: 'ignore',
  vite: {
    plugins: [tailwindcss()],
  },
});
