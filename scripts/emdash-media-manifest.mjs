#!/usr/bin/env node
/** Inventory only: no downloads, uploads, remote requests, or storage mutations. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imageTypes = new Map([
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.webp', 'image/webp'],
  ['.gif', 'image/gif'], ['.avif', 'image/avif'], ['.svg', 'image/svg+xml'], ['.ico', 'image/x-icon'],
]);

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat().sort();
}

export async function buildMediaManifest(seed) {
  const manifest = new Map();
  function add(url, source, details = {}) {
    const existing = manifest.get(url) ?? {
      url, filename: decodeURIComponent(new URL(url).pathname.split('/').at(-1)), sources: [],
    };
    Object.assign(existing, details);
    if (!existing.sources.includes(source)) existing.sources.push(source);
    manifest.set(url, existing);
  }
  function inspect(value, path) {
    if (!value || typeof value !== 'object') return;
    if (value.$media) add(value.$media.url, path, { alt: value.$media.alt ?? '', filename: value.$media.filename });
    for (const [key, child] of Object.entries(value)) inspect(child, `${path}.${key}`);
  }
  inspect(seed.content, 'content');
  const countryHeroUrls = new Map((seed.content.countries ?? []).map((entry) => [entry.slug, entry.data.hero_image?.$media?.url]));
  let localImages = 0;
  for (const path of await files(join(root, 'public'))) {
    const mimeType = imageTypes.get(extname(path).toLowerCase());
    if (!mimeType) continue;
    const assetPath = relative(join(root, 'public'), path).replaceAll('\\', '/');
    const country = assetPath.match(/^heroes\/([a-z]{2})\.webp$/)?.[1];
    const url = country && countryHeroUrls.get(country) ? countryHeroUrls.get(country)
      : assetPath.startsWith('covers/') ? `https://cdn.sably.co/${assetPath}` : `https://sably.co/${assetPath}`;
    const bytes = await readFile(path);
    add(url, `public/${assetPath}`, {
      localPath: `public/${assetPath}`, bytes: bytes.length, mimeType,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    localImages++;
  }
  const assets = [...manifest.values()].sort((a, b) => a.url.localeCompare(b.url));
  for (const asset of assets) asset.sources.sort();
  return {
    version: 1, kind: 'sably-media-inventory',
    counts: { assets: assets.length, localImages, seedReferencedAssets: assets.filter((asset) => asset.sources.some((source) => source.startsWith('content.'))).length, externalOnly: assets.filter((asset) => !asset.localPath).length },
    assets,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const seedPath = args[0] ?? '.emdash/migration-content.seed.json';
  const output = resolve(root, args[1] ?? '.emdash/media-manifest.json');
  const result = await buildMediaManifest(JSON.parse(await readFile(resolve(root, seedPath), 'utf8')));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ...result.counts, output: relative(root, output) }, null, 2));
}
