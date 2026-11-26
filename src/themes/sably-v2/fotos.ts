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
  | 'foto-panaderia-1' | 'foto-soldadura-1' | 'foto-unas-acrilicas-1' | 'foto-velas-1'
  | 'foto-oficio-masajes' | 'foto-oficio-unas' | 'foto-oficio-carroceria' | 'foto-oficio-pasteleria'
  | 'foto-oficio-barberia' | 'foto-oficio-celulares' | 'foto-oficio-canina' | 'foto-oficio-ceviche'
  | 'foto-oficio-electricidad' | 'foto-oficio-globos' | 'foto-oficio-idiomas' | 'foto-oficio-modisteria'
  | 'foto-pestanas-1'
  | 'foto-pestanas-vertical-1'
  | 'foto-barista-1'
  | 'foto-barista-vertical-1'
  | 'foto-tortas-1'
  | 'foto-tortas-vertical-1'
  | 'foto-globos-1'
  | 'foto-globos-vertical-1'
  | 'foto-guitarra-1'
  | 'foto-guitarra-vertical-1'
  | 'foto-idiomas-1'
  | 'foto-idiomas-vertical-1'
  | 'foto-crochet-1'
  | 'foto-crochet-vertical-1'
  | 'foto-masajes-vertical-1'
  | 'foto-barberia-vertical-1'
  | 'foto-maquillaje-vertical-1'
  | 'foto-cocina-vertical-1'
  | 'foto-electricidad-vertical-1'
  | 'foto-serie-1-elige'
  | 'foto-serie-1-elige-ancha'
  | 'foto-serie-3-practica'
  | 'foto-serie-3-practica-ancha'
  | 'foto-serie-4-ofrece'
  | 'foto-serie-4-ofrece-ancha'
  | 'foto-serie-2-aprende'
  | 'foto-serie-2-aprende-ancha'
  | 'foto-unas-acrilicas-vertical-1'
  | 'foto-motos-1'
  | 'foto-motos-vertical-1'
  | 'foto-curso-reposteria-mascotas'
  | 'foto-curso-cejas-pestanas'
  | 'foto-curso-drenaje-linfatico'
  | 'foto-curso-decoracion-globos'
  | 'foto-curso-macrame'
  | 'foto-curso-mecanica-motos'
  | 'foto-curso-mecanica-bicicletas'
  | 'foto-curso-desayunos-sorpresa';

/** `tarjeta: 'derecha'`: el protagonista está a la izquierda; un texto encima (oficio destacado) va a la derecha. */
interface Foto { ancho: number; alto: number; alt: string; tarjeta?: 'derecha' }

