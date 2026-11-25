/**
 * Validador del documento de la caja (fase 1). Puro: lo usan el panel (un error impide guardar; un aviso se muestra),
 * el resolvedor (un texto que no pasa vuelve al de fábrica) y las pruebas.
 *
 * Cubre la forma (ids, tipos, variantes, iconos, zonas, topes, claves de texto y de opción) y las invariantes de
 * `constructor-caja-arquitectura.md` §3:
 *   I1 un solo botón por zona (caja, y barra si tiene bloques), visible y sin condición;
 *   I2 ningún texto libre con cifras de precio, moneda o porcentaje;
 *   I3 nada que anuncie tachado, ahorro o reloj sin una campaña;
 *   I4 «Pago seguro en Hotmart» siempre visible (el aviso propio del curso lo gobierna `buyBoxNote`, B570);
 *   I5 ningún texto con URL o dominio (los destinos salen de BuyButton y de adb-whatsapp);
 *   I6 aviso si dos bloques interactivos quedan pegados sin separador;
 *   I8 vocabulario compartido y urgencia solo con `si.campana = "con-fechas"`;
 *   I9 la barra solo admite promoción, precio y botón.
 */
import type { Bloque, CajaDoc, Condicion, Parche, Preajuste, Problema, TextoSpec, TipoBloque, Zona } from "./model";
import { CAJA_VERSION, CATALOGO, ITEMS, LIMITES, TIPOS_BARRA, ZONAS, ZONA_NOMBRE, esIcono, esTipoBloque, esTipoItem } from "./model";
import { PREAJUSTES_FABRICA } from "./fabrica";
import { aplicarParche } from "./parche";
import { PERCENT_RE, PRICE_RE, URGENCY_RE, textProblems } from "./sitio";

type Donde = NonNullable<Problema["donde"]>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Símbolos y códigos de moneda (I2), además de lo que ya cubren `PRICE_RE` y `PERCENT_RE`. */
const MONEDA_RE = /[$€£¥₡]|US\$|\b(?:COP|USD|MXN|PEN|EUR|CLP|ARS|DOP|CRC|GTQ|PAB|BRL)\b|\bd[oó]lares?\b|\beuros?\b/i;
/** Números de 3 cifras o más («99.000», «150»): ninguna cifra se escribe a mano en la caja (I2). */
const CIFRA_RE = /\d{3,}|\d[.,]\d{3}/;
/** URL o dominio (I5). */
const URL_RE =
	/https?:|\bwww\.|\b[a-z0-9-]+\.(?:com|co|net|org|edu|gov|io|app|ly|me|info|biz|shop|store|link|site|online|mx|es|ar|cl|pe|us)\b/i;
/** Tachado, ahorro, descuento o reloj dichos a mano (I3): solo los pinta la campaña verificada. */
const AHORRO_RE =
	/\bahorr|\bdescuento|\brebaja|\btachad|precio\s+(?:normal|anterior|regular|de\s+lista|especial|rebajado)|mitad\s+de\s+precio|a\s+mitad\s+de|\bantes\s+(?:costaba|val[ií]a)|cuenta\s+regresiva|\breloj\b|\bcontador\b/i;
