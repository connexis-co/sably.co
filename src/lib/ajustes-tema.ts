/**
 * Ajustes del tema V2 desde el panel (plugin sably-operations, «Ajustes»).
 * Se leen de la tabla `options` de EmDash en cada render (la página ya está en
 * caché, así que es una consulta por render, no por visita), y guardarlos
 * invalida las páginas (ver `invalidatedTags` en public-delivery.ts).
 */
import { resolverTema, temaPorDefecto, type Tema, type TemaResuelto } from './tema';
import { SUBTITULO_SABLY, TITULO_SABLY } from './caja/sably';
import { bloquesVisibles, listaDeTexto, type BloquePortada } from './portada-bloques';
import { leerAjustesBlog, type AjustesBlog } from './blog-ajustes';

export type VarianteCaja = 'cuenta-clara' | 'cabecera-oscura';
export type EstiloContador = 'barra' | 'casillas' | 'linea' | 'tique';
export type EstiloCampo = 'outlined' | 'filled' | 'underline';
/** Rejillas de tarjetas de cursos entre 1024 y 1279 px (portada y ficha): ver themes/sably-v2/rejilla-tarjetas.ts. */
export type ColumnasTarjetas = 'tres-completas' | 'tres' | 'cuatro';
/** Dónde va el muro del héroe por debajo de 1024 px (panel → Portada · Muro del héroe en el celular). */
export const HEROE_MOVIL = ['tras-titular', 'franja', 'tras-buscador', 'tras-botones', 'final'] as const;
export type HeroeMovil = (typeof HEROE_MOVIL)[number];

export { VARIANTES_HEROE, VARIANTES_HEROE_AB, leerPruebaHeroe, type PruebaHeroe, type VarianteHeroe } from './prueba-heroe';
import { VARIANTES_HEROE, leerPruebaHeroe, type PruebaHeroe, type VarianteHeroe } from './prueba-heroe';

