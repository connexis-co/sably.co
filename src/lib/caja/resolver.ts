/**
 * Resolvedor de la caja (fase 1). Puro: lo usan las plantillas (`shared/caja/Zona.astro`), la vista previa del panel y
 * las pruebas.
 *
 *   efectivo(doc, curso) = parche del curso ∘ parche de la escuela ∘ preajuste(curso.preajuste ?? escuela.preajuste ?? sitio)
 *
 * Doble lectura (fase 1): un curso sin parche en `doc.cursos` pero con `cursos.caja_elementos` (B172) usa
 * `parcheDeElementos()`, así desplegar no cambia lo que se ve.
 *
 * `resolverZona` aplica además las invariantes aunque llegue un documento malo (constructor-caja-arquitectura.md §3):
 * quita lo que no se puede pintar (tipo, zona o ítem desconocido), corrige variantes, iconos y opciones a las de
 * fábrica, deja un único `boton` visible y sin condición (si falta, lo agrega tras `precio`), fuerza visibles `pais`,
 * `precio` y `confianza` con «Pago seguro en Hotmart» (el aviso del curso, `nota_legal`, lo gobierna `buyBoxNote`, B570), y devuelve al texto de fábrica todo texto que no
 * pase el validador. Lo corregido va a `corregidos` (registro y vista previa). Los bloques con `visible: false` se
 * devuelven tal cual: `Zona.astro` decide (no se pintan, salvo el respaldo de WhatsApp).
 */
import type { Bloque, CajaDoc, Condicion, CursoCaja, EstiloCaja, Preajuste, Problema, TipoBloque, Zona, ZonaResuelta } from "./model";
import { CATALOGO, ITEMS, LIMITES, TIPOS_BARRA, ZONAS, esIcono, esTipoBloque, esTipoItem } from "./model";
import { PREAJUSTES_FABRICA, clasica } from "./fabrica";
import { parcheDeElementos } from "./migrar";
import { aplicarParche, clonar } from "./parche";
import { problemasTexto } from "./validar";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const vacias = (): Record<Zona, Bloque[]> => ({ cabeza: [], sobre: [], caja: [], barra: [] });

/** El preajuste sin nada que lo rompa: zonas como listas (lo fino lo hace `sanear`). */
function normalizar(p: unknown): Preajuste | null {
	if (!isRecord(p) || typeof p.id !== "string") return null;
	const zonas = vacias();
	if (isRecord(p.zonas)) for (const z of ZONAS) zonas[z] = Array.isArray(p.zonas[z]) ? (p.zonas[z] as Bloque[]).filter(isRecord) : [];
	return {
		id: p.id,
		nombre: typeof p.nombre === "string" ? p.nombre : p.id,
		fabrica: p.fabrica === true,
		...(typeof p.descripcion === "string" ? { descripcion: p.descripcion } : {}),
		estilo: estiloSeguro(p.estilo),
		zonas,
	};
}

function estiloSeguro(e: unknown): EstiloCaja {
	const r = isRecord(e) ? e : {};
	return {
		piel: r.piel === "plana" || r.piel === "oscura" ? r.piel : "tarjeta",
		densidad: r.densidad === "compacta" ? "compacta" : "comoda",
	};
}

function componer(doc: CajaDoc, curso: CursoCaja, corregidos: Problema[]): Preajuste {
	const lista = (Array.isArray(doc?.preajustes) ? doc.preajustes : []).map(normalizar).filter((p): p is Preajuste => p !== null);
	const cursos = isRecord(doc?.cursos) ? doc.cursos : {};
	const escuelas = isRecord(doc?.escuelas) ? doc.escuelas : {};
	const propio = isRecord(cursos[curso.courseId]) ? cursos[curso.courseId] : null;
	const pc = propio ?? parcheDeElementos(curso.cajaElementos);
	const pe = curso.escuela && isRecord(escuelas[curso.escuela]) ? escuelas[curso.escuela]! : null;
	const sitio = typeof doc?.sitio === "string" ? doc.sitio : "clasica";
	const id = (typeof pc?.preajuste === "string" && pc.preajuste) || (typeof pe?.preajuste === "string" && pe.preajuste) || sitio;
	let base = lista.find((p) => p.id === id);
	if (!base) {
		corregidos.push({
			nivel: "aviso",
			regla: "forma",
			mensaje: `El preajuste «${id}» no existe: se usa el del sitio.`,
			donde: { preajuste: id, curso: curso.courseId },
		});
		base = lista.find((p) => p.id === sitio) ?? normalizar(clasica())!;
	}
	let p = base;
	if (pe) p = aplicarParche(p, pe, corregidos, { escuela: curso.escuela ?? undefined });
	if (pc) p = aplicarParche(p, pc, corregidos, { curso: curso.courseId });
	return p;
}