/** Cifra en palabras con su moneda («noventa y nueve mil pesos», «mil soles», «un millón de pesos»): I2. */
const NUM = "(?:un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diec\\p{L}+|veint\\p{L}*|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien(?:to)?|\\p{L}+cient[oa]s|quinient[oa]s|mil|mill[oó]n(?:es)?)";
const MONEDA_PALABRA = "(?:pesos?|d[oó]lar(?:es)?|soles?|euros?|quetzal(?:es)?|colon(?:es)?|col[oó]n|balboas?|bol[ií]var(?:es)?|reales?|lempiras?)";
const PRECIO_PALABRAS_RE = new RegExp(
	`(?<![\\p{L}])(?:${NUM}(?:\\s+(?:y|de)\\s+|\\s+))+${MONEDA_PALABRA}(?![\\p{L}])|(?<![\\p{L}])(?:mil|mill[oó]n(?:es)?)(?:\\s+de)?\\s+${MONEDA_PALABRA}(?![\\p{L}])`,
	"iu",
);
/** Fecha escrita a mano (I2: la fecha de cierre sale de Promociones): «26 de noviembre», «nov. 26», «30/11», «hasta el lunes». */
const MES = "(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|sept?iembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept?|set|oct|nov|dic)";
const DIA = "(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)";
const FECHA_RE = new RegExp(
	[
		`(?<![\\p{L}\\d])\\d{1,2}\\.?\\s*(?:de\\s+)?${MES}\\.?(?![\\p{L}])`,
		`(?<![\\p{L}])${MES}\\.?\\s+\\d{1,2}(?!\\d)`,
		`(?<![\\d/])(?:0?[1-9]|[12]\\d|3[01])\\s*[/-]\\s*(?:0?[1-9]|1[0-2])(?:\\s*[/-]\\s*\\d{2,4})?(?![\\d/])`,
		`(?<![\\p{L}])(?:hasta|antes\\s+del?|termina|cierra|vence|acaba|se\\s+acaba|finaliza)\\s+(?:(?:el|este|esta|pr[oó]ximo)\\s+)*(?:${DIA}|ma[nñ]ana|medianoche|fin\\s+de\\s+mes)(?![\\p{L}])`,
		`(?<![\\p{L}])(?:hasta|antes|termina|cierra|vence|acaba|finaliza)\\s+(?:del?\\s+|el\\s+)\\d{1,2}(?![\\d%])(?!\\s*(?:cuotas|meses|d[ií]as|semanas|horas|lecciones|m[oó]dulos|clases))`,
		`(?<![\\p{L}])${DIA}\\s+\\d{1,2}(?!\\d)`,
	].join("|"),
	"iu",
);
/**
 * Vocabulario vetado en la caja además del compartido (regla 1 del proyecto, I8): como palabra completa, con o sin
 * tilde. «Técnica» a secas no (es «la técnica del degradado»); sí «técnica profesional» o «técnica laboral».
 */
const VETADAS_CAJA_RE =
	/(?<![\p{L}])(t[ií]tul(?:o|os|ad[oa]s?)|t[eé]cnicos?|t[eé]cnicas?\s+(?:profesional(?:es)?|laboral(?:es)?)|avalad[oa]s?|aval|afiliad[oa]s?|afiliaci[oó]n|comisi[oó]n(?:es)?|gratis|gratuit[oa]s?|gratuitamente)(?![\p{L}])/iu;
/** Etiquetas `<…>` o entidades HTML: el texto del panel es texto plano (el render las quita aunque luego se escapen). */
const HTML_RE = /<\s*\/?\s*[a-z!?][^>]*>|<|>|&(?:[a-z][a-z0-9]{1,30}|#\d{1,7}|#x[0-9a-f]{1,6});/i;
const VAR_RE = /\{([a-z_]+)\}/g;
const INTERACTIVOS: ReadonlySet<string> = new Set(["whatsapp", "cupon", "acordeon"]);
const CAMPANAS = new Set(["activa", "con-fechas", "sin"]);
const CUPONES = new Set(["aplicado", "no-aplicado"]);
const DISPOSITIVOS = new Set(["movil", "escritorio"]);
const PAIS_RE = /^[A-Z]{2}$/;

const nombre = (tipo: string) =>
	esTipoBloque(tipo) ? CATALOGO[tipo].nombre : esTipoItem(tipo) ? ITEMS[tipo].nombre : `«${tipo}»`;
const corto = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);

/**
 * Problemas de un texto libre del panel. `si` es la condición del bloque (o la del bloque padre, para los ítems): la
 * urgencia y las palabras de ahorro solo pasan con una campaña.
 */
