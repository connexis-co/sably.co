/**
 * Fotos del rediseño V2 (diseno/imagenes/foto-*.jpg, generadas con IA para el
 * proyecto; ver diseno/imagenes/INDICE.md). Están en public/v2/fotos en AVIF y
 * WebP a 480, 960 y 1600 px (la de 1600 solo si el original la alcanza).
 * El `alt` describe la escena y nunca dice que esas personas sean alumnos de Sably.
 */
export type NombreFoto =
  | 'foto-barberia-1' | 'foto-celulares-1' | 'foto-cocina-1' | 'foto-costura-1' | 'foto-creador-1'
  | 'foto-electricidad-1' | 'foto-estudiar-celular-1' | 'foto-estudiar-celular-2' | 'foto-heroe-1'
  | 'foto-heroe-2' | 'foto-heroe-vertical-1' | 'foto-maquillaje-1' | 'foto-masajes-1' | 'foto-mascotas-1'
  | 'foto-panaderia-1' | 'foto-soldadura-1' | 'foto-unas-acrilicas-1' | 'foto-velas-1';

interface Foto { ancho: number; alto: number; alt: string }

export const FOTOS: Record<NombreFoto, Foto> = {
  'foto-barberia-1': { ancho: 1200, alto: 900, alt: 'Barbero que hace un degradado con máquina a un cliente en una barbería de pared turquesa' },
  'foto-celulares-1': { ancho: 1200, alto: 900, alt: 'Manos que reparan un celular abierto sobre un tapete antiestático, con pinzas y destornilladores de precisión' },
  'foto-cocina-1': { ancho: 1200, alto: 900, alt: 'Mujer que mueve un guiso en una olla de barro en una cocina familiar con azulejos de talavera' },
  'foto-costura-1': { ancho: 1200, alto: 900, alt: 'Manos de una costurera que guían tela de jean bajo el prensatelas de una máquina recta industrial' },
  'foto-creador-1': { ancho: 1200, alto: 900, alt: 'Instructor que cose cuero a dos agujas frente a un celular en trípode que lo graba' },
  'foto-electricidad-1': { ancho: 1200, alto: 900, alt: 'Electricista con guantes dieléctricos y gafas que aprieta un borne en un tablero de breakers' },
  'foto-estudiar-celular-1': { ancho: 1200, alto: 900, alt: 'Mujer con audífonos que mira una lección en el celular dentro de un bus urbano' },
  'foto-estudiar-celular-2': { ancho: 1200, alto: 900, alt: 'Joven que copia un paso en un cuaderno con el celular apoyado en el frutero de la mesa de la cocina' },
  'foto-heroe-1': { ancho: 1600, alto: 1200, alt: 'Hombre que cierra empanadas en la cocina de su casa con el celular apoyado en un frasco mostrando la lección' },
  'foto-heroe-2': { ancho: 1600, alto: 1200, alt: 'Aprendiz que lija una silla mientras el maestro le señala la unión en un taller de muebles' },
  'foto-heroe-vertical-1': { ancho: 900, alto: 1200, alt: 'Peluquera que corta con tijera y peine el cabello de una clienta en una peluquería de barrio' },
  'foto-maquillaje-1': { ancho: 1200, alto: 900, alt: 'Maquilladora que aplica sombra de ojos a una clienta en un camerino' },
  'foto-masajes-1': { ancho: 1200, alto: 900, alt: 'Terapeuta que trabaja la espalda de una persona con ambas palmas en un consultorio de masajes' },
  'foto-mascotas-1': { ancho: 1200, alto: 900, alt: 'Peluquero canino que recorta las patas de un schnauzer sobre una mesa de peluquería' },
  'foto-panaderia-1': { ancho: 1200, alto: 900, alt: 'Bandeja de conchas recién horneadas en una panadería, con el horno de pisos al fondo' },
  'foto-soldadura-1': { ancho: 1200, alto: 900, alt: 'Soldador con careta, chaqueta y guantes de cuero que suelda el marco de una reja en un taller' },
  'foto-unas-acrilicas-1': { ancho: 1200, alto: 900, alt: 'Manos con guantes negros que aplican acrílico con pincel sobre un molde de uña' },
  'foto-velas-1': { ancho: 1200, alto: 900, alt: 'Manos que vierten cera desde una jarra de acero en un frasco con la mecha sujeta por una barra' },
};

/** Foto que representa cada área en el megamenú y en la portada. Sin foto propia, la del CMS. */
export const FOTO_DE_AREA: Partial<Record<string, NombreFoto>> = {
  'belleza-online': 'foto-heroe-vertical-1',
  bienestar: 'foto-masajes-1',
  'panaderia-y-pasteleria': 'foto-panaderia-1',
  gastronomia: 'foto-cocina-1',
  manualidades: 'foto-velas-1',
  oficios: 'foto-electricidad-1',
  'moda-y-confeccion': 'foto-costura-1',
  'cuidado-animal': 'foto-mascotas-1',
};

const ANCHOS = [480, 960, 1600] as const;

/** `srcset` de un formato: solo los anchos que existen, sin comas dentro de ninguna URL. */
export function srcsetFoto(nombre: NombreFoto, formato: 'avif' | 'webp'): string {
  const { ancho } = FOTOS[nombre];
  return ANCHOS.filter(w => w <= ancho).map(w => `/v2/fotos/${nombre}-${w}.${formato} ${w}w`).join(', ');
}

export const srcFoto = (nombre: NombreFoto, ancho: 480 | 960 | 1600 = 960) => `/v2/fotos/${nombre}-${ancho}.webp`;

/** Foto propia de un curso por su oficio (barbería, uñas, masajes…); si no hay, la de su área. */
const POR_OFICIO: [RegExp, NombreFoto][] = [
  [/barber/, 'foto-barberia-1'], [/un(as|a)-|unas$|acrilic/, 'foto-unas-acrilicas-1'], [/maquill/, 'foto-maquillaje-1'],
  [/masaj|drenaje/, 'foto-masajes-1'], [/panader|pasteler|reposter/, 'foto-panaderia-1'], [/costura|confecci|corte-y/, 'foto-costura-1'],
  [/soldad/, 'foto-soldadura-1'], [/electric/, 'foto-electricidad-1'], [/celular/, 'foto-celulares-1'], [/vela|jabon/, 'foto-velas-1'],
  [/mascota|canin|perr/, 'foto-mascotas-1'], [/cocina|gastronom/, 'foto-cocina-1'],
];
export function fotoDeCurso(slug: string, area: string): NombreFoto | null {
  return POR_OFICIO.find(([re]) => re.test(slug))?.[1] ?? FOTO_DE_AREA[area] ?? null;
}
