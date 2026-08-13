/**
 * Gestión del canal de YouTube de Sably por API (OAuth de usuario, no service account:
 * la API de YouTube no admite service accounts).
 *
 * Requiere YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN en
 * ~/.config/connexis/marketing-secrets.env — los deja el script
 * ~/.config/connexis/get_youtube_refresh_token.py.
 *
 * Uso:
 *   node scripts/youtube-manage.mjs listar          → videos del canal con métricas
 *   node scripts/youtube-manage.mjs seo             → propone título/descripción con enlace a sably.co
 *   node scripts/youtube-manage.mjs seo --aplicar   → los escribe de verdad
 */
import { readFileSync } from 'node:fs';

const HOME = process.env.HOME;
const env = Object.fromEntries(
  readFileSync(`${HOME}/.config/connexis/marketing-secrets.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const Y = 'https://www.googleapis.com/youtube/v3';
const j = async (r) => { try { return await r.json(); } catch { return {}; } };

if (!env.YOUTUBE_REFRESH_TOKEN) {
  console.log('Falta YOUTUBE_REFRESH_TOKEN. Ejecuta primero:\n  python3 ~/.config/connexis/get_youtube_refresh_token.py');
  process.exit(1);
}

/** Access token a partir del refresh token (dura 1 hora, se pide en cada corrida). */
const tok = await j(await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: env.YOUTUBE_CLIENT_ID,
    client_secret: env.YOUTUBE_CLIENT_SECRET,
    refresh_token: env.YOUTUBE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }),
}));
if (!tok.access_token) { console.log('No se pudo renovar el token:', JSON.stringify(tok).slice(0, 200)); process.exit(1); }
const H = { authorization: `Bearer ${tok.access_token}` };

const canal = (await j(await fetch(`${Y}/channels?part=snippet,contentDetails,statistics&mine=true`, { headers: H }))).items?.[0];
if (!canal) { console.log('Esa cuenta no administra ningún canal.'); process.exit(1); }
console.log(`Canal: ${canal.snippet.title} · ${canal.statistics.videoCount} videos · ${canal.statistics.viewCount} visualizaciones\n`);

/** Todos los videos del canal vía la playlist de subidas. */
const listarVideos = async () => {
  const uploads = canal.contentDetails.relatedPlaylists.uploads;
  const ids = [];
  let page = '';
  do {
    const r = await j(await fetch(`${Y}/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=50&pageToken=${page}`, { headers: H }));
    ids.push(...(r.items ?? []).map((i) => i.contentDetails.videoId));
    page = r.nextPageToken ?? '';
  } while (page);
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await j(await fetch(`${Y}/videos?part=snippet,statistics,status&id=${ids.slice(i, i + 50).join(',')}`, { headers: H }));
    out.push(...(r.items ?? []));
  }
  return out;
};

/* Mapa video → curso de sably.co, el mismo de scripts/videos-pipeline.mjs. */
const CURSO = {
  'ZNpSf-duq9E': 'curso-de-barberia', 'YX7rDcyeX3I': 'curso-de-masajes',
  'Ht3g2vRjmrg': 'curso-de-masajes-terapeuticos-y-relajantes', 'EvaOaKXJmOs': 'curso-de-masaje-reductor',
  'nXg3b_h57wM': 'curso-de-automaquillaje', '9bMRDpxQ5-g': 'curso-de-maquillaje',
  'lTT2mfzWb64': 'curso-de-unas-acrilicas', 'iMyIua_1QjY': 'curso-de-decoracion-de-unas',
  'zeF2wu1cDzg': 'curso-de-manicure-y-pedicure', '57R9uxVAGwE': 'curso-de-trenzas-y-peinados',
  'KE8tg9Pqjpk': 'curso-de-peinados', 'LvD31sMlcqY': 'curso-de-extensiones-de-pestanas',
  'tpxoctfQUPM': 'curso-de-cejas-y-pestanas', 'LLtdvAOiozI': 'curso-de-limpieza-facial',
  'WUHp5C-EyjA': 'curso-de-depilacion',
};

const comando = process.argv[2] ?? 'listar';
const videos = await listarVideos();

if (comando === 'listar') {
  for (const v of videos) {
    const s = v.statistics;
    console.log(`${v.id} · ${s.viewCount ?? 0} vistas · ${v.status.privacyStatus} · ${v.snippet.title.slice(0, 60)}`);
    const desc = (v.snippet.description ?? '');
    if (!desc.includes('sably.co')) console.log('   ⚠️ la descripción no enlaza a sably.co');
  }
  process.exit(0);
}

if (comando === 'seo') {
  const aplicar = process.argv.includes('--aplicar');
  for (const v of videos) {
    const slug = CURSO[v.id];
    if (!slug) { console.log(`· ${v.id}: sin curso mapeado`); continue; }
    const url = `https://sably.co/co/${slug}/?utm_source=youtube&utm_medium=organico&utm_campaign=descripcion-video`;
    const desc = (v.snippet.description ?? '').trim();
    if (desc.includes('sably.co')) { console.log(`✓ ${v.id}: ya enlaza a sably.co`); continue; }

    const nueva = [
      desc,
      desc ? '' : null,
      `👉 Ver el curso completo con certificado: ${url}`,
      '',
      'En Sably aprendes un oficio 100% online, a tu ritmo, con certificado y acceso de por vida.',
      'Hoy con 50% de descuento.',
    ].filter((x) => x !== null).join('\n');

    if (!aplicar) { console.log(`(propuesta) ${v.id} → añadiría el enlace a ${slug}`); continue; }
    const r = await j(await fetch(`${Y}/videos?part=snippet`, {
      method: 'PUT',
      headers: { ...H, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: v.id,
        snippet: {
          title: v.snippet.title,
          description: nueva,
          categoryId: v.snippet.categoryId,
          tags: v.snippet.tags,
        },
      }),
    }));
    console.log(r.id ? `✅ ${v.id}: descripción actualizada` : `! ${v.id}: ${JSON.stringify(r.error?.message ?? r).slice(0, 140)}`);
  }
}
