import { gate, protectResponse, type StagingAccessEnv } from './staging-access';
export interface RuntimeEnvironment extends StagingAccessEnv {
 SABLY_ENVIRONMENT?:string;
 SABLY_SETUP_PASSWORD?:string;
 DB?:D1Database;
}
/** Restrict the native first-owner wizard until the owner registers a passkey.
 * This adds a gate; it never creates a user or bypasses EmDash authentication. */
async function gateProductionSetup(request:Request,env:RuntimeEnvironment):Promise<Response|null>{
 let path:string;
 try{path=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Invalid URL',{status:400});}
 if(!/^\/_emdash\/(?:api\/setup|admin\/setup)(?:\/|$)/.test(path))return null;
 if(!env.DB)return protectResponse(new Response('Setup is not available',{status:503}));
 try{
  const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first<{count:number}>();
  if(row&&row.count>0)return null;
 }catch{return protectResponse(new Response('Setup is not available',{status:503}));}
 const denied=await gate(request,{SABLY_DEV_PASSWORD:env.SABLY_SETUP_PASSWORD});
 if(!denied)return null;
 const headers=new Headers(denied.headers);
 if(denied.status===401)headers.set('WWW-Authenticate','Basic realm="Sably initial setup", charset="UTF-8"');
 return new Response('Initial setup requires the site owner.',{status:denied.status,headers});
}
/** Environment bindings determine access. A different hostname never bypasses staging. */
export async function gateEnvironment(request:Request,env:RuntimeEnvironment):Promise<Response|null> {
 if(env.SABLY_ENVIRONMENT==='production')return gateProductionSetup(request,env);
 if(env.SABLY_ENVIRONMENT==='development')return gate(request,env);
 return protectResponse(new Response('Runtime environment is not configured',{status:503}));
}
export function protectEnvironmentResponse(response:Response,env:RuntimeEnvironment):Response {
 return env.SABLY_ENVIRONMENT==='production'?response:protectResponse(response);
}
