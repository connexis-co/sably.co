import { useState } from 'react';
import { COLLECTIONS, type AuditReport } from './model';
const labels = { courses: 'Cursos', course_locales: 'Variantes por país', blog: 'Artículos', pages: 'Páginas', categories: 'Categorías', countries: 'Países', cities: 'Ciudades', creators: 'Creadores', homologaciones: 'Homologaciones' };
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function isReport(value: unknown): value is AuditReport {
  const data = record(value);
  if (!data || !['scanned', 'errors', 'warnings'].every(key => typeof data[key] === 'number') || typeof data.generatedAt !== 'string' || !Array.isArray(data.rows)) return false;
  return data.rows.every(value => {
    const row = record(value);
    if (!row || !['id', 'slug', 'title', 'description', 'editorUrl'].every(key => typeof row[key] === 'string') || !COLLECTIONS.some(collection => collection === row.collection) || !['titleLength', 'descriptionLength', 'words'].every(key => typeof row[key] === 'number') || typeof row.generatedDescription !== 'boolean' || !Array.isArray(row.issues)) return false;
    return row.issues.every(value => { const issue = record(value); return issue && typeof issue.code === 'string' && typeof issue.message === 'string' && ['error', 'warning', 'info'].includes(String(issue.severity)); });
  });
}

function SeoAdmin() {
  const [report, setReport] = useState<AuditReport | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [collection, setCollection] = useState(''), [query, setQuery] = useState(''), [onlyIssues, setOnlyIssues] = useState(true);
  async function analyze() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/_emdash/api/plugins/sably-seo/audit', { credentials: 'same-origin', headers: { 'X-EmDash-Request': '1' } });
      const value = record(await response.json());
      if (!response.ok || value?.success !== true) {
        const message = record(value?.error)?.message;
        throw new Error(typeof message === 'string' ? message : 'No se pudo completar el análisis.');
      }
      if (!isReport(value.data)) throw new Error('EmDash devolvió un informe SEO con formato inesperado.');
      setReport(value.data);
    } catch (error) { setError(error instanceof Error ? error.message : 'Error de conexión.'); }
    finally { setBusy(false); }
  }
  const rows = report?.rows.filter(row => (!collection || row.collection === collection) && (!onlyIssues || row.issues.length > 0) && `${row.title} ${row.slug}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))) ?? [];
  return <main className="sably-seo"><style>{`.sably-seo{max-width:1180px;padding:24px}.sably-seo h1{font-size:28px;font-weight:700}.sably-seo h2{font-size:18px;font-weight:650}.sably-seo p{margin:10px 0}.sably-seo button{background:#1765d1;color:#fff;border-radius:6px;padding:10px 18px}.sably-seo button:disabled{opacity:.6}.sably-seo .stats,.sably-seo .filters{display:flex;flex-wrap:wrap;gap:20px;margin:24px 0}.sably-seo .stats div{border:1px solid #8885;border-radius:8px;padding:16px;min-width:160px}.sably-seo strong{font-size:24px;display:block}.sably-seo label{display:flex;gap:8px;align-items:center}.sably-seo input[type=search],.sably-seo select{border:1px solid #8887;padding:8px;background:var(--background,transparent);color:inherit;border-radius:6px}.sably-seo article{border-top:1px solid #8885;padding:18px 0}.sably-seo small{opacity:.75}.sably-seo a{color:#357ddc;text-decoration:underline}.sably-seo ul{list-style:disc;padding-left:22px}.sably-seo li{margin:5px 0}.sably-seo [role=alert]{border:1px solid #b44;padding:12px}.sably-seo .error{color:#c83e48}`}</style>
    <h1>SEO editorial de Sably</h1><p>Revisa títulos, descripciones, canónicas, imágenes y cuerpo del contenido publicado en EmDash, con reglas para los cursos, las páginas y los listados de Sably.</p>
    <p>Las recomendaciones no cambian el contenido ni bloquean publicaciones. Edita los campos y el panel SEO nativo de cada entrada para aplicar los ajustes.</p>
    <button type="button" disabled={busy} onClick={analyze}>{busy ? 'Analizando todas las entradas…' : report ? 'Actualizar análisis' : 'Analizar contenido publicado'}</button>
    {error && <p role="alert">{error}</p>}
    {report && <><p role="status">Análisis completo: {new Date(report.generatedAt).toLocaleString('es')}. Los resultados reflejan los datos guardados en ese momento.</p>
      <div className="stats"><div><strong>{report.scanned}</strong>Entradas revisadas</div><div><strong>{report.errors}</strong>Con campos necesarios pendientes</div><div><strong>{report.warnings}</strong>Con recomendaciones</div></div>
      <div className="filters"><label>Colección<select value={collection} onChange={event => setCollection(event.target.value)}><option value="">Todas</option>{COLLECTIONS.map(key => <option key={key} value={key}>{labels[key]}</option>)}</select></label><label>Buscar<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Título o slug" /></label><label><input type="checkbox" checked={onlyIssues} onChange={event => setOnlyIssues(event.target.checked)} />Solo con observaciones</label></div>
      <p>{rows.length} resultados. Las longitudes son orientativas: este panel no predice posiciones en Google ni sustituye el rastreo de las páginas públicas.</p>
      {rows.map(row => <article key={`${row.collection}:${row.id}`}><small>{labels[row.collection]} · {row.slug}</small><h2><a href={row.editorUrl}>{row.title || 'Sin título'}</a></h2><p>{row.description || (row.generatedDescription ? 'La plantilla genera la descripción pública usando los datos del país o ciudad.' : 'Sin descripción explícita')}</p><small>Título: {row.titleLength} caracteres · Descripción explícita: {row.descriptionLength} · Texto editorial: {row.words} palabras</small>{row.issues.length ? <ul>{row.issues.map(issue => <li key={issue.code} className={issue.severity === 'error' ? 'error' : ''}>{issue.message}</li>)}</ul> : <p>Sin observaciones en estas comprobaciones.</p>}</article>)}
      {!rows.length && <p>No hay entradas con estos filtros.</p>}</>}
  </main>;
}
export const pages = { '/seo': SeoAdmin };
