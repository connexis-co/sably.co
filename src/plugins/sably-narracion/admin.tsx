import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { PluginAdminExports } from 'emdash';

const BASE = '/_emdash/api/plugins/sably-narracion/';
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

type Estado = 'pendiente' | 'generando' | 'revision' | 'publicada' | 'reemplazada' | 'rechazada' | 'obsoleta' | 'error' | 'retirada';
interface Toma { id: string; coleccion: string; slug: string; titulo: string; estado: Estado; perfil: { vozId: string; voz: string; proveedor: string }; numero: number; origen: string; intentos: number; reintentarDesde: number; costoEstimadoUsd: number; costoUsd?: number; segundos?: number; url?: string; deposito?: string; error?: string; informe?: Record<string, any>; actualizado: number; palabras: number }
interface Voz { id: string; proveedor: string; voz: string; modelo?: string; etiqueta: string; origen: string; activa: boolean; permiso?: string }
interface Config { colecciones: Record<string, boolean>; voz: string; estilo: string; revision: 'automatica' | 'manual'; topeMensualUsd: number; topeLoteUsd: number; incluirPreguntas: boolean; deposito: string; pronunciaciones: Record<string, string>; caracteresPorSegundo: number }
interface Panel { config: Config; voces: Voz[]; proveedores: { id: string; nombre: string; disponible: boolean; puedeClonar: boolean; pausa: { hasta: number; motivo: string } | null }[]; tomas: Toma[]; permisos: any[]; colecciones: Record<string, string>; resumen: Partial<Record<Estado, number>>; gasto: { usd: number; tomas: number }; publicadas: number; deposito: { carpeta: string; r2: boolean } }

const ESTADOS: Record<Estado, string> = { pendiente: 'En cola', generando: 'Generando', revision: 'En revisión', publicada: 'Suena en el sitio', reemplazada: 'Reemplazada', rechazada: 'Rechazada', obsoleta: 'Obsoleta', error: 'Error', retirada: 'Retirada' };
const usd = (n?: number) => n === undefined ? '—' : `USD ${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: n > 0 && n < 0.1 ? 4 : 2 })}`;
const duracion = (s?: number) => s === undefined ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const fecha = (ms: number) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }).format(ms);
const escuchar = (t: Toma) => t.deposito === 'r2' && t.url ? t.url : `${BASE}escuchar?id=${encodeURIComponent(t.id)}`;

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return <label className="sn-campo"><span>{etiqueta}</span>{children}{ayuda && <small>{ayuda}</small>}</label>;
}

function Pestanas({ actual, cambiar }: { actual: string; cambiar: (p: string) => void }) {
  const lista = [['estado', 'Estado'], ['narraciones', 'Narraciones'], ['voces', 'Voces'], ['lote', 'Lote'], ['ajustes', 'Ajustes']];
  return <div role="tablist" aria-label="Secciones de narraciones" className="sn-pestanas">{lista.map(([id, txt]) =>
    <button key={id} role="tab" type="button" aria-selected={actual === id} onClick={() => cambiar(id!)}>{txt}</button>)}</div>;
}

function NarracionesPage() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [pestana, setPestana] = useState('estado');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function cargar() {
    try { setPanel(await api<Panel>('estado')); setError(''); } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void cargar(); }, []);
  async function accion(ruta: string, cuerpo: unknown, exito: string) {
    setOcupado(true); setAviso(''); setError('');
    try { const r = await api(ruta, cuerpo); setAviso(exito); await cargar(); return r; }
    catch (e) { setError((e as Error).message); return undefined; }
    finally { setOcupado(false); }
  }
  if (!panel) return <main className="sn"><h1>Narraciones</h1><p role="status">{error || 'Cargando…'}</p></main>;
  return <main className="sn">
    <style>{ESTILOS}</style>
    <h1>Narraciones</h1>
    <p>Cada artículo que se publica se narra solo con voz sintética. El texto sigue entero en la página; el audio es un añadido y, si el proveedor falla, el artículo se publica igual sin reproductor.</p>
    <Pestanas actual={pestana} cambiar={setPestana} />
    <p className="sn-avisos" role="status" aria-live="polite">{aviso}</p>
    {error && <p className="sn-error" role="alert">{error}</p>}
    {pestana === 'estado' && <Resumen panel={panel} accion={accion} ocupado={ocupado} />}
    {pestana === 'narraciones' && <Lista panel={panel} accion={accion} ocupado={ocupado} />}
    {pestana === 'voces' && <Voces panel={panel} accion={accion} ocupado={ocupado} />}
    {pestana === 'lote' && <Lote accion={accion} ocupado={ocupado} />}
    {pestana === 'ajustes' && <Ajustes panel={panel} accion={accion} ocupado={ocupado} />}
  </main>;
}

