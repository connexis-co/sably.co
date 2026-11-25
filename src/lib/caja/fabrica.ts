/**
 * Preajustes de fábrica de la caja de compra (fase 1). Puros y congelados con `model.ts`.
 *
 *  - «Clásica»: idéntica a la caja v3 de hoy (`claude/components/BuyBox.astro`, rama `v3`), en su mismo orden:
 *    país → campaña → precio → cupón | botón → confianza → calificación → WhatsApp → plegables → reseña | aviso.
 *    La migración vuelca en ella los interruptores `buyBox*` (migrar.ts). Es la del sitio por defecto.
 *  - «Campaña»: la variante B de `cro-ficha-compra.md` §5b (campaña al frente, título, banda oscura, pastilla de
 *    acento, cupón en pastilla, dos señales y dos plegables, sin WhatsApp). Sin campaña, la banda no se ve.
 *    Desde la revisión de la PR #140 (25-nov) es `uso: "campana"`: solo durante una campaña con fechas, nunca la del sitio.
 *  - «Mínima»: precio, botón y lo obligatorio; cinta de campaña; WhatsApp como enlace; sin plegables.
 *  - «Precio claro» (A de V3.6, la recomendada), «Confianza primero» (C) y «Cuenta clara» (D, común con Sably): armadas
 *    con los bloques y variantes que pinta la fase 1. Lo que todavía no se puede va en su `descripcion` como «fase 2».
 *    Ids de `docs/equipo/2026-11-24/constructor-caja/NOMBRES-COMUNES.md`.
 *
 * Los ids son estables («b1»…): los parches y las capas los nombran. No se renumeran nunca.
 */
import type { Bloque, CajaDoc, Preajuste, Zona } from "./model";
import { CAJA_VERSION } from "./model";

const b = (id: string, tipo: Bloque["tipo"], variante: string, extra: Partial<Bloque> = {}): Bloque => ({
	id,
	tipo,
	visible: true,
	variante,
	...extra,
});
const item = (id: string, tipo: Bloque["tipo"], visible = true, extra: Partial<Bloque> = {}): Bloque =>
	b(id, tipo, "-", { visible, ...extra });

const vacias = (): Record<Zona, Bloque[]> => ({ cabeza: [], sobre: [], caja: [], barra: [] });

export function clasica(): Preajuste {
	return {
		id: "clasica",
		nombre: "Clásica",
		fabrica: true,
		descripcion: "La caja de hoy, pieza por pieza.",
		estilo: { piel: "tarjeta", densidad: "comoda" },
		zonas: {
			...vacias(),
			caja: [
				b("b1", "pais", "fila"),
				b("b2", "promocion", "tarjeta", { opciones: { reloj: "campana" } }),
				b("b3", "precio", "grande", { opciones: { ahorro: "pildora", tachado: "fino", equivalencia: true } }),
				b("b4", "cupon", "enlace"),
				b("b5", "boton", "solido-l"),
				b("b6", "confianza", "lista-checks", {
					hijos: [item("b6a", "pago-seguro"), item("b6b", "garantia"), item("b6c", "acceso"), item("b6d", "medios")],
				}),
				b("b7", "calificacion", "linea"),
				b("b8", "whatsapp", "contorno", { opciones: { respaldo: "preguntas" } }),
				b("b9", "acordeon", "filas", {
					hijos: [item("b9a", "calcula"), item("b9b", "medios"), item("b9c", "clic")],
				}),
				b("b10", "resena", "enlace", { visible: false }),
				b("b11", "nota_legal", "pie"),
			],
		},
	};
}

