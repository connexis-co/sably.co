#!/usr/bin/env node
// ============================================================
// Sincroniza el catálogo de Hotmart hacia src/data/hotmart-products.json
//
// Uso local:
//   HOTMART_CLIENT_ID=xxx HOTMART_CLIENT_SECRET=yyy node scripts/sync-hotmart.mjs
//
// En CI: workflow "Sync Hotmart" (requiere los secretos HOTMART_CLIENT_ID
// y HOTMART_CLIENT_SECRET en GitHub → Settings → Secrets → Actions).
//
// Qué hace:
//   1. Obtiene un access_token (OAuth client_credentials).
//   2. Lista los productos de la cuenta (API de productores) y, si la cuenta
//      es solo de afiliado, resume las comisiones recientes como referencia.
//   3. Escribe src/data/hotmart-products.json para consulta manual.
//
// Qué NO hace: generar enlaces de afiliado (hotlinks). Esos se copian del
// panel de Hotmart (Mercado de afiliación → Divulgar → enlace go.hotmart.com
// o pay.hotmart.com) y se pegan en el campo hotmartUrl de src/data/courses.ts.
// ============================================================

import { writeFile } from 'node:fs/promises';

const CLIENT_ID = process.env.HOTMART_CLIENT_ID;
const CLIENT_SECRET = process.env.HOTMART_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan HOTMART_CLIENT_ID y/o HOTMART_CLIENT_SECRET en el entorno.');
  process.exit(1);
}

const TOKEN_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const API = 'https://developers.hotmart.com';

async function getToken() {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const url = `${TOKEN_URL}?grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Token HTTP ${res.status}: ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

async function api(token, path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: res.ok ? await res.json() : await res.text() };
}

const token = await getToken();
console.log('✓ Autenticado contra Hotmart');

const out = { syncedAt: new Date().toISOString(), products: [], salesSample: null };

const products = await api(token, '/products/api/v1/products?max_results=50');
if (products.status === 200 && products.body.items?.length) {
  out.products = products.body.items;
  console.log(`✓ ${out.products.length} producto(s) propios encontrados:`);
  for (const p of out.products) console.log(`   - [${p.id}] ${p.name} (${p.status})`);
} else {
  console.log(`ℹ Products API: HTTP ${products.status} — la cuenta parece ser de afiliado (sin productos propios).`);
  const sales = await api(token, '/payments/api/v1/sales/history?max_results=10');
  if (sales.status === 200) {
    out.salesSample = sales.body.items ?? [];
    console.log(`✓ Últimas ${out.salesSample.length} transacciones (para verificar afiliaciones activas).`);
  } else {
    console.log(`ℹ Sales API: HTTP ${sales.status}`);
  }
}

await writeFile(
  new URL('../src/data/hotmart-products.json', import.meta.url),
  JSON.stringify(out, null, 2)
);
console.log('✓ Escrito src/data/hotmart-products.json');
console.log('\nRecuerda: los enlaces de compra (hotmartUrl en src/data/courses.ts) se copian del panel de afiliado de Hotmart.');
