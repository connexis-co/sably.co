import { existsSync } from 'node:fs';

export interface Subcategory {
  slug: string;
  name: string;
}

export interface Category {
  slug: string;
  name: string;
  emoji: string;
  /** Descripción corta para cards y meta descriptions. */
  description: string;
  /** Gradiente CSS para covers placeholder (hasta tener fotografía real). */
  gradient: [string, string];
  subcategories: Subcategory[];
  /** Si la categoría vive en una filial del ecosistema, enlazamos afuera. */
  externalUrl?: string;
}

export const CATEGORIES: Category[] = [
  {
    slug: 'belleza',
    name: 'Belleza',
    emoji: '💅',
    description:
      'Peluquería, uñas, maquillaje, barbería y estética en nuestra academia especializada.',
    gradient: ['#E8456B', '#C9A87C'],
    subcategories: [],
    externalUrl: 'https://academiadebelleza.edu.co',
  },
  {
    slug: 'belleza-online',
    name: 'Belleza Online',
    emoji: '💄',
    description:
      'Uñas, barbería, maquillaje y estética: certifícate online y emprende desde casa.',
    gradient: ['#E8456B', '#C9A87C'],
    subcategories: [
      { slug: 'unas', name: 'Uñas' },
      { slug: 'barberia', name: 'Barbería' },
      { slug: 'maquillaje', name: 'Maquillaje' },
      { slug: 'cejas-y-pestanas', name: 'Cejas y pestañas' },
      { slug: 'cabello', name: 'Cabello' },
      { slug: 'estetica-facial', name: 'Estética facial' },
    ],
  },
  {
    slug: 'panaderia-y-pasteleria',
    name: 'Panadería y Pastelería',
    emoji: '🍞',
    description:
      'Pan artesanal, masa madre, tortas decoradas y repostería fina para vender desde casa.',
    gradient: ['#F59E0B', '#B45309'],
    subcategories: [
      { slug: 'pan-artesanal', name: 'Pan artesanal' },
      { slug: 'tortas-decoradas', name: 'Tortas decoradas' },
      { slug: 'reposteria-fina', name: 'Repostería fina' },
      { slug: 'pasteleria-francesa', name: 'Pastelería francesa' },
      { slug: 'masa-madre', name: 'Masa madre' },
      { slug: 'pasteleria', name: 'Pastelería' },
      { slug: 'reposteria', name: 'Repostería' },
      { slug: 'tortas', name: 'Tortas' },
      { slug: 'chocolateria', name: 'Chocolatería' },
    ],
  },
  {
    slug: 'gastronomia',
    name: 'Gastronomía',
    emoji: '🍳',
    description:
      'Cocina profesional, barismo y parrilla: técnicas reales para emprender en comida.',
    gradient: ['#EF4444', '#7C2D12'],
    subcategories: [
      { slug: 'cocina-internacional', name: 'Cocina internacional' },
      { slug: 'cocina-colombiana', name: 'Cocina colombiana' },
      { slug: 'cocina-vegana', name: 'Cocina vegana' },
      { slug: 'barismo', name: 'Barismo' },
      { slug: 'parrillas-y-asados', name: 'Parrillas y asados' },
      { slug: 'bebidas', name: 'Bebidas' },
      { slug: 'comida-rapida', name: 'Comida rápida' },
    ],
  },
  {
    slug: 'oficios',
    name: 'Oficios',
    emoji: '🔧',
    description:
      'Electricidad, plomería, soldadura y mecánica: oficios que la IA no puede reemplazar.',
    gradient: ['#3B82F6', '#1E3A8A'],
    subcategories: [
      { slug: 'electricidad', name: 'Electricidad' },
      { slug: 'plomeria', name: 'Plomería' },
      { slug: 'carpinteria', name: 'Carpintería' },
      { slug: 'mecanica-automotriz', name: 'Mecánica automotriz' },
      { slug: 'mecanica-de-motos', name: 'Mecánica de motos' },
      { slug: 'soldadura', name: 'Soldadura' },
      { slug: 'refrigeracion', name: 'Refrigeración' },
      { slug: 'construccion', name: 'Construcción' },
      { slug: 'electronica', name: 'Electrónica' },
      { slug: 'electrodomesticos', name: 'Reparación de electrodomésticos' },
      { slug: 'energia-solar', name: 'Energía solar' },
      { slug: 'mecanica', name: 'Mecánica general' },
      { slug: 'seguridad', name: 'Seguridad' },
      { slug: 'tatuaje', name: 'Tatuaje' },
    ],
  },
  {
    slug: 'moda-y-confeccion',
    name: 'Moda y Confección',
    emoji: '🧵',
    description:
      'Costura, patronaje y diseño de modas: crea y vende tus propias prendas.',
    gradient: ['#8B5CF6', '#4C1D95'],
    subcategories: [
      { slug: 'costura', name: 'Costura' },
      { slug: 'patronaje', name: 'Patronaje' },
      { slug: 'diseno-de-modas', name: 'Diseño de modas' },
      { slug: 'sastreria', name: 'Sastrería' },
      { slug: 'lenceria', name: 'Lencería' },
      { slug: 'confeccion', name: 'Confección' },
    ],
  },
  {
    slug: 'bienestar',
    name: 'Bienestar',
    emoji: '🏋️',
    description:
      'Nutrición, fitness, yoga y masajes: trabaja ayudando a otros a sentirse mejor.',
    gradient: ['#22C55E', '#14532D'],
    subcategories: [
      { slug: 'nutricion', name: 'Nutrición' },
      { slug: 'fitness', name: 'Fitness' },
      { slug: 'yoga', name: 'Yoga' },
      { slug: 'masajes-terapeuticos', name: 'Masajes terapéuticos' },
      { slug: 'aromaterapia', name: 'Aromaterapia' },
      { slug: 'defensa-personal', name: 'Defensa personal' },
      { slug: 'estetica-corporal', name: 'Estética corporal' },
      { slug: 'primeros-auxilios', name: 'Primeros auxilios' },
    ],
  },
  {
    slug: 'manualidades',
    name: 'Manualidades',
    emoji: '🎨',
    description:
      'Velas, jabones, cerámica y resina: productos artesanales con alta demanda.',
    gradient: ['#EC4899', '#831843'],
    subcategories: [
      { slug: 'velas-artesanales', name: 'Velas artesanales' },
      { slug: 'jabones', name: 'Jabones' },
      { slug: 'bordado', name: 'Bordado' },
      { slug: 'ceramica', name: 'Cerámica' },
      { slug: 'resina-epoxica', name: 'Resina epóxica' },
      { slug: 'artesanias', name: 'Artesanías' },
      { slug: 'joyeria', name: 'Joyería' },
      { slug: 'tejido', name: 'Tejido' },
      { slug: 'personalizados', name: 'Personalizados' },
      { slug: 'eventos', name: 'Decoración de eventos' },
    ],
  },
  {
    slug: 'emprendimiento',
    name: 'Emprendimiento',
    emoji: '💼',
    description:
      'Marketing digital, ventas y finanzas para convertir tu oficio en un negocio rentable.',
    gradient: ['#1B1B3A', '#3B82F6'],
    subcategories: [
      { slug: 'marketing-digital', name: 'Marketing digital' },
      { slug: 'finanzas-personales', name: 'Finanzas personales' },
      { slug: 'e-commerce', name: 'E-commerce' },
      { slug: 'ventas', name: 'Ventas' },
      { slug: 'contabilidad-basica', name: 'Contabilidad básica' },
      { slug: 'marketing', name: 'Marketing' },
      { slug: 'finanzas', name: 'Finanzas' },
      { slug: 'negocios-caseros', name: 'Negocios caseros' },
      { slug: 'fotografia', name: 'Fotografía' },
      { slug: 'herramientas', name: 'Herramientas digitales' },
    ],
  },
  {
    slug: 'cuidado-animal',
    name: 'Cuidado Animal',
    emoji: '🐾',
    description:
      'Peluquería canina, adiestramiento y cuidado básico: emprende con mascotas.',
    gradient: ['#F97316', '#7C2D12'],
    subcategories: [
      { slug: 'peluqueria-canina', name: 'Peluquería canina' },
      { slug: 'adiestramiento', name: 'Adiestramiento' },
      { slug: 'veterinaria-basica', name: 'Veterinaria básica' },
      { slug: 'grooming', name: 'Grooming' },
      { slug: 'salud-mascotas', name: 'Salud de mascotas' },
      { slug: 'reposteria-mascotas', name: 'Repostería para mascotas' },
    ],
  },
  {
    slug: 'idiomas',
    name: 'Idiomas',
    emoji: '🗣️',
    description:
      'Inglés, coreano, francés y más: abre puertas laborales hablando un nuevo idioma.',
    gradient: ['#0EA5E9', '#1E40AF'],
    subcategories: [
      { slug: 'ingles', name: 'Inglés' },
      { slug: 'coreano', name: 'Coreano' },
      { slug: 'frances', name: 'Francés' },
      { slug: 'portugues', name: 'Portugués' },
      { slug: 'italiano', name: 'Italiano' },
      { slug: 'japones', name: 'Japonés' },
    ],
  },
  {
    slug: 'musica',
    name: 'Música',
    emoji: '🎸',
    description:
      'Guitarra, piano, canto y producción: aprende música y hasta vive de ella.',
    gradient: ['#A855F7', '#6B21A8'],
    subcategories: [
      { slug: 'guitarra', name: 'Guitarra' },
      { slug: 'piano', name: 'Piano' },
      { slug: 'canto', name: 'Canto' },
      { slug: 'produccion-musical', name: 'Producción musical' },
      { slug: 'dj', name: 'DJ' },
    ],
  },
  {
    slug: 'hospitalidad',
    name: 'Hospitalidad',
    emoji: '🏨',
    description:
      'Bartending, eventos y wedding planning: la industria de la experiencia te espera.',
    gradient: ['#06B6D4', '#164E63'],
    subcategories: [
      { slug: 'bartending', name: 'Bartending' },
      { slug: 'wedding-planning', name: 'Wedding planning' },
      { slug: 'eventos', name: 'Eventos' },
      { slug: 'hoteleria', name: 'Hotelería' },
      { slug: 'cocteleria', name: 'Coctelería' },
      { slug: 'cafe', name: 'Café' },
      { slug: 'alojamiento', name: 'Alojamiento' },
    ],
  },
];

/** Categorías con cursos propios en este sitio (excluye filiales externas). */
export const INTERNAL_CATEGORIES = CATEGORIES.filter((c) => !c.externalUrl);

/** Portada fotorrealista de la categoría (generadas con Gemini, public/covers/). */
export function categoryCover(slug: string, variant: 'hero' | 'card' = 'hero'): string {
  return `/covers/${slug}${variant === 'card' ? '-card' : ''}.jpg`;
}

/**
 * Portada única del curso (nano-banana, public/covers/cursos/). Fallback a la
 * portada de su categoría si aún no se generó. El existsSync corre en build (SSG).
 */
export function courseCover(courseSlug: string, categorySlug: string, variant: 'hero' | 'card' = 'hero'): string {
  const suffix = variant === 'card' ? '-card' : '';
  const file = `covers/cursos/${courseSlug}${suffix}.jpg`;
  if (existsSync(new URL(`../../public/${file}`, import.meta.url))) return `/${file}`;
  return categoryCover(categorySlug, variant);
}

export function getCategory(slug: string): Category {
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) throw new Error(`Categoría desconocida: ${slug}`);
  return category;
}
