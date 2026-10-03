/** Temporary development import protocol. No credentials are stored in source. */
export const MIGRATION_COLLECTIONS = ['categories', 'countries', 'creators', 'cities', 'courses', 'course_locales', 'blog', 'testimonials', 'pages', 'homologaciones'] as const;
export const MIGRATION_JSON_LIMIT = 1_500_000;
export const MIGRATION_MEDIA_LIMIT = 2_000_000;
export const LEGACY_AUTHOR_IMAGE = 'https://hotmart.s3.amazonaws.com/profile_pictures/dd0bfeb6-83e9-4ce9-9b9b-2af5c7d21b97/mclafw.png';
const encoder = new TextEncoder();

export function canonicalJson(value: unknown): string {
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, sort(value)]));
    return item;
  };
  return JSON.stringify(sort(value));
}

export async function sha256(value: Uint8Array | string): Promise<string> {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function secretMatches(actual: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([sha256(actual), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function authorizeMigration(request: Request, environment: { SABLY_ENVIRONMENT?: string; SABLY_MIGRATION_TOKEN?: string }): Promise<boolean> {
  const host = new URL(request.url).hostname;
  if (environment.SABLY_ENVIRONMENT !== 'development' || !['dev.sably.co', 'localhost', '127.0.0.1'].includes(host)) return false;
  if (!environment.SABLY_MIGRATION_TOKEN || environment.SABLY_MIGRATION_TOKEN.length < 32) return false;
  return secretMatches(request.headers.get('X-Sably-Migration-Token') ?? '', environment.SABLY_MIGRATION_TOKEN);
}

export function allowedMediaSource(value: string): boolean {
  if (value === LEGACY_AUTHOR_IMAGE) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['sably.co', 'cdn.sably.co'].includes(url.hostname) && !url.username && !url.password && !url.port;
  } catch { return false; }
}

export async function readLimited(request: Request, limit: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > limit) throw new Error('Request exceeds import limit');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.length;
      if (length > limit) { await reader.cancel(); throw new Error('Request exceeds import limit'); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return data;
}

export function normalizedStoredValue(value: unknown): unknown {
  if (typeof value === 'string' && /^[\[{]/.test(value)) {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value ?? null;
}

export async function snapshotHash(row: Record<string, unknown>, fields: string[]): Promise<string> {
  const values = Object.fromEntries(fields.map((field) => [field, normalizedStoredValue(row[field])]));
  return sha256(canonicalJson(values));
}

export function isPilotEntry(collection: string, slug: string): boolean {
  return (collection === 'courses' && slug === 'curso-de-barberia')
    || (collection === 'course_locales' && /^curso-de-barberia--(ar|cl|co|ec|es|mx|pe|us)$/.test(slug))
    || (collection === 'blog' && slug === 'como-emprender-con-un-oficio-en-2026');
}