export function problemasTexto(
	texto: string,
	spec: TextoSpec | undefined,
	si: Condicion | undefined,
	donde: Donde = {},
	dueno = "El texto",
): Problema[] {
	const out: Problema[] = [];
	const err = (regla: string, mensaje: string) => out.push({ nivel: "error", regla, mensaje, donde });
	const q = `${dueno} «${corto(texto)}»`;
	if (!spec) {
		err("forma", `${dueno} no se puede editar en este bloque.`);
		return out;
	}
	if (typeof texto !== "string") {
		err("forma", `${dueno} tiene que ser texto.`);
		return out;
	}
	if (texto.length > spec.max) err("forma", `${q} pasa de ${spec.max} caracteres (tiene ${texto.length}).`);
	const permitidas = new Set(spec.variables ?? []);
	for (const m of texto.matchAll(VAR_RE))
		if (!permitidas.has(m[1] ?? ""))
			err(
				"forma",
				permitidas.size
					? `${q} usa la variable {${m[1]}}; aquí solo valen ${[...permitidas].map((v) => `{${v}}`).join(" y ")}.`
					: `${q} usa la variable {${m[1]}}; este texto no admite variables.`,
			);
	const limpio = texto.replace(VAR_RE, " ");
	if (HTML_RE.test(texto)) err("forma", `${q} tiene etiquetas o entidades HTML («<», «>», «&…;»): escríbelo como texto plano.`);
	if (PRICE_RE.test(limpio) || PERCENT_RE.test(limpio) || MONEDA_RE.test(limpio) || CIFRA_RE.test(limpio) || PRECIO_PALABRAS_RE.test(limpio))
		err("I2", `${q} tiene una cifra, una moneda o un porcentaje. El precio y el descuento salen de Ofertas y Promociones: escríbelo sin números.`);
	if (FECHA_RE.test(limpio))
		err("I2", `${q} tiene una fecha escrita a mano («${limpio.match(FECHA_RE)?.[0]?.trim()}»). La fecha de cierre la pone la campaña de Promociones.`);
	if (URL_RE.test(limpio))
		err("I5", `${q} tiene un enlace o un dominio. Los enlaces de pago y de WhatsApp los pone el sitio: quítalo.`);
	const conCampana = si?.campana === "activa" || si?.campana === "con-fechas";
	if (AHORRO_RE.test(limpio) && !conCampana)
		err("I3", `${q} habla de ahorro, descuento o reloj. Solo se puede con la condición «Con campaña»: el tachado y el ahorro los pinta la campaña verificada.`);
	if (URGENCY_RE.test(limpio) && si?.campana !== "con-fechas")
		err("I8", `${q} tiene urgencia («${limpio.match(URGENCY_RE)?.[0]}»). Solo se admite con la condición «Campaña con fechas».`);
	const compartido = textProblems(texto);
	for (const m of compartido) err("I8", `${q}: ${m}.`);
	const vetada = limpio.match(VETADAS_CAJA_RE)?.[0];
	if (vetada && !compartido.some((m) => m.toLocaleLowerCase("es").includes(vetada.toLocaleLowerCase("es"))))
		err("I8", `${q} dice «${vetada}», que no se dice en la caja (ni «título», «técnico», «avalado», «afiliado», «comisión» o «gratis»).`);
	return out;
}

function problemasCondicion(si: unknown, donde: Donde): Problema[] {
	if (si === undefined) return [];
	const err = (mensaje: string): Problema => ({ nivel: "error", regla: "forma", mensaje, donde });
	if (!isRecord(si)) return [err("La condición del bloque no tiene una forma válida.")];
	const out: Problema[] = [];
	for (const k of Object.keys(si))
		if (!["campana", "cupon", "dispositivo", "paises"].includes(k)) out.push(err(`Condición desconocida: «${k}».`));
	if (si.campana !== undefined && !CAMPANAS.has(si.campana as string)) out.push(err("La condición de campaña no es válida."));
	if (si.cupon !== undefined && !CUPONES.has(si.cupon as string)) out.push(err("La condición de cupón no es válida."));
	if (si.dispositivo !== undefined && !DISPOSITIVOS.has(si.dispositivo as string))
		out.push(err("La condición de dispositivo no es válida."));
	if (si.paises !== undefined && (!Array.isArray(si.paises) || si.paises.some((p) => typeof p !== "string" || !PAIS_RE.test(p))))
		out.push(err("La lista de países de la condición no es válida (códigos de dos letras)."));
	return out;
}