export interface AjustesV2 {
  temaPorDefecto: Tema;
  caja: {
    variante: VarianteCaja;
    contador: EstiloContador;
    /** Texto del bloque `titulo` del núcleo común: variables {curso} y {escuela} (el creador); sin cifras. Vacío = sin título. */
    titulo: string;
    subtitulo: string;
    /** C4: contorno, sombra honda y filete coral para que la caja destaque del fondo (de fábrica). */
    resaltada: boolean;
    /** C8: título y subtítulo centrados con una línea corta debajo (de fábrica). */
    tituloCentrado: boolean;
    /** C9: «Precio normal» tachado con campaña (de fábrica) o sin tachar. */
    precioNormal: 'tachado' | 'sin-tachar';
    /** C10: fila «Precio para {país}» (de fábrica, oculta). */
    pais: boolean;
    /** C11: el reloj late, el segundero corre y la barra brilla (de fábrica; nunca con menos movimiento). */
    movimiento: boolean;
  };
  /** Marca del creador: línea junto al pago y tarjeta en «Creador y opiniones» (el docente va en la cabeza y la caja). */
  mostrarCreador: boolean;
  /** Bloque del docente real (C5): solo en cursos con docente con fuente. */
  mostrarDocente: boolean;
  /** «Disponible online en {país}» con las ciudades del país, en texto y sin enlaces. */
  mostrarCiudades: boolean;
  estiloCampo: EstiloCampo;
  /** Tarjetas de cursos entre 1024 y 1279 px: 3 columnas sin fila a medias (de fábrica), 3 con todas o 4. */
  columnasTarjetas: ColumnasTarjetas;
  /** Reborde del pie: bandas de coral sobre el corte redondeado (de fábrica, escalonado). */
  pieBorde: 'escalonado' | 'inverso' | 'anchas' | 'finas' | 'tenue' | 'ninguno';
  /** C5: en «Sobre este curso», una foto por pestaña con fundido (de fábrica). */
  sobreFotos: boolean;
  /** C6: movimiento de la ficha al bajar y animación del certificado (nunca con menos movimiento). */
  movimientoFicha: { ficha: 'sobrio' | 'minimo' | 'ninguno'; certificado: 'arma' | 'lateral' | 'revela' | 'destello' | 'entrada' | 'ninguna' };
  /** Barra fija de la ficha desde 1024 px: menú solo arriba + compra abajo (de fábrica), las dos completas, solo arriba o solo abajo. */
  barraEscritorio: 'menu-abajo' | 'ambas' | 'arriba' | 'abajo';
  /** Alineación del menú interno cuando va solo arriba («menu-abajo»). */
  menuAlineacion: 'centro' | 'izquierda' | 'derecha';
  /** Temario y bloques de la ficha (paquete 2 del pulido: C7, C10a, C10b). */
  bloquesFicha: {
    /** `enfoca`: abrir un módulo cierra el anterior y lo encuadra; `encuadra`: solo lo encuadra; `nada`: acordeón libre. */
    temario: 'enfoca' | 'encuadra' | 'nada';
    /** «Qué incluye el curso» (lámina `jYRD5`): cifras reales de la ficha como titular. */
    queIncluye: boolean;
    /** Tarjeta de «Cursos relacionados»: `placa` que crece sobre la foto (`fEaNY` · 6, sin precio) o la de listado con precio. */
    relacionados: 'placa' | 'precio';
  };
  /** Bloque de opiniones de la ficha V2 (ronda 2 de JP, C1 y C3). */
  opiniones: {
    /** `lista`: nota grande y extractos reales en lista editorial (`HVAlI`); `compacto`: una sola fila con la nota. */
    estilo: 'lista' | 'compacto';
    /** Extractos de Hotmart que hacen falta para enseñar la lista (con menos, estado honesto sin citas). */
    minimoExtractos: number;
    /** Tope de extractos en la lista (JP, 26-nov: 3–4). */
    maximoExtractos: number;
    /** Perfil público de la fuente (Google u otra), si se configuró con una URL https válida. */
    perfil: { nombre: string; url: string } | null;
  };
  /** Barra de campaña V2 («Ajustes del sitio → Campañas y cupones»). */
  barraCampana: {
    /** `sesion`: cerrada, no vuelve hasta cerrar la pestaña; `vista`: vuelve en la página siguiente. */
    cierre: 'sesion' | 'vista';
    /** En la ficha, solo si el curso tiene la oferta de la campaña (su creador acepta el cupón). */
    enFicha: boolean;
    /** Pegada encima de la cabecera al desplazarse mientras esté abierta (E3). */
    fija: boolean;
    /** Botón a los cursos de la campaña. `texto` lleva {pct}; `destino` vacío = listado filtrado del país; `ficha`: qué lleva en la ficha. */
    boton: { activo: boolean; texto: string; destino: string; ficha: 'nada' | 'enlace' };
  };
  /** Qué enseña cada aviso de campaña («Campañas y cupones»): contador con segundero, cupón para copiar, ambos o la fecha. */
  campana: Record<'barra' | 'banda' | 'megamenu' | 'listado', MuestraCampana>;
  /** Portada de país V2 («Ajustes del sitio → Portada»). */
  portada: {
    /** Bloques visibles, en orden (el héroe va siempre primero y no está aquí). */
    bloques: BloquePortada[];
    heroe: { variante: VarianteHeroe; fondo: 'liso' | 'aurora'; botones: 'dos' | 'uno'; tachar: boolean; rota: boolean; intervalo: number; orden: 'aleatorio' | 'fijo'; cursos: string[] };
    /** Prueba A/B del héroe (HEROES-X §11). `null` = apagada o mal configurada (menos de dos variantes válidas). */
    pruebaHeroe: PruebaHeroe | null;
    categoriasVariante: 'fotos' | 'pila' | 'filas';
    comoFuncionaAnimado: boolean;
    heroeMovil: HeroeMovil;
    oficioModo: 'automatico' | 'estatico';
    oficioIntervalo: number;
    guiasVariante: 'tarjetas' | 'lista';
    beneficiosModo: 'automatico' | 'estatico';
    aparicion: boolean;
    cifrasCuentan: boolean;
    paralaje: boolean;
    escenasAtenuar: boolean;
    escenasVariante: 'apiladas' | 'foto-fija';
    valoradosMinimo: number;
  };
  /** Página «Nosotros» V2 («Ajustes del sitio → Cursos y contenido»). */
  nosotros: { diseno: 'narrativo' | 'sencillo'; cifras: boolean; movimiento: boolean };
  /** Blog V2 («Ajustes del sitio → Blog»): claves `blog*` con sus valores de fábrica. */
  blog: AjustesBlog;
}

export interface TemaDeLaPeticion extends TemaResuelto {
  ajustes: AjustesV2;
}

const PREFIJO = 'plugin:sably-operations:settings:';
export const TITULO_CAJA_POR_DEFECTO = TITULO_SABLY;
export const SUBTITULO_CAJA_POR_DEFECTO = SUBTITULO_SABLY;

const uno = <T extends string>(valor: unknown, validos: readonly T[], defecto: T): T =>
  typeof valor === 'string' && (validos as readonly string[]).includes(valor) ? (valor as T) : defecto;

/** Solo una URL https con su nombre: un perfil a medio configurar no se enseña. */
function perfilOpiniones(nombre: string, url: string): { nombre: string; url: string } | null {
  if (!nombre || !url) return null;
  try { return new URL(url).protocol === 'https:' ? { nombre: nombre.slice(0, 40), url } : null; } catch { return null; }
}

function decodificar(valor: string): unknown {
  try { return JSON.parse(valor); } catch { return valor; }
}