export function campana(): Preajuste {
	return {
		id: "campana",
		nombre: "Campaña",
		fabrica: true,
		descripcion:
			"Solo para campañas con fechas: la campaña al frente, título, banda oscura con reloj, pastilla de acento y cupón en pastilla.",
		uso: "campana",
		estilo: { piel: "tarjeta", densidad: "comoda" },
		zonas: {
			...vacias(),
			caja: [
				b("b12", "titulo", "display", { textos: { texto: "Inscríbete hoy" } }),
				b("b1", "pais", "fila"),
				b("b2", "promocion", "banda", { opciones: { reloj: "campana" } }),
				b("b3", "precio", "grande", { opciones: { ahorro: "pildora-acento", tachado: "acento", equivalencia: false } }),
				b("b5", "boton", "solido-l"),
				b("b4", "cupon", "chip"),
				b("b6", "confianza", "lista-checks", {
					hijos: [item("b6a", "pago-seguro"), item("b6b", "garantia"), item("b6c", "acceso", false), item("b6d", "medios", false)],
				}),
				b("b7", "calificacion", "linea"),
				b("b8", "whatsapp", "contorno", { visible: false, opciones: { respaldo: "nada" } }),
				b("b9", "acordeon", "filas", {
					hijos: [item("b9a", "calcula", false), item("b9b", "medios"), item("b9c", "clic")],
				}),
				b("b11", "nota_legal", "pie"),
			],
		},
	};
}

export function minima(): Preajuste {
	return {
		id: "minima",
		nombre: "Mínima",
		fabrica: true,
		descripcion: "Precio, botón y lo obligatorio. Para cajas cortas y pantallas bajas.",
		estilo: { piel: "plana", densidad: "compacta" },
		zonas: {
			...vacias(),
			caja: [
				b("b1", "pais", "fila"),
				b("b2", "promocion", "cinta", { opciones: { reloj: "no" } }),
				b("b3", "precio", "grande", { opciones: { ahorro: "suave", tachado: "fino", equivalencia: false } }),
				b("b5", "boton", "solido-l"),
				b("b4", "cupon", "discreto"),
				b("b6", "confianza", "chips", {
					hijos: [item("b6a", "pago-seguro"), item("b6b", "garantia"), item("b6c", "acceso", false), item("b6d", "medios", false)],
				}),
				b("b8", "whatsapp", "enlace", { opciones: { respaldo: "nada" } }),
				b("b11", "nota_legal", "pie"),
			],
		},
	};
}

/** A «Precio claro, botón cerca» (V3.6-01; CRO §5b A): precio y botón a un palmo, campaña en cinta. */
export function precioClaro(): Preajuste {
	return {
		id: "precio-claro",
		nombre: "Precio claro",
		fabrica: true,
		descripcion:
			"Precio y botón a un palmo: campaña en cinta (el reloj va en la barra fija), pastilla de ahorro suave, señales y tres plegables. Fase 2: rótulo «Precio con cupón», cuotas como pieza propia y la señal «Certificado al terminar».",
		estilo: { piel: "tarjeta", densidad: "comoda" },
		zonas: {
			...vacias(),
			caja: [
				b("b1", "pais", "fila"),
				b("b2", "promocion", "cinta", { opciones: { reloj: "no" } }),
				b("b3", "precio", "grande", { opciones: { ahorro: "suave", tachado: "fino", equivalencia: true } }),
				b("b5", "boton", "solido-l"),
				b("b6", "confianza", "lista-checks", {
					hijos: [item("b6a", "pago-seguro"), item("b6b", "garantia"), item("b6c", "acceso"), item("b6d", "medios", false)],
				}),
				b("b4", "cupon", "discreto"),
				b("b8", "whatsapp", "contorno", { opciones: { respaldo: "preguntas" } }),
				b("b9", "acordeon", "filas", {
					hijos: [item("b9b", "medios"), item("b9c", "clic"), item("b9d", "garantia"), item("b9a", "calcula", false)],
				}),
				b("b7", "calificacion", "linea", { visible: false }),
				b("b11", "nota_legal", "pie"),
			],
		},
	};
}

