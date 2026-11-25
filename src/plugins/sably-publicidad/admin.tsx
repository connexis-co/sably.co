import { useEffect, useState } from 'react';
import {
  DEFAULT_CONFIG, FORMATOS, LINEA_ADS_TXT, POSICIONES, POSICIONES_INFO, ROTULOS, TIPOS_PAGINA,
  type ConfigPublicidad, type Dispositivo, type IdPosicion, type Posicion, type Rotulo,
} from './model';

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/_emdash/api/plugins/sably-publicidad/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-EmDash-Request': '1' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await r.json() as { success?: boolean; error?: { message?: string }; data: T };
  if (!r.ok || !value.success) throw new Error(value.error?.message || 'No se pudo guardar la configuración.');
  return value.data;
}
const DISPOSITIVOS: [Dispositivo, string][] = [['ambos', 'Móvil y escritorio'], ['movil', 'Solo móvil'], ['escritorio', 'Solo escritorio']];
const MEDIDAS = ['300x250', '336x280', '320x100', '320x50', '728x90', '970x90', '970x250', '300x600', '160x600', '250x250', '468x60'];
const split = (t: string) => t.split('\n').map(x => x.trim()).filter(Boolean);

function Medida({ label, value, onChange, max }: { label: string; value: { ancho: number; alto: number }; onChange: (v: { ancho: number; alto: number }) => void; max: number }) {
  const actual = `${value.ancho}x${value.alto}`;
  return <label>{label}<select value={MEDIDAS.includes(actual) ? actual : 'otra'} onChange={e => { if (e.target.value === 'otra') return; const [a = 300, h = 250] = e.target.value.split('x').map(Number); onChange({ ancho: a, alto: h }); }}>
    {MEDIDAS.filter(m => Number(m.split('x')[0]) <= max).map(m => <option key={m} value={m}>{m.replace('x', ' × ')}</option>)}
    <option value="otra">Otra ({value.ancho} × {value.alto})</option></select>
    <span className="fila"><input type="number" min={50} max={max} value={value.ancho} aria-label={`${label}: ancho`} onChange={e => onChange({ ...value, ancho: Number(e.target.value) })} /><input type="number" min={50} max={1200} value={value.alto} aria-label={`${label}: alto`} onChange={e => onChange({ ...value, alto: Number(e.target.value) })} /></span></label>;
}

/** Vista previa esquemática: dónde caerían los huecos activos en un artículo, por dispositivo. */
function Vista({ config, dispositivo }: { config: ConfigPublicidad; dispositivo: 'movil' | 'escritorio' }) {
  const ve = (id: IdPosicion) => { const p = config.posiciones[id]; return config.enabled && p.activa && (p.dispositivo === 'ambos' || p.dispositivo === dispositivo); };
  const caja = (id: IdPosicion, k?: number) => { const p = config.posiciones[id]; const t = dispositivo === 'movil' ? p.movil : p.escritorio; const escala = dispositivo === 'movil' ? 0.6 : 0.45;
    return <div key={`${id}${k ?? ''}`} className="hueco" style={{ width: Math.min(t.ancho * escala, dispositivo === 'movil' ? 200 : 300), height: t.alto * escala }}><small>{config.rotulo}</small><span>{POSICIONES_INFO[id].label}<br />{t.ancho} × {t.alto}</span></div>; };
  const t = config.posiciones['articulo-texto'];
  const parrafos = Array.from({ length: 12 }, (_, i) => i + 1);
  let puestos = 0;
  return <div className={`vista vista-${dispositivo}`}><div className="col">
    <div className="h1" /><div className="p" />{ve('articulo-arriba') && caja('articulo-arriba')}
    {parrafos.map(n => { const poner = ve('articulo-texto') && n % t.cada === 0 && n < 12 && puestos < t.maximo; if (poner) puestos++; return <div key={n}><div className="p" />{poner && caja('articulo-texto', n)}</div>; })}
    {ve('articulo-final') && caja('articulo-final')}<div className="p corto" /></div>
    {dispositivo === 'escritorio' && <div className="lat"><div className="toc" />{ve('articulo-lateral') && caja('articulo-lateral')}</div>}
    <p className="nota">Esquema a escala reducida. El tope de {config.maximoPorPagina} anuncios por página y el mínimo de {config.minimoPalabras} palabras se aplican en el sitio.</p></div>;
}

