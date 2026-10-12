import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Kysely } from 'kysely';
import { OptionsRepository } from 'emdash';
import { createDialect } from 'emdash/db/sqlite';
import { integrationSettings } from '../src/lib/integration-settings';
import { resolveLegacyApiRuntime, type RuntimeAccess } from '../src/lib/legacy-api-runtime';

const operational={prepare(){},batch(){}} as unknown as D1Database;
const production={SABLY_ENVIRONMENT:'production',SABLY_CMS_READY:'true',SABLY_PRODUCTION_ACTIVATED:'true',SABLY_DB:operational,EMDASH_ENCRYPTION_KEY:'emdash_enc_v1_'+Buffer.alloc(32,7).toString('base64url')};
const webhookUrl='https://sably.co/api/hotmart-webhook',leadsUrl='https://sably.co/api/v1/leads';

/** EmDash's options table on its SQLite dialect: what an anonymous request must reach without `locals.emdash.db`. */
async function runtime(email:unknown=null) {
  const db=new Kysely<any>({dialect:createDialect({url:':memory:'})});
  await db.schema.createTable('options').addColumn('name','text',col=>col.primaryKey()).addColumn('value','text',col=>col.notNull())
    .addColumn('revision','text',col=>col.notNull().defaultTo('0')).execute();
  let opened=0;
  const access:RuntimeAccess=async run=>{opened++;return run({db,email} as never);};
  return {db,access,opened:()=>opened};
}
const unreachable:RuntimeAccess=async()=>assert.fail('The runtime must not be opened');

test('Hotmart is anonymous: the webhook reads its token from the runtime, not from request locals',async()=>{
  const r=await runtime();
  await (await integrationSettings(r.db,production)).set('hotmartHottok','FAKE_HOTTOK');
  for(const path of ['hotmart-webhook','hotmart-webhook/']) {
    const {bindings,mail}=await resolveLegacyApiRuntime(path,production,webhookUrl,r.access);
    assert.equal(bindings.SABLY_HOTMART_HOTTOK,'FAKE_HOTTOK');assert.equal(mail,undefined);
  }
  assert.equal(r.opened(),2);
  const stored=await r.db.selectFrom('options').select('value').execute();
  assert.doesNotMatch(JSON.stringify(stored),/FAKE_HOTTOK/);
  await r.db.destroy();
});
test('the runtime stays closed outside activated production and for routes without CMS settings',async()=>{
  const development={...production,SABLY_ENVIRONMENT:'development'},inactive={...production,SABLY_PRODUCTION_ACTIVATED:'false'};
  for(const [path,bindings,url] of [['hotmart-webhook',development,'https://dev.sably.co/api/hotmart-webhook'],['hotmart-webhook',production,'https://dev.sably.co/api/hotmart-webhook'],
    ['hotmart-webhook',inactive,webhookUrl],['v1/leads',development,'https://dev.sably.co/api/v1/leads'],['v1/catalogo',production,'https://sably.co/api/v1/catalogo']] as const) {
    assert.deepEqual(await resolveLegacyApiRuntime(path,bindings,url,unreachable),{bindings});
  }
});
test('an anonymous contact notifies the team through the runtime mail pipeline',async()=>{
  const sent:unknown[]=[];
  const r=await runtime({isAvailable:()=>true,send:async(message:unknown,source:string)=>{sent.push({message,source});}});
  await new OptionsRepository(r.db).set('plugin:sably-operations:settings:notificationEmail','team@example.invalid');
  for(const path of ['v1/leads','v1/abandonos-notify']) {
    const {bindings,mail}=await resolveLegacyApiRuntime(path,production,leadsUrl,r.access);
    assert.equal(bindings,production);assert.equal(mail?.notificationEmail,'team@example.invalid');
  }
  const {mail}=await resolveLegacyApiRuntime('v1/leads',production,leadsUrl,r.access);
  await mail!.send({to:mail!.notificationEmail,subject:'Synthetic',text:'Synthetic test'});
  assert.deepEqual(sent,[{message:{to:'team@example.invalid',subject:'Synthetic',text:'Synthetic test'},source:'sably-operations'}]);
  await r.db.destroy();
});
test('an unavailable runtime never loses a contact and fails the webhook closed',async(t)=>{
  const log=t.mock.method(console,'error',()=>{});
  const failing:RuntimeAccess=async()=>{throw new Error('Synthetic runtime failure');};
  assert.deepEqual(await resolveLegacyApiRuntime('v1/leads',production,leadsUrl,failing),{bindings:production});
  assert.equal(log.mock.callCount(),1);assert.doesNotMatch(String(log.mock.calls[0]!.arguments),/Synthetic runtime failure/);
  await assert.rejects(resolveLegacyApiRuntime('hotmart-webhook',production,webhookUrl,failing),/Synthetic runtime failure/);
});
