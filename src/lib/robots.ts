/** Development cannot inherit an editor's permissive production robots policy. */
export function robotsContent(environment: string | undefined, custom?: string): string {
  if (environment !== 'production') return 'User-agent: *\nDisallow: /\n';
  const body = custom?.trim() || [
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes, ai-train=yes',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /_emdash/',
    'Allow: /_emdash/api/media/file/',
    'Disallow: /api/',
    '',
    'User-agent: Bytespider',
    'Disallow: /',
  ].join('\n');
  return `${body}\n${/^\s*Sitemap:/im.test(body) ? '' : '\nSitemap: https://sably.co/sitemap-index.xml\n'}`;
}