export const FOTOS: Record<NombreFoto, Foto> = {
  'foto-barberia-1': { ancho: 1200, alto: 900, alt: 'Barbero que hace un degradado con máquina a un cliente en una barbería de pared turquesa', tarjeta: 'derecha' },
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
  'foto-velas-1': { ancho: 1200, alto: 900, alt: 'Manos que vierten cera desde una jarra de acero en un frasco con la mecha sujeta por una barra', tarjeta: 'derecha' },
  'foto-oficio-masajes': { ancho: 1200, alto: 900, alt: 'Masajista que trabaja con el antebrazo la espalda de un cliente en una camilla' },
  'foto-oficio-unas': { ancho: 1200, alto: 900, alt: 'Manos con guantes negros que esculpen una uña acrílica rosa con pincel' },
  'foto-oficio-carroceria': { ancho: 1200, alto: 900, alt: 'Técnica con careta que suelda un panel de carrocería en un taller automotriz' },
  'foto-oficio-pasteleria': { ancho: 1200, alto: 900, alt: 'Pastelero que coloca tartaletas de mango en una bandeja sobre una mesa de acero' },
  'foto-oficio-barberia': { ancho: 1200, alto: 900, alt: 'Barbero que hace un degradado con máquina a un joven en una barbería de barrio' },
  'foto-oficio-celulares': { ancho: 1200, alto: 900, alt: 'Técnico que repara un celular con estación de calor en un local de reparación' },
  'foto-oficio-canina': { ancho: 1200, alto: 900, alt: 'Peluquera canina que recorta con tijera la cara de un caniche sobre la mesa' },
  'foto-oficio-ceviche': { ancho: 1200, alto: 900, alt: 'Cocinero que exprime limón sobre un ceviche en la cocina de un restaurante' },
  'foto-oficio-electricidad': { ancho: 1200, alto: 900, alt: 'Electricista con guantes y gafas que conecta cables en una caja de pared' },
  'foto-oficio-globos': { ancho: 1200, alto: 900, alt: 'Artista de globos que arma una flor para una niña en una fiesta en el parque' },
  'foto-oficio-idiomas': { ancho: 1200, alto: 900, alt: 'Recepcionista de hotel que da indicaciones a turistas en otro idioma' },
  'foto-oficio-modisteria': { ancho: 1200, alto: 900, alt: 'Modista que prende con alfileres el ruedo de un vestido verde a una clienta' },
  'foto-pestanas-1': { ancho: 1600, alto: 1200, alt: 'Técnica de pestañas que coloca una extensión con pinzas a una clienta recostada' },
  'foto-pestanas-vertical-1': { ancho: 1200, alto: 1600, alt: 'Técnica de pestañas que coloca una extensión con pinzas a una clienta recostada' },
  'foto-barista-1': { ancho: 1600, alto: 1200, alt: 'Barista que dibuja una roseta al verter la leche en un café de barrio' },
  'foto-barista-vertical-1': { ancho: 1200, alto: 1600, alt: 'Barista que dibuja una roseta al verter la leche en un café de barrio' },
  'foto-tortas-1': { ancho: 1600, alto: 1200, alt: 'Repostera que alisa la crema de una torta sobre un giratorio en la mesa de su cocina' },
  'foto-tortas-vertical-1': { ancho: 1200, alto: 1600, alt: 'Repostera que alisa la crema de una torta sobre un giratorio en la mesa de su cocina' },
  'foto-globos-1': { ancho: 1600, alto: 1200, alt: 'Decorador que arma un arco de globos en un salón de fiestas a medio montar' },
  'foto-globos-vertical-1': { ancho: 1200, alto: 1600, alt: 'Decorador que arma un arco de globos en un salón de fiestas a medio montar' },
  'foto-guitarra-1': { ancho: 1600, alto: 1200, alt: 'Mujer que toca un acorde en una guitarra acústica en la sala de su casa' },
  'foto-guitarra-vertical-1': { ancho: 1200, alto: 1600, alt: 'Mujer que toca un acorde en una guitarra acústica en la sala de su casa' },
  'foto-idiomas-1': { ancho: 1600, alto: 1200, alt: 'Joven con audífonos que repite una frase frente al celular apoyado en una taza' },
  'foto-idiomas-vertical-1': { ancho: 1200, alto: 1600, alt: 'Joven con audífonos que repite una frase frente al celular apoyado en una taza' },
  'foto-crochet-1': { ancho: 1600, alto: 1200, alt: 'Mujer mayor que teje un amigurumi con ganchillo, con una canasta de ovillos al lado' },
  'foto-crochet-vertical-1': { ancho: 1200, alto: 1600, alt: 'Mujer mayor que teje un amigurumi con ganchillo, con una canasta de ovillos al lado' },
  'foto-masajes-vertical-1': { ancho: 1200, alto: 1600, alt: 'Terapeuta que trabaja la espalda de una persona con ambas palmas en un consultorio de masajes' },
  'foto-barberia-vertical-1': { ancho: 1200, alto: 1600, alt: 'Barbero que hace un degradado con máquina a un cliente en una barbería de pared turquesa' },
  'foto-maquillaje-vertical-1': { ancho: 1200, alto: 1600, alt: 'Maquilladora que aplica sombra de ojos a una clienta en un camerino' },
  'foto-cocina-vertical-1': { ancho: 1200, alto: 1600, alt: 'Mujer que mueve un guiso en una olla de barro en una cocina familiar con azulejos de talavera' },
  'foto-electricidad-vertical-1': { ancho: 1200, alto: 1600, alt: 'Electricista con guantes dieléctricos y gafas que aprieta un borne en un tablero de breakers' },
  'foto-serie-1-elige': { ancho: 1200, alto: 1280, alt: 'Mujer sentada a la mesa de su cocina con una taza de café mirando su celular' },
  'foto-serie-1-elige-ancha': { ancho: 1600, alto: 900, alt: 'Mujer sentada a la mesa de su cocina con una taza de café mirando su celular' },
  'foto-serie-3-practica': { ancho: 1200, alto: 1280, alt: 'Mujer que decora con manga pastelera su primera torta sobre un giratorio en la cocina de su casa' },
  'foto-serie-3-practica-ancha': { ancho: 1600, alto: 900, alt: 'Mujer que decora con manga pastelera su primera torta sobre un giratorio en la cocina de su casa' },
  'foto-serie-4-ofrece': { ancho: 1200, alto: 1280, alt: 'Mujer que entrega una caja blanca atada con cabuya a una vecina en la puerta de su casa' },
  'foto-serie-4-ofrece-ancha': { ancho: 1600, alto: 900, alt: 'Mujer que entrega una caja blanca atada con cabuya a una vecina en la puerta de su casa' },
  'foto-serie-2-aprende': { ancho: 1200, alto: 1280, alt: 'Mujer que toma notas a lápiz en su cuaderno en la mesa de la cocina, con un tazón y un batidor al lado' },
  'foto-serie-2-aprende-ancha': { ancho: 1600, alto: 900, alt: 'Mujer que toma notas a lápiz en su cuaderno en la mesa de la cocina, con un tazón y un batidor al lado' },
  'foto-unas-acrilicas-vertical-1': { ancho: 1200, alto: 1600, alt: 'Manos con guantes negros que aplican acrílico con pincel sobre un molde de uña' },
  'foto-motos-1': { ancho: 1600, alto: 1200, alt: 'Mecánico que ajusta la cadena de una moto en un taller abierto a la calle' },
  'foto-motos-vertical-1': { ancho: 1200, alto: 1600, alt: 'Mecánico que ajusta la cadena de una moto en un taller abierto a la calle' },
  'foto-curso-reposteria-mascotas': { ancho: 480, alto: 321, alt: 'Repostera que rellena una manga pastelera para decorar galletas de hueso para perros, con un golden retriever mirando desde la esquina de la mesa' },
  'foto-curso-cejas-pestanas': { ancho: 480, alto: 321, alt: 'Técnica que practica la colocación de extensiones de pestañas con pinzas sobre una cabeza de maniquí, con el estuche de pestañas y los cepillos al lado' },
  'foto-curso-drenaje-linfatico': { ancho: 480, alto: 321, alt: 'Terapeuta que trabaja con ambas manos la pantorrilla de una persona recostada en una camilla, con aceites y helechos junto a la ventana' },
  'foto-curso-decoracion-globos': { ancho: 480, alto: 321, alt: 'Decoradora que tuerce globos largos color terracota para armar una guirnalda en una mesa con inflador, cuaderno de bocetos y globos sueltos' },
  'foto-curso-macrame': { ancho: 480, alto: 321, alt: 'Mujer que anuda cuerda de algodón en un tapiz de macramé sobre una mesa de madera, con un cuaderno de patrones, tijeras y madejas' },
  'foto-curso-mecanica-motos': { ancho: 480, alto: 321, alt: 'Mecánico que desarma un carburador sobre un banco de taller con llaves y manuales, con el chasis de una moto al fondo' },
  'foto-curso-mecanica-bicicletas': { ancho: 480, alto: 321, alt: 'Mecánico que revisa la horquilla de una bicicleta de montaña en un soporte de taller, con herramientas colgadas en el tablero' },
  'foto-curso-desayunos-sorpresa': { ancho: 480, alto: 320, alt: 'Mujer con delantal que arma una canasta de desayuno sorpresa con croissants, fresas, jugo de naranja y una tarjeta, en una cocina con azulejos' },
};

