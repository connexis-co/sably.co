/**
 * Anuncios de video 9:16 en Meta con los videos del canal de YouTube de Sably.
 *
 * Resuelve el problema del anuncio "mudo": en Reels/Stories Meta no muestra el
 * texto del anuncio, solo la creatividad. Estos videos llevan logo, titular y
 * oferta quemados, así que comunican aunque el usuario no lea nada más.
 * Todos apuntan a sably.co.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const HOME = process.env.HOME;
const SC = process.env.SABLY_SCRATCH ?? '/private/tmp/claude-501/-Users-jpmisat-Documents-JP-Projects-sably-co/5f29e299-ac62-468a-a79a-d79f903ab867/scratchpad';
const VERT = `${SC}/videos-vertical`;
const env = Object.fromEntries(
  readFileSync(`${HOME}/.config/connexis/marketing-secrets.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const G = 'https://graph.facebook.com/v23.0';
const TK = env.META_SYSTEM_TOKEN_2;
const ACT = 'act_246925521751537';
const PAGE = '1384649245181822';
const j = async (r) => { try { return await r.json(); } catch { return {}; } };
const post = (p, b) => fetch(`${G}/${p}`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ...b, access_token: TK }),
}).then(j);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLAN = [
  {
    adset: '120252067588310736', label: 'Uñas MX', curso: 'curso-de-unas-acrilicas', cc: 'mx',
    message: '¿Cansada de que el sueldo no alcance? 💅 Aprende uñas acrílicas desde cero con clases en video paso a paso, certificado y acceso de por vida. Miles de mujeres ya cobran por su trabajo desde casa. Hoy con 50% de descuento.',
    title: 'Curso de Uñas Acrílicas', desc: 'Certificado · 50% OFF',
  },
  {
    adset: '120252067588840736', label: 'Barbería MX+CO', curso: 'curso-de-barberia', cc: 'mx',
    message: 'Si ya cortas cabello pero no te pagan lo que vale 💈 domina fades, navaja y barba con técnica profesional. Curso 100% online, certificado y acceso de por vida. Monta tu propia barbería. Hoy con 50% de descuento.',
    title: 'Curso de Barbería Online', desc: 'Certificado · 50% OFF',
  },
  {
    adset: '120252067589730736', label: 'Masajes CO', curso: 'curso-de-masajes', cc: 'co',
    message: 'Nunca es tarde para empezar de nuevo 💆‍♀️ Conviértete en masajista profesional con técnicas reales de spa explicadas paso a paso. Certificado incluido y acceso de por vida. Atiende desde tu casa. Hoy con 50% de descuento.',
    title: 'Curso de Masajes Online', desc: 'Certificado · 50% OFF',
  },
  {
    adset: '120252067590250736', label: 'Pestañas MX', curso: 'curso-de-extensiones-de-pestanas', cc: 'mx',
    message: 'La técnica que más piden tus clientas 👁️ Extensiones pelo a pelo y volumen ruso desde cero, con certificado y acceso de por vida. Atiende en tu casa y cobra por sesión. Hoy con 50% de descuento.',
    title: 'Curso de Pestañas Online', desc: 'Certificado · 50% OFF',
  },
];

for (const p of PLAN) {
  const file = `${VERT}/${p.curso}-9x16.mp4`;
  if (!existsSync(file)) { console.log(`· ${p.label}: falta ${p.curso}-9x16.mp4`); continue; }

  // 1) Subir el video
  const fv = new FormData();
  fv.append('source', new Blob([readFileSync(file)], { type: 'video/mp4' }), `${p.curso}.mp4`);
  fv.append('title', `Sably - ${p.curso} 9x16`);
  fv.append('access_token', TK);
  const vid = await j(await fetch(`${G}/${ACT}/advideos`, { method: 'POST', body: fv }));
  if (!vid.id) { console.log(`! ${p.label} video: ${JSON.stringify(vid.error ?? vid).slice(0, 180)}`); continue; }
  console.log(`↑ ${p.label}: video ${vid.id}`);

  // 2) Miniatura desde el propio video (Meta la exige en video_data)
  const thumb = `${SC}/thumb-${p.curso}.jpg`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '2', '-i', file, '-frames:v', '1', thumb]);
  const fi = new FormData();
  fi.append('source', new Blob([readFileSync(thumb)], { type: 'image/jpeg' }), 'thumb.jpg');
  fi.append('access_token', TK);
  const img = await j(await fetch(`${G}/${ACT}/adimages`, { method: 'POST', body: fi }));
  const hash = img.images?.bytes?.hash;

  // 3) Esperar a que Meta procese el video (si no, el creativo falla)
  let listo = false;
  for (let i = 0; i < 20; i++) {
    await sleep(6000);
    const st = await j(await fetch(`${G}/${vid.id}?fields=status&access_token=${TK}`));
    const v = st.status?.video_status;
    if (v === 'ready') { listo = true; break; }
    if (v === 'error') break;
  }
  if (!listo) console.log(`  (aviso) el video sigue procesándose; se crea igual y Meta lo publica al terminar`);

  const link = `https://sably.co/${p.cc}/${p.curso}/`;
  const cr = await post(`${ACT}/adcreatives`, {
    name: `Sably - ${p.curso} - video 9:16`,
    url_tags: 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}',
    object_story_spec: {
      page_id: PAGE,
      video_data: {
        video_id: vid.id,
        message: p.message,
        title: p.title,
        link_description: p.desc,
        image_hash: hash,
        call_to_action: { type: 'LEARN_MORE', value: { link } },
      },
    },
  });
  if (!cr.id) { console.log(`! ${p.label} creative: ${JSON.stringify(cr.error ?? cr).slice(0, 220)}`); continue; }

  const ad = await post(`${ACT}/ads`, {
    name: `${p.label} - VIDEO 9:16 · LP sably`,
    adset_id: p.adset,
    creative: { creative_id: cr.id },
    status: 'ACTIVE',
  });
  console.log(ad.id ? `✅ ${p.label}: anuncio de video ${ad.id} → ${link}` : `! ${p.label} ad: ${JSON.stringify(ad.error ?? ad).slice(0, 220)}`);
}
