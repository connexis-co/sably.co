/** Only these public Hotmart entry points may be fetched by the refresher. */
const HOTMART_HOSTS = new Set(['go.hotmart.com', 'pay.hotmart.com', 'hotm.art', 'hotm.io']);
export function allowedHotmartUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && HOTMART_HOSTS.has(url.hostname) && !url.username && !url.password && !url.port && !url.pathname.includes('PENDIENTE');
  } catch { return false; }
}

/** Validate every hop, including redirects from an otherwise trusted short URL. */
export async function fetchHotmart(value, { fetcher = fetch, headers = {}, maxRedirects = 8, marketplace = false } = {}) {
  let url = value;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const parsed = new URL(url);
    const marketplaceDestination = marketplace && parsed.protocol === 'https:' && ['hotmart.com','www.hotmart.com'].includes(parsed.hostname) && !parsed.username && !parsed.password && !parsed.port;
    if (!allowedHotmartUrl(url) && !marketplaceDestination) throw new Error('URL Hotmart no permitida');
    const response = await fetcher(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(25000) });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirección Hotmart sin destino');
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok) throw new Error(`Hotmart respondió ${response.status}`);
    return { final: url, html: await response.text() };
  }
  throw new Error('Demasiadas redirecciones Hotmart');
}

export function catalogApiOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['sably.co','dev.sably.co'].includes(url.hostname) || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('SABLY_API debe ser https://sably.co o https://dev.sably.co');
  return url.origin;
}

export async function loadPublishedHotmartCatalog({ api, token, previewToken, fetcher = fetch }) {
  const origin = catalogApiOrigin(api);
  if (!token) throw new Error('Falta SNAPSHOT_TOKEN para consultar el catálogo CMS');
  const headers = { authorization: `Bearer ${token}`, ...(previewToken ? { 'X-Sably-Preview-Token': previewToken } : {}) };
  const response = await fetcher(`${origin}/api/v1/catalogo`, { headers, redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`El catálogo CMS respondió ${response.status}`);
  const data = await response.json();
  if (data.source !== 'emdash' || !Array.isArray(data.courses)) throw new Error('Respuesta de catálogo CMS inválida');
  const slugs = new Set();
  for (const row of data.courses) {
    if (!row || typeof row.slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(row.slug) || slugs.has(row.slug) || typeof row.titulo !== 'string' || !allowedHotmartUrl(row.url)) throw new Error('Curso CMS inválido en catálogo Hotmart');
    slugs.add(row.slug);
  }
  return data.courses;
}

/** A previous local capture is reusable only while its CMS source URL matches. */
export function retainPublishedCaptures(snapshot, courses) {
  const current = new Map(courses.map(row => [row.slug, row.url]));
  for (const field of ['productos','precios','valoraciones','resenas']) {
    snapshot[field] ??= {};
    for (const slug of Object.keys(snapshot[field])) {
      if (!current.has(slug) || snapshot._sourceUrls?.[slug] !== current.get(slug)) delete snapshot[field][slug];
    }
  }
  snapshot._sourceUrls = Object.fromEntries(current);
  return snapshot;
}
