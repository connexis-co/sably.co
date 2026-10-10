import type { APIRoute } from 'astro';
import { env } from 'virtual:sably-runtime';

/** Readiness only: never return table contents, credentials, or error details. */
export const GET: APIRoute = async () => {
  try {
    await Promise.all([
      env.DB.prepare('SELECT id FROM users LIMIT 1').all(),
      env.DB.prepare('SELECT id FROM _emdash_collections LIMIT 1').all(),
      env.SABLY_DB.prepare('SELECT id FROM subject LIMIT 1').all(),
    ]);
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
};
