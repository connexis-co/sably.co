import assert from 'node:assert/strict';
import test from 'node:test';
import { gate, protectResponse } from '../src/lib/staging-access.ts';

const password = 'test-preview-secret:with-colon';
const env = { SABLY_DEV_PASSWORD: password };

function request(headers: HeadersInit = {}, hostname = 'dev.sably.co'): Request {
  return new Request(`https://${hostname}/_emdash/api/setup`, { headers });
}

function basic(username: string, secret: string): string {
  const bytes = new TextEncoder().encode(`${username}:${secret}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

function assertProtected(response: Response): void {
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const vary = response.headers.get('Vary')!.toLowerCase().split(',').map((value) => value.trim());
  assert.ok(vary.includes('authorization'));
  assert.ok(vary.includes('x-sably-preview-token'));
}

test('missing or empty configuration fails closed even with supplied credentials', async () => {
  for (const missingEnv of [{}, { SABLY_DEV_PASSWORD: '' }]) {
    const response = await gate(request({ Authorization: basic('sably', password) }), missingEnv);
    assert.equal(response?.status, 503);
    assertProtected(response!);
  }
});

test('anonymous setup requests cannot bypass the gate on another hostname', async () => {
  for (const hostname of ['dev.sably.co', 'sably.co', 'localhost', 'preview.workers.dev']) {
    const response = await gate(request({}, hostname), env);
    assert.equal(response?.status, 401);
    assert.match(response!.headers.get('WWW-Authenticate')!, /^Basic /);
    assertProtected(response!);
  }
});

test('wrong username, wrong password, malformed Basic and Bearer credentials are rejected', async () => {
  for (const authorization of [
    basic('someone-else', password),
    basic('sably', 'incorrect'),
    'Basic !!!invalid-base64!!!',
    'Basic',
    `Bearer ${password}`,
  ]) {
    const response = await gate(request({ Authorization: authorization }), env);
    assert.equal(response?.status, 401);
    assertProtected(response!);
    assert.ok(!(await response!.text()).includes(password));
  }
});

test('valid Basic credentials pass without creating an EmDash session', async () => {
  assert.equal(await gate(request({ Authorization: basic('sably', password) }), env), null);
});

test('Basic authentication supports UTF-8 passwords and case-insensitive scheme', async () => {
  const unicodePassword = 'desarrollo-seguro-ñ';
  const authorization = basic('sably', unicodePassword).replace('Basic', 'bAsIc');
  assert.equal(await gate(request({ Authorization: authorization }), {
    SABLY_DEV_PASSWORD: unicodePassword,
  }), null);
});

test('valid preview token permits the independent EmDash Bearer authorization header', async () => {
  const incoming = request({
    'X-Sably-Preview-Token': password,
    Authorization: 'Bearer ec_pat_test-credential',
  });
  assert.equal(await gate(incoming, env), null);
  assert.equal(incoming.headers.get('Authorization'), 'Bearer ec_pat_test-credential');
});

test('wrong or empty preview tokens are rejected', async () => {
  for (const token of ['incorrect', '']) {
    const response = await gate(request({ 'X-Sably-Preview-Token': token }), env);
    assert.equal(response?.status, 401);
    assertProtected(response!);
  }
});

test('response protection covers success, redirects and errors without changing the response content', async () => {
  for (const status of [200, 301, 401, 404, 500, 503]) {
    const original = new Response('original body', {
      status,
      headers: {
        Vary: 'Accept-Encoding, authorization',
        Location: '/_emdash/admin',
        'Set-Cookie': 'astro-session=test; Path=/; HttpOnly; Secure',
        'Cache-Control': 'public, max-age=3600',
      },
    });
    const response = protectResponse(original);
    assert.equal(response.status, status);
    assertProtected(response);
    assert.equal(await response.text(), 'original body');
    assert.equal(response.headers.get('Location'), '/_emdash/admin');
    assert.equal(response.headers.get('Set-Cookie'), original.headers.get('Set-Cookie'));
    assert.equal(response.headers.get('Vary'), 'Accept-Encoding, authorization, X-Sably-Preview-Token');
    assert.equal(original.headers.get('Cache-Control'), 'public, max-age=3600');
  }
});

test('immutable redirect responses can receive protection headers', () => {
  const response = protectResponse(Response.redirect('https://dev.sably.co/_emdash/admin', 302));
  assert.equal(response.status, 302);
  assertProtected(response);
});

test('an existing wildcard Vary is preserved', () => {
  const response = protectResponse(new Response(null, { headers: { Vary: '*' } }));
  assert.equal(response.headers.get('Vary'), '*');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
});
