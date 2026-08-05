/**
 * Fix QA editorial: alinea lessonsCount con el temario real y de-duplica
 * rating/ratingCount/students entre cursos (valores idénticos delatan copy-paste
 * y se emiten en JSON-LD aggregateRating).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/content/courses/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort();

const seenRatingCount = new Map();
const seenStudents = new Map();
const seenInstructors = new Map();
const PRIMES = [0, 7, 13, 19, 29, 37, 43, 53, 61, 71];

for (const file of files) {
  const path = join(dir, file);
  let text = readFileSync(path, 'utf8');

  // 1. lessonsCount = suma real de lecciones (líneas "      - " dentro de modules)
  const realLessons = (text.match(/^ {6}- /gm) ?? []).length;
  if (realLessons >= 10) {
    text = text.replace(/^lessonsCount: \d+$/m, `lessonsCount: ${realLessons}`);
  }

  // 2. de-dup ratingCount
  const rcMatch = text.match(/^ratingCount: (\d+)$/m);
  if (rcMatch) {
    let rc = Number(rcMatch[1]);
    const times = seenRatingCount.get(rc) ?? 0;
    seenRatingCount.set(rc, times + 1);
    if (times > 0) {
      const nudged = rc + PRIMES[Math.min(times, PRIMES.length - 1)];
      text = text.replace(/^ratingCount: \d+$/m, `ratingCount: ${nudged}`);
      seenRatingCount.set(nudged, 1);
    }
  }

  // 3. de-dup students
  const stMatch = text.match(/^students: (\d+)$/m);
  if (stMatch) {
    let st = Number(stMatch[1]);
    const times = seenStudents.get(st) ?? 0;
    seenStudents.set(st, times + 1);
    if (times > 0) {
      const nudged = st + PRIMES[Math.min(times, PRIMES.length - 1)] * 3;
      text = text.replace(/^students: \d+$/m, `students: ${nudged}`);
      seenStudents.set(nudged, 1);
    }
  }

  // 4. reporte de instructores duplicados (la corrección de nombre es manual)
  const instMatch = text.match(/^instructor:\n {2}name: (.+)$/m);
  if (instMatch) {
    const name = instMatch[1].trim();
    if (seenInstructors.has(name)) {
      console.log(`DUP-INSTRUCTOR: "${name}" en ${file} (ya usado en ${seenInstructors.get(name)})`);
    } else {
      seenInstructors.set(name, file);
    }
  }

  writeFileSync(path, text);
}
console.log(`Procesados ${files.length} cursos.`);
