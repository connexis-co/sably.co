/**
 * «Ajustes del sitio»: los ajustes de Sably ordenados por tarea (ORDEN.md, docs/equipo/2026-11-25/panel).
 * Lee y guarda por la API nativa de EmDash (`/_emdash/api/admin/plugins/sably-operations/settings`), la misma del
 * formulario genérico: mismas claves y misma invalidación de caché. Solo envía lo que cambió, para no fijar un valor
 * de fábrica (por ejemplo el tema, que sin guardar obedece a la variable del servidor).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { api, CSS_SO, Notice, Promotions, WidgetEditor } from './admin-comun';
import { bloquesParaElPanel, ORDEN_DE_FABRICA } from '../../lib/portada-bloques';
import { leerPruebaHeroe } from '../../lib/prueba-heroe';
import { AJUSTES_PELIGROSOS, CAMPANA_CLAVES, PESTANAS, cambiosAGuardar, settingsSchema, textoDeValor, valorDeFabrica, type ClaveAjuste, type IdPestana } from './ajustes';

const NATIVA = '/_emdash/api/admin/plugins/sably-operations/settings';
const ADMIN = '/_emdash/admin';
type Valores = Partial<Record<ClaveAjuste, unknown>>;

async function nativa<T>(method: 'GET' | 'PUT', body?: unknown): Promise<T> {
  const r = await fetch(NATIVA, { method, credentials: 'same-origin', headers: { 'X-EmDash-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json() as { success?: boolean; data: T; error?: { message?: string } };
  if (!r.ok || j.success === false) throw new Error(j.error?.message ?? 'No se pudo completar. Revisa la sesión y el rol (administrador).');
  return j.data;
}

/** Estado de la prueba A/B del héroe con lo guardado (no con el borrador). */
function EstadoPruebaAB({ valores }: { valores: Valores }) {
  const p = leerPruebaHeroe(valores.portadaHeroeAB, valores.portadaHeroeABVariantes ?? 'muro, buscador', valores.portadaHeroeABReparto, valores.portadaHeroeABInicio);
  if (valores.portadaHeroeAB !== true) return <p>Estado: <strong>apagada</strong>. Manda «Variante del héroe». Primera prueba propuesta: collage contra buscador primero (14 contra 06), 14 días como mínimo.</p>;
  if (!p) return <p role="alert">Estado: <strong>encendida pero sin efecto</strong>: hacen falta dos o tres variantes válidas (el mosaico no entra). Mientras tanto manda «Variante del héroe».</p>;
  const dias = p.inicio ? Math.floor((Date.now() - Date.parse(`${p.inicio}T00:00:00Z`)) / 86_400_000) : null;
  const reparto = p.variantes.map((v, i) => `${v} ${Math.round(p.pesos[i]! * 100)} %`).join(' · ');
  return <p>Estado: <strong>encendida</strong>{p.inicio ? ` desde el ${p.inicio} (${dias} ${dias === 1 ? 'día' : 'días'}${dias !== null && dias < 14 ? `; faltan ${14 - dias} para el mínimo de 14: no la cortes antes` : '; ya pasó el mínimo de 14 días'})` : ' (sin fecha de inicio)'}. Reparto: {reparto}. Control y bots: {p.variantes[0]}. En GA4: evento experiment_impression con experiment_id «heroe_portada» y variant_id; la métrica principal es click_course_home por variant_id.</p>;
}