/** C «Confianza primero» (V3.6-03; CRO §5b C): visita fría de Google o de un motor de IA, cursos sin reseñas. */
export function confianzaPrimero(): Preajuste {
	return {
		id: "confianza-primero",
		nombre: "Confianza primero",
		fabrica: true,
		descripcion:
			"Primero qué recibes, después el precio: título y subtítulo, campaña en cinta, señales en pastillas, calificación de Hotmart con su fuente y WhatsApp. Fase 2: la docente, «Qué recibes» como ficha técnica, el número de lecciones en el subtítulo y el plegable «Cómo funciona Sably».",
		estilo: { piel: "tarjeta", densidad: "comoda" },
		zonas: {
			...vacias(),
			caja: [
				b("b12", "titulo", "display", { textos: { texto: "Empieza tu oficio hoy" } }),
				b("b13", "subtitulo", "atenuado", { textos: { texto: "Clases en video, a tu ritmo y con certificado al terminar" } }),
				b("b1", "pais", "fila"),
				b("b2", "promocion", "cinta", { opciones: { reloj: "no" } }),
				b("b3", "precio", "grande", { opciones: { ahorro: "suave", tachado: "fino", equivalencia: false } }),
				b("b5", "boton", "solido-l"),
				b("b6", "confianza", "chips", {
					hijos: [item("b6a", "pago-seguro"), item("b6b", "garantia"), item("b6c", "acceso"), item("b6d", "medios", false)],
				}),
				b("b4", "cupon", "discreto"),
				b("b7", "calificacion", "linea"),
				b("b8", "whatsapp", "contorno", { opciones: { respaldo: "preguntas" } }),
				b("b9", "acordeon", "filas", {
					hijos: [item("b9c", "clic"), item("b9d", "garantia"), item("b9a", "calcula", false), item("b9b", "medios", false)],
				}),
				b("b11", "nota_legal", "pie"),
			],
		},
	};
}

/** D «Cuenta clara» (V3.6-09, común con Sably E): la cuenta que mostrará Hotmart antes del botón. */
export function cuentaClara(): Preajuste {
	return {
		id: "cuenta-clara",
		nombre: "Cuenta clara",
		fabrica: true,
		descripcion:
			"La cuenta antes de pagar: nombre del curso, precio con su tachado fino, cupón en línea, la campaña con su reloj y el botón; señales en pastillas, «¿Qué pasa al hacer clic?» y WhatsApp en tarjeta al pie. Fase 2: «Precio normal → cupón → Hoy pagas» como filas de la cuenta, el contador en barra, logos de los medios y la banda gris de las dudas.",
		estilo: { piel: "tarjeta", densidad: "comoda" },
		zonas: {
			...vacias(),
			caja: [
				b("b12", "titulo", "simple", { textos: { texto: "{curso}" } }),
				b("b13", "subtitulo", "atenuado", { textos: { texto: "Clases en video, a tu ritmo y con certificado al terminar" } }),
				b("b1", "pais", "fila"),
				b("b3", "precio", "grande", { opciones: { ahorro: "texto", tachado: "fino", equivalencia: false } }),
				b("b4", "cupon", "enlace"),
				b("b2", "promocion", "tarjeta", { opciones: { reloj: "campana" } }),
				b("b5", "boton", "solido-l"),
				b("b6", "confianza", "chips", {
					hijos: [item("b6a", "pago-seguro"), item("b6b", "garantia"), item("b6c", "acceso", false), item("b6d", "medios")],
				}),
				b("b9", "acordeon", "filas", {
					hijos: [item("b9c", "clic"), item("b9a", "calcula", false), item("b9b", "medios", false)],
				}),
				b("b14", "separador", "espacio"),
				b("b8", "whatsapp", "tarjeta", { opciones: { respaldo: "preguntas" } }),
				b("b11", "nota_legal", "pie"),
			],
		},
	};
}

export const PREAJUSTES_FABRICA: ReadonlyArray<() => Preajuste> = [clasica, campana, minima, precioClaro, confianzaPrimero, cuentaClara];
export const PREAJUSTE_SITIO = "clasica";

/** Documento de fábrica (sin interruptores: la migración los aplica sobre la Clásica). */
export function docFabrica(): CajaDoc {
	return {
		v: CAJA_VERSION,
		sitio: PREAJUSTE_SITIO,
		preajustes: PREAJUSTES_FABRICA.map((f) => f()),
		escuelas: {},
		cursos: {},
		capas: [],
		revision: "fabrica",
		updatedAt: null,
		updatedBy: null,
	};
}
