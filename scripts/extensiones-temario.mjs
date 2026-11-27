// Corrección del temario de extensiones de cabello (26-nov) con lo comprobado en el vídeo. Uso: node scripts/extensiones-temario.mjs [--aplicar]
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DOCS = process.env.SABLY_DOCS ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../docs');
const OUT = path.join(DOCS, 'equipo/2026-11-26/contenido/extensiones');
const SLUG = 'curso-de-extensiones-de-cabello';
const em = (a) => JSON.parse(execFileSync('npx', ['--no-install', 'emdash', ...a, '--url', 'https://sably.co', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }));
const MODULOS = [ // [módulo, [tema, minuto en la Parte 1]]
  ['Fundamentos y negocio de las extensiones', ['Historia de las extensiones', 'Inventario por color, textura, largo y cantidad', 'Asesoría honesta y venta a la clienta', 'Métodos de instalación temporales y fijos']],
  ['Selección del cabello y materiales', ['Cómo reconocer extensiones de buena calidad', 'Elección del color y prueba con un mechón', 'Cantidad de cabello según la clienta', 'Herramientas de trabajo']],
  ['Extensiones con clips', ['Preparación del cabello', 'Instalación con guías de microlinks', 'Instalación sobre entorchado', 'Instalación con cardado', 'Cómo disimular un corte recto']],
  ['Extensiones adhesivas', ['Materiales y particiones', 'Instalación paso a paso', 'Peinado y mantenimiento', 'Retiro y reinstalación', 'Cuidados para no dañar el cabello']],
  ['Extensiones con microlinks', ['Capas con puntos guía', 'Retiro de las capas', 'Instalación por puntos', 'Clientas con pérdida de cabello', 'Corrección del corte final', 'Costos y precios del servicio']],
];
const actual = em(['content', 'get', 'courses', SLUG, '--raw']);
const nuevo = { ...actual.data,
  modules: MODULOS.map(([title, lessons]) => ({ title, lessons })),
  curriculum: MODULOS.map(([title, lessons]) => ({ title, lessons_text: lessons.join('\n') })),
  lessons_count: 2 }; // recuento real: una lección con dos vídeos (Parte 1 y Parte 2); lo demás son temas
try { writeFileSync(`${OUT}/respaldo-curso-antes-temario.json`, JSON.stringify(actual, null, 1), { flag: 'wx' }); } catch { /* se conserva el primero */ }
if (process.argv.includes('--aplicar')) writeFileSync(`${OUT}/respaldo-curso-previo-${Date.now()}.json`, JSON.stringify(actual, null, 1));
const sinCambios = JSON.stringify([actual.data.modules, actual.data.curriculum, Number(actual.data.lessons_count)]) === JSON.stringify([nuevo.modules, nuevo.curriculum, nuevo.lessons_count]);
if (sinCambios) { console.log('temario ya corregido'); process.exit(0); }
if (process.argv.includes('--aplicar')) {
  writeFileSync(`${OUT}/.escritura.json`, JSON.stringify(nuevo));
  em(['content', 'update', 'courses', SLUG, '--file', `${OUT}/.escritura.json`, '--rev', actual._rev]);
}
console.log(process.argv.includes('--aplicar') ? 'escrito' : 'simulado', nuevo.modules.length, 'módulos', nuevo.lessons_count, 'lecciones (vídeos)');