/** El preajuste efectivo del curso (herencia y parches; sin las correcciones de `resolverZona`). */
export function efectivo(doc: CajaDoc, curso: CursoCaja): Preajuste {
	return clonar(componer(doc, curso, []));
}

/** Bloque de fábrica con el mismo id en el preajuste de fábrica del mismo id (para devolver un texto). */
function deFabrica(preajuste: string, id: string): Bloque | null {
	const f = PREAJUSTES_FABRICA.map((x) => x()).find((p) => p.id === preajuste);
	if (!f) return null;
	for (const z of ZONAS)
		for (const b of f.zonas[z]) {
			if (b.id === id) return b;
			for (const h of b.hijos ?? []) if (h.id === id) return h;
		}
	return null;
}

const SI_CAMPANA = new Set(["activa", "con-fechas", "sin"]);
const SI_CUPON = new Set(["aplicado", "no-aplicado"]);
const SI_DISP = new Set(["movil", "escritorio"]);

function condicion(si: unknown): Condicion | undefined {
	if (!isRecord(si)) return undefined;
	const out: Condicion = {};
	if (SI_CAMPANA.has(si.campana as string)) out.campana = si.campana as Condicion["campana"];
	if (SI_CUPON.has(si.cupon as string)) out.cupon = si.cupon as Condicion["cupon"];
	if (SI_DISP.has(si.dispositivo as string)) out.dispositivo = si.dispositivo as Condicion["dispositivo"];
	if (Array.isArray(si.paises)) {
		const paises = si.paises.filter((p): p is string => typeof p === "string" && /^[A-Z]{2}$/.test(p));
		if (paises.length) out.paises = paises;
	}
	return Object.keys(out).length ? out : undefined;
}

interface Contexto {
	preajuste: string;
	zona: Zona;
	corregidos: Problema[];
}

function corregir(c: Contexto, mensaje: string, bloque?: string) {
	c.corregidos.push({ nivel: "aviso", regla: "forma", mensaje, donde: { preajuste: c.preajuste, zona: c.zona, ...(bloque ? { bloque } : {}) } });
}

/** Textos del catálogo que pasan el validador; el resto vuelve al de fábrica (o se quita). */
function textosSeguros(
	c: Contexto,
	b: { id: string; textos?: unknown },
	specs: ReadonlyArray<{ clave: string; max: number; variables?: readonly string[]; etiqueta: string }>,
	si: Condicion | undefined,
): Record<string, string> | undefined {
	if (!isRecord(b.textos)) return undefined;
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(b.textos)) {
		const spec = specs.find((s) => s.clave === k);
		if (!spec || typeof v !== "string") continue;
		if (!v.trim()) continue;
		if (!problemasTexto(v, spec, si).length) {
			out[k] = v;
			continue;
		}
		const fab = deFabrica(c.preajuste, b.id)?.textos?.[k];
		corregir(c, `El texto «${k}» del bloque «${b.id}» no pasa las reglas: se usa el de fábrica.`, b.id);
		if (fab && !problemasTexto(fab, spec, si).length) out[k] = fab;
	}
	return Object.keys(out).length ? out : undefined;
}

function opcionesSeguras(tipo: TipoBloque, o: unknown): Record<string, string | boolean> | undefined {
	if (!isRecord(o)) return undefined;
	const out: Record<string, string | boolean> = {};
	for (const spec of CATALOGO[tipo].opciones) {
		const v = o[spec.clave];
		if (spec.tipo === "switch" ? typeof v === "boolean" : spec.valores?.some((x) => x.id === v)) out[spec.clave] = v as string | boolean;
	}
	return Object.keys(out).length ? out : undefined;
}

