import { useEffect, useState, type FormEvent } from 'react';
import type { PluginAdminExports } from 'emdash';

const BASE = '/_emdash/api/plugins/sably-video/';
async function api<T = any>(ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(BASE + ruta, {
    method: cuerpo === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: { 'X-EmDash-Request': '1', ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const sobre = await r.json().catch(() => ({})) as { success?: boolean; error?: { message?: string }; data?: T };
  if (!r.ok || sobre.success === false) throw new Error(sobre.error?.message ?? 'La sesión o el rol no permite esta operación.');
  return sobre.data as T;
}

interface Copia { id: string; proveedor: string; externoId: string; playbackId?: string; estado: 'preparando' | 'lista' | 'error' | 'borrada'; subtitulos?: string; mp4?: boolean; segundos?: number; resolucion?: string; error?: string; actualizado: number }
interface Video { id: string; titulo: string; original: string; web: string | null; segundos: number; ancho?: number; alto?: number; origen?: string; copias: Copia[]; usos: string[]; publico: { proveedor: string; mp4: string; hls?: string } | null }
interface Config { entrega: 'r2' | 'mux'; calidad: 'basic' | 'plus' | 'premium'; alertaUsd: number }
interface Panel { config: Config; mux: boolean; webhook: boolean; coste: { entradaUsd: number; almacenamientoMesUsd: number }; videos: Video[] }

const ESTADO: Record<Copia['estado'], string> = { preparando: 'Preparando', lista: 'Lista', error: 'Error', borrada: 'Borrada' };
const reloj = (s?: number) => s === undefined ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const usd = (n: number) => `USD ${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function VideoPage() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [pestana, setPestana] = useState<'biblioteca' | 'usos' | 'ajustes'>('biblioteca');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function cargar() { try { setPanel(await api<Panel>('estado')); setError(''); } catch (e) { setError((e as Error).message); } }
  useEffect(() => { void cargar(); }, []);
  async function accion(ruta: string, cuerpo: unknown, exito: (r: any) => string) {
    setOcupado(true); setAviso(''); setError('');
    try { const r = await api(ruta, cuerpo); setAviso(exito(r)); await cargar(); } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  }
  if (!panel) return <main className="sv"><h1>Vídeo</h1><p role="status">{error || 'Cargando…'}</p></main>;
  const c = panel.config;
  const gastoMes = panel.coste.almacenamientoMesUsd;
  return <main className="sv">
    <style>{ESTILOS}</style>
    <h1>Vídeo</h1>
    <p>Cada vídeo tiene su original y su MP4 en R2 (cdn.sably.co), que nunca se borran. Mux es una copia para servirlo con calidad adaptativa y subtítulos: si la copia falla o se borra, la página vuelve sola al MP4 de R2.</p>
    <div className="sv-cifras">
      <div><span>Vídeos</span><strong>{panel.videos.length}</strong></div>
      <div><span>Se sirve desde</span><strong>{c.entrega === 'mux' ? 'Mux (HLS)' : 'R2 (MP4)'}</strong></div>
      <div><span>Mux</span><strong>{panel.mux ? 'Conectado' : 'Sin claves'}</strong><small>{panel.webhook ? 'Webhook con firma' : 'Sin webhook: se consulta cada 10 min'}</small></div>
      <div><span>Mux estimado</span><strong className={gastoMes > c.alertaUsd ? 'sv-mal' : ''}>{usd(gastoMes)}/mes</strong><small>Codificación ya hecha: {usd(panel.coste.entradaUsd)}. La entrega no se estima: 100.000 min al mes son gratis y el crédito mensual es de 20 USD.</small></div>
    </div>
    {gastoMes > c.alertaUsd && <p className="sv-mal" role="alert">El almacenamiento estimado en Mux pasa del aviso de {usd(c.alertaUsd)} al mes.</p>}
    <div role="tablist" aria-label="Secciones de vídeo" className="sv-pestanas">
      {([['biblioteca', 'Biblioteca'], ['usos', 'Dónde se usa'], ['ajustes', 'Ajustes']] as const).map(([id, t]) =>
        <button key={id} role="tab" type="button" aria-selected={pestana === id} onClick={() => setPestana(id)}>{t}</button>)}
    </div>
    <p className="sv-avisos" role="status" aria-live="polite">{aviso}</p>
    {error && <p className="sv-mal" role="alert">{error}</p>}
    {pestana === 'biblioteca' && <section aria-label="Biblioteca">
      <p>
        <button type="button" disabled={ocupado} onClick={() => void accion('sembrar', {}, (r) => r.nuevos.length ? `Añadidos: ${r.nuevos.join(', ')}.` : 'No había vídeos nuevos en R2.')}>Cargar los vídeos de R2</button>
        <button type="button" disabled={ocupado || !panel.mux} onClick={() => void accion('enlazar-mux', {}, (r) => r.enlazados.length ? `Enlazados: ${r.enlazados.join(', ')}.` : 'No había copias nuevas en Mux.')}>Enlazar copias ya creadas en Mux</button>
        <button type="button" disabled={ocupado || !panel.mux} onClick={() => void accion('sincronizar', {}, (r) => `Consultadas ${r.consultadas} copias.`)}>Actualizar estados</button>
      </p>
      <table className="sv-tabla"><thead><tr><th>Vídeo</th><th>Duración</th><th>R2</th><th>Mux</th><th>En la web</th><th>Acciones</th></tr></thead><tbody>
        {panel.videos.map((v) => {
          const mux = v.copias.find((x) => x.proveedor === 'mux' && x.estado !== 'borrada');
          return <tr key={v.id}>
            <td><strong>{v.titulo}</strong><br /><small>{v.id}{v.origen ? ` · ${v.origen}` : ''}</small></td>
            <td>{reloj(v.segundos)}{v.alto ? <><br /><small>{v.ancho}×{v.alto}</small></> : null}</td>
            <td><a href={v.original} target="_blank" rel="noreferrer">Original</a>{v.web && <> · <a href={v.web} target="_blank" rel="noreferrer">MP4 web</a></>}</td>
            <td>{mux ? <>{ESTADO[mux.estado]}{mux.resolucion ? ` · ${mux.resolucion}` : ''}{mux.subtitulos ? ' · subtítulos' : ''}{mux.error && <><br /><small className="sv-mal">{mux.error}</small></>}</> : '—'}</td>
            <td>{v.publico ? (v.publico.proveedor === 'mux' ? 'Mux (HLS)' : 'R2 (MP4)') : <span className="sv-mal">No se muestra</span>}<br /><small>{v.usos.join(', ') || 'sin asignar'}</small></td>
            <td>
              {!mux && <button type="button" disabled={ocupado || !panel.mux} onClick={() => void accion('enviar-mux', { video: v.id }, () => 'Enviado a Mux. Tarda unos minutos en quedar listo.')}>Enviar a Mux</button>}
              {mux && <button type="button" disabled={ocupado} onClick={() => { if (confirm('¿Borrar la copia de Mux? El vídeo seguirá en R2 y la web volverá al MP4.')) void accion('borrar-copia', { video: v.id }, () => 'Copia de Mux borrada.'); }}>Borrar copia de Mux</button>}
            </td>
          </tr>;
        })}
      </tbody></table>
      {!panel.videos.length && <p>La biblioteca está vacía. «Cargar los vídeos de R2» da de alta los que ya están subidos.</p>}
    </section>}
    {pestana === 'usos' && <Usos panel={panel} ocupado={ocupado} accion={accion} />}
    {pestana === 'ajustes' && <form className="sv-form" onSubmit={(e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      void accion('ajustes', { entrega: f.get('entrega'), calidad: f.get('calidad'), alertaUsd: Number(f.get('alertaUsd')) }, () => 'Ajustes guardados.');
    }}>
      <label className="sv-campo"><span>Desde dónde se sirve al público</span>
        <select name="entrega" defaultValue={c.entrega}><option value="r2">R2: MP4 de una calidad (como hasta ahora)</option><option value="mux">Mux: calidad adaptativa y subtítulos cuando la copia está lista</option></select>
        <small>Con Mux, los navegadores sin HLS nativo (Firefox, algunos Android) reciben el MP4 de R2. Los vídeos sin copia lista siguen en R2.</small></label>
      <label className="sv-campo"><span>Calidad de las copias nuevas en Mux</span>
        <select name="calidad" defaultValue={c.calidad}><option value="premium">Premium (la mejor; codificación de pago)</option><option value="plus">Plus</option><option value="basic">Basic (codificación gratis)</option></select></label>
      <label className="sv-campo"><span>Aviso de gasto mensual en Mux (USD)</span>
        <input name="alertaUsd" type="number" min={0} max={500} step={0.5} defaultValue={c.alertaUsd} /></label>
      <button type="submit" disabled={ocupado}>Guardar ajustes</button>
    </form>}
  </main>;
}

function Usos({ panel, ocupado, accion }: { panel: Panel; ocupado: boolean; accion: (r: string, c: unknown, e: (x: any) => string) => Promise<void> }) {
  const [curso, setCurso] = useState('');
  const [video, setVideo] = useState(panel.videos[0]?.id ?? '');
  return <section aria-label="Dónde se usa">
    <p>Cada curso muestra como máximo un vídeo de presentación. Asignarlo aquí lo pinta en la ficha sin desplegar.</p>
    <form className="sv-form" onSubmit={(e) => { e.preventDefault(); void accion('asignar', { curso: curso.trim(), video }, () => `Asignado a ${curso.trim()}.`); }}>
      <label className="sv-campo"><span>Curso (slug)</span><input value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="curso-de-barberia" required pattern="[a-z0-9][a-z0-9-]+" /></label>
      <label className="sv-campo"><span>Vídeo</span><select value={video} onChange={(e) => setVideo(e.target.value)}>{panel.videos.map((v) => <option key={v.id} value={v.id}>{v.titulo}</option>)}</select></label>
      <button type="submit" disabled={ocupado || !curso || !video}>Asignar</button>
    </form>
    <table className="sv-tabla"><thead><tr><th>Curso</th><th>Vídeo</th><th></th></tr></thead><tbody>
      {panel.videos.flatMap((v) => v.usos.map((u) => <tr key={u}><td>{u.replace(/^curso:/, '')}</td><td>{v.titulo}</td>
        <td><button type="button" disabled={ocupado} onClick={() => void accion('asignar', { curso: u.replace(/^curso:/, ''), video: null }, () => 'Quitado.')}>Quitar</button></td></tr>))}
    </tbody></table>
  </section>;
}

const ESTILOS = `.sv{max-width:1180px;padding:24px}.sv h1{font-size:28px;font-weight:700}.sv p{margin:10px 0;max-width:80ch}
.sv button{background:#1765d1;color:#fff;border-radius:6px;padding:8px 14px;margin:4px 6px 4px 0;min-height:40px}.sv button:disabled{opacity:.55}
.sv button:focus-visible,.sv select:focus-visible,.sv input:focus-visible{outline:3px solid #ff8a65;outline-offset:2px}
.sv-pestanas{display:flex;gap:4px;border-bottom:1px solid #d6dbe4;margin:16px 0}.sv-pestanas button{background:transparent;color:inherit;border-radius:6px 6px 0 0;margin:0}.sv-pestanas button[aria-selected=true]{background:#1765d1;color:#fff}
.sv-cifras{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:12px 0}.sv-cifras div{border:1px solid #d6dbe4;border-radius:8px;padding:12px}.sv-cifras strong{display:block;font-size:22px}.sv-cifras small{display:block;opacity:.75}
.sv-tabla{width:100%;border-collapse:collapse;margin:12px 0}.sv-tabla th,.sv-tabla td{border-bottom:1px solid #e3e7ee;padding:8px;text-align:left;vertical-align:top}.sv a{text-decoration:underline}
.sv-form{display:grid;gap:12px;max-width:720px}.sv-campo{display:grid;gap:4px}.sv-campo input,.sv-campo select{border:1px solid #8b94a5;border-radius:6px;padding:8px;background:transparent;color:inherit}.sv option{color:#111}.sv-campo small{opacity:.75}
.sv-mal{color:#e5484d}`;

export const pages: PluginAdminExports['pages'] = { '/video': VideoPage };