/**
 * Doce oficios para el mosaico de la portada, cada uno ligado a su curso (la foto es la misma escena que la
 * portada del curso en el CMS, recortada a 4:3). Para un mosaico vertical, `object-cover` con aspect 4/5 o 3/4
 * mantiene la acción: el sujeto está en el cuadrado central.
 */
export const OFICIOS_MOSAICO: readonly { foto: NombreFoto; curso: string }[] = [
  { foto: 'foto-oficio-masajes', curso: 'curso-de-masajes' },
  { foto: 'foto-oficio-unas', curso: 'curso-de-unas-acrilicas' },
  { foto: 'foto-oficio-carroceria', curso: 'curso-de-soldadura' },
  { foto: 'foto-oficio-pasteleria', curso: 'curso-de-pasteleria' },
  { foto: 'foto-oficio-barberia', curso: 'curso-de-barberia' },
  { foto: 'foto-oficio-celulares', curso: 'curso-de-reparacion-de-celulares' },
  { foto: 'foto-oficio-canina', curso: 'curso-de-peluqueria-canina-profesional' },
  { foto: 'foto-oficio-ceviche', curso: 'curso-de-ceviche-peruano' },
  { foto: 'foto-oficio-electricidad', curso: 'curso-de-electricista' },
  { foto: 'foto-oficio-globos', curso: 'curso-de-globoflexia' },
  { foto: 'foto-oficio-idiomas', curso: 'curso-de-ingles' },
  { foto: 'foto-oficio-modisteria', curso: 'curso-de-modisteria' },
];

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
  [/mascota|canin|perr/, 'foto-mascotas-1'], [/cocina|gastronom/, 'foto-cocina-1'], [/pestan|cejas/, 'foto-pestanas-1'], [/barista|cafe/, 'foto-barista-1'], [/tortas/, 'foto-tortas-1'], [/globo/, 'foto-globos-1'], [/guitarra/, 'foto-guitarra-1'], [/ingles|frances|portugues|japones|coreano|idioma/, 'foto-idiomas-1'], [/crochet|amigurumi|tejid/, 'foto-crochet-1'], [/moto/, 'foto-motos-1'],
];
export function fotoDeCurso(slug: string, area: string): NombreFoto | null {
  return POR_OFICIO.find(([re]) => re.test(slug))?.[1] ?? FOTO_DE_AREA[area] ?? null;
}