/** Ítem de `confianza` o `acordeon`. `si` es la condición del bloque padre. */
function problemasItem(item: unknown, padre: TipoBloque, si: Condicion | undefined, donde: Donde, enCaja: boolean): Problema[] {
	const out: Problema[] = [];
	const err = (regla: string, mensaje: string, d = donde) => out.push({ nivel: "error", regla, mensaje, donde: d });
	if (!isRecord(item) || typeof item.id !== "string" || !item.id) {
		err("forma", `Un ítem de ${CATALOGO[padre].nombre} no tiene id.`);
		return out;
	}
	const d = { ...donde, bloque: item.id };
	if (!esTipoItem(item.tipo) || !(CATALOGO[padre].items ?? []).includes(item.tipo)) {
		err("forma", `${CATALOGO[padre].nombre} no admite el ítem ${nombre(String(item.tipo))}.`, d);
		return out;
	}
	const spec = ITEMS[item.tipo];
	if (item.variante !== "-") err("forma", `El ítem ${spec.nombre} no tiene variantes.`, d);
	if (typeof item.visible !== "boolean") err("forma", `El ítem ${spec.nombre} no dice si se ve.`, d);
	if (item.icono !== undefined && item.icono !== null && !esIcono(item.icono))
		err("forma", `El icono «${String(item.icono)}» del ítem ${spec.nombre} no está en la lista de iconos.`, d);
	if (item.si !== undefined) err("forma", `Los ítems no llevan condición propia: usa la del bloque ${CATALOGO[padre].nombre}.`, d);
	if (item.hijos !== undefined) err("forma", `El ítem ${spec.nombre} no admite ítems dentro.`, d);
	if (item.opciones !== undefined && isRecord(item.opciones) && Object.keys(item.opciones).length)
		err("forma", `El ítem ${spec.nombre} no tiene opciones.`, d);
	if (item.tipo === "pago-seguro" && enCaja && item.visible === false)
		err("I4", "«Pago seguro en Hotmart» no se puede apagar: es la promesa de pago de la caja.", d);
	if (isRecord(item.textos)) {
		for (const [k, v] of Object.entries(item.textos)) {
			const ts = spec.textos?.find((t) => t.clave === k);
			if (typeof v !== "string") err("forma", `El texto «${k}» del ítem ${spec.nombre} no es texto.`, d);
			else if (v.trim()) out.push(...problemasTexto(v, ts, si, d, ts ? `${ts.etiqueta} de ${spec.nombre}` : `El texto «${k}» de ${spec.nombre}`));
		}
	} else if (item.textos !== undefined) err("forma", `Los textos del ítem ${spec.nombre} no tienen una forma válida.`, d);
	if (item.tipo === "propia" && item.visible !== false) {
		const t = isRecord(item.textos) ? item.textos : {};
		if (!String(t.pregunta ?? "").trim() || !String(t.respuesta ?? "").trim())
			out.push({ nivel: "aviso", regla: "forma", mensaje: "Una pregunta propia sin pregunta o sin respuesta no se verá.", donde: d });
	}
	return out;
}

/**
 * Problemas de un bloque en una zona (forma, I1–I5, I8 e I9 que se ven en el bloque solo). Las reglas entre bloques
 * (ids repetidos, un solo botón, separadores) son de `validarCaja`.
 */
