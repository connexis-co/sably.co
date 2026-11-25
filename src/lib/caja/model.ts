/**
 * Constructor de la caja de compra · contrato (fase 1, B6xx «adb-caja»). Módulo PURO: lo usan el plugin `adb-caja`
 * (panel y rutas), las plantillas (`shared/caja/`) y las pruebas. Congelado el 24-nov-2026: los agentes de render,
 * panel y migración solo importan de aquí; un cambio de forma sube `CAJA_VERSION` y trae su `migrarVnAVm`.
 *
 * Ideas (docs/equipo/2026-11-24/auditoria/constructor-caja-arquitectura.md y cro-ficha-compra.md):
 *  - La caja es una LISTA ORDENADA de bloques tipados por ZONA. El orden del arreglo es el orden del DOM (I6).
 *  - Herencia: sitio → preajuste → parche por escuela → parche por curso (un parche guarda solo lo que se aparta).
 *  - Las cifras (precio, moneda, tachado, %, cierre) NUNCA son texto de un bloque (I2): salen de `ofertas_curso`,
 *    `adb-precios` y `adb-promos`. Ningún bloque tiene campos de URL (I5).
 *  - Fase 1 pinta la zona `caja` (estado «a la venta» con oferta). `cabeza`, `sobre` y `barra` existen en el modelo
 *    y en el panel, pero se pintan en la fase 2.
 */

export const CAJA_VERSION = 1 as const;

// ── Zonas y condiciones ─────────────────────────────────────────────────────────────────────────────────────────

export type Zona = "cabeza" | "sobre" | "caja" | "barra";
export const ZONAS: readonly Zona[] = ["cabeza", "sobre", "caja", "barra"];
/** Zonas que pinta la fase 1. Las demás se ven en el panel como «Llega en la fase 2». */
export const ZONAS_FASE1: readonly Zona[] = ["caja"];
export const ZONA_NOMBRE: Record<Zona, string> = {
	cabeza: "Cabecera de la ficha",
	sobre: "Sobre la caja",
	caja: "Caja",
	barra: "Barra móvil",
};

/** Países con mercado propio (los de `MARKETS`) más «XX» = otro país. */
export type PaisCaja = string;

export interface Condicion {
	/** `con-fechas` = campaña con un fin que se dice (B208): la única que admite urgencia en los textos. */
	campana?: "activa" | "con-fechas" | "sin";
	cupon?: "aplicado" | "no-aplicado";
	dispositivo?: "movil" | "escritorio";
	/** Vacío o ausente = todos. */
	paises?: PaisCaja[];
}

// ── Iconos (lista blanca compartida: los `Icon` de Claude y Codex deben resolverlos; una prueba lo comprueba) ───────

export const ICONOS_CAJA = [
	"check",
	"circle-check",
	"lock",
	"credit-card",
	"receipt",
	"file-check",
	"graduation-cap",
	"book-open-check",
	"list-checks",
	"monitor-play",
	"circle-play",
	"clock",
	"hourglass",
	"gift",
	"star",
	"user-round",
	"globe",
	"info",
	"circle-help",
	"message-circle",
	"whatsapp",
	"bell",
	"package",
	"signal-high",
	"arrow-right",
	"chevron-down",
	"plus",
	"pen-line",
	"external-link",
	"store",
] as const;
export type IconoCaja = (typeof ICONOS_CAJA)[number];
export const esIcono = (v: unknown): v is IconoCaja => typeof v === "string" && (ICONOS_CAJA as readonly string[]).includes(v);

// ── Bloques ─────────────────────────────────────────────────────────────────────────────────────────────────

export type TipoBloque =
	| "titulo"
	| "subtitulo"
	| "pais"
	| "promocion"
	| "precio"
	| "cupon"
	| "boton"
	| "confianza"
	| "calificacion"
	| "whatsapp"
	| "acordeon"
	| "separador"
	| "texto"
	| "nota_legal"
	| "resena";

/** Ítems (hijos) de `confianza` y de `acordeon`. Los «de datos» salen del curso; `propia` es texto del panel. */
export type TipoItem =
	| "pago-seguro"
	| "garantia"
	| "acceso"
	| "medios"
	| "calcula"
	| "clic"
	| "propia";