/** Puro: filas de `options` (+ variable de entorno) → ajustes con sus valores por defecto. */
const MUESTRAS = ['contador', 'cupon', 'ambos', 'fecha'] as const;

/** Botón de la barra de campaña: el texto lleva {pct} (el de la campaña vigente) y cabe en una línea. */
export const BOTON_BARRA_POR_DEFECTO = 'Ver cursos con {pct}';
const textoBoton = (t: string) => (t && t.length <= 32 ? t : BOTON_BARRA_POR_DEFECTO);
/** Solo rutas propias («/…», no «//dominio»); cualquier otra cosa cae al listado filtrado (''). */
const destinoBoton = (d: string) => (/^\/(?!\/)[^\s"'<>]*$/.test(d) && d.length <= 200 ? d : '');
export type MuestraCampana = (typeof MUESTRAS)[number];

export function leerAjustesV2(filas: { name: string; value: string }[], entornoTema?: string): AjustesV2 {
  const v: Record<string, unknown> = {};
  for (const fila of filas) if (fila.name.startsWith(PREFIJO)) v[fila.name.slice(PREFIJO.length)] = decodificar(fila.value);
  const texto = (clave: string, defecto: string) => (typeof v[clave] === 'string' ? (v[clave] as string).trim() : defecto);
  return {
    temaPorDefecto: temaPorDefecto(v.temaPorDefecto, entornoTema),
    caja: {
      variante: uno(v.cajaVariante, ['cuenta-clara', 'cabecera-oscura'] as const, 'cuenta-clara'),
      contador: uno(v.cajaContador, ['barra', 'casillas', 'linea', 'tique'] as const, 'barra'),
      titulo: texto('cajaTitulo', TITULO_CAJA_POR_DEFECTO),
      subtitulo: texto('cajaSubtitulo', SUBTITULO_CAJA_POR_DEFECTO),
      resaltada: v.cajaResaltada !== false,
      tituloCentrado: v.cajaTituloCentrado !== false,
      precioNormal: uno(v.cajaPrecioNormal, ['tachado', 'sin-tachar'] as const, 'tachado'),
      pais: v.cajaPais === true,
      movimiento: v.cajaMovimiento !== false,
    },
    mostrarCreador: v.mostrarCreador !== false,
    mostrarDocente: v.mostrarDocente !== false,
    mostrarCiudades: v.mostrarCiudades !== false,
    estiloCampo: uno(v.estiloCampo, ['outlined', 'filled', 'underline'] as const, 'outlined'),
    columnasTarjetas: uno(v.tarjetasColumnasMedio, ['tres-completas', 'tres', 'cuatro'] as const, 'tres-completas'),
    pieBorde: uno(v.pieBorde, ['escalonado', 'inverso', 'anchas', 'finas', 'tenue', 'ninguno'] as const, 'escalonado'),
    sobreFotos: v.sobreFotosPestanas !== false,
    movimientoFicha: {
      ficha: uno(v.fichaMovimiento, ['sobrio', 'minimo', 'ninguno'] as const, 'sobrio'),
      certificado: uno(v.certificadoAnimacion, ['arma', 'lateral', 'revela', 'destello', 'entrada', 'ninguna'] as const, 'arma'),
    },
    barraEscritorio: uno(v.barraCompraEscritorio, ['menu-abajo', 'ambas', 'arriba', 'abajo'] as const, 'menu-abajo'),
    menuAlineacion: uno(v.menuInternoAlineacion, ['centro', 'izquierda', 'derecha'] as const, 'centro'),
    bloquesFicha: {
      temario: uno(v.temarioEnfoque, ['enfoca', 'encuadra', 'nada'] as const, 'enfoca'),
      queIncluye: v.fichaQueIncluye !== false,
      relacionados: uno(v.relacionadosTarjeta, ['placa', 'precio'] as const, 'placa'),
    },
    opiniones: {
      estilo: uno(v.opinionesEstilo, ['lista', 'compacto'] as const, 'lista'),
      minimoExtractos: Number(uno(v.opinionesExtractosMinimo, ['1', '2', '3'] as const, '1')),
      maximoExtractos: Number(uno(v.opinionesExtractosMaximo, ['2', '3', '4'] as const, '4')),
      perfil: perfilOpiniones(texto('opinionesPerfilNombre', ''), texto('opinionesPerfilUrl', '')),
    },
    barraCampana: {
      cierre: uno(v.barraCampanaCierre, ['sesion', 'vista'] as const, 'sesion'),
      enFicha: v.barraCampanaFicha !== false,
      fija: v.barraCampanaFija !== false,
      boton: {
        activo: v.barraCampanaBoton !== false,
        texto: textoBoton(texto('barraCampanaBotonTexto', BOTON_BARRA_POR_DEFECTO)),
        destino: destinoBoton(texto('barraCampanaBotonDestino', '')),
        ficha: uno(v.barraCampanaBotonFicha, ['nada', 'enlace'] as const, 'nada'),
      },
    },
    campana: {
      barra: uno(v.campanaBarra, MUESTRAS, 'contador'),
      banda: uno(v.campanaBanda, MUESTRAS, 'contador'),
      megamenu: uno(v.campanaMegamenu, MUESTRAS, 'contador'),
      listado: uno(v.campanaListado, MUESTRAS, 'contador'),
    },
    portada: {
      bloques: bloquesVisibles(v.portadaOrden, v.portadaOcultos),
      heroe: {
        variante: uno(v.portadaHeroeVariante, VARIANTES_HEROE, 'muro'),
        fondo: uno(v.portadaHeroeFondo, ['liso', 'aurora'] as const, 'liso'),
        botones: uno(v.portadaHeroeBotones, ['dos', 'uno'] as const, 'dos'),
        tachar: v.portadaHeroeTachado !== false,
        rota: v.portadaHeroeRota !== false,
        intervalo: Number(uno(v.portadaHeroeIntervalo, ['3500', '4500', '6000'] as const, '4500')),
        orden: uno(v.portadaHeroeOrden, ['aleatorio', 'fijo'] as const, 'aleatorio'),
        cursos: listaDeTexto(v.portadaHeroeOficios).slice(0, 12),
      },
      pruebaHeroe: leerPruebaHeroe(v.portadaHeroeAB, v.portadaHeroeABVariantes ?? 'muro, buscador', v.portadaHeroeABReparto, v.portadaHeroeABInicio),
      categoriasVariante: uno(v.portadaCategoriasVariante, ['fotos', 'pila', 'filas'] as const, 'fotos'),
      comoFuncionaAnimado: v.portadaComoFuncionaAnimado !== false,
      heroeMovil: uno(v.portadaHeroeMovil, HEROE_MOVIL, 'tras-buscador'),
      oficioModo: uno(v.portadaOficioModo, ['automatico', 'estatico'] as const, 'automatico'),
      oficioIntervalo: Number(uno(v.portadaOficioIntervalo, ['7000', '9000', '12000'] as const, '9000')),
      guiasVariante: uno(v.portadaGuiasVariante, ['tarjetas', 'lista'] as const, 'tarjetas'),
      beneficiosModo: uno(v.portadaBeneficiosModo, ['automatico', 'estatico'] as const, 'automatico'),
      aparicion: v.portadaAparicion !== false,
      cifrasCuentan: v.portadaCifrasCuentan !== false,
      paralaje: v.portadaParalaje !== false,
      escenasAtenuar: v.portadaEscenasAtenuar !== false,
      escenasVariante: uno(v.portadaEscenasVariante, ['apiladas', 'foto-fija'] as const, 'apiladas'),
      valoradosMinimo: Number(uno(v.portadaValoradosMinimo, ['10', '20', '50'] as const, '20')),
    },
    nosotros: {
      diseno: uno(v.nosotrosDiseno, ['narrativo', 'sencillo'] as const, 'narrativo'),
      cifras: v.nosotrosCifras !== false,
      movimiento: v.nosotrosMovimiento !== false,
    },
    blog: leerAjustesBlog(v),
  };
}

/** Sustituye {variable} por su valor; las que no se conocen se quitan con su espacio. */
export function rellenarPlantilla(plantilla: string, valores: Record<string, string | number | null | undefined>): string {
  return plantilla
    .replace(/\{(\w+)\}/g, (_, clave: string) => {
      const valor = valores[clave];
      return valor === null || valor === undefined || valor === '' ? '' : String(valor);
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

async function leerFilas(): Promise<{ name: string; value: string }[]> {
  try {
    const { getDb } = await import('emdash/runtime');
    return await (await getDb()).selectFrom('options').select(['name', 'value']).where('name', 'like', `${PREFIJO}%`).execute();
  } catch {
    // Sin base (build, pruebas) el sitio sigue con los valores por defecto: el clásico.
    return [];
  }
}

/** Tema y ajustes de esta petición, resueltos una vez y guardados en `locals`. */
export async function temaDeLaPeticion(astro: { url: URL; locals: App.Locals }): Promise<TemaDeLaPeticion> {
  if (astro.locals.sablyTema) return astro.locals.sablyTema;
  const { env } = await import('virtual:sably-runtime');
  const entorno = (env as unknown as { SABLY_TEMA_POR_DEFECTO?: string }).SABLY_TEMA_POR_DEFECTO;
  const ajustes = leerAjustesV2(await leerFilas(), entorno);
  const resuelto = { ...resolverTema(astro.url, ajustes.temaPorDefecto), ajustes };
  astro.locals.sablyTema = resuelto;
  return resuelto;
}
