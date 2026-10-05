import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaults, settingsSchema, validateUpdates, readPublic, adminConfig, trackingFragments, resolveIntegrationBindings } from '../src/plugins/sably-integrations/model';
import { integrationSettings } from '../src/lib/integration-settings';
import { createSettingsAccess, resolvePluginEncryptionKeys } from 'emdash/internal/plugins/host';
import type { OptionsRepository, SettingsAccess } from 'emdash';
const reader=(values:Record<string,unknown>):Pick<SettingsAccess,'get'>=>({async get<T>(key:string){return (values[key]??null) as T|null;}});
const configured={...defaults,browserMode:'gtm' as const,gtmId:'GTM-ABCDEFGH',ga4Id:'G-ABCDEFGHIJ',metaPixelId:'123456789',serverConversions:true};
const secretValues={ga4ApiSecret:'FAKE_GA4',metaCapiToken:'FAKE_META',hotmartHottok:'FAKE_HOTTOK'};
test('IDs reject pasted snippets, credentials, unexpected keys and invalid types',()=>{
  for(const input of [{gtmId:"GTM-X';alert(1)//"},{ga4Id:'<script>bad</script>'},{metaPixelId:'abc123'},{serverConversions:'true'},{arbitraryScript:'anything'},{browserMode:'both'}])assert.throws(()=>validateUpdates(input));
  assert.deepEqual(validateUpdates({gtmId:' GTM-ABCDEFGH '}),{gtmId:'GTM-ABCDEFGH'});
});
test('Tag Manager has one loader and no duplicate direct GA4 or Meta install',()=>{
  const output=JSON.stringify(trackingFragments(configured,true));
  assert.match(output,/gtm\.js/);assert.match(output,/ns\.html/);
  // Deferred by default: GTM waits for load + idle or the first interaction.
  assert.match(output,/requestIdleCallback/);assert.match(output,/addEventListener\('load'/);assert.match(output,/GTM-ABCDEFGH/);
  const immediate=JSON.stringify(trackingFragments({...configured,gtmDelay:false},true));
  assert.match(immediate,/gtm\.js/);assert.doesNotMatch(immediate,/requestIdleCallback/);
  // Cloudflare's Google tag gateway may already have injected the same container.
  for(const snippet of [output,immediate])assert.match(snippet,/google_tags_first_party/);
  assert.throws(()=>validateUpdates({gtmDelay:'true'}));assert.deepEqual(validateUpdates({gtmDelay:false}),{gtmDelay:false});
  assert.doesNotMatch(output,/gtag\/js|fbevents\.js|G-ABCDEFGHIJ|FAKE_/);
  const direct=JSON.stringify(trackingFragments({...configured,browserMode:'direct'},true));
  assert.match(direct,/gtag\/js/);assert.match(direct,/fbevents\.js/);assert.doesNotMatch(direct,/gtm\.js|ns\.html/);
  assert.deepEqual(trackingFragments(configured,false),[]);
  assert.deepEqual(trackingFragments({...configured,browserMode:'off'},true),[]);
});
test('invalid settings written via the generic CMS form fail closed at rendering',async()=>{
  const config=await readPublic(reader({...configured,gtmId:'<img onerror=alert(1)>',ga4Id:'bad',metaPixelId:'bad'}));
  assert.equal(config.gtmId,'');assert.deepEqual(trackingFragments(config,true),[]);
});
test('admin response exposes presence but never plaintext secrets; fresh edits are visible',async()=>{
  const values={...configured,...secretValues};const access=reader(values);
  assert.deepEqual((await adminConfig(access)).secretsSet,{ga4ApiSecret:true,metaCapiToken:true,hotmartHottok:true});
  assert.doesNotMatch(JSON.stringify(await adminConfig(access)),/FAKE_/);
  values.gtmId='GTM-UPDATED1';assert.equal((await readPublic(access)).gtmId,'GTM-UPDATED1');
  values.hotmartHottok='';assert.equal((await adminConfig(access)).secretsSet.hotmartHottok,false);
});
test('development and wrong host cannot read production integration credentials',async()=>{
  const access:Pick<SettingsAccess,'get'>={async get(){assert.fail('No credential read in development');}};
  for(const [bindings,url] of [[{SABLY_ENVIRONMENT:'development'},'https://dev.sably.co'],[{SABLY_ENVIRONMENT:'production',SABLY_CMS_READY:'true',SABLY_PRODUCTION_ACTIVATED:'true'},'https://dev.sably.co']] as const){assert.equal(await resolveIntegrationBindings(bindings,url,access),bindings);}
});
test('server conversions use current CMS keys and explicit disable ignores legacy secrets',async()=>{
  const bindings={SABLY_ENVIRONMENT:'production',SABLY_CMS_READY:'true',SABLY_PRODUCTION_ACTIVATED:'true',SABLY_META_CAPI_TOKEN:'OLD_META',SABLY_HOTMART_HOTTOK:'OLD_HOTTOK'};
  const result=await resolveIntegrationBindings(bindings,'https://sably.co/api/hotmart-webhook',reader({...configured,...secretValues}));
  assert.equal(result.SABLY_HOTMART_HOTTOK,'FAKE_HOTTOK');assert.equal(result.SABLY_META_CAPI_TOKEN,'FAKE_META');assert.equal(result.SABLY_GA4_MEASUREMENT_ID,configured.ga4Id);
  const off=await resolveIntegrationBindings(bindings,'https://sably.co/',reader({...configured,...secretValues,serverConversions:false,hotmartHottok:''}));
  assert.equal(off.SABLY_META_CAPI_TOKEN,undefined);assert.equal(off.SABLY_GA4_API_SECRET,undefined);assert.equal(off.SABLY_HOTMART_HOTTOK,'');
});
test('EmDash native encryption protects every integration key at rest',async()=>{
  const stored=new Map<string,unknown>();
  const repo={async get(key:string){return stored.get(key)??null;},async set(key:string,value:unknown){stored.set(key,value)}} as unknown as OptionsRepository;
  const env={EMDASH_ENCRYPTION_KEY:'emdash_enc_v1_'+Buffer.alloc(32,7).toString('base64url')};
  const settings=createSettingsAccess(repo,'sably-integrations',settingsSchema,await resolvePluginEncryptionKeys(env));
  for(const [key,value] of Object.entries(secretValues)){await settings.set(key,value);assert.equal(await settings.get(key),value);}
  assert.doesNotMatch(JSON.stringify([...stored]),/FAKE_/);
  assert.equal(typeof integrationSettings,'function');
});
