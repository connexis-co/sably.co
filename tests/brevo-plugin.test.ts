import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { brevoPlugin, manifest } from '../src/plugins/sably-brevo/index.mjs';
import upstream from '../src/plugins/sably-brevo/backend.js';
import { generateSandboxedPluginsModule } from '../node_modules/emdash/src/astro/integration/virtual-modules.ts';
import { createSandboxedPluginProxy } from '../node_modules/emdash/src/plugins/sandbox/proxy.ts';
import { HookPipeline } from 'emdash';
import { EmailPipeline } from '../node_modules/emdash/src/plugins/email.ts';
import { createSettingsAccess, isEncryptedPluginSetting, decryptPluginSetting } from '../node_modules/emdash/src/plugins/settings.ts';
import { parseEncryptionKeys } from '../node_modules/emdash/src/config/secrets.ts';
import type { OptionsRepository } from '../node_modules/emdash/src/database/repositories/options.ts';

const root = new URL('../', import.meta.url);
const code = readFileSync(new URL('../src/plugins/sably-brevo/backend.js',import.meta.url),'utf8');
test('Brevo embeds its reviewed local implementation in the sandbox', async () => {
  const descriptor = brevoPlugin();
  assert.deepEqual(descriptor.capabilities, ['network:request', 'hooks.email-transport:register']);
  assert.deepEqual(descriptor.allowedHosts, ['api.brevo.com']);
  assert.deepEqual(descriptor.hooks, [{ name: 'email:deliver', exclusive: true }]);
  assert.deepEqual(descriptor.routes, []);
  const module = generateSandboxedPluginsModule([descriptor], fileURLToPath(root));
  const { sandboxedPlugins } = await import(`data:text/javascript;base64,${Buffer.from(module).toString('base64')}`);
  assert.equal(sandboxedPlugins.length, 1);
  assert.equal(sandboxedPlugins[0].code, code);
  assert.equal(sandboxedPlugins[0].settingsSchema.apiKey.type, 'secret');
  assert.equal(sandboxedPlugins[0].settingsSchema.fromEmail.type, 'email');
  for (const file of ['wrangler.jsonc', 'config/wrangler.production.jsonc']) {
    const config = JSON.parse(readFileSync(new URL(file, root), 'utf8'));
    assert.deepEqual(config.worker_loaders, [{ binding: 'LOADER' }]);
  }
});

test('sandbox proxy is discoverable as the sole email provider without invoking transport', async () => {
  const plugin = createSandboxedPluginProxy(manifest, {
    id: 'sably-brevo:1.0.0',
    async invokeHook() { assert.fail('Provider discovery must not deliver mail'); },
    async invokeRoute() { assert.fail('Brevo has no routes'); },
    async terminate() {},
  });
  const pipeline = new HookPipeline([plugin]);
  assert.deepEqual(pipeline.getExclusiveHookProviders('email:deliver'), [{ pluginId: 'sably-brevo' }]);
  const email = new EmailPipeline(pipeline);
  assert.equal(email.isAvailable(), false);
  pipeline.setExclusiveSelection('email:deliver', 'sably-brevo');
  // Selection makes the provider available; it does not mean credentials exist.
  assert.equal(email.isAvailable(), true);
  assert.equal(pipeline.getExclusiveSelection('email:deliver'), 'sably-brevo');
});

test('native settings encrypt the Brevo key before persistence and bind it to plugin and field', async () => {
  const keys = await parseEncryptionKeys(`emdash_enc_v1_${Buffer.alloc(32, 7).toString('base64url')}`);
  const stored = new Map<string, unknown>();
  const repo = { async get(key: string) { return stored.get(key) ?? null; }, async set(key: string, value: unknown) { stored.set(key, value); } } as unknown as OptionsRepository;
  const settings = createSettingsAccess(repo, 'sably-brevo', brevoPlugin().settingsSchema, keys);
  const fakeKey = 'TEST_ONLY_NOT_A_BREVO_CREDENTIAL';
  await settings.set('apiKey', fakeKey);
  await settings.set('fromEmail', 'sender@example.invalid');
  const envelope = stored.get('plugin:sably-brevo:settings:apiKey');
  assert.ok(isEncryptedPluginSetting(envelope));
  assert.ok(!JSON.stringify([...stored]).includes(fakeKey));
  assert.equal(await settings.get('apiKey'), fakeKey);
  assert.equal(await settings.get('fromEmail'), 'sender@example.invalid');
  await assert.rejects(decryptPluginSetting('another-plugin', 'apiKey', envelope, keys), /could not be decrypted/);
  await assert.rejects(decryptPluginSetting('sably-brevo', 'another-field', envelope, keys), /could not be decrypted/);
  const noEncryption = createSettingsAccess(repo, 'sably-brevo', brevoPlugin().settingsSchema, null);
  await assert.rejects(noEncryption.set('apiKey', fakeKey), /EMDASH_ENCRYPTION_KEY/);
});

