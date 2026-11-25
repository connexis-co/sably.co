// Trabajador: reclama tomas, genera la voz por tramos con reintentos, controla la duración de cada tramo, masteriza a
// MP3, lo deposita y, en revisión automática y con los controles en verde, lo publica. Nunca lanza al editor: un fallo
// del proveedor deja la toma en la cola y el artículo se publica igual, sin reproductor.
import { aMp3, medir, normalizar, recortar, unir, type Pcm } from "./audio";
import type { Config } from "./config";
import { Cola, type Toma } from "./cola";
import { guardar } from "./deposito";
import { disponible, ErrorProveedor, proveedor as obtenerProveedor, type Proveedor } from "./proveedores";
import { guion, sha256, type Fragmento } from "./texto";

/** Tramos de hasta 1.800 caracteres sin partir un bloque: si uno falla o sale corto se repite solo ese. */
export const MAXIMO_TRAMO = 1800;
export const PAUSA_ENTRE_TRAMOS = 0.6;
/** Duración aceptable de un tramo frente a la esperada por sus caracteres. */
export const RANGO_DURACION: [number, number] = [0.7, 1.45];
const ESPERAS_TRAMO_MS = [1000, 4000, 16000];

const usdEs = (n: number) => n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function agrupar(fragmentos: Fragmento[], maximo = MAXIMO_TRAMO): string[] {
  const grupos: string[] = [];
  let actual = "";
  for (const f of fragmentos) {
    if (actual && actual.length + f.texto.length + 2 > maximo) {
      grupos.push(actual);
      actual = "";
    }
    actual = actual ? actual + "\n\n" + f.texto : f.texto;
  }
  if (actual) grupos.push(actual);
  return grupos;
}

/** Segundos esperados de un texto con la voz configurada. */
export const segundosEsperados = (caracteres: number, config: Pick<Config, "caracteresPorSegundo">) =>
  caracteres / config.caracteresPorSegundo;

/** Coste estimado de narrar unos bloques (para topes, lote y panel). */
export function estimar(bloques: string[], perfil: Toma["perfil"], config: Config, fecha?: Date) {
  const texto = guion(bloques, { pronunciaciones: config.pronunciaciones }).map((f) => f.texto).join(" ");
  const segundos = segundosEsperados(texto.length, config);
  const p = obtenerProveedor(perfil.proveedor);
  return { caracteres: texto.length, segundos, usd: p.estimar(perfil, texto.length, segundos, fecha) };
}

export interface OpcionesTrabajo {
  limite?: number;
  /** Para pruebas: proveedor ya construido y esperas sin tiempo real. */
  proveedorInstancia?: Proveedor;
  esperar?: (ms: number) => Promise<void>;
  registro?: (mensaje: string, datos?: Record<string, unknown>) => void;
  metadatos?: { artista: string; album: string };
}

export interface ResumenTrabajo {
  publicadas: string[];
  revision: string[];
  fallidas: { id: string; motivo: string }[];
  costoUsd: number;
  omitido?: string;
}

interface InformeTramo {
  caracteres: number;
  segundos: number;
  esperado: number;
  razon: number;
  intentos: number;
  costoUsd: number;
}

/** Genera un tramo con reintentos ante errores transitorios y lo repite una vez si su duración no cuadra. */
async function tramo(p: Proveedor, texto: string, toma: Toma, config: Config, o: OpcionesTrabajo): Promise<{ pcm: Pcm; informe: InformeTramo; sospechoso: boolean }> {
  const esperar = o.esperar ?? ((ms) => new Promise((ok) => setTimeout(ok, ms)));
  let costo = 0;
  let intentos = 0;
  let mejor: { pcm: Pcm; razon: number } | undefined;
  for (let repeticion = 0; repeticion < 2; repeticion++) {
    let resultado;
    for (let i = 0; ; i++) {
      intentos++;
      try {
        resultado = await p.sintetizar(texto, toma.perfil, { estilo: config.estilo });
        break;
      } catch (e) {
        if (!(e instanceof ErrorProveedor) || e.tipo !== "transitorio" || i >= ESPERAS_TRAMO_MS.length - 1) throw e;
        await esperar(ESPERAS_TRAMO_MS[i]!);
      }
    }
    costo += resultado.costoUsd;
    const pcm = recortar(resultado.pcm);
    const segundos = pcm.muestras.length / pcm.frecuencia;
    const razon = segundos / segundosEsperados(texto.length, config);
    const silencio = (await medir(pcm)).silencioMaximo;
    const bien = razon >= RANGO_DURACION[0] && razon <= RANGO_DURACION[1] && silencio <= 4;
    if (!mejor || Math.abs(Math.log(razon)) < Math.abs(Math.log(mejor.razon))) mejor = { pcm, razon };
    if (bien) break;
    o.registro?.("Tramo con duración fuera de rango; se repite", { razon: Math.round(razon * 100) / 100, silencio });
  }
  const pcm = mejor!.pcm;
  const segundos = pcm.muestras.length / pcm.frecuencia;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sospechoso = mejor!.razon < RANGO_DURACION[0] || mejor!.razon > RANGO_DURACION[1];
  return {
    pcm,
    sospechoso,
    informe: { caracteres: texto.length, segundos: r2(segundos), esperado: r2(segundosEsperados(texto.length, config)),
      razon: r2(mejor!.razon), intentos, costoUsd: Math.round(costo * 1e6) / 1e6 },
  };
}