export function validarBloque(bloque: Bloque, zona: Zona, donde: Donde = {}): Problema[] {
	const out: Problema[] = [];
	const raw = bloque as unknown;
	const d: Donde = { ...donde, zona, ...(isRecord(raw) && typeof raw.id === "string" ? { bloque: raw.id } : {}) };
	const err = (regla: string, mensaje: string) => out.push({ nivel: "error", regla, mensaje, donde: d });
	if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) {
		err("forma", "Hay un bloque sin id.");
		return out;
	}
	if (!esTipoBloque(raw.tipo)) {
		err("forma", `El bloque «${raw.id}» tiene un tipo desconocido (${nombre(String(raw.tipo))}).`);
		return out;
	}
	const spec = CATALOGO[raw.tipo];
	const b = raw as unknown as Bloque & { tipo: TipoBloque };
	if (zona === "barra" && !TIPOS_BARRA.includes(b.tipo))
		err("I9", `La barra móvil solo admite Campaña, Precio y Botón; ${spec.nombre} no cabe en una línea de 64 px.`);
	else if (!spec.zonas.includes(zona)) err("forma", `${spec.nombre} no va en la zona «${ZONA_NOMBRE[zona]}».`);
	if (typeof b.visible !== "boolean") err("forma", `${spec.nombre} no dice si se ve.`);
	if (!spec.variantes.some((v) => v.id === b.variante))
		err("forma", `${spec.nombre} no tiene la variante «${String(b.variante)}».`);
	if (b.icono !== undefined && b.icono !== null && !esIcono(b.icono))
		err("forma", `El icono «${String(b.icono)}» de ${spec.nombre} no está en la lista de iconos.`);
	out.push(...problemasCondicion(b.si, d));

	// Obligatorios (I1, I4): visibles y sin condición que los esconda.
	const obligatorio = spec.obligatorio && (zona === "caja" || b.tipo === "boton");
	if (obligatorio) {
		const regla = b.tipo === "boton" ? "I1" : b.tipo === "confianza" ? "I4" : "forma";
		if (b.visible === false) err(regla, `${spec.nombre} no se puede apagar en la caja.`);
		if (b.si !== undefined) err(regla, `${spec.nombre} no admite condiciones: tiene que verse siempre.`);
	}

	// Textos.
	if (b.textos !== undefined && !isRecord(b.textos)) err("forma", `Los textos de ${spec.nombre} no tienen una forma válida.`);
	else
		for (const [k, v] of Object.entries(b.textos ?? {})) {
			const ts = spec.textos.find((t) => t.clave === k);
			if (typeof v !== "string") err("forma", `El texto «${k}» de ${spec.nombre} no es texto.`);
			else if (v.trim()) out.push(...problemasTexto(v, ts, b.si, d, ts ? `${ts.etiqueta} de ${spec.nombre}` : `El texto «${k}» de ${spec.nombre}`));
		}
	if ((b.tipo === "titulo" || b.tipo === "subtitulo" || b.tipo === "texto") && b.visible && !String(b.textos?.texto ?? "").trim())
		out.push({ nivel: "aviso", regla: "forma", mensaje: `${spec.nombre} sin texto no se verá.`, donde: d });

	// Opciones.
	if (b.opciones !== undefined && !isRecord(b.opciones)) err("forma", `Las opciones de ${spec.nombre} no tienen una forma válida.`);
	else
		for (const [k, v] of Object.entries(b.opciones ?? {})) {
			const os = spec.opciones.find((o) => o.clave === k);
			if (!os) err("forma", `${spec.nombre} no tiene la opción «${k}».`);
			else if (os.tipo === "switch" ? typeof v !== "boolean" : !os.valores?.some((x) => x.id === v))
				err("forma", `La opción «${os.etiqueta}» de ${spec.nombre} tiene un valor que no existe.`);
		}

	// Ítems.
	if (b.hijos !== undefined) {
		if (!spec.items) err("forma", `${spec.nombre} no admite ítems.`);
		else if (!Array.isArray(b.hijos)) err("forma", `Los ítems de ${spec.nombre} no tienen una forma válida.`);
		else {
			const tope = b.tipo === "acordeon" ? LIMITES.itemsAcordeon : LIMITES.itemsConfianza;
			if (b.hijos.length > tope) err("forma", `${spec.nombre} admite hasta ${tope} ítems (tiene ${b.hijos.length}).`);
			for (const h of b.hijos) out.push(...problemasItem(h, b.tipo, b.si, d, zona === "caja"));
		}
	}
	if (b.tipo === "confianza" && zona === "caja") {
		const seguro = Array.isArray(b.hijos) ? b.hijos.find((h) => isRecord(h) && h.tipo === "pago-seguro") : undefined;
		if (!seguro) err("I4", "Las señales de confianza tienen que incluir «Pago seguro en Hotmart».");
	}
	return out;
}

