import { definePlugin, PluginRouteError } from 'emdash';
import { env } from 'cloudflare:workers';
import type { OperationalBindings } from '../../lib/operational-environment';
import { operationalEnvironmentEnabled } from '../../lib/operational-environment';
import { settingsSchema, validateUpdates, adminConfig, readPublic, trackingFragments } from './model';
export function createPlugin(){
  return definePlugin({
    id:'sably-integrations',version:'1.0.0',capabilities:['hooks.page-fragments:register'],
    admin:{pages:[{path:'/integrations',label:'Sably · integraciones',icon:'settings'}],settingsSchema},
    routes:{
      config:{methods:['GET'],permission:'plugins:manage',request:{body:'none'},handler:async ctx=>({...await adminConfig(ctx.settings),environment:(env as OperationalBindings).SABLY_ENVIRONMENT})},
      save:{methods:['POST'],permission:'plugins:manage',request:{body:'json',maxBytes:32768},handler:async ctx=>{
        let updates;
        try{updates=validateUpdates(ctx.input);}catch(error){throw PluginRouteError.badRequest(error instanceof Error?error.message:'Revisa los campos.');}
        for(const [key,value] of Object.entries(updates))await ctx.settings.set(key,value);
        return adminConfig(ctx.settings);
      }},
    },
    hooks:{'page:fragments':async({page},ctx)=>{
      if((env as OperationalBindings).SABLY_ENVIRONMENT!=='production'||!operationalEnvironmentEnabled(env,page.url)||new URL(page.url).pathname.startsWith('/_emdash'))return null;
      return trackingFragments(await readPublic(ctx.settings),true);
    }},
  });
}
