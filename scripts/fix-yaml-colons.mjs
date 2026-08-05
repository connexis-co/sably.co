/**
 * En YAML, `- Texto: algo` se parsea como objeto, no como string.
 * Los ítems de listas (lessons, learnings, audience, keywords) que contienen
 * ": " deben ir entrecomillados o el schema zod los rechaza.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dirs = ['../src/content/courses/', '../src/content/blog/'];
let fixed = 0;
const touched = [];

for (const rel of dirs) {
  let dir;
  try {
    dir = fileURLToPath(new URL(rel, import.meta.url));
    readdirSync(dir);
  } catch {
    continue;
  }
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.mdx'))) {
    const path = join(dir, file);
    const text = readFileSync(path, 'utf8');
    const end = text.indexOf('\n---', 4);
    if (!text.startsWith('---') || end === -1) continue;

    const front = text.slice(0, end);
    const rest = text.slice(end);
    let count = 0;

    const patched = front
      .split('\n')
      .map((line) => {
        // ítem de lista simple con ": " sin comillas → entrecomillar
        const m = line.match(/^(\s*- )(?!["'])(.*?: .*)$/);
        if (!m) return line;
        // no tocar mappings reales (q:/a:/title:/name: al inicio del ítem)
        if (/^(q|a|title|name|bio|slug|lessons):/.test(m[2])) return line;
        count += 1;
        return `${m[1]}"${m[2].replace(/"/g, "'")}"`;
      })
      .join('\n');

    if (count > 0) {
      writeFileSync(path, patched + rest);
      fixed += count;
      touched.push(`${file} (${count})`);
    }
  }
}

console.log(`Ítems entrecomillados: ${fixed}`);
touched.forEach((t) => console.log('  ', t));