function PublicidadAdmin() {
  const [config, setConfig] = useState<ConfigPublicidad>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [exclusiones, setExclusiones] = useState('');
  useEffect(() => { api<{ config: ConfigPublicidad }>('config').then(v => { setConfig(v.config); setExclusiones(v.config.exclusiones.join('\n')); setReady(true); }).catch(e => setMessage(e.message)); }, []);
  const update = <K extends keyof ConfigPublicidad>(k: K, v: ConfigPublicidad[K]) => setConfig(s => ({ ...s, [k]: v }));
  const pos = (id: IdPosicion, patch: Partial<Posicion>) => setConfig(s => ({ ...s, posiciones: { ...s.posiciones, [id]: { ...s.posiciones[id], ...patch } } }));
  const save = async () => { setBusy(true); setMessage(''); try { const v = await api<{ config: ConfigPublicidad }>('save', { ...config, exclusiones: split(exclusiones) }); setConfig(v.config); setMessage('Guardado. Las páginas se regeneran en la siguiente visita (hasta ~5 min por la caché).'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Error al guardar.'); } finally { setBusy(false); } };
  const protegidosMarcados = config.tiposPagina.some(t => TIPOS_PAGINA.find(x => x.id === t)?.protegido);
  return <div className="sably-ads-admin"><style>{`.sably-ads-admin{max-width:1150px;padding:24px;color:var(--foreground,inherit)}.sably-ads-admin h1{font-size:28px;font-weight:700}.sably-ads-admin h2{font-size:20px;font-weight:650;margin-bottom:12px}.sably-ads-admin section,.sably-ads-admin details{border:1px solid #8885;border-radius:10px;padding:20px;margin:20px 0}.sably-ads-admin label{display:flex;flex-direction:column;gap:6px;font-size:14px}.sably-ads-admin input:not([type=checkbox]),.sably-ads-admin select,.sably-ads-admin textarea{width:100%;border:1px solid #8888;border-radius:6px;padding:9px;background:var(--background,transparent);color:inherit}.sably-ads-admin textarea{min-height:90px;font-family:ui-monospace,monospace;font-size:13px}.sably-ads-admin .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.sably-ads-admin .check{flex-direction:row;align-items:center;gap:8px}.sably-ads-admin .checks{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0}.sably-ads-admin .fila{display:flex;gap:6px}.sably-ads-admin small,.sably-ads-admin .ayuda{opacity:.75;font-size:13px}.sably-ads-admin button{padding:9px 15px;background:#1666d8;color:#fff;border-radius:6px;margin:10px 8px 0 0}.sably-ads-admin button:disabled{opacity:.5}.sably-ads-admin summary{cursor:pointer;font-weight:600}.sably-ads-admin [role=status]{padding:12px;border:1px solid #8888;border-radius:6px}.sably-ads-admin .aviso{padding:12px;border-radius:6px;background:#fff4e5;color:#6b3d00;font-size:14px}.sably-ads-admin .vistas{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start}.sably-ads-admin .vista{display:flex;gap:12px;flex-wrap:wrap;padding:12px;border:1px solid #8886;border-radius:10px;background:#fff;color:#333}.sably-ads-admin .vista-movil .col{width:216px}.sably-ads-admin .vista-escritorio .col{width:330px}.sably-ads-admin .h1{height:18px;width:80%;background:#1b1b3a;border-radius:3px;margin-bottom:8px}.sably-ads-admin .p{height:22px;background:repeating-linear-gradient(#d9dce4 0 4px,transparent 4px 9px);margin:6px 0}.sably-ads-admin .p.corto{width:60%}.sably-ads-admin .lat{width:150px}.sably-ads-admin .toc{height:90px;background:#eef0f5;border-radius:6px;margin-bottom:8px}.sably-ads-admin .hueco{margin:8px auto;border:1px dashed #c92c52;background:#fdeef1;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;text-align:center;color:#7a1a32}.sably-ads-admin .hueco small{opacity:1;font-size:9px;text-transform:uppercase;letter-spacing:.06em}.sably-ads-admin .nota{flex-basis:100%;font-size:12px;opacity:.7;margin:0}`}</style>
    <h1>Publicidad (Google AdSense)</h1>
    <p>Anuncios en el blog y las guías sin tocar fichas, caja de compra, portada ni listados. Cada hueco guarda su tamaño (la página no se mueve) y no se piden anuncios sin el permiso de «Publicidad» del aviso de cookies, salvo que lo cambies abajo.</p>
    {message && <p role="status">{message}</p>}
    {!ready ? <p>Cargando configuración…</p> : <>
      <section><h2>General</h2>
        <div className="checks">
          <label className="check"><input type="checkbox" checked={config.enabled} onChange={e => update('enabled', e.target.checked)} /><strong>Publicidad activa</strong></label>
          <label className="check"><input type="checkbox" checked={config.muestra} onChange={e => update('muestra', e.target.checked)} />Huecos de muestra (cajas grises, sin Google)</label>
          <label className="check"><input type="checkbox" checked={config.exigirConsentimiento} onChange={e => update('exigirConsentimiento', e.target.checked)} />Exigir permiso de «Publicidad» del aviso de cookies</label>
          <label className="check"><input type="checkbox" checked={config.metaVerificacion} onChange={e => update('metaVerificacion', e.target.checked)} />Meta de verificación del sitio (google-adsense-account)</label>
        </div>
        {config.muestra && config.enabled && <p className="aviso">Con «huecos de muestra» las cajas grises las ve cualquiera que abra el blog. Úsalo en local o en dev.sably.co, no en producción.</p>}
        {!config.exigirConsentimiento && <p className="aviso">Sin exigir permiso, a quien no aceptó se le piden anuncios no personalizados (requestNonPersonalizedAds) y se carga el script de Google: decisión legal de JP.</p>}
        <div className="grid">
          <label>Identificador de editor<input value={config.cliente} placeholder="ca-pub-0000000000000000" onChange={e => update('cliente', e.target.value.trim())} /><small>Lo da AdSense en Cuenta → Información de la cuenta.</small></label>
          <label>Rótulo sobre cada anuncio<select value={config.rotulo} onChange={e => update('rotulo', e.target.value as Rotulo)}>{ROTULOS.map(r => <option key={r}>{r}</option>)}</select><small>La política de AdSense en español solo admite estos dos.</small></label>
          <label>Tope de anuncios por página<input type="number" min={1} max={6} value={config.maximoPorPagina} onChange={e => update('maximoPorPagina', Number(e.target.value))} /><small>Por dispositivo. No cuenta los automáticos.</small></label>
          <label>Mínimo de palabras para anuncios dentro del texto<input type="number" min={0} max={5000} value={config.minimoPalabras} onChange={e => update('minimoPalabras', Number(e.target.value))} /></label>
        </div></section>

      <section><h2>Anuncios automáticos</h2>
        <p className="ayuda">Google decide dónde ponerlos. Qué formatos salen (ancla, viñeta, lateral, banners en la página) se elige en AdSense → Anuncios → Por sitio. Aquí solo se decide en qué dispositivos se carga el script en las páginas permitidas: fuera de ellas no hay anuncios automáticos.</p>
        <div className="checks"><label className="check"><input type="checkbox" checked={config.automaticos.activos} onChange={e => update('automaticos', { ...config.automaticos, activos: e.target.checked })} />Cargar anuncios automáticos</label>
          <label className="check"><input type="checkbox" checked={config.automaticos.anclaSoloAbajo} onChange={e => update('automaticos', { ...config.automaticos, anclaSoloAbajo: e.target.checked })} />Ancla solo abajo (data-overlays="bottom")</label></div>
        <label style={{ maxWidth: 280 }}>Dispositivos<select value={config.automaticos.dispositivo} onChange={e => update('automaticos', { ...config.automaticos, dispositivo: e.target.value as Dispositivo })}>{DISPOSITIVOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <p className="ayuda">Recomendado si se activan: solo móvil, solo el ancla inferior; viñeta, lateral, banners en la página, «disparadores adicionales de viñeta» e «intents» apagados en AdSense (motivos en docs/equipo/2026-11-25/publicidad/ESTUDIO.md).</p></section>

      <section><h2>Posiciones</h2>
        {POSICIONES.map(id => { const p = config.posiciones[id]; const info = POSICIONES_INFO[id]; return <details key={id} open={p.activa}><summary>{info.label}{p.activa ? ' · activa' : ' · apagada'}</summary>
          <p className="ayuda">{info.donde} Nombre en plantilla: <code>{id}</code>.</p>
          <div className="checks"><label className="check"><input type="checkbox" checked={p.activa} onChange={e => pos(id, { activa: e.target.checked })} />Activar</label></div>
          <div className="grid">
            <label>Formato<select value={p.formato} onChange={e => pos(id, { formato: e.target.value as Posicion['formato'] })}>{FORMATOS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select><small>{FORMATOS.find(f => f.id === p.formato)?.ayuda}</small></label>
            <label>ID de la unidad (data-ad-slot)<input value={p.unidad} placeholder="Vacío: hueco sin anuncio" onChange={e => pos(id, { unidad: e.target.value.trim() })} /></label>
            {p.formato === 'in-feed' && <label>Clave de diseño (data-ad-layout-key)<input value={p.claveDiseno} onChange={e => pos(id, { claveDiseno: e.target.value.trim() })} /></label>}
            <label>Dispositivo<select value={p.dispositivo} onChange={e => pos(id, { dispositivo: e.target.value as Dispositivo })}>{DISPOSITIVOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            {p.dispositivo !== 'escritorio' && <Medida label="Tamaño en móvil" value={p.movil} max={360} onChange={v => pos(id, { movil: v })} />}
            {p.dispositivo !== 'movil' && <Medida label="Tamaño en escritorio" value={p.escritorio} max={1200} onChange={v => pos(id, { escritorio: v })} />}
            {info.usaCada && <><label>{id === 'blog-rejilla' ? 'Un anuncio cada N tarjetas' : 'Un anuncio cada N párrafos'}<input type="number" min={2} max={20} value={p.cada} onChange={e => pos(id, { cada: Number(e.target.value) })} /></label>
              <label>Máximo en esta posición<input type="number" min={1} max={5} value={p.maximo} onChange={e => pos(id, { maximo: Number(e.target.value) })} /></label></>}
          </div></details>; })}
      </section>

      <section><h2>Dónde se permite</h2>
        <div className="checks">{TIPOS_PAGINA.map(t => <label key={t.id} className="check"><input type="checkbox" checked={config.tiposPagina.includes(t.id)} onChange={e => update('tiposPagina', e.target.checked ? [...config.tiposPagina, t.id] : config.tiposPagina.filter(x => x !== t.id))} />{t.label}{t.protegido ? ' ⚠' : ''}</label>)}</div>
        {protegidosMarcados && <label className="check aviso"><input type="checkbox" checked={config.confirmoProtegidos} onChange={e => update('confirmoProtegidos', e.target.checked)} />Confirmo que quiero publicidad en páginas que venden (⚠): puede restar compras y clics a los cursos.</label>}
        <label>Sin publicidad en estas rutas<textarea value={exclusiones} onChange={e => setExclusiones(e.target.value)} placeholder={'/blog/un-articulo/\n/legal/*'} /><small>Una por línea, desde «/». Admiten *.</small></label></section>

      <section><h2>ads.txt</h2>
        <p className="ayuda">Se sirve en https://sably.co/ads.txt aunque la publicidad esté apagada (AdSense lo pide antes de aprobar el sitio). Vacío: la dirección da 404.</p>
        <textarea value={config.adsTxt} onChange={e => update('adsTxt', e.target.value)} placeholder="google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0" />
        <button type="button" disabled={!config.cliente} onClick={() => update('adsTxt', LINEA_ADS_TXT(config.cliente))}>Generar la línea de Google con el identificador</button></section>

      <section><h2>Vista previa</h2><div className="vistas"><div><p><strong>Móvil</strong></p><Vista config={config} dispositivo="movil" /></div><div><p><strong>Escritorio</strong></p><Vista config={config} dispositivo="escritorio" /></div></div>
        <p className="ayuda">Para verlo en un artículo real: activa «Huecos de muestra» en local o en dev.sably.co y abre cualquier artículo del blog.</p></section>
      <button disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar publicidad'}</button>
    </>}
  </div>;
}
export const pages = { '/publicidad': PublicidadAdmin };
