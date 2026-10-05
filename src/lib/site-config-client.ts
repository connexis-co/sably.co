/**
 * `GET /api/v1/config` una sola vez por página. WhatsApp, la prueba social y el
 * reproductor lo leían cada uno por su cuenta: tres peticiones idénticas en la
 * carga. Devuelve `null` ante cualquier fallo, y cada widget usa entonces los
 * valores que el HTML ya trae horneados. Solo para scripts de navegador.
 */
let configDeLaPagina: Promise<unknown> | undefined;

export function leerConfig<T>(): Promise<T | null> {
  configDeLaPagina ??= fetch('/api/v1/config', { signal: AbortSignal.timeout(4000) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return configDeLaPagina as Promise<T | null>;
}