const message = { to: 'recipient@example.invalid', cc: ['copy@example.invalid'], replyTo: 'reply@example.invalid', subject: 'Local test', text: 'Plain text', html: '<p>Plain text</p>' };
const logs: unknown[][] = [];
const log = { info: (...args: unknown[]) => logs.push(args), error: (...args: unknown[]) => logs.push(args) };

test('Brevo preserves recipient, cc and reply-to with only the reviewed API host (mock transport)', async () => {
  let calls = 0;
  await upstream.hooks['email:deliver'].handler({ message, source: 'sably-operations' }, {
    settings: { async get(key: string) { return key === 'apiKey' ? 'TEST_ONLY_NOT_A_BREVO_CREDENTIAL' : key === 'fromName' ? 'Sably' : 'sender@example.invalid'; } }, log,
    http: { async fetch(url: string, init: RequestInit) {
      calls++;
      assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
      assert.equal(init.method, 'POST');
      assert.deepEqual(JSON.parse(String(init.body)), { sender: {email:'sender@example.invalid',name:'Sably'}, to: [{email:message.to}], cc: message.cc.map(email=>({email})), replyTo:{email:message.replyTo}, subject: message.subject, textContent: message.text, htmlContent: message.html });
      assert.equal(new Headers(init.headers).get('api-key'), 'TEST_ONLY_NOT_A_BREVO_CREDENTIAL');
      return new Response('{"id":"mock-only"}', { status: 200 });
    } },
  });
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(logs).includes('TEST_ONLY_NOT_A_BREVO_CREDENTIAL'));
});

test('unconfigured provider refuses delivery before networking and surfaces API failure', async () => {
  await assert.rejects(upstream.hooks['email:deliver'].handler({ message, source: 'test' }, {
    settings: { async get() { return null; } }, log,
    http: { async fetch() { assert.fail('Unconfigured provider must not perform network calls'); } },
  }), /configura la clave API/);
  await assert.rejects(upstream.hooks['email:deliver'].handler({ message, source: 'test' }, {
    settings: { async get(key: string) { return key === 'apiKey' ? 'TEST_ONLY_NOT_A_BREVO_CREDENTIAL' : 'sender@example.invalid'; } }, log,
    http: { async fetch() { return new Response('{"message":"domain not verified"}', { status: 403 }); } },
  }), /HTTP 403/);
});


test('plain text is escaped for HTML fallback and malformed destinations fail before networking', async () => {
  const settings={async get(key:string){return key==='apiKey'?'TEST_ONLY_NOT_A_BREVO_CREDENTIAL':key==='fromName'?'Sably':'sender@example.invalid';}};
  await upstream.hooks['email:deliver'].handler({message:{...message,html:undefined,text:'<script>x&y</script>'}}, {settings,http:{async fetch(_url:string,init:RequestInit){assert.equal(JSON.parse(String(init.body)).htmlContent,'<pre>&lt;script&gt;x&amp;y&lt;/script&gt;</pre>');return new Response('{}',{status:201});}}});
  await assert.rejects(upstream.hooks['email:deliver'].handler({message:{...message,to:'unsafe@example.invalid\r\nBcc: hidden@example.invalid'}},{settings,http:{async fetch(){assert.fail('Invalid email must not send');}}}),/dirección de correo inválida/);
});

test('network and provider errors never disclose private details or retry', async () => {
  const settings={async get(key:string){return key==='apiKey'?'TEST_ONLY_NOT_A_BREVO_CREDENTIAL':'sender@example.invalid';}};
  let calls=0;
  await assert.rejects(upstream.hooks['email:deliver'].handler({message},{settings,http:{async fetch(){calls++;throw new Error('TEST_ONLY_NOT_A_BREVO_CREDENTIAL');}}}),error=>!String(error).includes('TEST_ONLY')&&String(error).includes('no se pudo confirmar'));
  assert.equal(calls,1);
});
