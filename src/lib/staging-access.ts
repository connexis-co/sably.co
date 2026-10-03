export interface StagingAccessEnv {
  SABLY_DEV_PASSWORD?: string;
}

const PREVIEW_HEADER = 'X-Sably-Preview-Token';
const BASIC_USER = 'sably';
const encoder = new TextEncoder();

async function matchesSecret(value: string, expected: string): Promise<boolean> {
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(value)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const actual = new Uint8Array(actualDigest);
  const target = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < target.length; index += 1) {
    difference |= actual[index]! ^ target[index]!;
  }
  return difference === 0;
}

function basicCredentials(request: Request): string | null {
  const match = /^Basic\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '');
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[1]!), (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Apply these headers after the application handler, including on redirects and errors. */
export function protectResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('Cache-Control', 'private, no-store');

  const vary = (headers.get('Vary') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  // A wildcard already varies on every request header; do not weaken it.
  if (!vary.includes('*')) {
    for (const name of ['Authorization', PREVIEW_HEADER]) {
      if (!vary.some((value) => value.toLowerCase() === name.toLowerCase())) vary.push(name);
    }
    headers.set('Vary', vary.join(', '));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Return a protected denial or null to continue into EmDash's own authentication. */
export async function gate(request: Request, env: StagingAccessEnv): Promise<Response | null> {
  const password = env.SABLY_DEV_PASSWORD;
  if (typeof password !== 'string' || password.length === 0) {
    return protectResponse(new Response('Development access is not configured.', { status: 503 }));
  }

  const previewToken = request.headers.get(PREVIEW_HEADER);
  if (previewToken !== null && await matchesSecret(previewToken, password)) return null;

  const credentials = basicCredentials(request);
  if (credentials !== null && await matchesSecret(credentials, `${BASIC_USER}:${password}`)) return null;

  return protectResponse(new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Sably development", charset="UTF-8"' },
  }));
}