type Accion = (ruta: string, cuerpo: unknown, exito: string) => Promise<unknown>;

function Resumen({ panel, accion, ocupado }: { panel: Panel; accion: Accion; ocupado: boolean }) {
  const r = panel.resumen;
  const errores = panel.tomas.filter(t => t.estado === 'error' || (t.estado === 'pendiente' && t.error));
  return <section>
    <div className="sn-cifras">
      <div><strong>{panel.publicadas}</strong>Entradas con audio</div>
      <div><strong>{(r.pendiente ?? 0) + (r.generando ?? 0)}</strong>En cola</div>
      <div><strong>{r.revision ?? 0}</strong>En revisión</div>
      <div><strong>{r.error ?? 0}</strong>Con error</div>
      <div><strong>{usd(panel.gasto.usd)}</strong>Gastado este mes de {usd(panel.config.topeMensualUsd)}</div>
    </div>
    <h2>Proveedores</h2>
    <ul className="sn-lista">{panel.proveedores.map(p => <li key={p.id}>
      <b>{p.nombre}</b> · {p.disponible ? 'clave presente en el servidor' : 'sin clave en el servidor (no genera)'}
      {p.pausa && <> · <span className="sn-mal">en pausa hasta {fecha(p.pausa.hasta)}: {p.pausa.motivo}</span> <button type="button" disabled={ocupado} onClick={() => accion('reanudar', { proveedor: p.id }, 'Proveedor reanudado.')}>Reanudar</button></>}
    </li>)}</ul>
    <p>Audio guardado en {panel.deposito.r2 ? 'R2 (cdn.sably.co), con el disco del servidor de respaldo' : `el disco del servidor (${panel.deposito.carpeta})`}.</p>
    <button type="button" disabled={ocupado} onClick={() => accion('procesar', {}, 'Cola procesada.')}>{ocupado ? 'Procesando…' : 'Procesar la cola ahora'}</button>
    {errores.length > 0 && <><h2>Errores recientes</h2><ul className="sn-lista">{errores.map(t => <li key={t.id}><b>{t.titulo}</b>: {t.error} {t.estado === 'pendiente' && t.reintentarDesde > Date.now() ? `(reintento ${fecha(t.reintentarDesde)})` : ''}</li>)}</ul></>}
  </section>;
}