/** Los 12 oficios del héroe que eligió JP (HEROES-X.md §10.1: nota × valoraciones en Hotmart, 3 por familia como máximo). Lista de fábrica del héroe. */
export const OFICIOS_HEROE: readonly { foto: NombreFoto; curso: string }[] = [
  { foto: 'foto-curso-reposteria-mascotas', curso: 'curso-de-reposteria-para-mascotas' },
  { foto: 'foto-curso-cejas-pestanas', curso: 'curso-de-cejas-y-pestanas' },
  { foto: 'foto-curso-drenaje-linfatico', curso: 'curso-de-drenaje-linfatico' },
  { foto: 'foto-curso-decoracion-globos', curso: 'curso-de-decoracion-con-globos' },
  { foto: 'foto-curso-macrame', curso: 'curso-de-macrame' },
  { foto: 'foto-curso-mecanica-motos', curso: 'curso-de-mecanica-de-motos' },
  { foto: 'foto-curso-mecanica-bicicletas', curso: 'curso-de-mecanica-de-bicicletas' },
  { foto: 'foto-oficio-masajes', curso: 'curso-de-masajes-terapeuticos-y-relajantes' },
  { foto: 'foto-curso-desayunos-sorpresa', curso: 'curso-de-desayunos-sorpresa' },
  { foto: 'foto-oficio-barberia', curso: 'curso-de-barberia' },
  { foto: 'foto-oficio-electricidad', curso: 'curso-de-electricista' },
  { foto: 'foto-oficio-pasteleria', curso: 'curso-de-pasteleria' },
];
