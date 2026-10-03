import { definePlugin, PluginRouteError, type PluginRoute, type RouteContext } from 'emdash';
import { getWidgets, listLeads, listPromos, listReviews, moderate, OperationsError, ratings, savePromo, saveWidget, summary } from './service';
import { availableOperationalDatabase, type OperationalBindings } from '../../lib/operational-environment';
import { reconcileCatalog } from './catalog';

async function catalogChanged(event: { collection: string }) {
  if (!['courses','blog'].includes(event.collection)) return;
  const { env } = await import('cloudflare:workers');
  const bindings = env as unknown as OperationalBindings & { EMDASH_SITE_URL?: string };
  const db = availableOperationalDatabase(bindings,bindings.EMDASH_SITE_URL ?? '');
  if (db && bindings.DB) await reconcileCatalog(bindings.DB,db,[event.collection === 'courses' ? 'course' : 'blog']);
}

type Service = (db: D1Database, user: RouteContext['user'], input: unknown) => Promise<unknown>;
function route(permission: 'comments:moderate'|'settings:manage', method: 'GET'|'POST', service: Service): PluginRoute {
  return {
    methods: [method], permission, public: false,
    request: { body: method === 'GET' ? 'none' as const : 'json' as const, maxBytes: 32768 },
    handler: async (ctx: RouteContext) => {
      const { env } = await import('cloudflare:workers');
      const db = availableOperationalDatabase(env as unknown as OperationalBindings, ctx.request.url);
      if (!db) {
        throw new PluginRouteError('SABLY_UNAVAILABLE','Operaciones no disponibles: verifica la activación del entorno y el binding independiente SABLY_DB.',503);
      }
      try { return { ok: true, data: await service(db, ctx.user, ctx.input) }; }
      catch (error) {
        if (error instanceof OperationsError) throw new PluginRouteError('SABLY_OPERATION_REJECTED',error.message,error.status);
        ctx.log.error('Sably operations failed; verify operational migrations and bindings.');
        throw PluginRouteError.internal('No se pudo completar la operación. Revisa las migraciones de SABLY_DB.');
      }
    },
  };
}
export function createPlugin() {
  return definePlugin({
    id: 'sably-operations', version: '1.0.0', capabilities: ['content:read','email:send'],
    hooks: {
      'content:afterSave': catalogChanged,
      'content:afterPublish': catalogChanged,
      'content:afterUnpublish': catalogChanged,
      'content:afterDelete': catalogChanged,
      'content:afterRestore': catalogChanged,
    },
    admin: { pages: [{ path: '/operations', label: 'Sably · operaciones', icon: 'sliders' }], settingsSchema: {
      notificationEmail: {type:'email',label:'Correo del equipo',description:'Destinatario de nuevas solicitudes y dirección de respuesta para recuperación. Vacío: no se envían correos operativos. El remitente y la clave se configuran en el proveedor seleccionado en Ajustes → Correo.'},
    } },
    routes: {
      summary: route('comments:moderate','GET',summary),
      leads: route('settings:manage','GET',listLeads),
      reviews: route('comments:moderate','GET',listReviews),
      moderate: route('comments:moderate','POST',moderate),
      ratings: route('comments:moderate','GET',ratings),
      promos: route('settings:manage','GET',listPromos),
      'save-promo': route('settings:manage','POST',savePromo),
      widgets: route('settings:manage','GET',getWidgets),
      'save-widget': route('settings:manage','POST',saveWidget),
    },
  });
}
