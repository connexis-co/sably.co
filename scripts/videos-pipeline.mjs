/**
 * Pipeline de videos del canal de YouTube de Sably:
 *   1. Transcodifica cada video a una versión web ligera (720p, faststart).
 *   2. Genera la versión vertical 9:16 para Reels/Stories, con fondo desenfocado,
 *      logo real y titular quemado en la imagen (en Stories el texto del anuncio
 *      no se muestra: si no va en el video, el anuncio queda mudo).
 *   3. Sube ambas a R2 (bucket sably-assets → cdn.sably.co).
 *   4. Escribe `videoKey` en el frontmatter del curso correspondiente.
 *
 * Uso: node scripts/videos-pipeline.mjs [--solo-web] [--dry]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const HOME = process.env.HOME;
const REPO = `${HOME}/Documents/JP Projects/sably.co`;
const SC = process.env.SABLY_SCRATCH ?? '/private/tmp/claude-501/-Users-jpmisat-Documents-JP-Projects-sably-co/5f29e299-ac62-468a-a79a-d79f903ab867/scratchpad';
const SRC = `${SC}/videos`;
const WEB = `${SC}/videos-web`;
const VERT = `${SC}/videos-vertical`;
const DRY = process.argv.includes('--dry');
const SOLO_WEB = process.argv.includes('--solo-web');

const env = Object.fromEntries(
  readFileSync(`${HOME}/.config/connexis/marketing-secrets.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

/** Video de YouTube → curso de sably.co + titular para la versión vertical. */
export const MAPA = [
  { id: 'ZNpSf-duq9E', curso: 'curso-de-barberia', titular: 'Aprende barbería\ndesde cero' },
  { id: 'YX7rDcyeX3I', curso: 'curso-de-masajes', titular: 'Sé masajista\nprofesional' },
  { id: 'Ht3g2vRjmrg', curso: 'curso-de-masajes-terapeuticos-y-relajantes', titular: 'Masajes que\nsí se pagan' },
  { id: 'EvaOaKXJmOs', curso: 'curso-de-masaje-reductor', titular: 'Masaje reductor\nprofesional' },
  { id: 'nXg3b_h57wM', curso: 'curso-de-automaquillaje', titular: 'Maquíllate\ncomo experta' },
  { id: '9bMRDpxQ5-g', curso: 'curso-de-maquillaje', titular: 'Maquillaje social\npara eventos' },
  { id: 'lTT2mfzWb64', curso: 'curso-de-unas-acrilicas', titular: 'Uñas acrílicas\ndesde cero' },
  { id: 'iMyIua_1QjY', curso: 'curso-de-decoracion-de-unas', titular: 'Decoración de uñas\nque enamora' },
  { id: 'zeF2wu1cDzg', curso: 'curso-de-manicure-y-pedicure', titular: 'Manicure y pedicure\nprofesional' },
  { id: '57R9uxVAGwE', curso: 'curso-de-trenzas-y-peinados', titular: 'Trenzas y peinados\nque cobran bien' },
  { id: 'KE8tg9Pqjpk', curso: 'curso-de-peinados', titular: 'Peinados de\nsalón' },
  { id: 'LvD31sMlcqY', curso: 'curso-de-extensiones-de-pestanas', titular: 'Pestañas pelo a pelo\ny volumen ruso' },
  { id: 'tpxoctfQUPM', curso: 'curso-de-cejas-y-pestanas', titular: 'Cejas y pestañas\nprofesionales' },
  { id: 'LLtdvAOiozI', curso: 'curso-de-limpieza-facial', titular: 'Limpieza facial\nen 9 pasos' },
  { id: 'WUHp5C-EyjA', curso: 'curso-de-depilacion', titular: 'Depilación con cera\nprofesional' },
];

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

// ─── 1 y 2: transcodificación ───────────────────────────────
function transcodificar() {
  mkdirSync(WEB, { recursive: true });
  mkdirSync(VERT, { recursive: true });
  for (const m of MAPA) {
    const src = `${SRC}/${m.id}.mp4`;
    if (!existsSync(src)) { console.log(`· ${m.id}: aún no descargado`); continue; }

    const web = `${WEB}/${m.curso}.mp4`;
    if (!existsSync(web)) {
      sh('ffmpeg', ['-y', '-i', src, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-crf', '26',
        '-preset', 'medium', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', web]);
      console.log(`✓ web ${m.curso}.mp4 (${(statSync(web).size / 1048576).toFixed(1)} MB)`);
    }

    if (SOLO_WEB) continue;
    const vert = `${VERT}/${m.curso}-9x16.mp4`;
    const overlay = `${VERT}/${m.curso}-overlay.png`;
    if (!existsSync(overlay)) { console.log(`· falta overlay de ${m.curso} (crear con overlay_vertical.py)`); continue; }
    if (!existsSync(vert)) {
      sh('ffmpeg', ['-y', '-i', src, '-i', overlay, '-filter_complex',
        '[0:v]split[a][b];' +
        '[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=28[bg];' +
        '[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v];[v][1:v]overlay=0:0',
        '-c:v', 'libx264', '-crf', '24', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', vert]);
      console.log(`✓ 9:16 ${m.curso}-9x16.mp4 (${(statSync(vert).size / 1048576).toFixed(1)} MB)`);
    }
  }
}

// ─── 3: subida a R2 ─────────────────────────────────────────
async function subirR2(dir, prefijo) {
  if (!existsSync(dir)) return [];
  const CF = 'https://api.cloudflare.com/client/v4';
  const subidos = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.mp4'))) {
    const key = `${prefijo}/${f}`;
    if (DRY) { console.log(`(dry) subiría ${key}`); continue; }
    const r = await fetch(`${CF}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/sably-assets/objects/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'video/mp4' },
      body: readFileSync(`${dir}/${f}`),
    });
    console.log(r.ok ? `↑ ${key}` : `! ${key}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
    if (r.ok) subidos.push(f);
  }
  return subidos;
}

// ─── 4: frontmatter ─────────────────────────────────────────
function escribirFrontmatter() {
  let n = 0;
  for (const m of MAPA) {
    const file = `${REPO}/src/content/courses/${m.curso}.mdx`;
    if (!existsSync(file)) { console.log(`! no existe ${m.curso}.mdx`); continue; }
    let txt = readFileSync(file, 'utf8');
    if (txt.includes('videoKey:')) continue;
    const nuevo = txt.replace(/^(hotmartUrl: .*)$/m, `$1\nvideoKey: ${m.curso}.mp4`);
    if (nuevo === txt) { console.log(`! sin ancla hotmartUrl en ${m.curso}`); continue; }
    if (!DRY) writeFileSync(file, nuevo);
    n += 1;
  }
  console.log(`✓ videoKey escrito en ${n} cursos`);
}

if (process.argv[1]?.endsWith('videos-pipeline.mjs')) {
  transcodificar();
  const web = await subirR2(WEB, 'videos');
  if (!SOLO_WEB) await subirR2(VERT, 'videos/vertical');
  escribirFrontmatter();
  console.log(`\nListo. ${web.length} videos web en cdn.sably.co/videos/`);
}