export interface Bloque {
	/** Estable dentro del documento («b7», «b10c»): lo usan el editor, los parches y las capas. */
	id: string;
	tipo: TipoBloque | TipoItem;
	visible: boolean;
	/** Validada contra `CATALOGO[tipo].variantes`. Los ítems usan «-». */
	variante: string;
	/** `null` = sin icono; ausente = el de fábrica del tipo. */
	icono?: IconoCaja | null;
	/** Claves de `CATALOGO[tipo].textos`. Vacío o ausente = el texto de Textos / Promociones → Ajustes. */
	textos?: Record<string, string>;
	si?: Condicion;
	/** Solo `confianza` (ítems de confianza) y `acordeon` (preguntas). */
	hijos?: Bloque[];
	/** Por tipo, ver `CATALOGO[tipo].opciones` (p. ej. whatsapp.respaldo, precio.ahorro). */
	opciones?: Record<string, string | boolean>;
}

export interface EstiloCaja {
	piel: "tarjeta" | "plana" | "oscura";
	densidad: "comoda" | "compacta";
}

export interface Preajuste {
	id: string;
	nombre: string;
	/** Los de fábrica no se borran ni se renombran; se pueden duplicar. */
	fabrica: boolean;
	descripcion?: string;
	/**
	 * Dónde se puede usar (revisión de la PR #140, 25-nov): `sitio` (o ausente) = como caja del sitio, de una escuela o
	 * de un curso; `campana` = solo durante una campaña con fechas (fase 2: capa de campaña). El validador no deja
	 * ponerlo como caja del sitio y el panel no ofrece «Usar en todo el sitio».
	 */
	uso?: "sitio" | "campana";
	estilo: EstiloCaja;
	zonas: Record<Zona, Bloque[]>;
}

/** Excepción por curso (o escuela) SOBRE su preajuste: solo lo que se aparta. */
export interface Parche {
	/** Otro preajuste; ausente = el heredado. */
	preajuste?: string;
	bloques?: Record<string, Partial<Pick<Bloque, "visible" | "variante" | "icono" | "textos" | "si" | "opciones">>>;
	/** Ids en orden; los que falten van al final en su orden heredado. */
	orden?: Partial<Record<Zona, string[]>>;
	/** Bloques propios del curso (texto, acordeón, separador…), agregados al final de la zona o tras `despuesDe`. */
	extra?: Partial<Record<Zona, Array<Bloque & { despuesDe?: string | null }>>>;
}

/** Capa de campaña (fase 2: se enlaza desde `PromoFields.cajaCapa`). No reordena. */
export interface CapaCampana {
	id: string;
	nombre: string;
	bloques: Record<string, Partial<Pick<Bloque, "visible" | "variante" | "textos">>>;
	extra: Partial<Record<Zona, Array<Bloque & { despuesDe: string | null }>>>;
}

export interface EntradaHistorial {
	at: string;
	by: string | null;
	resumen: string;
}

export interface CajaDoc {
	v: typeof CAJA_VERSION;
	/** Id del preajuste del sitio. */
	sitio: string;
	preajustes: Preajuste[];
	escuelas: Record<string, Parche>;
	cursos: Record<string, Parche>;
	capas: CapaCampana[];
	revision: string;
	updatedAt: string | null;
	updatedBy: string | null;
}

export const LIMITES = {
	preajustes: 12,
	capas: 12,
	bloquesPorZona: 24,
	itemsAcordeon: 8,
	itemsConfianza: 6,
	historial: 20,
} as const;

// ── Catálogo ────────────────────────────────────────────────────────────────────────────────────────────────

