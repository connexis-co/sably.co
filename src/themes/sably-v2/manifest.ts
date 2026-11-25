/** Tema V2 de sably.co (rediseño aprobado por JP el 25-nov-2026). Convive con sably-classic; ver src/lib/tema.ts. */
export const SABLY_V2_THEME = {
  id: 'sably-v2',
  name: 'Sably V2',
  /** Plantillas que ya existen en V2. El resto de páginas sigue en el clásico aunque V2 sea el tema por defecto. */
  pages: ['market-item'] as const,
} as const;
