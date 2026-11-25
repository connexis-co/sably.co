/**
 * Documento de caja de Sably sobre el núcleo común (copia exacta del de la academia).
 *
 * - Parte del documento de fábrica común (`docFabrica`): `validarCaja` exige que estén
 *   todos los preajustes de fábrica, y así la academia y Sably hablan de los mismos ids.
 * - Los textos de fábrica pasan al vocabulario de Sably («constancia», no «certificado»).
 * - La caja del sitio es `cuenta-clara` (variante E de la lámina RGZQ7 de Sably, D de la
 *   V3.6 de la academia: en el código manda el id, no la letra).
 * - `cabecera-oscura` (variante B de Sably) se crea aquí primero, con la forma de
 *   `Preajuste`, para que la academia la traiga de vuelta a su `fabrica.ts` tal cual.
 */
import type { Bloque, CajaDoc, Preajuste, Zona } from "./model";
import { docFabrica } from "./fabrica";
import { validarCaja } from "./validar";
import { conConstancia } from "../vocabulario";

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

/** Texto de fábrica de Sably para el subtítulo (sin cifras: I2). */
export const SUBTITULO_SABLY = "Lecciones en vídeo, a tu ritmo.";
export const TITULO_SABLY = "Empieza {curso}";

/** B «Cabecera oscura» (Sably, lámina RGZQ7): la campaña manda arriba en una franja azul noche. */
export function cabeceraOscura(): Preajuste {
	return {
		id: "cabecera-oscura",
		nombre: "Cabecera oscura",
		fabrica: true,
		descripcion:
			"La campaña manda: franja oscura con el título, el porcentaje, el reloj en casillas y el cupón; debajo, el precio con su tachado, el botón, las señales y los plegables. Sin campaña se ve como «Cuenta clara». Para los picos del año.",
		estilo: { piel: "oscura", densidad: "comoda" },
		zonas: {
			...vacias(),
			caja: [
				b("b12", "titulo", "simple", { textos: { texto: TITULO_SABLY } }),
				b("b13", "subtitulo", "atenuado", { textos: { texto: SUBTITULO_SABLY } }),
				b("b2", "promocion", "franja", { opciones: { reloj: "campana" } }),
				b("b4", "cupon", "enlace"),
				b("b1", "pais", "fila"),
				b("b3", "precio", "grande", { opciones: { ahorro: "suave", tachado: "fino", equivalencia: false } }),
				b("b5", "boton", "solido-l"),
				b("b6", "confianza", "lista-checks", {
					hijos: [item("b6a", "pago-seguro"), item("b6b", "garantia"), item("b6c", "acceso", false), item("b6d", "medios")],
				}),
				b("b9", "acordeon", "filas", {
					hijos: [item("b9c", "clic"), item("b9b", "medios"), item("b9a", "calcula", false)],
				}),
				b("b8", "whatsapp", "contorno", { opciones: { respaldo: "preguntas" } }),
				b("b11", "nota_legal", "pie"),
			],
		},
	};
}

/** Los textos de un bloque (y de sus hijos) con el vocabulario de Sably. */
function aSably(bloque: Bloque): Bloque {
	const textos = bloque.textos ? Object.fromEntries(Object.entries(bloque.textos).map(([k, v]) => [k, conConstancia(v)])) : undefined;
	return { ...bloque, ...(textos ? { textos } : {}), ...(bloque.hijos ? { hijos: bloque.hijos.map(aSably) } : {}) };
}

/** Documento de caja de Sably tal como sale de fábrica. */
export function docSably(): CajaDoc {
	const doc = docFabrica();
	const preajustes = doc.preajustes.map((p) => ({
		...p,
		...(p.descripcion ? { descripcion: p.descripcion.replace(/Certificad([oa])/g, "Constancia").replace(/certificad([oa])/g, "constancia") } : {}),
		zonas: Object.fromEntries(Object.entries(p.zonas).map(([z, bloques]) => [z, bloques.map(aSably)])) as Preajuste["zonas"],
	}));
	const cuenta = preajustes.find((p) => p.id === "cuenta-clara");
	if (cuenta)
		cuenta.zonas.caja = cuenta.zonas.caja.map((bl) =>
			bl.tipo === "titulo"
				? { ...bl, textos: { texto: TITULO_SABLY } }
				: bl.tipo === "subtitulo"
					? { ...bl, textos: { texto: SUBTITULO_SABLY } }
					: // La E aprobada por JP (lámina RGZQ7) trae «Medios de pago» entre los plegables.
						bl.tipo === "acordeon"
						? { ...bl, hijos: (bl.hijos ?? []).map((h) => (h.tipo === "medios" ? { ...h, visible: true } : h)) }
						: bl,
		);
	return { ...doc, sitio: "cuenta-clara", preajustes: [...preajustes, cabeceraOscura()], revision: "fabrica-sably" };
}

/**
 * El documento con lo que hoy se elige en Ajustes → Sably · operaciones (variante, título y
 * subtítulo), mientras no esté portado el panel constructor de la academia. Un título o
 * subtítulo vacío apaga ese bloque. Si un texto no pasa el validador común (vocabulario,
 * cifras, urgencia sin fecha, largo), se queda el de fábrica: nunca sale a la página.
 */
export function docConAjustes(ajustes: { variante: string; titulo: string; subtitulo: string }): CajaDoc {
	const base = docSably();
	const conTextos = (doc: CajaDoc, titulo: string, subtitulo: string): CajaDoc => ({
		...doc,
		sitio: ajustes.variante === "cabecera-oscura" ? "cabecera-oscura" : "cuenta-clara",
		preajustes: doc.preajustes.map((p) =>
			p.id !== "cuenta-clara" && p.id !== "cabecera-oscura"
				? p
				: {
						...p,
						zonas: {
							...p.zonas,
							caja: p.zonas.caja.map((bl) => {
								const texto = bl.tipo === "titulo" ? titulo : bl.tipo === "subtitulo" ? subtitulo : null;
								if (texto === null) return bl;
								return texto.trim() ? { ...bl, visible: true, textos: { texto: texto.trim() } } : { ...bl, visible: false };
							}),
						},
					},
		),
	});
	const propio = conTextos(base, ajustes.titulo, ajustes.subtitulo);
	return validarCaja(propio).some((p) => p.nivel === "error") ? conTextos(base, TITULO_SABLY, SUBTITULO_SABLY) : propio;
}