function Lista({ panel, accion, ocupado }: { panel: Panel; accion: Accion; ocupado: boolean }) {
  const [filtro, setFiltro] = useState('');
  const activas = panel.voces.filter(v => v.activa);
  const tomas = panel.tomas.filter(t => !filtro || t.estado === filtro);
  return <section>
    <Campo etiqueta="Mostrar"><select value={filtro} onChange={e => setFiltro(e.target.value)}><option value="">Todas</option>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
    <table className="sn-tabla"><thead><tr><th scope="col">Entrada</th><th scope="col">Estado</th><th scope="col">Voz</th><th scope="col">Duración</th><th scope="col">Coste</th><th scope="col">Acciones</th></tr></thead>
      <tbody>{tomas.map(t => <tr key={t.id}>
        <td><b>{t.titulo}</b><br /><small>{panel.colecciones[t.coleccion] ?? t.coleccion} · toma {t.numero + 1} · {t.palabras} palabras · {fecha(t.actualizado)}</small>
          {t.informe?.motivoRevision && <><br /><small className="sn-mal">{t.informe.motivoRevision}</small></>}
          {t.error && <><br /><small className="sn-mal">{t.error}</small></>}</td>
        <td>{ESTADOS[t.estado]}</td>
        <td>{t.perfil.vozId}</td>
        <td>{duracion(t.segundos)}</td>
        <td>{usd(t.costoUsd ?? t.costoEstimadoUsd)}{t.costoUsd === undefined ? ' (estimado)' : ''}</td>
        <td className="sn-acciones">
          {t.segundos !== undefined && t.url && <audio controls preload="none" src={escuchar(t)} aria-label={`Escuchar ${t.titulo}`} />}
          {t.estado === 'revision' && <button type="button" disabled={ocupado} onClick={() => accion('publicar', { id: t.id }, 'Narración publicada.')}>Publicar</button>}
          {t.estado === 'revision' && <button type="button" disabled={ocupado} onClick={() => { const nota = prompt('¿Qué hay que corregir?'); if (nota) void accion('rechazar', { id: t.id, nota }, 'Toma rechazada.'); }}>Rechazar</button>}
          {['publicada', 'revision', 'error', 'rechazada'].includes(t.estado) && <button type="button" disabled={ocupado} onClick={() => confirm('Regenerar crea otra toma y tiene coste. ¿Seguir?') && accion('regenerar', { id: t.id }, 'Toma nueva en cola.')}>Regenerar</button>}
          {t.estado === 'publicada' && <select aria-label={`Cambiar la voz de ${t.titulo}`} disabled={ocupado} value="" onChange={e => e.target.value && accion('cambiar-voz', { coleccion: t.coleccion, slug: t.slug, voz: e.target.value }, 'Voz cambiada: la toma nueva sustituirá a la actual al terminar.')}><option value="">Cambiar voz…</option>{activas.filter(v => v.id !== t.perfil.vozId).map(v => <option key={v.id} value={v.id}>{v.id}</option>)}</select>}
          {t.estado === 'publicada' && <button type="button" disabled={ocupado} onClick={() => confirm('El artículo dejará de mostrar el reproductor. ¿Seguir?') && accion('retirar', { coleccion: t.coleccion, slug: t.slug }, 'Narración retirada.')}>Retirar</button>}
        </td></tr>)}</tbody></table>
    {!tomas.length && <p>No hay narraciones con este filtro.</p>}
  </section>;
}

