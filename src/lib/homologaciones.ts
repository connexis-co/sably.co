/**
 * Programas de certificación por validación de saberes previos (homologación).
 * Modelo: Sably conecta al interesado por WhatsApp con instituciones de formación
 * para el trabajo (ETDH) aliadas, que evalúan la experiencia y emiten la
 * certificación. Sably comisiona por referido; la institución presta el servicio.
 *
 * ⚠️ Copy compliance: siempre "certifica tu experiencia" + "sujeto a evaluación".
 * Nunca prometer certificado sin evaluación (riesgo legal + políticas de Meta/TikTok Ads).
 */
export interface ProgramaHomologacion {
  slug: string;
  name: string;
  emoji: string;
  /** Cover de categoría Sably que mejor representa el programa. */
  coverCategory: string;
  shortDescription: string;
  /** Perfil típico que busca homologar. */
  audience: string[];
  /** Qué evalúa la institución. */
  evaluacion: string[];
  keyword: string;
}

export const SEDES = [
  { city: 'Bogotá', region: 'Cundinamarca' },
  { city: 'Florencia', region: 'Caquetá' },
  { city: 'Neiva', region: 'Huila' },
  { city: 'Supía', region: 'Caldas' },
  { city: 'Anserma', region: 'Caldas' },
];

export const PROGRAMAS: ProgramaHomologacion[] = [
  {
    slug: 'cuidado-de-manos-y-pies',
    name: 'Cuidado de Manos y Pies',
    emoji: '💅',
    coverCategory: 'belleza',
    shortDescription:
      '¿Llevas años haciendo manicure y pedicure? Certifica tu experiencia como técnico laboral en cuidado de manos y pies.',
    audience: [
      'Trabajas en uñas hace años pero no tienes certificado técnico',
      'Quieres cumplir requisitos para trabajar en salones y spas formales',
      'Necesitas el certificado para abrir tu propio local con todas las de la ley',
    ],
    evaluacion: [
      'Técnicas de manicure y pedicure',
      'Bioseguridad y manejo de instrumentos',
      'Conocimiento de productos y protocolos',
    ],
    keyword: 'homologar curso de manicure y pedicure',
  },
  {
    slug: 'cosmetologia-y-estetica',
    name: 'Cosmetología y Estética Integral',
    emoji: '🧴',
    coverCategory: 'belleza',
    shortDescription:
      'Valida tu experiencia en tratamientos faciales y corporales y obtén tu certificación técnica en cosmetología y estética.',
    audience: [
      'Realizas limpiezas faciales, masajes o tratamientos estéticos de forma empírica',
      'Los establecimientos te piden certificado técnico para contratarte',
      'Quieres habilitar tu cabina de estética cumpliendo la norma',
    ],
    evaluacion: [
      'Protocolos faciales y corporales',
      'Bioseguridad y normativa de establecimientos de estética',
      'Anatomía y fisiología básica de la piel',
    ],
    keyword: 'homologar curso de cosmetología',
  },
  {
    slug: 'barberia',
    name: 'Barbería',
    emoji: '💈',
    coverCategory: 'belleza',
    shortDescription:
      '¿Cortas cabello y perfilas barbas hace años? Certifica tu oficio de barbero con una institución de formación para el trabajo.',
    audience: [
      'Eres barbero empírico con clientela propia',
      'Quieres trabajar en barberías formales que exigen certificación',
      'Buscas darle respaldo profesional a tu marca personal',
    ],
    evaluacion: [
      'Técnicas de corte y degradados',
      'Afeitado clásico y perfilado de barba',
      'Bioseguridad y manejo de herramientas',
    ],
    keyword: 'homologar curso de barbería',
  },
  {
    slug: 'auxiliar-de-enfermeria',
    name: 'Auxiliar de Enfermería',
    emoji: '🩺',
    coverCategory: 'bienestar',
    shortDescription:
      'Infórmate sobre el proceso de homologación y certificación en auxiliar de enfermería con instituciones autorizadas.',
    audience: [
      'Tienes experiencia en cuidado de pacientes o adultos mayores',
      'Iniciaste estudios de enfermería y no los certificaste',
      'Quieres conocer los requisitos oficiales del programa',
    ],
    evaluacion: [
      'Este programa del área de la salud tiene requisitos normativos adicionales',
      'Requiere formación teórico-práctica y prácticas formativas según la normativa vigente',
      'La institución aliada te informa el proceso completo y sus tiempos',
    ],
    keyword: 'homologar auxiliar de enfermería',
  },
];

export function getPrograma(slug: string): ProgramaHomologacion {
  const programa = PROGRAMAS.find((p) => p.slug === slug);
  if (!programa) throw new Error(`Programa desconocido: ${slug}`);
  return programa;
}
