/** Tema V2 de sably.co (rediseño aprobado por JP el 25-nov-2026). Convive con sably-classic; ver src/lib/tema.ts. */
export const SABLY_V2_THEME = {
  id: 'sably-v2',
  name: 'Sably V2',
  /** Plantillas que existen en V2 (src/themes/vistas/ elige cada una según el tema de la petición). */
  pages: ['market-item', 'country-home', 'country-catalog', 'country-category', 'blog-index', 'blog-article', 'creator-profile', 'video-library', 'course-watch', 'homologaciones-index', 'homologacion-program', 'site-map', 'pagina', '404'] as const,
} as const;
