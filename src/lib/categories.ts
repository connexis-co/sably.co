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
    ],
  },
];

/** Categorías con cursos propios en este sitio (excluye filiales externas). */
export const INTERNAL_CATEGORIES = CATEGORIES.filter((c) => !c.externalUrl);

export function getCategory(slug: string): Category {
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) throw new Error(`Categoría desconocida: ${slug}`);
  return category;
}