function itemSeguro(c: Contexto, raw: unknown, padre: TipoBloque, si: Condicion | undefined, i: number): Bloque | null {
	if (!isRecord(raw) || !esTipoItem(raw.tipo) || !(CATALOGO[padre].items ?? []).includes(raw.tipo)) {
		corregir(c, `Se quitó un ítem que ${CATALOGO[padre].nombre} no admite.`, isRecord(raw) ? String(raw.id ?? "") : undefined);
		return null;
	}
	const id = typeof raw.id === "string" && raw.id ? raw.id : `i${i}`;
	const item: Bloque = { id, tipo: raw.tipo, visible: raw.visible !== false, variante: "-" };
	if (raw.icono === null || esIcono(raw.icono)) item.icono = raw.icono as Bloque["icono"];
	const textos = textosSeguros(c, { id, textos: raw.textos }, ITEMS[raw.tipo].textos ?? [], si);
	if (textos) item.textos = textos;
	return item;
}

function bloqueSeguro(c: Contexto, raw: Record<string, unknown>, i: number): Bloque | null {
	const id = typeof raw.id === "string" && raw.id ? raw.id : `z${i}`;
	if (!esTipoBloque(raw.tipo)) {
		corregir(c, `Se quitó el bloque «${id}»: su tipo no existe.`, id);
		return null;
	}
	const tipo = raw.tipo;
	const spec = CATALOGO[tipo];
	if (!spec.zonas.includes(c.zona) || (c.zona === "barra" && !TIPOS_BARRA.includes(tipo))) {
		corregir(c, `Se quitó «${spec.nombre}» de una zona que no lo admite.`, id);
		return null;
	}
	const variante = spec.variantes.some((v) => v.id === raw.variante) ? (raw.variante as string) : spec.variantes[0]!.id;
	if (variante !== raw.variante) corregir(c, `«${spec.nombre}» vuelve a su variante de fábrica.`, id);
	const b: Bloque = { id, tipo, visible: raw.visible !== false, variante };
	if (raw.icono === null || esIcono(raw.icono)) b.icono = raw.icono as Bloque["icono"];
	else if (raw.icono !== undefined) corregir(c, `El icono de «${spec.nombre}» no está en la lista: se usa el de fábrica.`, id);
	const si = condicion(raw.si);
	if (si) b.si = si;
	const textos = textosSeguros(c, { id, textos: raw.textos }, spec.textos, si);
	if (textos) b.textos = textos;
	const opciones = opcionesSeguras(tipo, raw.opciones);
	if (opciones) b.opciones = opciones;
	if (spec.items && Array.isArray(raw.hijos)) {
		const tope = tipo === "acordeon" ? LIMITES.itemsAcordeon : LIMITES.itemsConfianza;
		const vistos = new Set<string>();
		b.hijos = raw.hijos
			.map((h, j) => itemSeguro(c, h, tipo, si, j))
			.filter((h): h is Bloque => {
				if (!h || vistos.has(h.id)) return false;
				vistos.add(h.id);
				return true;
			})
			.slice(0, tope);
	} else if (spec.items) b.hijos = [];
	return b;
}

/** Fuerza un bloque obligatorio visible y sin condición. */
function fijar(c: Contexto, b: Bloque) {
	if (!b.visible || b.si) corregir(c, `«${CATALOGO[b.tipo as TipoBloque].nombre}» no se puede apagar ni condicionar: se muestra siempre.`, b.id);
	b.visible = true;
	delete b.si;
}

const idLibre = (lista: Bloque[], id: string) => {
	const usados = new Set(lista.flatMap((b) => [b.id, ...(b.hijos ?? []).map((h) => h.id)]));
	let out = id;
	for (let n = 2; usados.has(out); n++) out = `${id}-${n}`;
	return out;
};