/** Ids del preajuste, también los de los ítems. */
function ids(p: Preajuste): string[] {
	const out: string[] = [];
	for (const z of ZONAS)
		for (const b of p.zonas[z] ?? []) {
			if (isRecord(b) && typeof b.id === "string") out.push(b.id);
			for (const h of Array.isArray(b?.hijos) ? b.hijos : []) if (isRecord(h) && typeof h.id === "string") out.push(h.id);
		}
	return out;
}

/** Problemas de un preajuste ya compuesto (el de la lista o uno con un parche aplicado). */
function validarPreajuste(p: Preajuste, base: Donde): Problema[] {
	const out: Problema[] = [];
	const d: Donde = { ...base, preajuste: p.id };
	if (!isRecord(p.zonas)) return [{ nivel: "error", regla: "forma", mensaje: `El preajuste «${p.id}» no tiene zonas.`, donde: d }];
	const vistos = new Set<string>();
	for (const id of ids(p)) {
		if (vistos.has(id))
			out.push({ nivel: "error", regla: "forma", mensaje: `El id «${id}» se repite en el preajuste «${p.nombre ?? p.id}».`, donde: { ...d, bloque: id } });
		vistos.add(id);
	}
	for (const z of ZONAS) {
		const lista = p.zonas[z];
		const dz: Donde = { ...d, zona: z };
		if (lista === undefined) continue;
		if (!Array.isArray(lista)) {
			out.push({ nivel: "error", regla: "forma", mensaje: `La zona «${ZONA_NOMBRE[z]}» no es una lista de bloques.`, donde: dz });
			continue;
		}
		if (lista.length > LIMITES.bloquesPorZona)
			out.push({ nivel: "error", regla: "forma", mensaje: `La zona «${ZONA_NOMBRE[z]}» admite hasta ${LIMITES.bloquesPorZona} bloques.`, donde: dz });
		const cuenta = new Map<string, number>();
		for (const b of lista) {
			out.push(...validarBloque(b, z, d));
			if (isRecord(b) && esTipoBloque(b.tipo)) cuenta.set(b.tipo, (cuenta.get(b.tipo) ?? 0) + 1);
		}
		for (const [tipo, n] of cuenta) {
			const spec = CATALOGO[tipo as TipoBloque];
			if (n > spec.maxPorZona && tipo !== "boton")
				out.push({
					nivel: "error",
					regla: "forma",
					mensaje: `La zona «${ZONA_NOMBRE[z]}» admite ${spec.maxPorZona === 1 ? "un solo bloque" : `hasta ${spec.maxPorZona} bloques`} de ${spec.nombre} (tiene ${n}).`,
					donde: dz,
				});
		}
		const botones = cuenta.get("boton") ?? 0;
		if ((z === "caja" || (z === "barra" && lista.length > 0)) && botones !== 1)
			out.push({
				nivel: "error",
				regla: "I1",
				mensaje: botones
					? `La zona «${ZONA_NOMBRE[z]}» tiene ${botones} botones de inscripción: tiene que haber uno solo.`
					: `La zona «${ZONA_NOMBRE[z]}» no tiene el botón de inscripción.`,
				donde: dz,
			});
		if (z === "caja") {
			for (const [tipo, regla] of [
				["pais", "forma"],
				["precio", "forma"],
				["confianza", "I4"],
			] as const)
				if (!cuenta.get(tipo))
					out.push({ nivel: "error", regla, mensaje: `Falta el bloque ${CATALOGO[tipo].nombre} en la caja.`, donde: dz });
			// I6: dos bloques interactivos pegados (sin separador entre ellos).
			const vis = lista.filter((b) => isRecord(b) && b.visible !== false);
			for (let i = 1; i < vis.length; i++) {
				const a = vis[i - 1]!;
				const b = vis[i]!;
				if (INTERACTIVOS.has(a.tipo) && INTERACTIVOS.has(b.tipo))
					out.push({
						nivel: "aviso",
						regla: "I6",
						mensaje: `${nombre(a.tipo)} y ${nombre(b.tipo)} quedan pegados: en el celular conviene un separador entre los dos.`,
						donde: { ...dz, bloque: b.id },
					});
			}
		}
	}
	return out;
}