async function generarToma(cola: Cola, id: string, toma: Toma, config: Config, o: OpcionesTrabajo, resumen: ResumenTrabajo) {
  const p = o.proveedorInstancia ?? obtenerProveedor(toma.perfil.proveedor);
  const fragmentos = guion(toma.bloques, { pronunciaciones: config.pronunciaciones });
  const tramos = agrupar(fragmentos);
  const partes: Pcm[] = [];
  const informes: InformeTramo[] = [];
  let sospechosos = 0;
  let costo = 0;
  try {
    for (const texto of tramos) {
      const r = await tramo(p, texto, toma, config, o);
      partes.push(r.pcm);
      informes.push(r.informe);
      costo += r.informe.costoUsd;
      if (r.sospechoso) sospechosos++;
    }
  } finally {
    // Lo que ya se generó se paga aunque la toma falle después: se suma siempre.
    if (costo > 0) {
      await cola.sumarGasto(costo);
      resumen.costoUsd += costo;
    }
  }
  const pcm = await normalizar(unir(partes, PAUSA_ENTRE_TRAMOS));
  const medicion = await medir(pcm);
  const mp3 = await aMp3(pcm, {
    titulo: toma.titulo,
    artista: o.metadatos?.artista ?? "Sably",
    album: o.metadatos?.album ?? "Artículos narrados",
    comentario: "Narración con voz sintética generada con IA.",
  });
  const huellaAudio = await sha256(mp3);
  const archivo = `${toma.slug.slice(0, 140)}-${huellaAudio.slice(0, 12)}.mp3`;
  const guardado = await guardar(config.deposito, archivo, mp3);
  const automatica = config.revision === "automatica" && sospechosos === 0;
  const final = await cola.entregar(id, {
    archivo, url: guardado.url, deposito: guardado.deposito, segundos: medicion.segundos, bytes: mp3.length, sha256: huellaAudio,
    costoUsd: Math.round(costo * 1e6) / 1e6,
    informe: {
      proveedor: p.id, voz: toma.perfil.voz, modelo: toma.perfil.modelo, medicion, tramos: informes, sospechosos,
      ...(guardado.aviso ? { avisoDeposito: guardado.aviso } : {}),
      ...(sospechosos ? { motivoRevision: `${sospechosos} tramo(s) con duración fuera de lo esperado: escúchala antes de publicar` } : {}),
    },
  }, automatica);
  (final.estado === "publicada" ? resumen.publicadas : resumen.revision).push(id);
  o.registro?.(final.estado === "publicada" ? "Narración publicada" : "Narración en revisión",
    { slug: toma.slug, segundos: medicion.segundos, lufs: medicion.lufs, usd: Math.round(costo * 1e4) / 1e4 });
}

/** Procesa la cola. Devuelve qué se publicó, qué quedó en revisión y qué falló. */
export async function procesar(cola: Cola, o: OpcionesTrabajo = {}): Promise<ResumenTrabajo> {
  const resumen: ResumenTrabajo = { publicadas: [], revision: [], fallidas: [], costoUsd: 0 };
  const dueno = `${typeof process !== "undefined" ? process.pid : "w"}-${Math.random().toString(36).slice(2, 8)}`;
  if (!(await cola.tomarCerrojo(dueno))) return { ...resumen, omitido: "Otro trabajador está en marcha" };
  try {
    const config = await cola.config();
    const limite = o.limite ?? 3;
    while (resumen.publicadas.length + resumen.revision.length + resumen.fallidas.length < limite) {
      const gasto = await cola.gasto();
      const reclamadas = await cola.reclamar(1);
      const actual = reclamadas[0];
      if (!actual) break;
      const { id, toma } = actual;
      const p = o.proveedorInstancia ?? obtenerProveedor(toma.perfil.proveedor);
      const pausa = await cola.disyuntor(p.id);
      if (pausa) {
        await cola.fallar(id, `Proveedor en pausa: ${pausa.motivo}`, { pausa: true });
        return { ...resumen, omitido: `Proveedor ${p.id} en pausa hasta ${new Date(pausa.hasta).toISOString()}` };
      }
      if (!o.proveedorInstancia && !disponible(p)) {
        await cola.fallar(id, `Falta ${p.clave} en el servidor`, { pausa: true });
        return { ...resumen, omitido: `Falta ${p.clave}` };
      }
      if (gasto.usd + toma.costoEstimadoUsd > config.topeMensualUsd) {
        await cola.fallar(id, `Tope mensual alcanzado: USD ${usdEs(gasto.usd)} gastados de USD ${usdEs(config.topeMensualUsd)}`, { pausa: true });
        return { ...resumen, omitido: "Tope mensual alcanzado" };
      }
      await cola.tomarCerrojo(dueno);
      try {
        await generarToma(cola, id, toma, config, o, resumen);
      } catch (e) {
        const motivo = (e as Error).message ?? String(e);
        if (e instanceof ErrorProveedor && (e.tipo === "saldo" || e.tipo === "credenciales")) {
          await cola.abrirDisyuntor(p.id, motivo);
          await cola.fallar(id, motivo, { pausa: true });
          resumen.fallidas.push({ id, motivo });
          o.registro?.("Proveedor en pausa", { proveedor: p.id, tipo: e.tipo });
          break;
        }
        await cola.fallar(id, motivo, { definitivo: e instanceof ErrorProveedor && e.tipo === "peticion" });
        resumen.fallidas.push({ id, motivo });
        o.registro?.("Narración fallida", { id, motivo: motivo.slice(0, 200) });
      }
    }
    return resumen;
  } finally {
    await cola.soltarCerrojo(dueno);
  }
}
