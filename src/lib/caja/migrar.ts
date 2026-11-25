/**
 * Migración a la caja por bloques (fase 1) y lectura del documento guardado. Puro.
 *
 *  - `migrar(interruptores)`: el documento de fábrica con los interruptores `buyBox*` de hoy (Diseño y marca →
 *    Comportamiento) volcados en la «Clásica». Con los valores de fábrica, la Clásica pinta la caja v3 de hoy tal cual.
 *  - `parcheDeElementos(lista)`: la lista `cursos.caja_elementos` como parche del curso. Desde B570 esa lista SUMA o
 *    QUITA sobre los interruptores del sitio («whatsapp» suma, «sin-whatsapp» quita, lo no nombrado no cambia), igual
 *    que `cajaElements()` (claude/ficha/compra.ts): el parche reproduce exactamente lo que se ve.
 *  - Doble lectura: sin el ajuste `caja` guardado, las plantillas arman el documento al vuelo con `migrar()`; un curso
 *    sin parche propio pero con `caja_elementos` usa `parcheDeElementos()`. Desplegar no cambia nada.
 *  - `readCaja(valor)`: acepta `v` ausente o 1; lo ilegible devuelve `null` (la plantilla cae a `migrar()`, nunca un 500).
 *
 * «Pago seguro en Hotmart» queda siempre visible (I4, B570). `buyBoxNote` (y «nota» / «sin-nota» del curso) solo decide
 * el aviso de pago propio del curso al pie (`nota_legal`, b11).
 */
import type { Bloque, CajaDoc, InterruptoresCaja, Parche, Preajuste } from "./model";
import { CAJA_VERSION, LIMITES, ZONAS } from "./model";
import { docFabrica } from "./fabrica";

/** Valores de fábrica de `adb-design/behavior.ts` (los de hoy en producción salvo que el panel los cambie). */
export const INTERRUPTORES_FABRICA: InterruptoresCaja = {
	buyBoxWhatsapp: true,
	buyBoxGuarantee: true,
	buyBoxPayments: true,
	buyBoxNote: true,
	buyBoxRating: true,
	buyBoxDetails: true,
	buyBoxReviewInvite: false,
};

/** Ids de la Clásica que gobierna cada elemento de hoy (`cajaElements`, B172). */
const MAPA: Record<"whatsapp" | "garantia" | "medios" | "nota" | "calificacion" | "plegables", readonly string[]> = {
	whatsapp: ["b8"],
	nota: ["b11"],
	garantia: ["b6b"],
	medios: ["b6d", "b9b"],
	calificacion: ["b7"],
	plegables: ["b9a", "b9c"],
};

function visibles(p: Preajuste, ids: Record<string, boolean>): Preajuste {
	const fijar = (b: Bloque): Bloque => ({
		...b,
		...(b.id in ids ? { visible: ids[b.id]! } : {}),
		...(b.hijos ? { hijos: b.hijos.map(fijar) } : {}),
	});
	return { ...p, zonas: Object.fromEntries(ZONAS.map((z) => [z, p.zonas[z].map(fijar)])) as Preajuste["zonas"] };
}

type Pieza = keyof typeof MAPA;

function idsDe(on: Record<Pieza, boolean>) {
	const out: Record<string, boolean> = {};
	for (const [k, ids] of Object.entries(MAPA)) for (const id of ids) out[id] = on[k as Pieza];
	return out;
}

export function migrar(i: Partial<InterruptoresCaja> = {}): CajaDoc {
	const s = { ...INTERRUPTORES_FABRICA, ...i };
	const doc = docFabrica();
	const ids = idsDe({
		whatsapp: s.buyBoxWhatsapp,
		garantia: s.buyBoxGuarantee,
		medios: s.buyBoxPayments,
		nota: s.buyBoxNote,
		calificacion: s.buyBoxRating,
		plegables: s.buyBoxDetails,
	});
	ids.b10 = s.buyBoxReviewInvite;
	doc.preajustes = doc.preajustes.map((p) => (p.id === "clasica" ? visibles(p, ids) : p));
	// Hoy, con los seis interruptores apagados, la caja no pinta ni el enlace a las preguntas (`el.size > 1`).
	const ninguno = ![s.buyBoxWhatsapp, s.buyBoxGuarantee, s.buyBoxPayments, s.buyBoxNote, s.buyBoxRating, s.buyBoxDetails].some(Boolean);
	if (ninguno)
		doc.preajustes = doc.preajustes.map((p) =>
			p.id === "clasica"
				? { ...p, zonas: { ...p.zonas, caja: p.zonas.caja.map((b) => (b.id === "b8" ? { ...b, opciones: { ...b.opciones, respaldo: "nada" } } : b)) } }
				: p,
		);
	doc.revision = "migrado";
	return doc;
}

/**
 * La lista del curso (`caja_elementos`, B570) como parche de visibilidad sobre la Clásica: «x» enciende las piezas de x,
 * «sin-x» las apaga y lo que no nombra queda como en el sitio; si se repite, manda la última (como `cajaElements`).
 * «pagar» y los nombres desconocidos no cambian nada. Sin nada que cambie, `null`.
 */
export function parcheDeElementos(lista: readonly string[] | null | undefined): Parche | null {
	const bloques: NonNullable<Parche["bloques"]> = {};
	for (const v of lista ?? []) {
		const quita = v.startsWith("sin-");
		const pieza = (quita ? v.slice(4) : v) as Pieza;
		if (!(pieza in MAPA)) continue;
		for (const id of MAPA[pieza]) bloques[id] = { visible: !quita };
	}
	return Object.keys(bloques).length ? { bloques } : null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Lectura tolerante del ajuste guardado. Comprueba la forma gruesa (la fina es de `validarCaja`) y repone los
 * preajustes de fábrica que falten: un documento viejo nunca deja la caja sin preajuste.
 */
export function readCaja(valor: unknown): CajaDoc | null {
	let v = valor;
	if (typeof v === "string") {
		try {
			v = JSON.parse(v);
		} catch {
			return null;
		}
	}
	if (!isRecord(v)) return null;
	if (v.v !== undefined && v.v !== CAJA_VERSION) return null;
	if (!Array.isArray(v.preajustes) || typeof v.sitio !== "string") return null;
	const preajustes = (v.preajustes as unknown[])
		.filter((p): p is Preajuste => isRecord(p) && typeof p.id === "string" && isRecord(p.zonas))
		.map((p) => ({
			...p,
			zonas: Object.fromEntries(ZONAS.map((z) => [z, Array.isArray(p.zonas[z]) ? p.zonas[z] : []])) as Preajuste["zonas"],
		}))
		.slice(0, LIMITES.preajustes);
	const fabrica = docFabrica().preajustes;
	for (const f of fabrica) if (!preajustes.some((p) => p.id === f.id)) preajustes.push(f);
	return {
		v: CAJA_VERSION,
		sitio: preajustes.some((p) => p.id === v.sitio) ? (v.sitio as string) : "clasica",
		preajustes,
		escuelas: isRecord(v.escuelas) ? (v.escuelas as CajaDoc["escuelas"]) : {},
		cursos: isRecord(v.cursos) ? (v.cursos as CajaDoc["cursos"]) : {},
		capas: Array.isArray(v.capas) ? (v.capas as CajaDoc["capas"]).slice(0, LIMITES.capas) : [],
		revision: typeof v.revision === "string" ? v.revision : "",
		updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : null,
		updatedBy: typeof v.updatedBy === "string" ? v.updatedBy : null,
	};
}