const clave = (p: Problema) => `${p.nivel}|${p.regla}|${p.mensaje}|${p.donde?.zona ?? ""}|${p.donde?.bloque ?? ""}`;

function validarParche(doc: CajaDoc, parche: unknown, origen: { escuela?: string; curso?: string }, base: Map<string, Problema[]>): Problema[] {
	const d: Donde = origen.curso ? { curso: origen.curso } : {};
	const quien = origen.curso ? `El curso «${origen.curso}»` : `La escuela «${origen.escuela}»`;
	if (!isRecord(parche)) return [{ nivel: "error", regla: "forma", mensaje: `${quien} tiene un ajuste ilegible.`, donde: d }];
	const out: Problema[] = [];
	const id = typeof parche.preajuste === "string" ? parche.preajuste : doc.sitio;
	const p = doc.preajustes.find((x) => x.id === id);
	if (!p) {
		out.push({ nivel: "error", regla: "forma", mensaje: `${quien} usa el preajuste «${id}», que no existe.`, donde: d });
		return out;
	}
	if (typeof parche.preajuste === "string" && p.uso === "campana")
		out.push({
			nivel: "aviso",
			regla: "forma",
			mensaje: `${quien} usa «${p.nombre}», que es para campañas con fechas: fuera de campaña se verá sin la campaña al frente.`,
			donde: d,
		});
	if (isRecord(parche.bloques))
		for (const [bid, cambio] of Object.entries(parche.bloques))
			if (isRecord(cambio)) {
				for (const k of Object.keys(cambio))
					if (!["visible", "variante", "icono", "textos", "si", "opciones"].includes(k))
						out.push({ nivel: "error", regla: "forma", mensaje: `${quien} cambia «${k}» del bloque «${bid}», que no se puede cambiar.`, donde: { ...d, bloque: bid } });
			}
	const avisos: Problema[] = [];
	const compuesto = aplicarParche(p, parche as Parche, avisos, origen);
	const yaEstaban = new Set((base.get(p.id) ?? []).map(clave));
	for (const x of validarPreajuste(compuesto, d)) if (!yaEstaban.has(clave(x))) out.push(x);
	out.push(...avisos.map((a) => ({ ...a, donde: { ...a.donde, ...d } })));
	return out;
}

