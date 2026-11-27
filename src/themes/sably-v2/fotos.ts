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
  | 'foto-curso-desayunos-sorpresa'
  | 'foto-marca-caro-1'
  | 'foto-estudiar-portatil-1'
  | 'foto-estudiar-portatil-2'
  | 'foto-estudiar-celular-3';

/** `tarjeta: 'derecha'`: el protagonista está a la izquierda; un texto encima (oficio destacado) va a la derecha. */
interface Foto { ancho: number; alto: number; alt: string; tarjeta?: 'derecha' }

export const FOTOS: Record<NombreFoto, Foto> = {
  'foto-barberia-1': { ancho: 1200, alto: 900, alt: 'Barbero que hace un degradado con máquina a un cliente en una barbería de pared turquesa', tarjeta: 'derecha' },
  'foto-celulares-1': { ancho: 1200, alto: 900, alt: 'Manos que reparan un celular abierto sobre un tapete antiestático, con pinzas y destornilladores de precisión' },
  'foto-cocina-1': { ancho: 1200, alto: 900, alt: 'Mujer que mueve un guiso en una olla de barro en una cocina familiar con azulejos de talavera' },
  'foto-costura-1': { ancho: 1200, alto: 900, alt: 'Costurera de unos cuarenta años guía un jean bajo el prensatelas de una máquina industrial' },
  'foto-creador-1': { ancho: 1200, alto: 900, alt: 'Instructor que cose cuero a dos agujas frente a un celular en trípode que lo graba' },
  'foto-electricidad-1': { ancho: 1200, alto: 900, alt: 'Electricista con guantes dieléctricos y gafas que aprieta un borne en un tablero de breakers' },
  'foto-estudiar-celular-1': { ancho: 1200, alto: 900, alt: 'Mujer con audífonos de cable mira una lección en su celular sentada en un bus' },
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
  'foto-idiomas-1': { ancho: 1600, alto: 1200, alt: 'Joven con audífonos que toma notas a lápiz frente al celular apoyado en un soporte de madera' },
  'foto-idiomas-vertical-1': { ancho: 1200, alto: 1600, alt: 'Joven con audífonos que toma notas a lápiz frente al celular apoyado en un soporte de madera' },
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
  'foto-curso-reposteria-mascotas': { ancho: 480, alto: 321, alt: 'Pastelera llena con una cuchara un molde de huesitos para galletas de mascotas sobre una bandeja.' },
  'foto-curso-cejas-pestanas': { ancho: 480, alto: 321, alt: 'Cosmetóloga con mascarilla y guantes aplica la solución de un lifting de pestañas sobre el escudo de silicona en el párpado de una clienta recostada, en una cabina blanca luminosa.' },
  'foto-curso-drenaje-linfatico': { ancho: 480, alto: 321, alt: 'Terapeuta de pelo gris corto realiza maniobras suaves con las palmas sobre la pantorrilla de una clienta, en una cabina de paredes claras con carrito de aceite y toalla.' },
  'foto-curso-decoracion-globos': { ancho: 480, alto: 321, alt: 'Decorador que arma una columna de globos naranjas, mostaza y crema en un salón, junto a una escalera plegable, un inflador eléctrico y una caja de globos' },
  'foto-curso-macrame': { ancho: 480, alto: 321, alt: 'Manos anudan un nudo plano con cuerda de algodón crudo sobre una varilla gris en un puesto de feria bajo una carpa, con colgantes y tapices de macramé al fondo.' },
  'foto-curso-mecanica-motos': { ancho: 480, alto: 321, alt: 'Mecánico con guantes que ajusta el carburador de una moto con una llave en un taller abierto a la calle' },
  'foto-curso-mecanica-bicicletas': { ancho: 480, alto: 321, alt: 'Mecánica infla la llanta trasera de una bicicleta sujeta en el soporte de reparación.' },
  'foto-marca-caro-1': { ancho: 1200, alto: 1600, alt: 'Mujer sonriente con el celular en la mano, sentada en el brazo de un sofá gris en una sala luminosa con una planta junto a la ventana' },
  'foto-estudiar-portatil-1': { ancho: 1200, alto: 1500, alt: 'Mujer que toma notas en un cuaderno frente a un portátil en la mesa de madera del comedor, con una taza y un vaso de agua' },
  'foto-estudiar-portatil-2': { ancho: 1200, alto: 1500, alt: 'Mujer que sonríe frente a un portátil en la mesa redonda de una cocina de baldosas verdes' },
  'foto-estudiar-celular-3': { ancho: 1200, alto: 1500, alt: 'Mujer que escribe en un cuaderno mientras mira el celular apoyado en un soporte de madera junto a la ventana' },
  'foto-curso-desayunos-sorpresa': { ancho: 480, alto: 320, alt: 'Mujer con delantal a rayas acomoda fresas y croissants en una bandeja de mimbre con jugo de naranja, una tarjeta en blanco y un lazo, en una cocina de azulejos blancos y azules.' },
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

/** Fotos genéricas de «Más sobre el curso» (4:5): dos con portátil y una con celular. */
export const FOTOS_MAS_SOBRE = ['foto-estudiar-portatil-1', 'foto-estudiar-portatil-2', 'foto-estudiar-celular-3'] as const satisfies readonly NombreFoto[];

/** Reparto estable por curso: el mismo slug da siempre la misma foto (hash FNV-1a, sin aleatoriedad en el render). */
export function fotoMasSobre(slug: string): NombreFoto {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 0x01000193);
  return FOTOS_MAS_SOBRE[(h >>> 0) % FOTOS_MAS_SOBRE.length]!;
}

