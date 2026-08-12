/**
 * GET /admin/ventas?key=<SNAPSHOT_TOKEN> — panel HTML de la base de compradores Hotmart.
 * Server-rendered desde D1 (sin build de Astro). Filtros: ?event=…&q=…
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const BADGE = {
  PURCHASE_APPROVED: ['Aprobada', '#16a34a'],
  PURCHASE_COMPLETE: ['Completa', '#15803d'],
  PURCHASE_REFUNDED: ['Reembolso', '#dc2626'],
  PURCHASE_CHARGEBACK: ['Chargeback', '#b91c1c'],
  PURCHASE_CANCELED: ['Cancelada', '#6b7280'],
  PURCHASE_BILLET_PRINTED: ['Boleto', '#f59e0b'],
  PURCHASE_PROTEST: ['Disputa', '#c2410c'],
  PURCHASE_DELAYED: ['Atrasada', '#f59e0b'],
  PURCHASE_EXPIRED: ['Vencida', '#6b7280'],
  PURCHASE_OUT_OF_SHOPPING_CART: ['Abandono 🛒', '#7c3aed'],
  CART_ABANDONMENT: ['Abandono 🛒', '#7c3aed'],
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.SNAPSHOT_TOKEN || url.searchParams.get('key') !== env.SNAPSHOT_TOKEN) {
    return new Response('No autorizado. Usa /admin/ventas?key=…', { status: 401 });
  }
  const key = url.searchParams.get('key');
  const event = (url.searchParams.get('event') ?? '').trim();
  const q = (url.searchParams.get('q') ?? '').trim();

  const where = [];
  const args = [];
  if (event) { where.push('event = ?'); args.push(event); }
  if (q) {
    where.push('(buyer_email LIKE ? OR buyer_name LIKE ? OR product_name LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like);
  }
  const filtro = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const filas = (await env.DB.prepare(
    `SELECT * FROM hotmart_eventos ${filtro} ORDER BY created_at DESC LIMIT 200`,
  ).bind(...args).all()).results ?? [];

  const resumen = (await env.DB.prepare(
    `SELECT event, currency, COUNT(*) AS n, ROUND(SUM(COALESCE(value,0)),2) AS total
     FROM hotmart_eventos GROUP BY event, currency`,
  ).all()).results ?? [];

  const aprobadas = resumen.filter((r) => ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'].includes(r.event));
  const nAprob = aprobadas.reduce((s, r) => s + r.n, 0);
  const ingresos = aprobadas.map((r) => `${Number(r.total).toLocaleString('es-CO')} ${esc(r.currency ?? '')}`).join(' · ') || '—';
  const nAband = resumen.filter((r) => /ABANDON|SHOPPING_CART/.test(r.event)).reduce((s, r) => s + r.n, 0);
  const nReemb = resumen.filter((r) => /REFUND|CHARGEBACK/.test(r.event)).reduce((s, r) => s + r.n, 0);

  const filasHtml = filas.map((f) => {
    const [label, color] = BADGE[f.event] ?? [f.event, '#475569'];
    const attr = [f.sck_gclid && 'gclid', f.sck_fbc && 'fbc', f.sck_fbp && 'fbp', f.sck_cid && 'ga']
      .filter(Boolean)
      .map((a) => `<span class="attr">${a}</span>`)
      .join('') || '<span class="attr none">directo</span>';
    return `<tr>
      <td class="fecha">${esc((f.created_at ?? '').slice(0, 16))}</td>
      <td><span class="badge" style="background:${color}">${esc(label)}</span></td>
      <td class="prod">${esc(f.product_name ?? '—')}</td>
      <td><div class="nombre">${esc(f.buyer_name ?? '—')}</div>
          <div class="mail">${esc(f.buyer_email ?? '')}</div>
          <div class="mail">${esc(f.buyer_phone ?? '')}</div></td>
      <td>${esc(f.country_iso ?? '—')}</td>
      <td class="valor">${f.value ? `${Number(f.value).toLocaleString('es-CO')} ${esc(f.currency ?? '')}` : '—'}</td>
      <td>${attr}</td>
      <td class="tx">${esc(f.transaction_code ?? '')}</td>
    </tr>`;
  }).join('');

  const opciones = Object.entries(BADGE)
    .map(([ev, [label]]) => `<option value="${ev}" ${ev === event ? 'selected' : ''}>${label}</option>`)
    .join('');

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Ventas Hotmart — Sably</title><style>
:root{color-scheme:dark}*{box-sizing:border-box;margin:0}
body{font:14px/1.5 -apple-system,system-ui,sans-serif;background:#0b1020;color:#e2e8f0;padding:24px}
h1{font-size:20px;margin-bottom:4px}.sub{color:#94a3b8;margin-bottom:20px;font-size:13px}
.cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.card{background:#131a2e;border:1px solid #1e293b;border-radius:10px;padding:14px 18px;min-width:150px}
.card b{display:block;font-size:22px}.card span{color:#94a3b8;font-size:12px}
form{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
input,select{background:#131a2e;border:1px solid #283548;color:#e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px}
button{background:#2563eb;border:0;color:#fff;border-radius:8px;padding:8px 16px;cursor:pointer}
table{width:100%;border-collapse:collapse;background:#0e1526;border-radius:10px;overflow:hidden}
th{background:#131a2e;text-align:left;padding:9px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#94a3b8}
td{padding:9px 10px;border-top:1px solid #17203a;vertical-align:top}
.badge{padding:2px 9px;border-radius:99px;font-size:11px;font-weight:600;color:#fff;white-space:nowrap}
.fecha{color:#94a3b8;white-space:nowrap;font-size:12px}.prod{max-width:220px}
.nombre{font-weight:600}.mail{color:#94a3b8;font-size:12px}
.valor{font-weight:600;white-space:nowrap}
.attr{display:inline-block;background:#1d4ed8;border-radius:5px;padding:1px 6px;font-size:10px;margin:1px;font-weight:700}
.attr.none{background:#334155}.tx{color:#64748b;font-size:11px}
.vacio{padding:40px;text-align:center;color:#64748b}
</style></head><body>
<h1>💰 Ventas y eventos de Hotmart</h1>
<div class="sub">Base de compradores en D1 · la llena el webhook en tiempo real · últimas 200 filas</div>
<div class="cards">
  <div class="card"><b>${nAprob}</b><span>compras aprobadas</span></div>
  <div class="card"><b>${ingresos}</b><span>ingresos aprobados</span></div>
  <div class="card"><b>${nAband}</b><span>abandonos de carrito</span></div>
  <div class="card"><b>${nReemb}</b><span>reembolsos/chargebacks</span></div>
</div>
<form method="get">
  <input type="hidden" name="key" value="${esc(key)}">
  <select name="event"><option value="">Todos los eventos</option>${opciones}</select>
  <input name="q" placeholder="Buscar email, nombre o producto" value="${esc(q)}">
  <button>Filtrar</button>
</form>
<table><thead><tr><th>Fecha</th><th>Evento</th><th>Producto</th><th>Comprador</th><th>País</th><th>Valor</th><th>Atribución</th><th>Transacción</th></tr></thead>
<tbody>${filasHtml || '<tr><td colspan="8" class="vacio">Sin eventos todavía — llegarán con la primera compra o abandono real.</td></tr>'}</tbody></table>
</body></html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
