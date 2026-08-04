// ============================================================
// Catálogo de cursos (productos Hotmart revendidos como afiliado).
//
// IMPORTANTE — hotmartUrl: pega aquí TU enlace de afiliado/checkout
// de Hotmart para cada curso (ej. https://pay.hotmart.com/XXXXXXXX).
// Mientras esté vacío, el botón de compra dirige a /contacto.
//
// Esta capa se reemplazará por el API del backend Laravel (Connexis).
// ============================================================

export interface CourseModule {
  title: string;
  lessons: number;
}

export interface Course {
  slug: string;
  title: string;
  cardTitle: string;
  category: string;
  categorySlug: string;
  level: string;
  hours: number;
  emoji: string;
  gradient: string; // clases tailwind para la portada
  glow: string; // color del resplandor de la portada
  price: number; // COP
  fullPrice: number; // COP (precio de lista)
  hotmartUrl: string; // ← TU enlace de afiliado Hotmart
  excerpt: string;
  description: string;
  learn: string[];
  audience: string[];
  curriculum: CourseModule[];
}

export const CATEGORIES = [
  { slug: 'maquillaje', name: 'Maquillaje', emoji: '💄' },
  { slug: 'cabello', name: 'Cabello', emoji: '✂️' },
  { slug: 'unas', name: 'Uñas', emoji: '💅' },
  { slug: 'cejas-y-pestanas', name: 'Cejas y Pestañas', emoji: '✨' },
  { slug: 'estetica', name: 'Estética', emoji: '🧖‍♀️' },
] as const;

