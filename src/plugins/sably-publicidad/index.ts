import { definePlugin, PluginRouteError } from 'emdash';
import { DEFAULT_CONFIG, normalizarConfig, paginaPermitida, validarConfig, type ConfigPublicidad } from './model';
import { PUBLICIDAD_CSS, motorScript, puertaScript } from './runtime';

/**
 * Publicidad (Google AdSense) configurable desde el panel «Publicidad». APAGADO por defecto: sin
 * configuración guardada o con el interruptor apagado el hook no aporta nada y el HTML no cambia.
 *
 * El hook solo pone lo común a la página (CSS, puerta de consentimiento, motor y, si se pide, la meta de
 * verificación). Los huecos los pintan los componentes `HuecoPublicidad` y `PublicidadEnTexto` donde la plantilla
 * los coloque; cada uno decide con la misma configuración si se pinta.
 */
export const CLAVE_CONFIG = 'config';

export function fragmentosPublicidad(config: ConfigPublicidad, page: { pageType: string; url: string }) {
  const ruta = new URL(page.url).pathname;
  const fragmentos: { kind: 'html' | 'inline-script'; placement: 'head' | 'body:end'; key: string; html?: string; code?: string }[] = [];
  if (config.metaVerificacion && config.cliente && !ruta.startsWith('/_emdash')) {
    fragmentos.push({ kind: 'html', placement: 'head', key: 'sably-publicidad-meta', html: `<meta name="google-adsense-account" content="${config.cliente}">` });
  }
  if (paginaPermitida(config, page.pageType, ruta)) {
    fragmentos.push(
      { kind: 'html', placement: 'head', key: 'sably-publicidad-css', html: `<style>${PUBLICIDAD_CSS}</style>` },
      { kind: 'inline-script', placement: 'head', key: 'sably-publicidad-puerta', code: puertaScript(config) },
      { kind: 'inline-script', placement: 'body:end', key: 'sably-publicidad-motor', code: motorScript(config) },
    );
  }
  return fragmentos;
}

export function createPlugin() {
  return definePlugin({
    id: 'sably-publicidad', version: '1.0.0', capabilities: ['hooks.page-fragments:register'],
    admin: { pages: [{ path: '/publicidad', label: 'Publicidad', icon: 'megaphone' }] },
    routes: {
      config: { methods: ['GET'], permission: 'settings:manage', request: { body: 'none' }, handler: async ctx => ({ config: normalizarConfig(await ctx.kv.get(CLAVE_CONFIG)) }) },
      save: { methods: ['POST'], permission: 'settings:manage', request: { body: 'json', maxBytes: 65536 }, handler: async ctx => {
        let config: ConfigPublicidad;
        try { config = validarConfig(ctx.input); }
        catch (error) { throw PluginRouteError.badRequest(error instanceof Error ? error.message : 'Configuración inválida.'); }
        await ctx.kv.set(CLAVE_CONFIG, config);
        return { config };
      } },
      defaults: { methods: ['GET'], permission: 'settings:manage', request: { body: 'none' }, handler: async () => ({ config: DEFAULT_CONFIG }) },
    },
    hooks: {
      'page:fragments': async ({ page }, ctx) => {
        const guardada = await ctx.kv.get(CLAVE_CONFIG);
        if (!guardada) return null;
        const fragmentos = fragmentosPublicidad(normalizarConfig(guardada), page);
        return fragmentos.length ? (fragmentos as never) : null;
      },
    },
  });
}
