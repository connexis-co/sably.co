import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getLiveSiteSettings } from '@/lib/live-site-settings';
import { robotsContent } from '@/lib/robots';
export const prerender = false;
export const GET: APIRoute = async () => {
  const environment = (env as { SABLY_ENVIRONMENT?: string }).SABLY_ENVIRONMENT;
  const settings = environment === 'production' ? await getLiveSiteSettings() : {};
  return new Response(robotsContent(environment, settings.seo?.robotsTxt), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};
