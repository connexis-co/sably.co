import { definePlugin, PluginRouteError, type RouteContext } from 'emdash';
import { auditEntries, readAuditEntries } from './model';
import { articleMetadata } from './metadata';

export async function audit(ctx: RouteContext) {
  if (!ctx.user || ctx.user.role < 40) throw PluginRouteError.forbidden('La auditoría SEO requiere una sesión de editor o administrador.');
  if (!ctx.content) throw PluginRouteError.internal('No está disponible la lectura de contenido de EmDash.');
  try { return auditEntries(await readAuditEntries(ctx.content)); }
  catch (error) { ctx.log.error('Sably SEO could not complete its CMS scan.'); throw PluginRouteError.internal(error instanceof Error ? error.message : 'No se pudo completar el análisis.'); }
}
export function createPlugin() {
  return definePlugin({
    id: 'sably-seo', version: '1.0.0', capabilities: ['content:read'],
    admin: { pages: [{ path: '/seo', label: 'Sably · SEO', icon: 'search' }] },
    routes: { audit: { methods: ['GET'], permission: 'content:read', public: false, request: { body: 'none' }, handler: audit } },
    // Typed page:metadata needs no additional capability in EmDash 1.1.
    // Its primary graph replaces the core graph by ID, preserving one article.
    hooks: { 'page:metadata': ({ page }) => articleMetadata(page) },
  });
}
