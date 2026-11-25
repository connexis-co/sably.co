/**
 * Aplicación de un parche (escuela o curso) sobre un preajuste. Puro. Lo comparten el resolvedor (que pinta) y el
 * validador (que revisa cada parche sobre su preajuste), así los dos ven exactamente la misma caja.
 *
 * Orden: `extra` (bloques propios, tras `despuesDe` o al final) → `orden` (los ids nombrados primero; los que falten,
 * al final en su orden heredado) → `bloques` (visible, variante, icono, textos, si y opciones de cada id). Un id que el
 * preajuste no tiene es «huérfano»: se ignora y se informa en `huerfanos` (el panel lo marca).
 */
import type { Bloque, Parche, Preajuste, Problema, Zona } from "./model";
import { ZONAS } from "./model";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Copia profunda de datos JSON (los documentos de la caja solo tienen datos JSON). */
export const clonar = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/** Busca un bloque por id en las zonas del preajuste, también entre los hijos. */
export function buscar(p: Preajuste, id: string): Bloque | null {
	for (const z of ZONAS) {
		for (const b of p.zonas[z] ?? []) {
			if (b?.id === id) return b;
			for (const h of Array.isArray(b?.hijos) ? b.hijos : []) if (h?.id === id) return h;
		}
	}
	return null;
}

export interface Origen {
	escuela?: string;
	curso?: string;
}

/**
 * El preajuste con el parche aplicado (copia; el original no se toca). Los ids huérfanos y los bloques propios que no
 * se pudieron poner van a `avisos`.
 */
export function aplicarParche(base: Preajuste, parche: Parche | null | undefined, avisos: Problema[] = [], origen: Origen = {}): Preajuste {
	const p = clonar(base);
	if (!isRecord(parche)) return p;
	const quien = origen.curso ? `el curso «${origen.curso}»` : origen.escuela ? `la escuela «${origen.escuela}»` : "el parche";
	const huerfano = (id: string, zona?: Zona) =>
		avisos.push({
			nivel: "aviso",
			regla: "forma",
			mensaje: `El ajuste de ${quien} nombra el bloque «${id}», que el preajuste «${p.nombre ?? p.id}» ya no tiene: se ignora.`,
			donde: { preajuste: p.id, ...(origen.curso ? { curso: origen.curso } : {}), ...(zona ? { zona } : {}), bloque: id },
		});

	// 1. Bloques propios.
	if (isRecord(parche.extra)) {
		for (const z of ZONAS) {
			const lista = (parche.extra as Record<string, unknown>)[z];
			if (!Array.isArray(lista)) continue;
			for (const raw of lista) {
				if (!isRecord(raw) || typeof raw.id !== "string") continue;
				const { despuesDe, ...bloque } = clonar(raw) as unknown as Bloque & { despuesDe?: string | null };
				if (buscar(p, bloque.id)) {
					avisos.push({
						nivel: "aviso",
						regla: "forma",
						mensaje: `El bloque propio «${bloque.id}» de ${quien} repite un id del preajuste: se ignora.`,
						donde: { preajuste: p.id, zona: z, bloque: bloque.id },
					});
					continue;
				}
				const zona = p.zonas[z];
				const at = typeof despuesDe === "string" ? zona.findIndex((b) => b.id === despuesDe) : -1;
				if (typeof despuesDe === "string" && at < 0) huerfano(despuesDe, z);
				if (at >= 0) zona.splice(at + 1, 0, bloque);
				else zona.push(bloque);
			}
		}
	}

	// 2. Orden.
	if (isRecord(parche.orden)) {
		for (const z of ZONAS) {
			const ids = (parche.orden as Record<string, unknown>)[z];
			if (!Array.isArray(ids)) continue;
			const zona = p.zonas[z];
			const primero: Bloque[] = [];
			for (const id of ids) {
				const b = typeof id === "string" ? zona.find((x) => x.id === id) : undefined;
				if (!b) {
					if (typeof id === "string") huerfano(id, z);
					continue;
				}
				if (!primero.includes(b)) primero.push(b);
			}
			p.zonas[z] = [...primero, ...zona.filter((b) => !primero.includes(b))];
		}
	}

	// 3. Campos de cada bloque.
	if (isRecord(parche.bloques)) {
		for (const [id, cambio] of Object.entries(parche.bloques)) {
			if (!isRecord(cambio)) continue;
			const b = buscar(p, id);
			if (!b) {
				huerfano(id);
				continue;
			}
			if (typeof cambio.visible === "boolean") b.visible = cambio.visible;
			if (typeof cambio.variante === "string") b.variante = cambio.variante;
			if (cambio.icono === null || typeof cambio.icono === "string") b.icono = cambio.icono as Bloque["icono"];
			if (isRecord(cambio.textos)) b.textos = { ...(b.textos ?? {}), ...(clonar(cambio.textos) as Record<string, string>) };
			if (isRecord(cambio.opciones))
				b.opciones = { ...(b.opciones ?? {}), ...(clonar(cambio.opciones) as Record<string, string | boolean>) };
			if ("si" in cambio) {
				if (isRecord(cambio.si)) b.si = clonar(cambio.si) as Bloque["si"];
				else delete b.si;
			}
		}
	}
	return p;
}
