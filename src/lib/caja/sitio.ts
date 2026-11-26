/**
 * Lo único del núcleo de caja que cambia de un sitio a otro: el vocabulario y las
 * expresiones de cifras y urgencia que usa `validar.ts`.
 *
 * El núcleo (`model`, `fabrica`, `parche`, `resolver`, `validar`, `migrar`) es una
 * copia exacta del de academiadebelleza.edu.co (`web/src/lib/academia/caja/`); allí
 * `validar.ts` importa estas cuatro piezas de sus plugins. `tests/caja-paridad.test.ts`
 * comprueba que las dos copias no se separen.
 *
 * Sably: «certificado» (nunca «constancia»), «creador» (nunca «productor» ni
 * «afiliado»), la comisión se declara; vetados como en la academia las promesas de
 * ingresos, los superlativos y la urgencia sin fecha.
 */

/** Cifras de precio: «$85.000», «COP 85000», «85.000 pesos», «USD 25», «30 %», «2x1». Igual que la academia. */
export const PRICE_RE =
	/(?:US\$|\$|\b(?:COP|USD|MXN|PEN|EUR|CLP|ARS)\b)\s?\d|\b\d{1,3}(?:[.,]\d{3})+(?:\s?(?:pesos|d[oó]lares|soles))?\b|\b\d+(?:[.,]\d+)?\s?%|\b\d+\s?x\s?\d+\b|\b\d+\s?(?:pesos|d[oó]lares|soles|mil)\b/iu;

/** Porcentajes. Igual que la academia. */
export const PERCENT_RE = /\d\s?%|por ciento/i;

/** Frases de urgencia: solo se admiten con una campaña con fecha de fin. Igual que la academia. */
export const URGENCY_RE =
	/tiempo limitado|[uú]ltimas? horas|[uú]ltimos? (cupos|d[ií]as|lugares)|s[oó]lo (por )?hoy|termina en|quedan \d|cuenta regresiva|se (acaba|agota)|antes de que se acabe|no te lo pierdas|[uú]ltima oportunidad/i;

const REGLAS: ReadonlyArray<[RegExp, string]> = [
	// Solo la fórmula del documento: «con constancia» a secas también es «perseverancia».
	[
		/(?<![\p{L}])constancias?\s+(?:digital|de\s+finalizaci[oó]n|al\s+(?:terminar|finalizar)|incluida)|(?<![\p{L}])(?:tu|una|incluye)\s+constancia(?![\p{L}])/iu,
		"«certificado», nunca «constancia»: lo que entrega el curso es un certificado de finalización",
	],
	[/(?<![\p{L}])productor(?:a|es|as)?(?![\p{L}])/iu, "«creador», nunca «productor»"],
	[/(?<![\p{L}])afiliad[oa]s?(?![\p{L}])/iu, "sin «afiliado» en texto público"],
	[/(?<![\p{L}])cat[aá]logo(?![\p{L}])/iu, "«cursos», nunca «catálogo»"],
	[
		/(?<![\p{L}])(gana(?:r[aá]s|s)?\s+(?:dinero|plata|hasta)|ingresos?\s+(?:garantizad|asegurad|extra\s+seguro)|libertad\s+financiera|hazte\s+ric|vive\s+de\s+esto\s+ya)/iu,
		"sin promesas de ingresos",
	],
	[
		/(?<![\p{L}])(el|la|los|las)\s+mejor(?:es)?(?![\p{L}])|n[uú]mero\s+uno|(?<![\p{L}])l[ií]der(?:es)?(?![\p{L}])|m[aá]s\s+grande\s+del|#1(?!\d)/iu,
		"sin superlativos sin dato",
	],
	[
		/(?<![\p{L}])(últim[oa]s\s+(cupos|plazas|horas|unidades)|cupos?\s+limitad|solo\s+hoy|s[oó]lo\s+por\s+hoy|ap[uú]rate|date\s+prisa|no\s+te\s+lo\s+pierdas|quedan\s+\d+|corre\s+(ya|que))/iu,
		"sin urgencia falsa: nada de cupos, «solo hoy» ni «apúrate»",
	],
];

/** Problemas de vocabulario de un texto del panel (mismo contrato que `textProblems` de la academia). */
export function textProblems(text: string, _clave = ""): string[] {
	const out: string[] = [];
	for (const [patron, mensaje] of REGLAS) if (patron.test(text)) out.push(mensaje);
	return out;
}