/** Problemas del documento entero: preajustes, parches de escuela y de curso, y capas. */
export function validarCaja(doc: CajaDoc): Problema[] {
	const out: Problema[] = [];
	const err = (mensaje: string, donde: Donde = {}) => out.push({ nivel: "error", regla: "forma", mensaje, donde });
	if (!isRecord(doc)) return [{ nivel: "error", regla: "forma", mensaje: "El documento de la caja no tiene una forma válida." }];
	if (doc.v !== CAJA_VERSION) err(`Versión del documento desconocida (${String(doc.v)}).`);
	if (!Array.isArray(doc.preajustes)) {
		err("El documento no tiene preajustes.");
		return out;
	}
	if (doc.preajustes.length > LIMITES.preajustes) err(`Caben hasta ${LIMITES.preajustes} preajustes.`);
	const vistos = new Set<string>();
	const base = new Map<string, Problema[]>();
	for (const p of doc.preajustes) {
		if (!isRecord(p) || typeof p.id !== "string" || !p.id) {
			err("Hay un preajuste sin id.");
			continue;
		}
		if (vistos.has(p.id)) err(`El preajuste «${p.id}» está repetido.`, { preajuste: p.id });
		vistos.add(p.id);
		if (typeof p.nombre !== "string" || !p.nombre.trim()) err(`El preajuste «${p.id}» no tiene nombre.`, { preajuste: p.id });
		if (p.uso !== undefined && p.uso !== "sitio" && p.uso !== "campana") err(`El preajuste «${p.id}» tiene un uso desconocido.`, { preajuste: p.id });
		const probs = validarPreajuste(p, {});
		base.set(p.id, probs);
		out.push(...probs);
	}
	for (const f of PREAJUSTES_FABRICA) {
		const id = f().id;
		if (!vistos.has(id)) err(`El preajuste de fábrica «${f().nombre}» no se puede borrar.`, { preajuste: id });
	}
	if (typeof doc.sitio !== "string" || !vistos.has(doc.sitio)) err(`El preajuste del sitio («${String(doc.sitio)}») no existe.`);
	const delSitio = doc.preajustes.find((p) => isRecord(p) && p.id === doc.sitio);
	if (delSitio?.uso === "campana")
		err(`«${delSitio.nombre}» es solo para campañas con fechas: no puede ser la caja de todo el sitio.`, { preajuste: delSitio.id });
	for (const [escuela, parche] of Object.entries(isRecord(doc.escuelas) ? doc.escuelas : {}))
		out.push(...validarParche(doc, parche, { escuela }, base));
	for (const [curso, parche] of Object.entries(isRecord(doc.cursos) ? doc.cursos : {}))
		out.push(...validarParche(doc, parche, { curso }, base));
	if (doc.capas !== undefined && !Array.isArray(doc.capas)) err("Las capas de campaña no tienen una forma válida.");
	else {
		if ((doc.capas ?? []).length > LIMITES.capas) err(`Caben hasta ${LIMITES.capas} capas de campaña.`);
		for (const capa of doc.capas ?? []) {
			if (!isRecord(capa) || typeof capa.id !== "string") {
				err("Hay una capa de campaña sin id.");
				continue;
			}
			for (const [bid, cambio] of Object.entries(isRecord(capa.bloques) ? capa.bloques : {})) {
				if (!isRecord(cambio)) continue;
				if (cambio.visible === false)
					for (const p of doc.preajustes) {
						const tipo = [...(p.zonas?.caja ?? [])].find((b) => b.id === bid)?.tipo;
						if (tipo && esTipoBloque(tipo) && CATALOGO[tipo].obligatorio) {
							err(`La capa «${capa.nombre ?? capa.id}» apaga ${CATALOGO[tipo].nombre}, que no se puede apagar.`, { bloque: bid });
							break;
						}
					}
				if (isRecord(cambio.textos))
					for (const [k, v] of Object.entries(cambio.textos))
						if (typeof v === "string" && v.trim())
							out.push(
								...problemasTexto(v, { clave: k, etiqueta: k, max: 400, variables: ["curso", "escuela"] }, { campana: "con-fechas" }, { bloque: bid }, `El texto «${k}» de la capa`),
							);
			}
			for (const z of ZONAS) {
				const extra = isRecord(capa.extra) ? (capa.extra as Record<string, unknown>)[z] : undefined;
				for (const b of Array.isArray(extra) ? (extra as Bloque[]) : []) out.push(...validarBloque(b, z, {}));
			}
		}
	}
	return out;
}

/** ¿Se puede guardar? (ningún error; los avisos no impiden). */
export const sinErrores = (ps: readonly Problema[]) => !ps.some((p) => p.nivel === "error");