function Voces({ panel, accion, ocupado }: { panel: Panel; accion: Accion; ocupado: boolean }) {
  const [muestra, setMuestra] = useState<{ id: string; url: string } | null>(null);
  const clonables = panel.proveedores.filter(p => p.puedeClonar);
  const archivo = useRef<HTMLInputElement>(null);
  async function probar(id: string) {
    const r = await accion('voz-probar', { id }, 'Muestra generada.') as { mp3: string } | undefined;
    if (r?.mp3) setMuestra({ id, url: `data:audio/mpeg;base64,${r.mp3}` });
  }
  function nueva(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void accion('voz-nueva', Object.fromEntries(f), 'Voz añadida al catálogo.');
  }
  async function clonar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const subido = archivo.current?.files?.[0];
    if (!subido) return;
    const bytes = new Uint8Array(await subido.arrayBuffer());
    let binario = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    void accion('clonar', { proveedor: f.get('proveedor'), persona: f.get('persona'), relacion: f.get('relacion'), medio: f.get('medio'), fechaPermiso: f.get('fechaPermiso'), consentimiento: f.get('consentimiento') === 'si', muestra: btoa(binario), nombreArchivo: subido.name }, 'Voz clonada y registrada con su permiso.');
  }
  return <section>
    <table className="sn-tabla"><thead><tr><th scope="col">Voz</th><th scope="col">Proveedor</th><th scope="col">Origen</th><th scope="col">Acciones</th></tr></thead>
      <tbody>{panel.voces.map(v => <tr key={v.id}>
        <td><b>{v.id}</b>{panel.config.voz === v.id && ' · por defecto'}<br /><small>{v.etiqueta}</small></td>
        <td>{v.proveedor} · {v.voz}</td>
        <td>{v.origen === 'clonada' ? 'Clonada con permiso' : 'Biblioteca'}{!v.activa && ' · desactivada'}</td>
        <td className="sn-acciones">
          <button type="button" disabled={ocupado || !v.activa} onClick={() => probar(v.id)}>Probar (~USD 0,003)</button>
          {muestra?.id === v.id && <audio controls autoPlay src={muestra.url} aria-label={`Muestra de ${v.id}`} />}
          {v.activa && panel.config.voz !== v.id && <button type="button" disabled={ocupado} onClick={() => accion('ajustes', { voz: v.id }, 'Voz por defecto cambiada. Las entradas nuevas usarán esta voz; las publicadas siguen igual hasta regenerarlas.')}>Usar por defecto</button>}
          {panel.config.voz !== v.id && <button type="button" disabled={ocupado} onClick={() => accion('voz-activa', { id: v.id, activa: !v.activa }, v.activa ? 'Voz desactivada.' : 'Voz activada.')}>{v.activa ? 'Desactivar' : 'Activar'}</button>}
        </td></tr>)}</tbody></table>
    <h2>Añadir una voz de la biblioteca</h2>
    <form onSubmit={nueva} className="sn-form">
      <Campo etiqueta="Proveedor"><select name="proveedor">{panel.proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo>
      <Campo etiqueta="Identificador de la voz" ayuda="Tal como lo da el proveedor, por ejemplo es-419-csagent-9."><input name="voz" required pattern="[\w.\-]{2,80}" /></Campo>
      <Campo etiqueta="Modelo (opcional)"><input name="modelo" /></Campo>
      <Campo etiqueta="Descripción" ayuda="Cómo suena: género, edad, acento, carácter."><input name="etiqueta" required maxLength={160} /></Campo>
      <button type="submit" disabled={ocupado}>Añadir voz</button>
    </form>
    <h2>Clonar una voz</h2>
    {!clonables.length ? <p>Ningún proveedor configurado permite clonar voces.</p> : <form onSubmit={clonar} className="sn-form">
      <p>Solo con el <b>permiso expreso</b> de la persona dueña de la voz. El permiso queda registrado (quién, cómo, cuándo y la huella de la muestra) y retirarlo desactiva la voz. Esta función no se ha probado aún contra la API del proveedor.</p>
      <Campo etiqueta="Proveedor"><select name="proveedor">{clonables.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo>
      <Campo etiqueta="Nombre completo de la persona"><input name="persona" required minLength={3} /></Campo>
      <Campo etiqueta="Relación con Sably" ayuda="Por ejemplo: creadora del curso de uñas."><input name="relacion" /></Campo>
      <Campo etiqueta="Cómo dio el permiso" ayuda="Documento firmado, correo, grabación…"><input name="medio" required minLength={3} /></Campo>
      <Campo etiqueta="Fecha del permiso"><input name="fechaPermiso" type="date" required /></Campo>
      <Campo etiqueta="Muestra de voz" ayuda="Entre 10 s y 5 min de la persona hablando sola, sin música (MP3, WAV o M4A)."><input ref={archivo} type="file" accept="audio/*" required /></Campo>
      <label className="sn-casilla"><input type="checkbox" name="consentimiento" value="si" required /> Tengo el permiso expreso y por escrito de esta persona para clonar su voz y usarla en sably.co.</label>
      <button type="submit" disabled={ocupado}>Clonar y registrar el permiso</button>
    </form>}
    {panel.permisos.length > 0 && <><h2>Permisos registrados</h2><ul className="sn-lista">{panel.permisos.map(p => <li key={p.id}><b>{p.persona}</b> · {p.medio} · {p.fechaPermiso} · registrado por {p.registradoPor}{p.retirado ? ' · retirado' : <> <button type="button" disabled={ocupado} onClick={() => confirm('La voz clonada dejará de usarse. ¿Seguir?') && accion('retirar-permiso', { id: p.id }, 'Permiso retirado y voz desactivada.')}>Retirar permiso</button></>}</li>)}</ul></>}
  </section>;
}

function Lote({ accion, ocupado }: { accion: Accion; ocupado: boolean }) {
  const [lote, setLote] = useState<{ entradas: { coleccion: string; slug: string; titulo: string; minutos: number; usd: number }[]; usd: number; minutos: number; topeLoteUsd: number; gasto: { usd: number }; topeMensualUsd: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api('lote').then(setLote, (e: Error) => setError(e.message)); }, []);
  if (error) return <p className="sn-error" role="alert">{error}</p>;
  if (!lote) return <p role="status">Calculando lo que falta por narrar…</p>;
  return <section>
    <p><b>{lote.entradas.length}</b> entradas publicadas sin narración vigente: unos <b>{lote.minutos} min</b> de audio, <b>{usd(lote.usd)}</b> estimados. Tope del lote: {usd(lote.topeLoteUsd)}; gastado este mes: {usd(lote.gasto.usd)} de {usd(lote.topeMensualUsd)}.</p>
    {lote.usd > lote.topeLoteUsd && <p className="sn-mal">El total pasa del tope del lote: solo se encolarán las primeras hasta llegar a él.</p>}
    <button type="button" disabled={ocupado || !lote.entradas.length} onClick={() => confirm(`Se encolan hasta ${usd(Math.min(lote.usd, lote.topeLoteUsd))} de narraciones. ¿Lanzar el lote?`) && accion('lote-lanzar', { confirmar: true }, 'Lote en cola: el trabajador lo procesa en segundo plano.')}>Lanzar el lote</button>
    <table className="sn-tabla"><thead><tr><th scope="col">Entrada</th><th scope="col">Minutos</th><th scope="col">Estimado</th></tr></thead>
      <tbody>{lote.entradas.map(e => <tr key={e.coleccion + e.slug}><td>{e.titulo}</td><td>{e.minutos}</td><td>{usd(e.usd)}</td></tr>)}</tbody></table>
  </section>;
}

