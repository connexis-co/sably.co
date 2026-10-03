import type { APIRoute } from 'astro';

export const prerender = false;

/** Keep existing administration bookmarks usable after the EmDash migration. */
export const GET: APIRoute = ({ url }) =>
  Response.redirect(new URL('/_emdash/admin', url), 302);

export const HEAD = GET;