export interface VarianteSpec {
	id: string;
	nombre: string;
	descripcion: string;
}
export interface TextoSpec {
	clave: string;
	etiqueta: string;
	max: number;
	/** Variables admitidas (`{curso}`, `{escuela}`). Ninguna variable de cifra: I2. */
	variables?: readonly string[];
	/** Sugerencias del panel (chips). */
	sugerencias?: readonly string[];
	multilinea?: boolean;
	/** Vacío = el texto de Textos (clave indicada) o de Promociones → Ajustes. */
	origen?: string;
}
export interface OpcionSpec {
	clave: string;
	etiqueta: string;
	tipo: "select" | "switch";
	valores?: ReadonlyArray<{ id: string; nombre: string }>;
	defecto: string | boolean;
}
export interface TipoSpec {
	tipo: TipoBloque;
	nombre: string;
	/** Una línea para el panel («Qué hace este bloque»). */
	ayuda: string;
	icono: IconoCaja;
	zonas: readonly Zona[];
	variantes: readonly VarianteSpec[];
	textos: readonly TextoSpec[];
	opciones: readonly OpcionSpec[];
	/** Cuántos admite una zona (p. ej. un solo `boton`, un solo `pais`). */
	maxPorZona: number;
	/** Bloqueado: el panel no deja apagarlo ni quitarlo (I1, I4, país con varios mercados). */
	obligatorio: boolean;
	/** Ítems que admite (`confianza`, `acordeon`). */
	items?: readonly TipoItem[];
	/** Fase en la que se pinta (el panel muestra los de fase 2 deshabilitados). */
	fase: 1 | 2;
}

const v = (id: string, nombre: string, descripcion: string): VarianteSpec => ({ id, nombre, descripcion });

