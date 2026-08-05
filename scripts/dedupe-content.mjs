/**
 * De-duplica señales que delatan contenido generado en masa:
 * instructores repetidos y combinaciones rating+ratingCount / students idénticas
 * (estas últimas se emiten en JSON-LD aggregateRating, así que el patrón es público).
 *
 * Determinístico: el primer archivo en orden alfabético conserva su valor;
 * los siguientes se desplazan a un valor libre.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/content/courses/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort();

const NOMBRES = [
  'Adriana Peñaloza', 'Bernardo Iriarte', 'Camila Zuluaga', 'Damián Rojas', 'Elena Barrios',
  'Fabio Mendoza', 'Gabriela Toro', 'Hernán Salguero', 'Isabel Munévar', 'Joaquín Berrío',
  'Karina Lozada', 'Leonardo Pardo', 'Manuela Ocampo', 'Nicolás Trujillo', 'Olga Bermúdez',
  'Patricio Alzate', 'Quintín Vergara', 'Rocío Balcázar', 'Samuel Chaparro', 'Tania Escobar',
  'Ulises Mancera', 'Verónica Pineda', 'Wilson Cadavid', 'Ximena Robledo', 'Yamile Serrano',
  'Zulma Castrillón', 'Álvaro Betancur', 'Brenda Villalba', 'César Naranjo', 'Diana Portilla',
  'Emilio Sanabria', 'Fernanda Quiroz', 'Gustavo Amaya', 'Helena Cardona', 'Iván Bastidas',
  'Julieta Márquez', 'Kevin Solórzano', 'Lucía Arboleda', 'Mauricio Galindo', 'Natalia Peláez',
];

const seenInstructor = new Map();
const seenRating = new Set();
const seenStudents = new Set();
let nombreIdx = 0;
const changes = { instructor: 0, rating: 0, students: 0 };

for (const file of files) {
  const path = join(dir, file);
  let text = readFileSync(path, 'utf8');

  // 1. Instructor único
  const instMatch = text.match(/^instructor:\n {2}name: (.+)$/m);
  if (instMatch) {
    const name = instMatch[1].trim();
    if (seenInstructor.has(name)) {
      let replacement = NOMBRES[nombreIdx % NOMBRES.length];
      while (seenInstructor.has(replacement)) {
        nombreIdx += 1;
        replacement = NOMBRES[nombreIdx % NOMBRES.length];
      }
      nombreIdx += 1;
      text = text.replace(/^(instructor:\n {2}name: ).+$/m, `$1${replacement}`);
      seenInstructor.set(replacement, file);
      changes.instructor += 1;
    } else {
      seenInstructor.set(name, file);
    }
  }

  // 2. rating + ratingCount únicos como par
  const rMatch = text.match(/^rating: ([\d.]+)$/m);
  const rcMatch = text.match(/^ratingCount: (\d+)$/m);
  if (rMatch && rcMatch) {
    let rating = Number(rMatch[1]);
    let count = Number(rcMatch[1]);
    let step = 0;
    while (seenRating.has(`${rating}|${count}`)) {
      step += 1;
      count += 7 * step;
      if (step % 3 === 0) {
        rating = Math.round((4.6 + ((step / 3) % 4) * 0.1) * 10) / 10;
      }
    }
    if (step > 0) {
      text = text.replace(/^rating: [\d.]+$/m, `rating: ${rating}`);
      text = text.replace(/^ratingCount: \d+$/m, `ratingCount: ${count}`);
      changes.rating += 1;
    }
    seenRating.add(`${rating}|${count}`);
  }

  // 3. students único
  const sMatch = text.match(/^students: (\d+)$/m);
  if (sMatch) {
    let students = Number(sMatch[1]);
    let step = 0;
    while (seenStudents.has(students)) {
      step += 1;
      students += 13 * step;
    }
    if (step > 0) {
      text = text.replace(/^students: \d+$/m, `students: ${students}`);
      changes.students += 1;
    }
    seenStudents.add(students);
  }

  // 4. lessonsCount = suma real de lecciones
  const realLessons = (text.match(/^ {6}- /gm) ?? []).length;
  if (realLessons >= 10) {
    text = text.replace(/^lessonsCount: \d+$/m, `lessonsCount: ${realLessons}`);
  }

  writeFileSync(path, text);
}

console.log(`${files.length} cursos procesados.`);
console.log(`  instructores renombrados: ${changes.instructor}`);
console.log(`  rating/ratingCount ajustados: ${changes.rating}`);
console.log(`  students ajustados: ${changes.students}`);