/**
 * Fotos propias de un curso para dos pestañas de «Sobre este curso»:
 * `public/v2/fotos/curso/<slug>-<pestaña>-{480,960}.{avif,webp}`, 4:5 con el sujeto en el cuadrado central.
 * El valor es el `alt`. Un curso o una pestaña que no estén aquí usan las fotos genéricas de siempre.
 */
export type PestanaConFoto = 'necesitas' | 'estudia';
export const FOTOS_PESTANA: Readonly<Record<string, Partial<Record<PestanaConFoto, string>>>> = {
  'curso-de-automaquillaje': {
    necesitas: 'Neceser de tela abierto, base líquida, brochas, rímel, lápiz delineador y bálsamo en lata sobre un tocador blanco',
    estudia: 'Mujer que se aplica rímel sosteniendo un espejo de mano frente a la ventana',
  },
  'curso-de-barberia': {
    necesitas: 'Máquina de cortar, patillera, tijeras de corte y de entresacar, peine, brocha de afeitar y capa negra doblada sobre una mesa de madera',
  },
  'curso-de-carpinteria-y-muebles': {
    estudia: 'Hombre con gafas de seguridad que lija una tabla de pino con un taco de corcho en un banco de trabajo, con el celular en un soporte',
  },
  'curso-de-cejas-y-pestanas': {
    necesitas: 'Pinzas, cepillos para cejas, tijeras pequeñas, lápiz, henna con pincel, lámina de silicona y bastoncillos sobre un paño rosado',
    estudia: 'Mujer que dibuja cejas de práctica con lápiz sobre una lámina de silicona en su mesa',
  },
  'curso-de-decoracion-con-globos': {
    necesitas: 'Globos de látex crema, terracota y verde salvia, inflador eléctrico, tijeras, cinta para guirnaldas y carrete de hilo sobre un piso de madera',
    estudia: 'Mujer que anuda un globo verde salvia junto a una guirnalda de globos crema y terracota en la mesa del comedor',
  },
  'curso-de-depilacion': {
    necesitas: 'Calentador de cera, bandas de tela, talco, loción, espátulas de madera y toalla sobre una mesa cubierta con una toalla blanca',
    estudia: 'Mujer que extiende cera tibia con una espátula sobre su antebrazo apoyado en una toalla',
  },
  'curso-de-desayunos-sorpresa': {
    necesitas: 'Bandeja redonda de mimbre con taza y jugo de naranja, croissants, fresas, uvas, cinta, tijeras, flores y una caja de cartón lisa sobre una mesa de baldosas',
    estudia: 'Hombre con delantal que pone fresas en un cuenco sobre una bandeja de mimbre con jugo de naranja, junto al celular en un soporte',
  },
  'curso-de-drenaje-linfatico': {
    necesitas: 'Camilla con toallas blancas dobladas, cepillo de cerdas naturales, cuenco con aceite, frasco esmerilado, cojín cilíndrico y piedra de madera para masaje',
    estudia: 'Mujer que desliza la mano sobre su propio antebrazo apoyado en una toalla doblada, con el celular en un soporte sobre la mesa',
  },
  'curso-de-electricista': {
    estudia: 'Mujer con gafas de seguridad que pela la punta de un cable con un pelacables en la mesa de su casa, con el celular en un soporte',
  },
  'curso-de-estetica-canina': {
    necesitas: 'Carda, peine metálico, tijeras, máquina de corte, toalla, cortaúñas y frasco de champú sin etiqueta sobre una bandeja gris',
    estudia: 'Joven que cepilla el costado de su perro con una carda sobre una mesa en su casa',
  },
  'curso-de-extensiones-de-cabello': {
    necesitas: 'Mechones de cabello castaño, pinzas separadoras, peine de cola, aguja curva con hilo, microanillos y gancho de enhebrar sobre un mantel gris',
    estudia: 'Mujer que separa mechones con un peine de cola en una cabeza de maniquí sujeta a la mesa de su sala',
  },
  'curso-de-globoflexia': {
    estudia: 'Joven que retuerce un globo largo rojo para formar una figura, sentado a la mesa de su casa con el celular en un soporte',
  },
  'curso-de-limpieza-facial': {
    estudia: 'Mujer que aplica una mascarilla de arcilla con brocha sobre una cabeza de práctica en la mesa de su casa',
  },
  'curso-de-macrame': {
    necesitas: 'Dos rollos de cuerda de algodón, varillas de madera, tijeras, cuentas de madera, peine de madera y un pequeño tapiz de macramé empezado',
  },
  'curso-de-manicure-y-pedicure': {
    necesitas: 'Cuenco con agua, toalla, limas, alicate y empujador de cutícula, separadores de dedos, esmaltes sin etiqueta y discos de algodón sobre una mesa blanca',
    estudia: 'Mujer que se lima las uñas sobre una toalla doblada, con un cuenco de agua al lado y la lección en el celular',
  },
  'curso-de-maquillaje': {
    necesitas: 'Brochas de maquillaje, esponja, paleta de sombras, labial, polvo compacto y espejo de mano sobre una encimera clara',
    estudia: 'Mujer que se aplica rubor con una brocha frente al celular, con una paleta de sombras abierta sobre la mesa',
  },
  'curso-de-masajes': {
    necesitas: 'Camilla de masaje con toallas enrolladas, frascos de aceite sin etiqueta, cojín cilíndrico, piedras de masaje y un cuenco',
  },
  'curso-de-mecanica-de-bicicletas': {
    necesitas: 'Llaves allen, dos llaves combinadas, tres desmontables, aceite en gotero, inflador de mano, dos cámaras de repuesto y un paño azul sobre una mesa de madera',
  },
  'curso-de-mecanica-de-motos': {
    necesitas: 'Llaves combinadas, trinquete con copas, dos destornilladores, alicate y una bujía ordenados sobre un banco de madera',
    estudia: 'Joven arrodillado que ajusta con una llave la tuerca del eje trasero de su moto en el garaje de su casa',
  },
  'curso-de-pasteleria': {
    necesitas: 'Batidor, dos moldes redondos, manga pastelera con boquillas, espátula, huevos, harina, mantequilla y fresas sobre un mesón de mármol',
    estudia: 'Mujer que alisa la crema blanca de una torta con espátula sobre un plato giratorio en su cocina',
  },
  'curso-de-pestanas-volumen-ruso': {
    necesitas: 'Pinzas rectas y curvas, bandeja de pestañas, cepillos, microaplicadores, adhesivo, parches de gel y piedra de jade sobre un mantel claro',
    estudia: 'Mujer con tapabocas que coloca extensiones de pestañas con dos pinzas en una cabeza de práctica sobre la mesa de su casa',
  },
  'curso-de-porcelana-fria': {
    necesitas: 'Masa de porcelana fría, pinturas, rodillo pequeño, estecas, pinceles, cortadores y dos flores modeladas sobre una mesa de madera',
    estudia: 'Mujer mayor que modela una flor de porcelana fría entre los dedos en la mesa de su casa',
  },
  'curso-de-reparacion-de-celulares': {
    necesitas: 'Destornilladores de precisión, pinzas, palancas plásticas, ventosa, cautín en su base y un celular abierto sobre una alfombrilla gris',
    estudia: 'Mujer joven que abre la tapa de un celular con una púa plástica sobre una alfombrilla azul',
  },
  'curso-de-reposteria-para-mascotas': {
    necesitas: 'Rodillo, avena, zanahorias, puré de calabaza, huevos, cortadores de hueso y de huella y galletas en forma de hueso sobre una tabla de madera',
    estudia: 'Hombre que corta galletas en forma de hueso en su cocina mientras su perro mira',
  },
  'curso-de-unas': {
    necesitas: 'Esmaltes sin etiqueta, limas, bloque pulidor, empujador, alicate y cortaúñas, discos de algodón y una lámpara pequeña para uñas sobre una toalla blanca',
    estudia: 'Mujer que pinta con un pincel fino un tip de uña montado en un palito mientras sigue la lección en el celular',
  },
  'curso-de-unas-acrilicas': {
    necesitas: 'Polvos acrílicos, vasito para monómero, pincel, rollo de moldes, caja de tips, lima y toallitas sobre una mesa blanca',
    estudia: 'Mujer joven con tapabocas que esculpe acrílico rosado con pincel sobre un tip de práctica',
  },
  'curso-de-velas-artesanales-y-aromaticas': {
    necesitas: 'Cera en escamas, mechas con base metálica, frascos de vidrio, jarra de acero, palitos de madera, goteros ámbar y lavanda seca sobre una mesa de madera',
    estudia: 'Mujer que vierte cera derretida desde una jarra de acero en un vaso con mecha en la cocina de su casa',
  },
};

export function fotoDePestana(slug: string, pestana: string): { alt: string; src: string; avif: string; webp: string } | null {
  const alt = FOTOS_PESTANA[slug]?.[pestana as PestanaConFoto];
  if (!alt) return null;
  const base = `/v2/fotos/curso/${slug}-${pestana}`;
  const juego = (formato: 'avif' | 'webp') => [480, 960].map(w => `${base}-${w}.${formato} ${w}w`).join(', ');
  return { alt, src: `${base}-960.webp`, avif: juego('avif'), webp: juego('webp') };
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