export const CATALOGO: Record<TipoBloque, TipoSpec> = {
	titulo: {
		tipo: "titulo",
		nombre: "Título",
		ayuda: "Una frase corta que abre la caja. Es un párrafo, no un encabezado: no altera los H2 de la ficha.",
		icono: "pen-line",
		zonas: ["caja", "sobre", "cabeza"],
		variantes: [
			v("display", "Serif de titular", "Grande, con la tipografía de los titulares."),
			v("simple", "Sans", "Tamaño de texto destacado, sin serif."),
			v("rotulo", "Rótulo", "Versalitas pequeñas, como un antetítulo."),
		],
		textos: [
			{
				clave: "texto",
				etiqueta: "Texto",
				max: 40,
				variables: ["curso", "escuela"],
				sugerencias: ["Inscríbete hoy", "Empieza ya tu carrera", "Empieza tu oficio hoy", "Empieza a practicar"],
			},
		],
		opciones: [
			{
				clave: "alineacion",
				etiqueta: "Alineación",
				tipo: "select",
				valores: [
					{ id: "inicio", nombre: "Izquierda" },
					{ id: "centro", nombre: "Centrado" },
				],
				defecto: "inicio",
			},
		],
		maxPorZona: 1,
		obligatorio: false,
		fase: 1,
	},
	subtitulo: {
		tipo: "subtitulo",
		nombre: "Subtítulo",
		ayuda: "Una línea bajo el título. Sin cifras inventadas: usa las variables o datos del curso.",
		icono: "info",
		zonas: ["caja", "sobre"],
		variantes: [v("normal", "Normal", "Texto de apoyo."), v("atenuado", "Atenuado", "Más pequeño y suave.")],
		textos: [
			{
				clave: "texto",
				etiqueta: "Texto",
				max: 90,
				variables: ["curso", "escuela"],
				sugerencias: ["Clases en video, a tu ritmo y con certificado al terminar", "Aprende {curso} desde tu casa"],
			},
		],
		opciones: [],
		maxPorZona: 1,
		obligatorio: false,
		fase: 1,
	},
	pais: {
		tipo: "pais",
		nombre: "País y moneda",
		ayuda: "«Precios para Colombia · Cambiar». Siempre dice para qué país es la cifra.",
		icono: "globe",
		zonas: ["caja"],
		variantes: [v("fila", "Fila", "«Precios para…» con «Cambiar» a la derecha (la de hoy).")],
		textos: [],
		opciones: [],
		maxPorZona: 1,
		obligatorio: true,
		fase: 1,
	},
	promocion: {
		tipo: "promocion",
		nombre: "Campaña",
		ayuda: "Nombre, fecha de cierre y reloj de la campaña vigente. Salen de Promociones; aquí solo eliges el diseño.",
		icono: "gift",
		zonas: ["caja", "sobre", "barra"],
		variantes: [
			v("tarjeta", "Tarjeta", "Tarjeta suave con borde de acento (la de hoy)."),
			v("banda", "Banda oscura", "Tarjeta con el tema de la campaña y el reloj en casillas."),
			v("cinta", "Cinta", "Una sola línea sobre el precio: «Black November · termina el 26 nov»."),
			v("franja", "Franja", "Cabecera de color de la caja, de borde a borde."),
		],
		textos: [],
		opciones: [
			{
				clave: "reloj",
				etiqueta: "Reloj",
				tipo: "select",
				valores: [
					{ id: "campana", nombre: "Como diga la campaña" },
					{ id: "no", nombre: "Sin reloj en la caja" },
				],
				defecto: "campana",
			},
		],
		maxPorZona: 1,
		obligatorio: false,
		fase: 1,
	},
	precio: {
		tipo: "precio",
		nombre: "Precio",
		ayuda: "La cifra del país, el tachado y el ahorro. Las cifras salen de Ofertas y Promociones: aquí solo el estilo.",
		icono: "receipt",
		zonas: ["caja", "cabeza", "barra"],
		variantes: [v("grande", "Grande", "La cifra grande de hoy.")],
		textos: [],
		opciones: [
			{
				clave: "ahorro",
				etiqueta: "Distintivo de ahorro",
				tipo: "select",
				valores: [
					{ id: "pildora", nombre: "Pastilla oscura (hoy)" },
					{ id: "pildora-acento", nombre: "Pastilla de acento" },
					{ id: "suave", nombre: "Pastilla suave" },
					{ id: "texto", nombre: "Solo texto" },
				],
				defecto: "pildora",
			},
			{
				clave: "tachado",
				etiqueta: "Precio tachado",
				tipo: "select",
				valores: [
					{ id: "fino", nombre: "Fino (hoy)" },
					{ id: "grueso", nombre: "Grueso" },
					{ id: "acento", nombre: "Color de acento" },
				],
				defecto: "fino",
			},
			{ clave: "equivalencia", etiqueta: "Mostrar «Equivale a US$…»", tipo: "switch", defecto: true },
		],
		maxPorZona: 1,
		obligatorio: true,
		fase: 1,
	},
	cupon: {
		tipo: "cupon",
		nombre: "Cupón",
		ayuda: "Aplicar o quitar el cupón de la campaña. Solo se ve con un cupón verificado para el país.",
		icono: "receipt",
		zonas: ["caja"],
		variantes: [
			v("enlace", "Línea con enlace", "«Cupón 031016 aplicado · Quitar cupón» (la de hoy)."),
			v("discreto", "Línea discreta", "Escudo, código y «Quitar» atenuado, en letra de nota."),
			v("chip", "Pastilla", "«031016 ✓ aplicado» en una pastilla."),
		],
		textos: [],
		opciones: [],
		maxPorZona: 1,
		obligatorio: false,
		fase: 1,
	},
	boton: {
		tipo: "boton",
		nombre: "Botón de inscripción",
		ayuda: "El único botón de pago de la caja. Lleva a Hotmart con el país, el cupón y la atribución.",
		icono: "arrow-right",
		zonas: ["caja", "cabeza", "barra"],
		variantes: [v("solido-l", "Sólido grande", "Ancho completo, alto L (el de hoy).")],
		textos: [],
		opciones: [],
		maxPorZona: 1,
		obligatorio: true,
		fase: 1,
	},
	confianza: {
		tipo: "confianza",
		nombre: "Señales de confianza",
		ayuda: "Pago seguro en Hotmart (siempre), garantía (solo con los días leídos), acceso y medios.",
		icono: "lock",
		zonas: ["caja", "cabeza"],
		variantes: [
			v("lista-checks", "Lista con ✓", "Una línea por señal (la de hoy)."),
			v("fila-iconos", "Fila de iconos", "Señales en fila, con icono arriba."),
			v("chips", "Pastillas", "Señales como pastillas pequeñas."),
		],
		textos: [],
		opciones: [],
		maxPorZona: 1,
		obligatorio: true,
		items: ["pago-seguro", "garantia", "acceso", "medios"],
		fase: 1,
	},
	calificacion: {
		tipo: "calificacion",
		nombre: "Calificación de Hotmart",
		ayuda: "Nota y número de calificaciones públicas en Hotmart, con su fuente. Sin prueba suficiente no se pinta.",
		icono: "star",
		zonas: ["caja", "cabeza"],
		variantes: [v("linea", "Línea", "Una línea con la llama de Hotmart (la de hoy).")],
		textos: [],
		opciones: [],
		maxPorZona: 1,
		obligatorio: false,
		fase: 1,
	},
	whatsapp: {
		tipo: "whatsapp",
		nombre: "WhatsApp",
		ayuda: "«Preguntas antes de pagar». El número y el enlace salen del módulo WhatsApp; nunca es el botón principal.",
		icono: "whatsapp",
		zonas: ["caja", "sobre"],
		variantes: [
			v("contorno", "Botón de contorno", "Ancho completo, con borde (el de hoy)."),
			v("enlace", "Enlace", "Texto con el icono, sin borde."),
			v("tarjeta", "Tarjeta", "Icono y dos líneas: pregunta y «Te respondemos por WhatsApp»."),
		],
		textos: [{ clave: "etiqueta", etiqueta: "Texto del botón", max: 32, origen: "caja.preguntas", sugerencias: ["Preguntas antes de pagar", "Escríbenos por WhatsApp"] }],
		opciones: [
			{
				clave: "respaldo",
				etiqueta: "Sin número de WhatsApp",
				tipo: "select",
				valores: [
					{ id: "preguntas", nombre: "Enlace a las preguntas de la ficha" },
					{ id: "nada", nombre: "No mostrar nada" },
				],
				defecto: "preguntas",
			},
		],
		maxPorZona: 1,
		obligatorio: false,
		fase: 1,
	},
	acordeon: {
		tipo: "acordeon",
		nombre: "Preguntas plegables",
		ayuda: "Preguntas que se abren al tocar. Las de datos salen del curso; puedes agregar preguntas propias.",
		icono: "circle-help",
		zonas: ["caja"],
		variantes: [
			v("filas", "Filas", "Filas con línea y flecha (la de hoy)."),
			v("tarjetas", "Tarjetas", "Cada pregunta en una tarjeta suave."),
			v("mas-menos", "Más / menos", "Signo + que cambia a − al abrir."),
		],
		textos: [],
		opciones: [],
		maxPorZona: 1,
		obligatorio: false,
		items: ["calcula", "medios", "clic", "garantia", "propia"],
		fase: 1,
	},
	separador: {
		tipo: "separador",
		nombre: "Separador",
		ayuda: "Una línea o un espacio entre bloques.",
		icono: "list-checks",
		zonas: ["caja", "sobre"],
		variantes: [
			v("linea", "Línea", "Línea fina."),
			v("espacio", "Espacio", "Solo aire."),
			v("linea-texto", "Línea con texto", "Línea con una palabra al centro («o»)."),
		],
		textos: [{ clave: "texto", etiqueta: "Texto (solo «Línea con texto»)", max: 24 }],
		opciones: [],
		maxPorZona: 6,
		obligatorio: false,
		fase: 1,
	},
	texto: {
		tipo: "texto",
		nombre: "Texto",
		ayuda: "Una nota corta con icono. Sin cifras, sin urgencia falsa y sin enlaces.",
		icono: "info",
		zonas: ["caja", "sobre"],
		variantes: [v("nota", "Nota", "Letra pequeña con icono."), v("aviso", "Aviso", "Recuadro suave con icono.")],
		textos: [{ clave: "texto", etiqueta: "Texto", max: 160, variables: ["curso", "escuela"], multilinea: true }],
		opciones: [],
		maxPorZona: 4,
		obligatorio: false,
		fase: 1,
	},
	nota_legal: {
		tipo: "nota_legal",
		nombre: "Aviso de pago del curso",
		ayuda: "El aviso de pago propio del curso, si lo tiene, al pie de la caja. Lo gobierna «Aviso del curso» (B570): «Pago seguro en Hotmart» va siempre en las señales.",
		icono: "lock",
		zonas: ["caja"],
		variantes: [v("pie", "Pie", "Al pie de la caja (el de hoy).")],
		textos: [],
		opciones: [],
		maxPorZona: 1,
		obligatorio: false,
		fase: 1,
	},
	resena: {
		tipo: "resena",
		nombre: "Invitación a reseñar",
		ayuda: "«¿Ya hiciste este curso? Cuéntalo». Apagada de fábrica: la caja tiene una sola acción.",
		icono: "pen-line",
		zonas: ["caja"],
		variantes: [v("enlace", "Enlace", "Enlace con icono.")],
		textos: [],
		opciones: [],
		maxPorZona: 1,
		obligatorio: false,
		fase: 1,
	},
};

