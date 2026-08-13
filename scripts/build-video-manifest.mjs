/**
 * Genera src/lib/course-videos.ts leyendo los MP4 reales del CDN.
 *
 * La duración y la fecha de subida NO están en el frontmatter y no se pueden
 * inventar: `duration` sale de ffprobe sobre el archivo, y `uploadDate` del
 * Last-Modified que devuelve R2. Google usa la duración para pintar la insignia
 * de tiempo en el resultado, así que un número aproximado sería peor que nada.
 *
 * Se commitea el resultado, igual que course-covers.ts: el build no puede
 * sondear 15 archivos por red cada vez, y en CI ni siquiera hay ffprobe.
 *
 *   node scripts/build-video-manifest.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const CDN = 'https://cdn.sably.co';
const DIR = 'src/content/courses';

const cursos = readdirSync(DIR)
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => {
    const key = /^videoKey:\s*(.+)$/m.exec(readFileSync(`${DIR}/${f}`, 'utf8'))?.[1]?.trim();
    return key ? { slug: f.replace(/\.mdx$/, ''), key } : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.slug.localeCompare(b.slug));

const filas = [];
for (const { slug, key } of cursos) {
  const url = `${CDN}/videos/${key}`;
  const seg = Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', url], {
      encoding: 'utf8',
    }).trim(),
  );
  const r = await fetch(url, { method: 'HEAD' });
  const lm = r.headers.get('last-modified');
  if (!Number.isFinite(seg) || seg <= 0) throw new Error(`sin duración: ${key}`);
  if (!lm) throw new Error(`sin last-modified: ${key}`);
  filas.push({ slug, key, segundos: Math.round(seg), subido: new Date(lm).toISOString() });
  console.log(`  ${slug}  ${Math.round(seg)}s  ${lm}`);
}

const ts = `/**
 * Duración y fecha de subida de los vídeos de presentación.
 *
 * Generado por scripts/build-video-manifest.mjs a partir de los MP4 reales del
 * CDN: la duración con ffprobe y la fecha del Last-Modified de R2. Ninguno de
 * los dos está en el frontmatter, y son los que Google necesita para el
 * VideoObject —la duración es la que pinta la insignia de tiempo en el
 * resultado—, así que no valen aproximaciones.
 *
 * Se commitea porque el build no puede sondear la red por cada página y en CI
 * no hay ffprobe. Al añadir o reemplazar un vídeo, volver a ejecutar el script.
 */
export interface VideoCurso {
  /** Ruta dentro del bucket, la misma del frontmatter \`videoKey\`. */
  key: string;
  /** Duración en segundos, medida sobre el archivo. */
  segundos: number;
  /** ISO 8601. Cuándo se subió a R2. */
  subido: string;
}

export const COURSE_VIDEOS: Record<string, VideoCurso> = {
${filas.map((f) => `  '${f.slug}': { key: '${f.key}', segundos: ${f.segundos}, subido: '${f.subido}' },`).join('\n')}
};

/** Duración en formato ISO 8601, que es el que exige Schema.org: PT1M23S. */
export function duracionIso(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return \`PT\${m ? \`\${m}M\` : ''}\${s}S\`;
}
`;
writeFileSync('src/lib/course-videos.ts', ts);
console.log(`\n${filas.length} vídeos → src/lib/course-videos.ts`);
