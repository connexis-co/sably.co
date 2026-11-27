#!/usr/bin/env node
/** Barrido sin coste sobre los JSON ya redactados: notas internas, frases hechas y vetadas. Uso: node scripts/barrido-contenido.mjs [--cursos a,b] */
import { INTERNAS } from './contenido-gemini.mjs';
import { leerCursos, validar } from './contenido-cursos.mjs';
const i = process.argv.indexOf('--cursos');
let n = 0;
for (const c of leerCursos(i > 0 ? process.argv[i + 1].split(',') : undefined)) {
  const b = c.base;
  const textos = [b.subtitulo, ...b.beneficios, ...b.para_quien, ...b.requisitos, b.cuerpo, ...b.faqs.flatMap((f) => [f.q, f.a]), b.curso?.short_description ?? '', ...Object.values(c.paises).map((p) => p.meta_description ?? '')]
    .map((t) => t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
  for (const t of textos) for (const [p, motivo] of INTERNAS) { const m = t.match(p); if (m) { n++; console.log(`${c.slug}: ${motivo} → «${t.slice(Math.max(0, m.index - 60), m.index + 90).replace(/\n/g, ' ')}»`); } }
  for (const f of validar(c)) { n++; console.log(f); }
}
console.log(`${n} hallazgos`);
