import { gate, protectResponse, type StagingAccessEnv } from './staging-access';
export interface RuntimeEnvironment extends StagingAccessEnv { SABLY_ENVIRONMENT?:string }
/** Environment bindings determine access. A different hostname never bypasses staging. */
export async function gateEnvironment(request:Request,env:RuntimeEnvironment):Promise<Response|null> {
 if(env.SABLY_ENVIRONMENT==='production')return null;
 if(env.SABLY_ENVIRONMENT==='development')return gate(request,env);
 return protectResponse(new Response('Runtime environment is not configured',{status:503}));
}
export function protectEnvironmentResponse(response:Response,env:RuntimeEnvironment):Response {
 return env.SABLY_ENVIRONMENT==='production'?response:protectResponse(response);
}
