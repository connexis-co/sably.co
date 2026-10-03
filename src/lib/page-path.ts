/** Public CMS pages can own local paths outside the country/application namespaces. */
export function normalizePagePath(value: unknown): string | null {
 if(typeof value!=='string'||!value.startsWith('/')||/[\\?#%\u0000-\u0020]/.test(value)||value.includes('//'))return null;
 const segments=value.split('/').filter(Boolean);
 if(!segments.length||segments.some(segment=>segment==='.'||segment==='..'||!/^[-\p{L}\p{N}_]+$/u.test(segment)))return null;
 return `/${segments.join('/')}/`;
}
const reserved=new Set(['_emdash','admin','api','internal','blog','homologaciones','sitemap','mapa-del-sitio']);
export function pagePathAvailable(path:string,countryCodes:string[]):boolean {
 const normalized=normalizePagePath(path);if(!normalized)return false;
 const first=normalized.split('/')[1]!;
 return !reserved.has(first)&&!countryCodes.includes(first);
}
