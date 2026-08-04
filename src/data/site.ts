// ============================================================
// Configuración global del sitio.
// Cuando el backend Laravel (Hetzner/Connexis) esté listo, esta
// capa de datos se reemplaza por llamadas al API sin tocar las páginas.
// ============================================================

export const SITE = {
  name: 'Sably',
  legalName: 'Connexis',
  domain: 'sably.co',
  url: 'https://sably.co',
  title: 'Sably — Cursos online de belleza con certificado',
  description:
    'Aprende maquillaje, uñas, peluquería, cejas y pestañas y estética con cursos 100% online, certificado digital y acceso de por vida. Cada curso incluye la membresía Black University® con más de 1.400 cursos.',
  email: 'contacto@sably.co',
  country: 'Colombia',
  locale: 'es_CO',
  // Redes sociales: agrega aquí las URLs reales cuando estén activas.
  socials: {} as Record<string, string>,
} as const;

// Beneficio incluido en cada compra (antes Seminarios.Online®).
export const BLACK_UNIVERSITY = {
  name: 'Black University®',
  formerName: 'Seminarios.Online®',
  coursesCount: '1.400',
  description:
    'La membresía educativa que evolucionó de Seminarios.Online®: una biblioteca con más de 1.400 cursos, talleres y seminarios en español para seguir creciendo después de tu curso principal.',
} as const;

export const GUARANTEE_DAYS = 7;
