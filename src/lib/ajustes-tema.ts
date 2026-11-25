/**
 * Ajustes del tema V2 desde el panel (plugin sably-operations, «Ajustes»).
 * Se leen de la tabla `options` de EmDash en cada render (la página ya está en
 * caché, así que es una consulta por render, no por visita), y guardarlos
 * invalida las páginas (ver `invalidatedTags` en public-delivery.ts).
 */
import { resolverTema, temaPorDefecto, type Tema, type TemaResuelto } from './tema';
import { SUBTITULO_SABLY, TITULO_SABLY } from './caja/sably';
import { bloquesVisibles, listaDeTexto, type BloquePortada } from './portada-bloques';

export type VarianteCaja = 'cuenta-clara' | 'cabecera-oscura';
export type EstiloContador = 'barra' | 'casillas' | 'linea' | 'tique';
export type EstiloCampo = 'outlined' | 'filled' | 'underline';

export interface AjustesV2 {
  temaPorDefecto: Tema;
  caja: {
    variante: VarianteCaja;
    contador: EstiloContador;
    /** Texto del bloque `titulo` del núcleo común: variables {curso} y {escuela} (el creador); sin cifras. Vacío = sin título. */
    titulo: string;
    subtitulo: string;
  };
  /** «Lo dicta …» en la cabeza y en la caja. */
  mostrarCreador: boolean;
  /** Bloque del docente real (C5): solo en cursos con docente con fuente. */
  mostrarDocente: boolean;
  /** «Disponible online en {país}» con las ciudades del país, en texto y sin enlaces. */
  mostrarCiudades: boolean;
  estiloCampo: EstiloCampo;
  /** Portada de país V2 («Ajustes del sitio → Portada»). */
  portada: {
    /** Bloques visibles, en orden (el héroe va siempre primero y no está aquí). */
    bloques: BloquePortada[];
    heroe: { variante: 'vitrina' | 'buscador' | 'abanico' | 'mosaico'; botones: 'dos' | 'uno'; tachar: boolean; rota: boolean; intervalo: number; orden: 'aleatorio' | 'fijo'; cursos: string[] };
    comoFuncionaAnimado: boolean;
    escenasAtenuar: boolean;
    escenasVariante: 'apiladas' | 'foto-fija';
    valoradosMinimo: number;
  };
}

export interface TemaDeLaPeticion extends TemaResuelto {
  ajustes: AjustesV2;
}

const PREFIJO = 'plugin:sably-operations:settings:';
export const TITULO_CAJA_POR_DEFECTO = TITULO_SABLY;
export const SUBTITULO_CAJA_POR_DEFECTO = SUBTITULO_SABLY;

const uno = <T extends string>(valor: unknown, validos: readonly T[], defecto: T): T =>
  typeof valor === 'string' && (validos as readonly string[]).includes(valor) ? (valor as T) : defecto;

function decodificar(valor: string): unknown {
  try { return JSON.parse(valor); } catch { return valor; }
}

/** Puro: filas de `options` (+ variable de entorno) → ajustes con sus valores por defecto. */
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
    },
    mostrarCreador: v.mostrarCreador !== false,
    mostrarDocente: v.mostrarDocente !== false,
    mostrarCiudades: v.mostrarCiudades !== false,
    estiloCampo: uno(v.estiloCampo, ['outlined', 'filled', 'underline'] as const, 'outlined'),
    portada: {
      bloques: bloquesVisibles(v.portadaOrden, v.portadaOcultos),
      heroe: {
        variante: uno(v.portadaHeroeVariante, ['vitrina', 'buscador', 'abanico', 'mosaico'] as const, 'vitrina'),
        botones: uno(v.portadaHeroeBotones, ['dos', 'uno'] as const, 'dos'),
        tachar: v.portadaHeroeTachado !== false,
        rota: v.portadaHeroeRota !== false,
        intervalo: Number(uno(v.portadaHeroeIntervalo, ['3500', '4500', '6000'] as const, '4500')),
        orden: uno(v.portadaHeroeOrden, ['aleatorio', 'fijo'] as const, 'aleatorio'),
        cursos: listaDeTexto(v.portadaHeroeOficios).slice(0, 12),
      },
      comoFuncionaAnimado: v.portadaComoFuncionaAnimado !== false,
      escenasAtenuar: v.portadaEscenasAtenuar !== false,
      escenasVariante: uno(v.portadaEscenasVariante, ['apiladas', 'foto-fija'] as const, 'apiladas'),
      valoradosMinimo: Number(uno(v.portadaValoradosMinimo, ['10', '20', '50'] as const, '20')),
    },
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
