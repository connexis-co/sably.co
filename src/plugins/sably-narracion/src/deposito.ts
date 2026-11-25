// Dónde se guardan los MP3. El nombre lleva la huella del contenido (`<slug>-<sha256:12>.mp3`): nunca cambia lo que hay
// detrás de una URL, así que se sirve con caché inmutable de un año.
//   r2     bucket de Cloudflare (por defecto `sably-assets`, servido por cdn.sably.co) con la API de Cloudflare.
//   disco  carpeta del volumen persistente del servidor (Node), servida por /narraciones/<archivo>.
export const CACHE_INMUTABLE = "public, max-age=31536000, immutable";

export interface Guardado {
  deposito: "r2" | "disco";
  url: string;
}

export interface Deposito {
  id: "r2" | "disco";
  disponible(): boolean;
  guardar(archivo: string, datos: Uint8Array): Promise<Guardado>;
}

const ARCHIVO = /^[a-z0-9][a-z0-9-]{0,160}\.mp3$/;
export const archivoValido = (archivo: string) => ARCHIVO.test(archivo);

export function carpetaAudios() {
  return process.env.NARRACION_AUDIOS ?? `${process.env.SABLY_DATA_DIR ?? "./data"}/narraciones`;
}

const esNode = () => typeof process !== "undefined" && Boolean(process.versions?.node) && !("WebSocketPair" in globalThis);

export const disco: Deposito = {
  id: "disco",
  disponible: esNode,
  async guardar(archivo, datos) {
    if (!archivoValido(archivo)) throw Error("Nombre de archivo no válido");
    const { mkdir, writeFile, rename, stat } = await import("node:fs/promises");
    const { join, resolve } = await import("node:path");
    const carpeta = resolve(carpetaAudios());
    await mkdir(carpeta, { recursive: true });
    const final = join(carpeta, archivo);
    const existe = await stat(final).then((s) => s.size === datos.length, () => false);
    if (!existe) {
      const temporal = `${final}.${process.pid}.tmp`;
      await writeFile(temporal, datos);
      await rename(temporal, final);
    }
    return { deposito: "disco", url: `/narraciones/${archivo}` };
  },
};

function r2Config() {
  const token = process.env.NARRACION_R2_TOKEN;
  const cuenta = process.env.NARRACION_R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !cuenta) return undefined;
  return {
    token,
    cuenta,
    bucket: process.env.NARRACION_R2_BUCKET ?? "sably-assets",
    base: (process.env.NARRACION_CDN_URL ?? process.env.PUBLIC_CDN_URL ?? "https://cdn.sably.co").replace(/\/$/, ""),
  };
}

export const r2: Deposito = {
  id: "r2",
  disponible: () => Boolean(r2Config()),
  async guardar(archivo, datos) {
    if (!archivoValido(archivo)) throw Error("Nombre de archivo no válido");
    const c = r2Config();
    if (!c) throw Error("R2 sin configurar (NARRACION_R2_TOKEN y CLOUDFLARE_ACCOUNT_ID)");
    const clave = `narraciones/${archivo}`;
    const url = `https://api.cloudflare.com/client/v4/accounts/${c.cuenta}/r2/buckets/${c.bucket}/objects/${clave}`;
    let ultimo = "";
    for (let intento = 0; intento < 3; intento++) {
      try {
        const r = await fetch(url, {
          method: "PUT",
          headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "audio/mpeg", "Cache-Control": CACHE_INMUTABLE },
          body: datos as Uint8Array<ArrayBuffer>,
          signal: AbortSignal.timeout(60_000),
        });
        if (r.ok) return { deposito: "r2", url: `${c.base}/${clave}` };
        ultimo = `HTTP ${r.status}`;
        if (r.status < 500 && r.status !== 429) break;
      } catch (e) {
        ultimo = (e as Error).name;
      }
      await new Promise((ok) => setTimeout(ok, 1000 * 4 ** intento));
    }
    throw Error(`No se pudo subir a R2 (${ultimo})`);
  },
};

/** Guarda en el depósito elegido; con «auto», R2 si está configurado y el disco si R2 falla o no existe. */
export async function guardar(preferencia: "auto" | "r2" | "disco", archivo: string, datos: Uint8Array): Promise<Guardado & { aviso?: string }> {
  if (preferencia === "disco") return disco.guardar(archivo, datos);
  if (preferencia === "r2" || r2.disponible()) {
    try {
      return await r2.guardar(archivo, datos);
    } catch (e) {
      if (!disco.disponible()) throw e;
      return { ...(await disco.guardar(archivo, datos)), aviso: (e as Error).message };
    }
  }
  if (!disco.disponible()) throw Error("No hay depósito: configura R2 o ejecuta el sitio en Node");
  return disco.guardar(archivo, datos);
}
