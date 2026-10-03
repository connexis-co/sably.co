export interface LegacyRedirectRule {
  pattern: RegExp;
  parameters: string[];
  destination: string;
  status: 301 | 302;
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PARAMETER = /:([A-Za-z][A-Za-z0-9_]*)|\*/g;

/** Compile the local subset of Pages _redirects used by Sably, in file order. */
export function parseLegacyRedirects(source: string): LegacyRedirectRule[] {
  const rules: LegacyRedirectRule[] = [];
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const fail = (message: string): never => {
      throw new Error(`Invalid legacy redirect on line ${index + 1}: ${message}`);
    };
    const parts = line.split(/\s+/);
    if (parts.length !== 3) fail('expected source, destination and status');
    const [from, destination, code] = parts as [string, string, string];
    if (!from.startsWith('/') || from.startsWith('//') || /[?#\\]/.test(from)) fail('source must be a local path');
    if (!destination.startsWith('/') || destination.startsWith('//') || destination.includes('\\')) {
      fail('external destinations are not allowed');
    }
    if (code !== '301' && code !== '302') fail('only 301 and 302 are supported');

    const parameters: string[] = [];
    let pattern = '^';
    let cursor = 0;
    for (const match of from.matchAll(PARAMETER)) {
      pattern += escapeRegex(from.slice(cursor, match.index));
      const name = match[1] ?? 'splat';
      if (parameters.includes(name)) fail(`duplicate parameter ${name}`);
      parameters.push(name);
      pattern += match[0] === '*' ? '(.*)' : '([^/]+)';
      cursor = match.index + match[0].length;
    }
    pattern += `${escapeRegex(from.slice(cursor))}$`;
    for (const match of destination.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)) {
      if (!parameters.includes(match[1]!)) fail(`unknown destination parameter ${match[1]}`);
    }
    rules.push({ pattern: new RegExp(pattern), parameters, destination, status: Number(code) as 301 | 302 });
  }
  return rules;
}

/** Resolve after the development access gate; unmatched URLs continue to Astro. */
export function resolveLegacyRedirect(request: Request, rules: readonly LegacyRedirectRule[]): Response | null {
  const current = new URL(request.url);
  for (const rule of rules) {
    const match = rule.pattern.exec(current.pathname);
    if (!match) continue;
    const captures = new Map(rule.parameters.map((name, index) => [name, match[index + 1]!]));
    const path = rule.destination.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_, name: string) => captures.get(name)!);
    const destination = new URL(path, current.origin);
    // Defense in depth if a future rule substitutes a capture near the origin.
    if (destination.origin !== current.origin) return null;
    if (current.search) {
      destination.search = destination.search
        ? `${destination.search}&${current.search.slice(1)}`
        : current.search;
    }
    return Response.redirect(destination.href, rule.status);
  }
  return null;
}

/** Keep public document URLs canonical without changing API methods or paths. */
export function publicCanonicalRedirect(request: Request): Response | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  if (url.pathname === '/' || url.pathname.endsWith('/')) return null;
  if (/^\/(?:_emdash|api|_astro|internal|_server-islands|_image)(?:\/|$)/.test(url.pathname)) return null;
  if (/\/[^/]*\.[^/]*$/.test(url.pathname)) return null;
  url.pathname += '/';
  return Response.redirect(url.href, 301);
}