function Campo({ clave, valor, guardado, onChange }: { clave: ClaveAjuste; valor: unknown; guardado: boolean; onChange: (v: unknown) => void }) {
  const campo = settingsSchema[clave];
  const id = `aj-${clave}`;
  const fabrica = valorDeFabrica(clave);
  const rotulo = campo.label.replace(/^[^·]+ · /, '');
  const control = campo.type === 'select'
    ? <select id={id} value={String(valor ?? '')} onChange={e => onChange(e.target.value)} aria-describedby={`${id}-ayuda`}>{campo.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    : campo.type === 'boolean'
      ? <select id={id} value={valor === false ? 'no' : 'si'} onChange={e => onChange(e.target.value === 'si')} aria-describedby={`${id}-ayuda`}><option value="si">Encendido</option><option value="no">Apagado</option></select>
      : <input id={id} type={campo.type === 'email' ? 'email' : 'text'} value={String(valor ?? '')} onChange={e => onChange(e.target.value)} aria-describedby={`${id}-ayuda`} />;
  return <div className="so-field">
    <span className="so-row"><label htmlFor={id}>{rotulo}</label><span className="so-badge" data-guardado={guardado}>{guardado ? 'Guardado' : 'De fábrica'}</span></span>
    {control}
    <small id={`${id}-ayuda`} className="so-fieldhelp">{campo.description}{fabrica !== null && !campo.description.includes('Por defecto') ? ` Por defecto: ${textoDeValor(clave, fabrica)}.` : ''}</small>
  </div>;
}

/** Orden y visibilidad de los bloques de la portada: escribe `portadaOrden` y `portadaOcultos` en el borrador. */
function OrdenPortada({ orden, ocultos, onChange }: { orden: unknown; ocultos: unknown; onChange: (orden: string, ocultos: string) => void }) {
  const filas = bloquesParaElPanel(orden, ocultos);
  const escribir = (f: typeof filas) => {
    const ids = f.map(x => x.id);
    // Si coincide con el de fábrica se guarda vacío: así los bloques que lleguen después entran en su sitio.
    onChange(ids.join(',') === ORDEN_DE_FABRICA.join(',') ? '' : ids.join(','), f.filter(x => !x.visible).map(x => x.id).join(','));
  };
  const mover = (i: number, paso: number) => { const f = [...filas]; const [x] = f.splice(i, 1); f.splice(i + paso, 0, x!); escribir(f); };
  return <div className="so-field">
    <span className="so-row"><strong>Bloques de la portada</strong></span>
    <small className="so-fieldhelp">El héroe (con el título principal) va siempre primero. Apagar un bloque quita su texto y sus enlaces de la portada de los ocho países.</small>
    <ol className="so-orden">{filas.map((f, i) => <li key={f.id}>
      <label className="so-row"><input type="checkbox" checked={f.visible} onChange={e => escribir(filas.map(x => x.id === f.id ? { ...x, visible: e.target.checked } : x))} /> {f.nombre} <code>{f.id}</code></label>
      <span>
        <button type="button" disabled={i === 0} aria-label={`Subir «${f.nombre}»`} onClick={() => mover(i, -1)}>↑</button>
        <button type="button" disabled={i === filas.length - 1} aria-label={`Bajar «${f.nombre}»`} onClick={() => mover(i, 1)}>↓</button>
      </span>
    </li>)}</ol>
    <button type="button" onClick={() => onChange('', '')}>Volver al orden de fábrica</button>
  </div>;
}

function Enlaces({ items }: { items: [string, string, string][] }) {
  return <div className="so-cards">{items.map(([titulo, texto, href]) => <a key={href} href={href}><strong>{titulo}</strong><small>{texto}</small></a>)}</div>;
}

export function AjustesPage() {
  const [tab, setTab] = useState<IdPestana>(() => {
    const t = new URLSearchParams(location.search).get('tab');
    return (PESTANAS.some(p => p.id === t) ? t : 'sitio') as IdPestana;
  });
  const [actuales, setActuales] = useState<Valores>({});
  const [borrador, setBorrador] = useState<Valores>({});
  const [guardados, setGuardados] = useState<string[]>([]);
  const [confirmado, setConfirmado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function cargar() {
    const n = await nativa<{ values: Valores }>('GET');
    setActuales(n.values); setBorrador(n.values);
    // Si falla, los valores se ven igual; solo se pierde la marca «guardado / de fábrica».
    await api<{ guardados: string[] }>('ajustes-guardados').then(g => setGuardados(g.guardados), () => setGuardados([]));
  }
  useEffect(() => { cargar().catch(e => setMensaje((e as Error).message)); }, []);
  function irA(id: IdPestana) {
    setTab(id); setMensaje(''); setConfirmado(false);
    const u = new URL(location.href); u.searchParams.set('tab', id); history.replaceState(null, '', u);
  }

  async function guardar(claves: ClaveAjuste[]) {
    setOcupado(true); setMensaje('');
    try {
      const propuestos: Valores = Object.fromEntries(claves.map(k => [k, borrador[k]]));
      /* Al encender la prueba A/B sin fecha de inicio, el panel pone la de hoy (UTC). */
      if (propuestos.portadaHeroeAB === true && actuales.portadaHeroeAB !== true && !String(borrador.portadaHeroeABInicio ?? '').trim()) propuestos.portadaHeroeABInicio = new Date().toISOString().slice(0, 10);
      const cambios = cambiosAGuardar(propuestos, actuales, confirmado);
      if (!Object.keys(cambios).length) { setMensaje('No hay cambios que guardar.'); return; }
      await nativa('PUT', { values: cambios });
      await cargar(); setConfirmado(false);
      setMensaje(`Guardado: ${Object.keys(cambios).map(k => settingsSchema[k as ClaveAjuste].label.replace(/^[^·]+ · /, '')).join(', ')}. El público lo ve en unos minutos.`);
    } catch (e) { setMensaje((e as Error).message); } finally { setOcupado(false); }
  }

  const pestana = PESTANAS.find(p => p.id === tab)!;
  const seccion = (claves: ClaveAjuste[], titulo: string, extra?: ReactNode) => <section className="so-editor">
    <h3>{titulo}</h3>{extra}
    <div className="so-grid">{claves.map(k => <Campo key={k} clave={k} valor={borrador[k]} guardado={guardados.includes(k)} onChange={v => setBorrador(b => ({ ...b, [k]: v }))} />)}</div>
    <button className="so-primary" disabled={ocupado} onClick={() => void guardar(claves)}>{ocupado ? 'Guardando…' : `Guardar ${titulo.toLowerCase()}`}</button>
  </section>;

  const tema = 'temaPorDefecto' as const;
  const cambiaTema = borrador[tema] !== actuales[tema];
  let cuerpo: ReactNode;
  switch (tab) {
    case 'sitio': cuerpo = <>
      <section className="so-danger" aria-labelledby="zona-tema">
        <h3 id="zona-tema">Zona con cuidado · Tema del sitio</h3>
        <p>Cambia el diseño que ven <strong>todos los visitantes</strong> en unos minutos. Ahora: <strong>{textoDeValor(tema, actuales[tema])}</strong> {guardados.includes(tema) ? '(guardado en el panel)' : '(de fábrica: manda la variable SABLY_TEMA_POR_DEFECTO del servidor)'}. Para mirar el otro diseño sin cambiárselo a nadie, abre cualquier página con <code>?tema=v2</code> o <code>?tema=clasico</code>.</p>
        <div className="so-grid"><Campo clave={tema} valor={borrador[tema]} guardado={guardados.includes(tema)} onChange={v => { setBorrador(b => ({ ...b, [tema]: v })); setConfirmado(false); }} /></div>
        {cambiaTema && <label className="so-row"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} /> Entiendo que pasar a «{textoDeValor(tema, borrador[tema])}» cambia lo que ven todos los visitantes.</label>}
        <p><button className="so-primary" disabled={ocupado || !cambiaTema || !confirmado} onClick={() => void guardar([tema])}>Cambiar el tema del sitio</button></p>
      </section>
      {seccion(['estiloCampo'], 'Formularios')}
      {seccion(['tarjetasColumnasMedio'], 'Tarjetas de cursos')}
      {seccion(['pieBorde'], 'Pie')}
    </>; break;
    case 'campanas': cuerpo = <>{seccion(['barraCampanaCierre', 'barraCampanaFicha', 'barraCampanaFija', 'barraCampanaBoton', 'barraCampanaBotonTexto', 'barraCampanaBotonDestino', 'barraCampanaBotonFicha'], 'Barra de campaña')}{seccion(CAMPANA_CLAVES, 'Qué enseña cada aviso de campaña')}<Promotions /></>; break;
    case 'caja': cuerpo = <>{seccion(['cajaVariante', 'cajaContador', 'cajaTitulo', 'cajaSubtitulo', 'cajaTituloCentrado', 'cajaResaltada', 'cajaPrecioNormal', 'cajaPais', 'cajaMovimiento', 'barraCompraEscritorio', 'menuInternoAlineacion', 'mostrarCreador', 'mostrarDocente', 'mostrarCiudades'], 'Caja de compra')}{seccion(['sobreFotosPestanas', 'opinionesEstilo', 'opinionesExtractosMinimo', 'opinionesExtractosMaximo', 'opinionesPerfilNombre', 'opinionesPerfilUrl'], 'Opiniones de la ficha')}{seccion(['fichaMovimiento', 'certificadoAnimacion'], 'Movimiento de la ficha')}{seccion(['temarioEnfoque', 'fichaQueIncluye', 'relacionadosTarjeta'], 'Temario y bloques de la ficha')}<WidgetEditor only="social" /></>; break;
    case 'portada': cuerpo = <>
      <section className="so-editor">
        <h3>Bloques</h3>
        <OrdenPortada orden={borrador.portadaOrden} ocultos={borrador.portadaOcultos} onChange={(orden, ocultos) => setBorrador(b => ({ ...b, portadaOrden: orden, portadaOcultos: ocultos }))} />
        <button className="so-primary" disabled={ocupado} onClick={() => void guardar(['portadaOrden', 'portadaOcultos'])}>{ocupado ? 'Guardando…' : 'Guardar bloques'}</button>
      </section>
      {seccion(['portadaHeroeVariante', 'portadaHeroeFondo', 'portadaHeroeBotones', 'portadaHeroeTachado', 'portadaHeroeRota', 'portadaHeroeIntervalo', 'portadaHeroeOrden', 'portadaHeroeOficios', 'portadaHeroeMovil'], 'Héroe')}
      {seccion(['portadaHeroeAB', 'portadaHeroeABVariantes', 'portadaHeroeABReparto', 'portadaHeroeABInicio'], 'Prueba A/B del héroe', <EstadoPruebaAB valores={actuales} />)}
      {seccion(['portadaCategoriasVariante'], 'Categorías')}
      {seccion(['portadaComoFuncionaAnimado', 'portadaAparicion', 'portadaCifrasCuentan', 'portadaParalaje', 'portadaEscenasVariante', 'portadaEscenasAtenuar'], 'Movimiento de los bloques')}
      {seccion(['portadaOficioModo', 'portadaOficioIntervalo'], 'Oficio destacado')}
      {seccion(['portadaBeneficiosModo'], '¿Por qué Sably?')}
      {seccion(['portadaValoradosMinimo'], 'Los mejor valorados')}
      {seccion(['portadaGuiasVariante'], 'Guías del blog')}
      <Enlaces items={[['Textos de la portada', 'Titular, entradilla y textos de cada bloque (secciones sably-home-*).', `${ADMIN}/sections`]]} />
    </>; break;
    case 'contenido': cuerpo = <>{seccion(['nosotrosDiseno', 'nosotrosCifras', 'nosotrosMovimiento'], 'Página «Nosotros»')}<Enlaces items={[
      ['Cursos', 'Ficha general de cada curso.', `${ADMIN}/content/courses`],
      ['Cursos por país', 'Precio, enlace de compra y texto por país.', `${ADMIN}/content/course_locales`],
      ['Categorías', 'Oficios y su orden.', `${ADMIN}/content/categories`],
      ['Creadores', 'Quién dicta cada curso.', `${ADMIN}/content/creators`],
      ['Países y ciudades', 'Moneda, WhatsApp y textos por país.', `${ADMIN}/content/countries`],
      ['Páginas', 'Nosotros, contacto, legales y demás.', `${ADMIN}/content/pages`],
      ['Artículos', 'Blog.', `${ADMIN}/content/blog`],
      ['Menús', 'Cabecera y pie.', `${ADMIN}/menus`],
      ['Moderación y contactos', 'Opiniones, calificaciones y solicitudes.', `${ADMIN}/plugins/sably-operations/operations`],
    ]} /></>; break;
    case 'blog': cuerpo = <>
      {seccion(['blogTituloPortada', 'blogEntradillaPortada', 'blogBuscador', 'blogDestacado', 'blogRecientes', 'blogBandaCursos'], 'Portada del blog')}
      {seccion(['blogFiltrosEstilo', 'blogFiltrosMovil', 'blogFiltrosCuenta', 'blogPaginacion', 'blogVerMasAuto', 'blogPorPagina'], 'Portada · filtros y paginación')}
      {seccion(['blogCabecera', 'blogEntradillaEstilo', 'blogTamanoTexto', 'blogProgreso', 'blogProgresoMinimo'], 'Artículo · cabecera y lectura')}
      {seccion(['blogIndiceEscritorio', 'blogIndiceProgreso', 'blogIndiceMovil', 'blogIndiceNiveles', 'blogIndiceMinimo', 'blogCarrilDerecho'], 'Artículo · índice')}
      {seccion(['blogCompartirRedes', 'blogCompartirPosiciones', 'blogNarracionFija', 'blogNarracionSeguir'], 'Artículo · compartir y narración')}
      {seccion(['blogCursoMitad', 'blogLlamadaFinal', 'blogCursosSugeridos', 'blogArticulosSugeridos'], 'Artículo · cursos y sugeridos')}
      {seccion(['blogTarjeta', 'blogTarjetaMovil', 'blogTarjetaLeerMas', 'blogPortadaSinFoto', 'blogEtiquetaEstilo'], 'Tarjetas y etiquetas')}
      {seccion(['blogValoracion', 'blogEstrellasCabecera', 'blogMarcadoValoracion', 'blogTarjetaEstrellas', 'blogComentarios', 'blogComentariosPlegados', 'blogTarjetaComentarios'], 'Valoración y comentarios')}
      <Enlaces items={[['Artículos', 'Texto, portada, categoría y preguntas de cada artículo.', `${ADMIN}/content/blog`], ['Moderar comentarios y valoraciones', 'Los comentarios nacen pendientes: se publican al aprobarlos.', `${ADMIN}/plugins/sably-operations/operations`]]} />
    </>; break;
    case 'medios': cuerpo = <>
      <WidgetEditor only="video" />
      <div className="so-hueco"><strong>Narraciones (audio)</strong><p>Reservado. Llega con la sesión de narraciones (docs/equipo/2026-11-25/narraciones/DISENO.md).</p></div>
      <div className="so-hueco"><strong>Reproductor de vídeo</strong><p>Reservado. Llega con la sesión de vídeo (docs/equipo/2026-11-25/video/DISENO.md).</p></div>
    </>; break;
    case 'seo': cuerpo = <Enlaces items={[
      ['Medición y conversiones', 'Tag Manager, GA4, píxel de Meta y compras enviadas desde el servidor.', `${ADMIN}/plugins/sably-integrations/integrations`],
      ['Auditoría SEO', 'Revisión de títulos, descripciones y datos de los artículos.', `${ADMIN}/plugins/sably-seo/seo`],
      ['SEO del núcleo', 'Verificación de buscadores e indexación (EmDash).', `${ADMIN}/settings`],
      ['Redirecciones', 'Direcciones viejas que llevan a las nuevas.', `${ADMIN}/redirects`],
    ]} />; break;
    case 'cuenta': cuerpo = <>
      {seccion(['cuentaActiva', 'cuentaGoogle', 'cuentaCorreo', 'cuentaClave', 'cuentaAcceso'], 'Cuenta')}
      <div className="so-hueco"><strong>Claves del servidor</strong><p>El identificador y la clave del cliente OAuth de Google y la clave de sesión no se escriben aquí: van en el entorno del servidor (<code>SABLY_GOOGLE_ID</code>, <code>SABLY_GOOGLE_SECRET</code>, <code>SABLY_AUTH_SECRET</code>). Sin ellas, la cuenta no aparece aunque esté encendida. El código por correo usa el proveedor de Ajustes → Correo (Sably · Brevo con su clave API). Detalle en docs/equipo/2026-11-25/cuenta/IMPLEMENTACION.md.</p></div>
    </>; break;
    case 'integraciones': cuerpo = <>
      {seccion(['notificationEmail'], 'Correo del equipo')}
      <Enlaces items={[
        ['WhatsApp', 'Botón flotante, números por país y reglas por curso.', `${ADMIN}/plugins/sably-whatsapp/whatsapp`],
        ['Correo con Brevo y claves', 'Clave de Brevo, remitente y claves cifradas de conversiones.', `${ADMIN}/plugins/sably-integrations/integrations`],
        ['Correo de EmDash', 'Estado del proveedor y correo de prueba.', `${ADMIN}/settings`],
      ]} />
    </>; break;
    case 'avanzado': cuerpo = <section className="so-editor">
      <h3>Para soporte técnico</h3>
      <p>Revisar un diseño sin cambiárselo a nadie: añade <code>?tema=v2</code> o <code>?tema=clasico</code> a cualquier URL (no se indexa ni se guarda en caché).</p>
      <p>Si el tema nunca se guardó en el panel, manda la variable <code>SABLY_TEMA_POR_DEFECTO</code> del servidor.</p>
      <p>Formulario de respaldo de EmDash (los mismos ajustes, sin agrupar): <a href={`${ADMIN}/plugins-manager/sably-operations/settings`}>Plugins → sably-operations → ajustes</a>. Ojo: su botón «Guardar configuración» guarda todos los campos, también los que están de fábrica (y así fija el tema).</p>
      <div className="so-table"><table><thead><tr><th>Ajuste</th><th>Clave guardada</th><th>Pestaña</th></tr></thead><tbody>
        {PESTANAS.flatMap(p => p.claves.map(k => <tr key={k}><td>{settingsSchema[k].label}</td><td><code>plugin:sably-operations:settings:{k}</code></td><td>{p.titulo}</td></tr>))}
      </tbody></table></div>
    </section>; break;
  }

  return <div className="so"><style>{CSS_SO}</style>
    <h1>Ajustes del sitio</h1>
    <small>Todo lo que se configura de sably.co, ordenado por tarea. Los cambios llegan al público en unos minutos, sin desplegar.</small>
    <nav aria-label="Secciones de los ajustes" className="so-nav">{PESTANAS.map((p, i) => <button key={p.id} aria-current={tab === p.id} onClick={() => irA(p.id)}>{i + 1} · {p.titulo}</button>)}</nav>
    <p>{pestana.resumen}{AJUSTES_PELIGROSOS.some(k => pestana.claves.includes(k)) ? ' Lo que afecta a todo el sitio está aparte y pide confirmación.' : ''}</p>
    <Notice text={mensaje} />
    {cuerpo}
  </div>;
}