function Ajustes({ panel, accion, ocupado }: { panel: Panel; accion: Accion; ocupado: boolean }) {
  const c = panel.config;
  function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pronunciaciones = Object.fromEntries(String(f.get('pronunciaciones') ?? '').split('\n').map(l => l.split('=').map(x => x.trim())).filter(p => p.length === 2 && p[0] && p[1]));
    void accion('ajustes', {
      colecciones: Object.fromEntries(Object.keys(panel.colecciones).map(k => [k, f.get(`col-${k}`) === 'si'])),
      revision: f.get('revision'), topeMensualUsd: Number(f.get('topeMensualUsd')), topeLoteUsd: Number(f.get('topeLoteUsd')),
      incluirPreguntas: f.get('incluirPreguntas') === 'si', deposito: f.get('deposito'), estilo: f.get('estilo'), pronunciaciones,
      caracteresPorSegundo: Number(f.get('caracteresPorSegundo')),
    }, 'Ajustes guardados.');
  }
  return <form onSubmit={guardar} className="sn-form">
    <fieldset><legend>Qué se narra</legend>{Object.entries(panel.colecciones).map(([k, v]) => <label key={k} className="sn-casilla"><input type="checkbox" name={`col-${k}`} value="si" defaultChecked={c.colecciones[k]} /> {v}</label>)}
      <label className="sn-casilla"><input type="checkbox" name="incluirPreguntas" value="si" defaultChecked={c.incluirPreguntas} /> Incluir las preguntas frecuentes del artículo</label></fieldset>
    <Campo etiqueta="Revisión" ayuda="Automática: se publica sola si todos los tramos duran lo esperado; si no, queda en revisión. Manual: siempre hay que escucharla y publicarla aquí."><select name="revision" defaultValue={c.revision}><option value="automatica">Automática con controles</option><option value="manual">Manual</option></select></Campo>
    <Campo etiqueta="Tope de gasto mensual (USD)"><input name="topeMensualUsd" type="number" min={0} max={200} step={0.5} defaultValue={c.topeMensualUsd} /></Campo>
    <Campo etiqueta="Tope por lote (USD)"><input name="topeLoteUsd" type="number" min={0} max={100} step={0.5} defaultValue={c.topeLoteUsd} /></Campo>
    <Campo etiqueta="Dónde se guarda el audio"><select name="deposito" defaultValue={c.deposito}><option value="auto">Automático (R2 si está configurado; si no, disco)</option><option value="r2">R2 (cdn.sably.co)</option><option value="disco">Disco del servidor</option></select></Campo>
    <Campo etiqueta="Dirección de estilo" ayuda="Indicaciones de tono para la voz; no se leen en voz alta."><textarea name="estilo" rows={3} defaultValue={c.estilo} /></Campo>
    <Campo etiqueta="Pronunciaciones" ayuda="Una por línea: TEXTO = cómo se lee. Ejemplo: SMAW = ese eme a doble ve"><textarea name="pronunciaciones" rows={5} defaultValue={Object.entries(c.pronunciaciones).map(([k, v]) => `${k} = ${v}`).join('\n')} /></Campo>
    <Campo etiqueta="Caracteres por segundo de la voz" ayuda="Para el control de duración de cada tramo. Medido con la voz por defecto."><input name="caracteresPorSegundo" type="number" min={8} max={30} step={0.1} defaultValue={c.caracteresPorSegundo} /></Campo>
    <button type="submit" disabled={ocupado}>Guardar ajustes</button>
  </form>;
}

