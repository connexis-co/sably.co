/**
 * Reapunta todos los anuncios vivos de Meta a sably.co.
 *
 * Los creativos de Meta son inmutables: para cambiar el enlace hay que crear uno
 * nuevo y reasignarlo al anuncio (el histórico de aprendizaje del adset se conserva).
 * El país sale de la segmentación del propio conjunto, para caer en la landing
 * localizada correcta (sably.co/mx/…, /co/…, /cl/…).
 */
import { readFileSync } from 'node:fs';

const HOME = process.env.HOME;
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
const DRY = process.argv.includes('--dry');
const j = async (r) => { try { return await r.json(); } catch { return {}; } };
const post = (p, b) => fetch(`${G}/${p}`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ...b, access_token: TK }),
}).then(j);

/** Curso deducible desde el enlace viejo o el nombre del anuncio. */
const CURSO = [
  [/barberia|barber/i, 'curso-de-barberia'],
  [/unas-acrilicas|u%C3%B1as|unas|uñas/i, 'curso-de-unas-acrilicas'],
  [/cejas-y-pestanas|pestan|pestañ/i, 'curso-de-extensiones-de-pestanas'],
  [/masaje/i, 'curso-de-masajes'],
  [/globo/i, 'curso-de-decoracion-con-globos'],
];
const cursoDe = (txt) => (CURSO.find(([re]) => re.test(txt)) ?? [])[1] ?? null;

const paisDe = (t) => {
  const c = t?.geo_locations?.countries ?? [];
  return (c.includes('MX') ? 'mx' : c.includes('CO') ? 'co' : c.includes('CL') ? 'cl' : 'co');
};

const vive = async (url) => {
  try { return (await fetch(url, { method: 'HEAD', redirect: 'follow' })).status === 200; } catch { return false; }
};

const sets = await j(await fetch(`${G}/${ACT}/adsets?fields=name,status,targeting{geo_locations}&limit=50&access_token=${TK}`));
const paisPorSet = Object.fromEntries((sets.data ?? []).map((s) => [s.id, paisDe(s.targeting)]));

const ads = await j(await fetch(`${G}/${ACT}/ads?fields=name,effective_status,adset_id,creative{id,object_story_spec,url_tags}&limit=60&access_token=${TK}`));
const vivos = (ads.data ?? []).filter((a) => !['DELETED', 'ARCHIVED'].includes(a.effective_status));
console.log(`anuncios vivos: ${vivos.length}`);

const cache = {};
let cambiados = 0;
for (const a of vivos) {
  const ld = a.creative?.object_story_spec?.link_data;
  if (!ld) { console.log(`· ${a.name}: sin link_data`); continue; }
  if (/sably\.co/.test(ld.link ?? '')) { console.log(`✓ ${a.name}: ya apunta a sably.co`); continue; }

  const slug = cursoDe(`${ld.link} ${a.name}`);
  const cc = paisPorSet[a.adset_id] ?? 'co';
  if (!slug) { console.log(`! ${a.name}: no deduzco el curso de "${ld.link}"`); continue; }

  let destino = `https://sably.co/${cc}/${slug}/`;
  if (!(await vive(destino))) {
    const alt = `https://sably.co/${cc}/`;
    console.log(`  ${slug} no existe en /${cc}/ → uso ${alt}`);
    destino = alt;
  }

  const key = `${destino}|${ld.image_hash}|${(ld.message ?? '').slice(0, 30)}`;
  if (!cache[key]) {
    if (DRY) { console.log(`(dry) ${a.name} → ${destino}`); continue; }
    const cr = await post(`${ACT}/adcreatives`, {
      name: `${a.name} · LP sably`,
      url_tags: a.creative?.url_tags ?? 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}',
      object_story_spec: {
        page_id: PAGE,
        link_data: {
          link: destino,
          message: ld.message,
          name: ld.name,
          description: ld.description,
          image_hash: ld.image_hash,
          call_to_action: { type: ld.call_to_action?.type ?? 'LEARN_MORE', value: { link: destino } },
        },
      },
    });
    if (!cr.id) { console.log(`! creative ${a.name}: ${JSON.stringify(cr.error ?? cr).slice(0, 160)}`); continue; }
    cache[key] = cr.id;
  }
  const up = await post(a.id, { creative: { creative_id: cache[key] } });
  console.log(up.success ? `✓ ${a.name} → ${destino}` : `! ${a.name}: ${JSON.stringify(up.error ?? up).slice(0, 160)}`);
  if (up.success) cambiados += 1;
}
console.log(`\n${cambiados} anuncios reapuntados a sably.co`);
