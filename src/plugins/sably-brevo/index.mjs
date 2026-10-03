import { fileURLToPath } from 'node:url';
export const manifest = {
  id: 'sably-brevo', version: '1.0.0',
  capabilities: ['network:request','hooks.email-transport:register'],
  allowedHosts: ['api.brevo.com'],
  hooks: [{name:'email:deliver',exclusive:true}],
  routes: [], storage: {},
  admin: {settingsSchema: {
    apiKey: {type:'secret',label:'Clave API de Brevo',description:'Clave API transaccional de Brevo. EmDash la guarda cifrada; no es la contraseña SMTP.'},
    fromEmail: {type:'email',label:'Correo del remitente',description:'Dirección verificada en Brevo, por ejemplo contacto@sably.co.'},
    fromName: {type:'string',label:'Nombre del remitente',default:'Sably'},
  }},
};
export function brevoPlugin() {
  return {id:manifest.id,version:manifest.version,format:'standard',entrypoint:fileURLToPath(new URL('./backend.js',import.meta.url)),
    capabilities:manifest.capabilities,allowedHosts:manifest.allowedHosts,hooks:manifest.hooks,routes:manifest.routes,storage:manifest.storage,settingsSchema:manifest.admin.settingsSchema};
}
