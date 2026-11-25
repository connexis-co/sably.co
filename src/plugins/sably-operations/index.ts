import { definePlugin, PluginRouteError, type PluginRoute, type RouteContext } from 'emdash';
import { getWidgets, listLeads, listPromos, listReviews, moderate, OperationsError, ratings, savePromo, saveWidget, summary } from './service';
import { availableOperationalDatabase, type OperationalBindings } from '../../lib/operational-environment';
import { reconcileCatalog } from './catalog';

async function catalogChanged(event: { collection: string }) {
  if (!['courses','blog'].includes(event.collection)) return;
  const { env } = await import('virtual:sably-runtime');
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
      const { env } = await import('virtual:sably-runtime');
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
      temaPorDefecto: {type:'select',label:'Tema del sitio',description:'Diseño que ven todos los visitantes. Clásico es el de siempre; V2 es el rediseño. Para revisar sin cambiarlo a nadie: añade ?tema=v2 o ?tema=clasico a cualquier URL (esa vista no se indexa ni se guarda en caché). Si queda vacío manda la variable SABLY_TEMA_POR_DEFECTO del servidor. El cambio llega al público en unos minutos.',options:[{value:'clasico',label:'Clásico'},{value:'v2',label:'V2 (rediseño)'}],default:'clasico'},
      cajaVariante: {type:'select',label:'V2 · Caja de compra',description:'«Cuenta clara» enseña la cuenta que verá Hotmart (precio normal, cupón y lo que pagas hoy). «Cabecera oscura» pone la campaña arriba, para los picos del año.',options:[{value:'cuenta-clara',label:'Cuenta clara'},{value:'cabecera-oscura',label:'Cabecera oscura'}],default:'cuenta-clara'},
      cajaContador: {type:'select',label:'V2 · Contador de la campaña',description:'Solo aparece con una campaña con fecha de fin; usa esa fecha y nunca se reinicia.',options:[{value:'barra',label:'Barra que recorre la campaña'},{value:'casillas',label:'Casillas (días, horas, minutos)'},{value:'linea',label:'Una línea de texto'},{value:'tique',label:'Dentro del tique del cupón'}],default:'barra'},
      cajaTitulo: {type:'string',label:'V2 · Título de la caja',description:'Plantilla con {curso}, {lecciones}, {horas}, {pais} y {descuento}. Vacío: sin título. Sin cifras inventadas ni urgencia.',default:'Empieza {curso}'},
      cajaSubtitulo: {type:'string',label:'V2 · Subtítulo de la caja',description:'Misma plantilla que el título. Vacío: sin subtítulo.',default:'{lecciones} lecciones en vídeo, a tu ritmo.'},
      mostrarCreador: {type:'boolean',label:'V2 · Mostrar quién dicta el curso',description:'«Lo dicta …» en la cabeza de la ficha y en la caja. Apagado no deja hueco.',default:true},
      estiloCampo: {type:'select',label:'V2 · Estilo de los campos de formulario',options:[{value:'outlined',label:'Contorno'},{value:'filled',label:'Relleno'},{value:'underline',label:'Subrayado'}],default:'outlined'},
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