/** Bloque de fábrica de la Clásica (para reponer un obligatorio que falta). */
function repuesto(tipo: TipoBloque, lista: Bloque[]): Bloque {
	const b = clonar(clasica().zonas.caja.find((x) => x.tipo === tipo)!);
	b.id = idLibre(lista, b.id);
	for (const h of b.hijos ?? []) h.id = idLibre(lista, h.id);
	return b;
}

function sanear(lista: unknown[], c: Contexto): Bloque[] {
	const vistos = new Set<string>();
	const cuenta = new Map<string, number>();
	let out: Bloque[] = [];
	lista.forEach((raw, i) => {
		if (!isRecord(raw)) return;
		const b = bloqueSeguro(c, raw, i);
		if (!b) return;
		if (vistos.has(b.id)) {
			corregir(c, `Se quitó un bloque con el id repetido «${b.id}».`, b.id);
			return;
		}
		const n = (cuenta.get(b.tipo) ?? 0) + 1;
		if (n > CATALOGO[b.tipo as TipoBloque].maxPorZona) {
			corregir(c, `Se quitó un «${CATALOGO[b.tipo as TipoBloque].nombre}» de más.`, b.id);
			return;
		}
		vistos.add(b.id);
		cuenta.set(b.tipo, n);
		out.push(b);
	});
	if (out.length > LIMITES.bloquesPorZona) out = out.slice(0, LIMITES.bloquesPorZona);

	const de = (tipo: TipoBloque) => out.find((b) => b.tipo === tipo);
	if (c.zona === "caja") {
		// I1, I4 y el país: los obligatorios están, se ven y no tienen condición.
		if (!de("pais")) {
			corregir(c, "Faltaba «País y moneda»: se agregó al principio.");
			out.unshift(repuesto("pais", out));
		}
		if (!de("precio")) {
			corregir(c, "Faltaba el precio: se agregó antes del botón.");
			const at = out.findIndex((b) => b.tipo === "boton");
			out.splice(at >= 0 ? at : out.length, 0, repuesto("precio", out));
		}
		if (!de("boton")) {
			corregir(c, "Faltaba el botón de inscripción: se agregó tras el precio.");
			out.splice(out.findIndex((b) => b.tipo === "precio") + 1, 0, repuesto("boton", out));
		}
		if (!de("confianza")) {
			corregir(c, "Faltaban las señales de confianza: se agregaron tras el botón.");
			out.splice(out.findIndex((b) => b.tipo === "boton") + 1, 0, repuesto("confianza", out));
		}
		for (const t of ["pais", "precio", "boton", "confianza"] as const) fijar(c, de(t)!);
		const confianza = de("confianza")!;
		const seguro = confianza.hijos?.find((h) => h.tipo === "pago-seguro");
		if (!seguro) {
			corregir(c, "Faltaba «Pago seguro en Hotmart»: se agregó primero.", confianza.id);
			confianza.hijos = [{ id: idLibre(out, `${confianza.id}a`), tipo: "pago-seguro" as const, visible: true, variante: "-" }, ...(confianza.hijos ?? [])].slice(
				0,
				LIMITES.itemsConfianza,
			);
		} else if (!seguro.visible) {
			corregir(c, "«Pago seguro en Hotmart» no se puede apagar: se muestra.", seguro.id);
			seguro.visible = true;
		}
	} else if (c.zona === "barra" && out.length) {
		if (!de("boton")) {
			corregir(c, "La barra no tenía el botón de inscripción: se agregó al final.");
			out.push({ ...repuesto("boton", out), variante: CATALOGO.boton.variantes[0]!.id });
		}
		fijar(c, de("boton")!);
	} else {
		const boton = de("boton");
		if (boton) fijar(c, boton);
	}
	return out;
}

/** Bloques efectivos de una zona del curso, ya seguros para pintar. */
export function resolverZona({ doc, curso, zona }: { doc: CajaDoc; curso: CursoCaja; zona: Zona }): ZonaResuelta {
	const corregidos: Problema[] = [];
	const p = componer(doc, curso, corregidos);
	const c: Contexto = { preajuste: p.id, zona, corregidos };
	return { zona, preajuste: p.id, estilo: estiloSeguro(p.estilo), bloques: sanear(p.zonas[zona] ?? [], c), corregidos };
}