export interface ItemSpec {
	tipo: TipoItem;
	nombre: string;
	icono: IconoCaja;
	/** El panel no deja apagarlo (I4). */
	obligatorio?: boolean;
	/** Texto propio editable (solo `propia`). */
	textos?: readonly TextoSpec[];
	ayuda: string;
}

export const ITEMS: Record<TipoItem, ItemSpec> = {
	"pago-seguro": {
		tipo: "pago-seguro",
		nombre: "Pago seguro en Hotmart",
		icono: "lock",
		obligatorio: true,
		ayuda: "Siempre visible: es la promesa de pago.",
	},
	garantia: {
		tipo: "garantia",
		nombre: "Garantía",
		icono: "circle-check",
		ayuda: "Solo con los días de garantía leídos de Hotmart.",
	},
	acceso: { tipo: "acceso", nombre: "Acceso", icono: "check", ayuda: "Acceso al correo con el que pagas." },
	medios: { tipo: "medios", nombre: "Medios de pago", icono: "credit-card", ayuda: "Medios del país elegido." },
	calcula: { tipo: "calcula", nombre: "¿Cómo se calcula?", icono: "receipt", ayuda: "Texto de Textos → caja.calcula_texto." },
	clic: {
		tipo: "clic",
		nombre: "¿Qué pasa al hacer clic?",
		icono: "external-link",
		ayuda: "Misma pestaña, nombre del producto en Hotmart y qué verás allí.",
	},
	propia: {
		tipo: "propia",
		nombre: "Pregunta propia",
		icono: "circle-help",
		ayuda: "Pregunta y respuesta escritas en el panel.",
		textos: [
			{ clave: "pregunta", etiqueta: "Pregunta", max: 80 },
			{ clave: "respuesta", etiqueta: "Respuesta", max: 400, multilinea: true, variables: ["curso", "escuela"] },
		],
	},
};