export const COURSES: Course[] = [
  {
    slug: 'curso-de-maquillaje-profesional',
    title: 'Curso de Maquillaje Profesional',
    cardTitle: 'Maquillaje Profesional',
    category: 'Maquillaje',
    categorySlug: 'maquillaje',
    level: 'Desde cero',
    hours: 40,
    emoji: '💄',
    gradient: 'from-pink-500/25 via-fuchsia-500/10 to-transparent',
    glow: '#f472b6',
    price: 69900,
    fullPrice: 139800,
    hotmartUrl: '',
    excerpt:
      'Domina el maquillaje social, de novias y editorial: visagismo, piel perfecta, ojos y técnicas de estudio.',
    description:
      'Aprende maquillaje profesional desde cero: preparación de la piel, colorimetría aplicada, visagismo, técnicas de ojos y labios, maquillaje social, de novias y editorial. Un programa 100% online, con clases en video paso a paso que puedes ver a tu ritmo, las veces que quieras.',
    learn: [
      'Preparación y análisis de la piel según su tipo',
      'Visagismo y corrección de facciones',
      'Colorimetría aplicada al maquillaje',
      'Técnicas de ojos: ahumados, cut crease y delineados',
      'Maquillaje social, de novias y editorial',
      'Kit profesional: qué comprar y cómo cuidarlo',
    ],
    audience: [
      'Personas que quieren iniciar en el maquillaje profesional sin experiencia previa',
      'Maquilladoras empíricas que buscan técnica y certificado',
      'Emprendedoras que quieren ofrecer servicios de maquillaje',
    ],
    curriculum: [
      { title: 'Introducción y kit de maquillaje', lessons: 4 },
      { title: 'La piel: análisis y preparación', lessons: 5 },
      { title: 'Visagismo y estructura del rostro', lessons: 4 },
      { title: 'Colorimetría aplicada', lessons: 4 },
      { title: 'Cejas y mirada', lessons: 4 },
      { title: 'Técnicas de ojos', lessons: 6 },
      { title: 'Piel perfecta: bases y contorno', lessons: 5 },
      { title: 'Labios y acabados', lessons: 3 },
      { title: 'Maquillaje social día y noche', lessons: 5 },
      { title: 'Maquillaje de novias', lessons: 4 },
      { title: 'Maquillaje editorial y tendencias', lessons: 4 },
      { title: 'Emprende con tu servicio de maquillaje', lessons: 3 },
    ],
  },
  {
    slug: 'curso-de-peluqueria-profesional',
    title: 'Curso de Peluquería Profesional',
    cardTitle: 'Peluquería Profesional',
    category: 'Cabello',
    categorySlug: 'cabello',
    level: 'Desde cero',
    hours: 40,
    emoji: '✂️',
    gradient: 'from-violet-500/25 via-purple-500/10 to-transparent',
    glow: '#a78bfa',
    price: 69900,
    fullPrice: 139800,
    hotmartUrl: '',
    excerpt:
      'Cortes, colorimetría y tratamientos capilares: fórmate como estilista con técnica de salón profesional.',
    description:
      'Conviértete en estilista profesional: diagnóstico capilar, cortes de dama y caballero, colorimetría, mechas, balayage y tratamientos de restauración. Aprende con demostraciones reales, a tu ritmo y con acceso de por vida al contenido.',
    learn: [
      'Diagnóstico capilar y asesoría de imagen',
      'Cortes de dama: rectos, en capas y bob',
      'Colorimetría profesional y fórmulas',
      'Mechas, balayage y técnicas de iluminación',
      'Tratamientos capilares y restauración',
      'Manejo de herramientas y bioseguridad en el salón',
    ],
    audience: [
      'Personas que quieren formarse como estilistas desde cero',
      'Peluqueras y peluqueros empíricos que buscan certificarse',
      'Dueños de salón que quieren actualizar técnicas',
    ],
    curriculum: [
      { title: 'Fundamentos y bioseguridad', lessons: 4 },
      { title: 'El cabello: estructura y diagnóstico', lessons: 4 },
      { title: 'Herramientas del estilista', lessons: 3 },
      { title: 'Cortes de dama I: líneas base', lessons: 5 },
      { title: 'Cortes de dama II: capas y texturas', lessons: 5 },
      { title: 'Corte de caballero y máquina', lessons: 4 },
      { title: 'Colorimetría: teoría del color', lessons: 5 },
      { title: 'Aplicación de tintes y retoques', lessons: 4 },
      { title: 'Mechas, balayage y babylights', lessons: 5 },
      { title: 'Decoloración segura', lessons: 3 },
      { title: 'Tratamientos y restauración capilar', lessons: 4 },
      { title: 'Tu salón: clientes y precios', lessons: 3 },
    ],
  },
  {
    slug: 'curso-de-peinados',
    title: 'Curso de Peinados y Recogidos',
    cardTitle: 'Peinados y Recogidos',
    category: 'Cabello',
    categorySlug: 'cabello',
    level: 'Desde cero',
    hours: 25,
    emoji: '👑',
    gradient: 'from-purple-500/25 via-indigo-500/10 to-transparent',
    glow: '#c084fc',
    price: 59900,
    fullPrice: 119800,
    hotmartUrl: '',
    excerpt:
      'Ondas, trenzas y recogidos de fiesta y novia: 12 módulos para dominar el peinado profesional.',
    description:
      'Aprende peinados profesionales para toda ocasión: ondas al estilo hollywood, trenzas modernas, semirecogidos y recogidos de gala y novia. Técnicas paso a paso con herramientas de calor y acabados de larga duración.',
    learn: [
      'Preparación del cabello y productos de fijación',
      'Ondas clásicas, playeras y hollywood',
      'Trenzas: cocidas, holandesas y de burbuja',
      'Semirecogidos modernos para eventos',
      'Recogidos de gala y novia',
      'Acabados de larga duración para eventos',
    ],
    audience: [
      'Estilistas que quieren sumar peinados de evento a sus servicios',
      'Personas sin experiencia que aman el estilismo',
      'Maquilladoras que quieren ofrecer el combo maquillaje + peinado',
    ],
    curriculum: [
      { title: 'Preparación y productos', lessons: 3 },
      { title: 'Manejo de herramientas de calor', lessons: 3 },
      { title: 'Ondas clásicas y playeras', lessons: 4 },
      { title: 'Ondas hollywood', lessons: 3 },
      { title: 'Trenzas básicas y cocidas', lessons: 4 },
      { title: 'Trenzas holandesas y de burbuja', lessons: 4 },
      { title: 'Coletas altas y efecto liso', lessons: 3 },
      { title: 'Semirecogidos de evento', lessons: 4 },
      { title: 'Recogidos bajos elegantes', lessons: 4 },
      { title: 'Recogidos de gala', lessons: 4 },
      { title: 'Peinado de novia', lessons: 4 },
      { title: 'Portafolio y servicio a domicilio', lessons: 2 },
    ],
  },
  {
    slug: 'curso-de-unas-acrilicas',
    title: 'Curso de Uñas Acrílicas',
    cardTitle: 'Uñas Acrílicas',
    category: 'Uñas',
    categorySlug: 'unas',
    level: 'Desde cero',
    hours: 30,
    emoji: '💅',
    gradient: 'from-orange-500/25 via-amber-500/10 to-transparent',
    glow: '#fb923c',
    price: 69900,
    fullPrice: 139800,
    hotmartUrl: '',
    excerpt:
      'Esculpido acrílico profesional: desde la anatomía de la uña hasta estructuras, relleno y nail art.',
    description:
      'Domina el sistema acrílico desde cero: anatomía de la uña, preparación correcta, aplicación con tip y molde, estructuras perfectas, relleno, retiro seguro y decoración. Todo con técnica profesional para resultados duraderos y sin daño.',
    learn: [
      'Anatomía de la uña y bioseguridad',
      'Preparación de la uña natural sin daño',
      'Aplicación con tip y con molde',
      'Estructura, curva C y ápice perfecto',
      'Relleno, mantenimiento y retiro seguro',
      'Nail art: encapsulados, francés y efectos',
    ],
    audience: [
      'Personas que quieren iniciar en el mundo de las uñas esculpidas',
      'Manicuristas que quieren sumar el sistema acrílico',
      'Emprendedoras que buscan un negocio rentable desde casa',
    ],
    curriculum: [
      { title: 'Bioseguridad y anatomía de la uña', lessons: 4 },
      { title: 'Materiales y monómeros', lessons: 3 },
      { title: 'Preparación de la uña natural', lessons: 4 },
      { title: 'Aplicación con tip', lessons: 4 },
      { title: 'Esculpido con molde', lessons: 5 },
      { title: 'Estructura: curva C y ápice', lessons: 4 },
      { title: 'Limado y acabado espejo', lessons: 3 },
      { title: 'Relleno y mantenimiento', lessons: 3 },
      { title: 'Retiro sin daño', lessons: 2 },
      { title: 'Nail art y encapsulados', lessons: 5 },
      { title: 'Precios y clientas fieles', lessons: 2 },
    ],
  },
  {
    slug: 'curso-de-unas-semipermanentes',
    title: 'Curso de Uñas Semipermanentes',
    cardTitle: 'Uñas Semipermanentes',
    category: 'Uñas',
    categorySlug: 'unas',
    level: 'Desde cero',
    hours: 20,
    emoji: '🎨',
    gradient: 'from-rose-500/25 via-red-500/10 to-transparent',
    glow: '#fb7185',
    price: 59900,
    fullPrice: 119800,
    hotmartUrl: '',
    excerpt:
      'Esmaltado semipermanente perfecto: aplicación, durabilidad, retiro seguro y diseños en tendencia.',
    description:
      'Aprende la técnica completa del esmaltado semipermanente: preparación, aplicación en capas finas, sellado perfecto, retiro sin daño y decoraciones en tendencia. Logra acabados de salón que duran semanas.',
    learn: [
      'Preparación correcta para máxima duración',
      'Aplicación de base, color y top coat',
      'Sellado de borde libre y encapsulado fino',
      'Retiro seguro sin dañar la uña natural',
      'Diseños: francés, ojo de gato, efecto espejo',
      'Errores comunes y cómo corregirlos',
    ],
    audience: [
      'Principiantes que quieren iniciar con una técnica de alta demanda',
      'Manicuristas tradicionales que quieren modernizar su servicio',
      'Personas que buscan ingresos extra desde casa',
    ],
    curriculum: [
      { title: 'Fundamentos y materiales', lessons: 3 },
      { title: 'Bioseguridad e higiene', lessons: 2 },
      { title: 'Preparación de la uña', lessons: 4 },
      { title: 'Manicure rusa en seco', lessons: 3 },
      { title: 'Aplicación del sistema semipermanente', lessons: 5 },
      { title: 'Sellado y durabilidad', lessons: 3 },
      { title: 'Retiro seguro', lessons: 2 },
      { title: 'Diseños en tendencia', lessons: 5 },
      { title: 'Fotografía de tus trabajos', lessons: 2 },
      { title: 'Emprende tu servicio', lessons: 2 },
    ],
  },
  {
    slug: 'curso-de-manicure-y-pedicure',
    title: 'Curso de Manicure y Pedicure',
    cardTitle: 'Manicure y Pedicure',
    category: 'Uñas',
    categorySlug: 'unas',
    level: 'Desde cero',
    hours: 20,
    emoji: '🦶',
    gradient: 'from-amber-500/25 via-yellow-500/10 to-transparent',
    glow: '#fbbf24',
    price: 59900,
    fullPrice: 119800,
    hotmartUrl: '',
    excerpt:
      'La base de todo servicio de uñas: manicure y pedicure profesional con spa, esmaltado y bioseguridad.',
    description:
      'El curso esencial para iniciar en el mundo de las uñas: manicure y pedicure profesional, tratamiento spa, limado y esmaltado perfecto, cuidado de cutículas y protocolos de bioseguridad que tus clientas van a agradecer.',
    learn: [
      'Protocolo completo de manicure profesional',
      'Pedicure clínico y spa',
      'Cuidado de cutículas sin lesiones',
      'Limado, pulido y esmaltado tradicional perfecto',
      'Bioseguridad, desinfección y esterilización',
      'Atención al cliente y protocolo de servicio',
    ],
    audience: [
      'Personas sin experiencia que quieren su primer servicio de belleza',
      'Auxiliares de salón que quieren certificar su técnica',
      'Emprendedoras de servicios a domicilio',
    ],
    curriculum: [
      { title: 'Introducción y kit de trabajo', lessons: 3 },
      { title: 'Bioseguridad y esterilización', lessons: 4 },
      { title: 'Anatomía de manos y pies', lessons: 3 },
      { title: 'Manicure tradicional paso a paso', lessons: 5 },
      { title: 'Manicure spa', lessons: 3 },
      { title: 'Pedicure profesional', lessons: 5 },
      { title: 'Pedicure spa y relajación', lessons: 3 },
      { title: 'Esmaltado perfecto', lessons: 3 },
      { title: 'Protocolo de atención al cliente', lessons: 2 },
      { title: 'Tu emprendimiento de uñas', lessons: 2 },
    ],
  },
  {
    slug: 'curso-de-cejas-y-pestanas',
    title: 'Curso de Cejas y Pestañas',
    cardTitle: 'Cejas y Pestañas',
    category: 'Cejas y Pestañas',
    categorySlug: 'cejas-y-pestanas',
    level: 'Desde cero',
    hours: 25,
    emoji: '✨',
    gradient: 'from-teal-400/25 via-cyan-500/10 to-transparent',
    glow: '#2dd4bf',
    price: 59900,
    fullPrice: 119800,
    hotmartUrl: '',
    excerpt:
      'Diseño de cejas, laminado, lifting y extensiones de pestañas: la especialidad más rentable de la mirada.',
    description:
      'Especialízate en el diseño de la mirada: visagismo de cejas, depilación y perfilado, laminado de cejas, lifting de pestañas y fundamentos de extensiones clásicas. Técnicas de alta demanda con productos y tiempos profesionales.',
    learn: [
      'Visagismo y diseño de cejas según el rostro',
      'Depilación con cera, pinza e hilo',
      'Laminado de cejas paso a paso',
      'Lifting de pestañas profesional',
      'Extensiones de pestañas clásicas: fundamentos',
      'Henna y tintes para cejas',
    ],
    audience: [
      'Personas que quieren especializarse en el diseño de mirada',
      'Maquilladoras que quieren ampliar su carta de servicios',
      'Lashistas en formación',
    ],
    curriculum: [
      { title: 'Introducción y bioseguridad', lessons: 3 },
      { title: 'Visagismo de cejas', lessons: 4 },
      { title: 'Técnicas de depilación', lessons: 4 },
      { title: 'Henna y tinte de cejas', lessons: 3 },
      { title: 'Laminado de cejas', lessons: 4 },
      { title: 'Lifting de pestañas', lessons: 4 },
      { title: 'Extensiones clásicas: fundamentos', lessons: 5 },
      { title: 'Cuidados y retoques', lessons: 2 },
      { title: 'Precios y agenda llena', lessons: 2 },
    ],
  },
  {
    slug: 'curso-de-estetica-facial-y-corporal',
    title: 'Curso de Estética Facial y Corporal',
    cardTitle: 'Estética Facial y Corporal',
    category: 'Estética',
    categorySlug: 'estetica',
    level: 'Desde cero',
    hours: 35,
    emoji: '🧖‍♀️',
    gradient: 'from-sky-400/25 via-blue-500/10 to-transparent',
    glow: '#38bdf8',
    price: 79900,
    fullPrice: 159800,
    hotmartUrl: '',
    excerpt:
      'Limpiezas faciales profundas, tratamientos corporales y protocolos de spa con técnica profesional.',
    description:
      'Fórmate en estética facial y corporal: análisis de piel, limpiezas faciales profundas, exfoliaciones, mascarillas, hidrataciones, masajes relajantes y protocolos corporales. Conoce los productos, aparatología básica y tiempos de cabina de un centro de estética profesional.',
    learn: [
      'Análisis de piel y ficha técnica del cliente',
      'Limpieza facial profunda paso a paso',
      'Exfoliaciones, mascarillas e hidratación',
      'Masaje facial y drenaje básico',
      'Protocolos corporales reductores y relajantes',
      'Productos y aparatología básica de cabina',
    ],
    audience: [
      'Personas que quieren trabajar en centros de estética o spa',
      'Cosmetólogas empíricas que buscan protocolo y certificado',
      'Emprendedoras que quieren montar su propia cabina',
    ],
    curriculum: [
      { title: 'Fundamentos de la estética', lessons: 3 },
      { title: 'Bioseguridad en cabina', lessons: 3 },
      { title: 'La piel: tipos y análisis', lessons: 4 },
      { title: 'Ficha técnica y valoración', lessons: 2 },
      { title: 'Limpieza facial profunda', lessons: 5 },
      { title: 'Exfoliación y mascarillas', lessons: 4 },
      { title: 'Hidratación y nutrición facial', lessons: 3 },
      { title: 'Masaje facial y drenaje', lessons: 4 },
      { title: 'Protocolos corporales', lessons: 5 },
      { title: 'Aparatología básica', lessons: 3 },
      { title: 'Monta tu cabina de estética', lessons: 3 },
    ],
  },
];

export const formatCOP = (value: number) =>
  '$' + value.toLocaleString('es-CO') + ' COP';

export const getCourse = (slug: string) => COURSES.find((c) => c.slug === slug);

export const coursesByCategory = (categorySlug: string) =>
  COURSES.filter((c) => c.categorySlug === categorySlug);

/** URL de compra: enlace Hotmart del afiliado o contacto como respaldo. */
export const buyUrl = (course: Course) =>
  course.hotmartUrl || `/contacto?curso=${course.slug}`;
