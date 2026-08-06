/** Regenera src/lib/course-covers.ts a partir de public/covers/cursos/. */
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../public/covers/cursos/', import.meta.url));
const slugs = [...new Set(
  readdirSync(dir).filter((f) => f.endsWith('.jpg') && !f.endsWith('-card.jpg')).map((f) => f.replace('.jpg', '')),
)].sort();

const header = `/**
 * Manifiesto de portadas únicas por curso (generado por scripts/build-cover-manifest.mjs).
 *
 * Se commitea porque \`existsSync(import.meta.url)\` NO funciona dentro del bundle de
 * Astro: al empaquetar, import.meta.url deja de apuntar a src/lib/ y el chequeo siempre
 * fallaba, cayendo al cover de categoría. Un set estático es determinístico.
 */
export const COURSE_COVERS = new Set<string>([
`;
writeFileSync(fileURLToPath(new URL('../src/lib/course-covers.ts', import.meta.url)),
  header + slugs.map((s) => `  '${s}',`).join('\n') + '\n]);\n');
console.log(`manifiesto: ${slugs.length} portadas`);