/** Bloques que la zona `barra` admite (I9). */
export const TIPOS_BARRA: readonly TipoBloque[] = ["promocion", "precio", "boton"];

export const esTipoBloque = (t: unknown): t is TipoBloque => typeof t === "string" && t in CATALOGO;
export const esTipoItem = (t: unknown): t is TipoItem => typeof t === "string" && t in ITEMS;

// ── Resultado del validador ─────────────────────────────────────────────────────────────────────────────────

export interface Problema {
	nivel: "error" | "aviso";
	/** I1…I9 o «forma». */
	regla: string;
	mensaje: string;
	/** Dónde: id del preajuste, zona e id del bloque (si aplica). */
	donde?: { preajuste?: string; curso?: string; zona?: Zona; bloque?: string };
}

// ── Firmas que implementan los otros módulos (congeladas) ──────────────────────────────────────────────────

/** Interruptores de hoy (`adb-design/behavior.ts`) que la migración vuelca en la Clásica. */
export interface InterruptoresCaja {
	buyBoxWhatsapp: boolean;
	buyBoxGuarantee: boolean;
	buyBoxPayments: boolean;
	buyBoxNote: boolean;
	buyBoxRating: boolean;
	buyBoxDetails: boolean;
	buyBoxReviewInvite: boolean;
}

/** Contexto del curso que el resolvedor necesita (sin el VM entero). */
export interface CursoCaja {
	courseId: string;
	escuela: string | null;
	/** `cursos.caja_elementos` (B172) mientras exista: se lee como parche (doble lectura, fase 1). */
	cajaElementos: readonly string[] | null;
}

/** Bloques efectivos de una zona, ya con herencia, parches e invariantes aplicados (lo que pinta `Zona.astro`). */
export interface ZonaResuelta {
	zona: Zona;
	preajuste: string;
	estilo: EstiloCaja;
	bloques: Bloque[];
	/** Problemas que el resolvedor corrigió al vuelo (para el registro y la vista previa). */
	corregidos: Problema[];
}

// Implementaciones:
//   fabrica.ts  → PREAJUSTES_FABRICA, clasica(), docFabrica()
//   migrar.ts   → migrar(interruptores): CajaDoc · parcheDeElementos(elementos): Parche | null · readCaja(valor): CajaDoc | null
//   resolver.ts → resolverZona({ doc, curso, zona }): ZonaResuelta · efectivo(doc, curso): Preajuste
//   validar.ts  → validarCaja(doc): Problema[] · validarBloque(bloque, zona): Problema[]