const ESTILOS = `.sn{max-width:1180px;padding:24px}.sn h1{font-size:28px;font-weight:700}.sn h2{font-size:18px;font-weight:650;margin:24px 0 8px}.sn p{margin:10px 0;max-width:80ch}
.sn button{background:#1765d1;color:#fff;border-radius:6px;padding:8px 14px;margin:4px 6px 4px 0;min-height:40px}.sn button:disabled{opacity:.55}
.sn button:focus-visible,.sn select:focus-visible,.sn input:focus-visible,.sn textarea:focus-visible{outline:3px solid #ff8a65;outline-offset:2px}.sn-tabla th,.sn-tabla td{border-color:#8b94a540}
.sn-pestanas{display:flex;gap:4px;border-bottom:1px solid #d6dbe4;margin:16px 0}.sn-pestanas button{background:transparent;color:inherit;border-radius:6px 6px 0 0;margin:0}.sn-pestanas button[aria-selected=true]{background:#1765d1;color:#fff}
.sn-cifras{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:12px 0}.sn-cifras div{border:1px solid #d6dbe4;border-radius:8px;padding:12px}.sn-cifras strong{display:block;font-size:24px}
.sn-tabla{width:100%;border-collapse:collapse;margin:12px 0}.sn-tabla th,.sn-tabla td{border-bottom:1px solid #e3e7ee;padding:8px;text-align:left;vertical-align:top}.sn-acciones audio{max-width:260px;display:block;margin-bottom:4px}
.sn-form{display:grid;gap:12px;max-width:720px}.sn-campo{display:grid;gap:4px}.sn-campo input,.sn-campo select,.sn-campo textarea{border:1px solid #8b94a5;border-radius:6px;padding:8px;background:transparent;color:inherit}.sn select{color:inherit;background:transparent}.sn option{color:#111}.sn-campo small{opacity:.75}
.sn-casilla{display:flex;gap:8px;align-items:flex-start}.sn fieldset{border:1px solid #d6dbe4;border-radius:8px;padding:12px;display:grid;gap:8px}
.sn-mal,.sn-error{color:#e5484d}.sn-lista{display:grid;gap:6px;padding-left:18px;list-style:disc}`;

export const pages: PluginAdminExports['pages'] = { '/narraciones': NarracionesPage };
