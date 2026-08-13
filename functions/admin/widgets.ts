/**
 * /admin/widgets — lo que se puede cambiar sin desplegar: el botón flotante de
 * WhatsApp y el arranque del video de los cursos.
 *
 * WhatsApp: número y posición (x desde la derecha, y desde abajo). `numero`
 * vacío usa el número del país que ya trae el sitio, así que lo normal es no
 * tocarlo salvo campañas puntuales con una línea distinta.
 *
 * Video: si espera al play o arranca solo. Cada bloque es un formulario aparte
 * y se guardan por separado, así que tocar uno no puede pisar el otro.
 */
import { type Env, e, fecha, irA, noAutorizado, pagina, sesion } from './_ui';

interface Fila {
  activo: number;
  numero: string;
  offset_x: number;
  offset_y: number;
  paginas_ocultas: string;
  actualizado: number;
  por: string | null;
}

interface FilaVideo {
  modo: string;
  bucle: number;
  actualizado: number;
  por: string | null;
}

const VACIA: Fila = {
  activo: 1, numero: '', offset_x: 21, offset_y: 58, paginas_ocultas: '[]',
  actualizado: 0, por: null,
};

const VACIA_VIDEO: FilaVideo = { modo: 'play', bucle: 0, actualizado: 0, por: null };

const lista = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

async function leer(env: Env): Promise<{ fila: Fila; falta: boolean }> {
  try {
    const f = await env.DB.prepare(
      'SELECT activo, numero, offset_x, offset_y, paginas_ocultas, actualizado, por FROM widget_whatsapp WHERE id = 1',
    ).first<Fila>();
    return { fila: f ?? VACIA, falta: false };
  } catch {
    return { fila: VACIA, falta: true };
  }
}

async function leerVideo(env: Env): Promise<{ fila: FilaVideo; falta: boolean }> {
  try {
    const f = await env.DB.prepare(
      'SELECT modo, bucle, actualizado, por FROM widget_video WHERE id = 1',
    ).first<FilaVideo>();
    return { fila: f ?? VACIA_VIDEO, falta: false };
  } catch {
    return { fila: VACIA_VIDEO, falta: true };
  }
}

interface FilaPrueba {
  activo: number;
  posicion: string;
  offset_x: number;
  offset_y: number;
  espera_seg: number;
  intervalo_seg: number;
  paginas_ocultas: string;
}

const PRUEBA_DEFECTO: FilaPrueba = {
  activo: 1, posicion: 'inferior-izquierda', offset_x: 16, offset_y: 16,
  espera_seg: 8, intervalo_seg: 14, paginas_ocultas: '[]',
};

const ESQUINAS: [string, string][] = [
  ['inferior-izquierda', 'Abajo a la izquierda'],
  ['inferior-derecha', 'Abajo a la derecha'],
  ['superior-izquierda', 'Arriba a la izquierda'],
  ['superior-derecha', 'Arriba a la derecha'],
];

async function leerPrueba(env: Env): Promise<{ fila: FilaPrueba; falta: boolean }> {
  try {
    const f = await env.DB.prepare(
      `SELECT activo, posicion, offset_x, offset_y, espera_seg, intervalo_seg, paginas_ocultas
         FROM widget_prueba_social WHERE id = 1`,
    ).first<FilaPrueba>();
    return { fila: f ?? PRUEBA_DEFECTO, falta: !f };
  } catch {
    return { fila: PRUEBA_DEFECTO, falta: true };
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { email: mod, motivo } = await sesion(request, env);
  if (!mod) return noAutorizado(motivo);

  const { fila, falta } = await leer(env);
  const { fila: video, falta: faltaVideo } = await leerVideo(env);
  const { fila: prueba, falta: faltaPrueba } = await leerPrueba(env);
  const ocultas = lista(fila.paginas_ocultas);
  const guardado = new URL(request.url).searchParams.has('ok');

  return pagina('Widgets', mod, 'widgets', `
${falta ? `<div class="aviso"><b>Falta la migración.</b> Ejecuta
<code>npx wrangler d1 migrations apply sably-pulso --remote</code> para crear la tabla
<code>widget_whatsapp</code>. Hasta entonces el botón usa sus valores por defecto.</div>` : ''}
${guardado ? '<div class="aviso" style="background:#e8f5e9;border-color:#a5d6a7">Guardado. Tarda hasta un minuto en verse: la respuesta se cachea 60 s en el borde.</div>' : ''}

<h2 style="margin-top:0">Botón de WhatsApp</h2>
<form method="post" class="caja" style="padding:1.25rem;display:grid;gap:1.1rem;max-width:560px">
  <label style="display:flex;gap:.6rem;align-items:center;font-weight:700">
    <input type="checkbox" name="activo" value="1"${fila.activo ? ' checked' : ''}>
    Mostrar el botón flotante
  </label>

  <label>Número (vacío = usar el número de cada país)<br>
    <input type="tel" name="numero" value="${e(fila.numero)}" placeholder="573114574788"
           pattern="[0-9+ ]{0,20}" style="width:100%;padding:.45rem;margin-top:.3rem">
  </label>

  <div style="display:grid;gap:1.1rem;grid-template-columns:1fr 1fr">
    <label>Separación derecha (px)<br>
      <input type="number" name="offset_x" min="0" max="400" value="${fila.offset_x}"
             style="width:100%;padding:.45rem;margin-top:.3rem">
    </label>
    <label>Separación abajo (px)<br>
      <input type="number" name="offset_y" min="0" max="800" value="${fila.offset_y}"
             style="width:100%;padding:.45rem;margin-top:.3rem">
    </label>
  </div>

  <label>Ocultar el botón en estas rutas (una por línea; <code>*</code> como comodín)<br>
    <textarea name="paginas" rows="4" placeholder="/co/curso-de-unas/&#10;/blog*&#10;/homologaciones*"
              style="width:100%;padding:.45rem;margin-top:.3rem;font-family:ui-monospace,monospace"
              >${e(ocultas.join('\n'))}</textarea>
  </label>

  <input type="hidden" name="seccion" value="whatsapp">
  <div><button type="submit" class="pri">Guardar</button></div>
</form>

${fila.actualizado ? `<p class="nota">Última vez: ${e(fecha(fila.actualizado))}${fila.por ? ` por ${e(fila.por)}` : ''}.</p>` : ''}
<p class="nota">En móvil el botón se eleva solo por encima de la barra fija de compra;
los valores de aquí son su posición natural. El mensaje pre-llenado sigue saliendo del
contexto de cada página (nombre del curso).</p>
<p class="nota"><b>Apagarlo:</b> desmarca «Mostrar el botón» para quitarlo de TODO el sitio, o
lista rutas concretas para ocultarlo solo ahí. <code>/co/curso-de-unas/</code> lo oculta en esa
ficha; <code>/blog*</code> en todo el blog; <code>*/checkout/*</code> en cualquier ruta que
contenga checkout. Se refleja en ≤60 s, sin desplegar.</p>

<h2 style="margin-top:2.5rem">Video de los cursos</h2>
${faltaVideo ? `<div class="aviso"><b>Falta la migración.</b> Ejecuta
<code>npx wrangler d1 migrations apply sably-pulso --remote</code> para crear la tabla
<code>widget_video</code>. Hasta entonces el video espera al play.</div>` : ''}
<form method="post" class="caja" style="padding:1.25rem;display:grid;gap:1.1rem;max-width:560px">
  <fieldset style="border:0;padding:0;margin:0;display:grid;gap:.7rem">
    <legend style="font-weight:700;padding:0;margin-bottom:.2rem">Cómo arranca</legend>

    <label style="display:flex;gap:.6rem;align-items:flex-start">
      <input type="radio" name="modo" value="play"${video.modo !== 'auto' ? ' checked' : ''} style="margin-top:.25rem">
      <span><b>Con botón de play</b><br>
      <span class="nota">El visitante pulsa para ver el video. No se descarga hasta entonces,
      así que la ficha carga más rápido y no gasta datos de quien no lo va a ver.</span></span>
    </label>

    <label style="display:flex;gap:.6rem;align-items:flex-start">
      <input type="radio" name="modo" value="auto"${video.modo === 'auto' ? ' checked' : ''} style="margin-top:.25rem">
      <span><b>Reproducción automática</b><br>
      <span class="nota">Arranca solo al entrar en pantalla, <b>siempre sin sonido</b>: ningún
      navegador permite otra cosa. Se muestra un botón «Activar sonido» encima del video.</span></span>
    </label>
  </fieldset>

  <label style="display:flex;gap:.6rem;align-items:center;font-weight:700">
    <input type="checkbox" name="bucle" value="1"${video.bucle ? ' checked' : ''}>
    Repetir en bucle al terminar
  </label>

  <input type="hidden" name="seccion" value="video">
  <div><button type="submit" class="pri">Guardar</button></div>
</form>

${video.actualizado ? `<p class="nota">Última vez: ${e(fecha(video.actualizado))}${video.por ? ` por ${e(video.por)}` : ''}.</p>` : ''}
<p class="nota">Se aplica a la ficha de los cursos que tengan video. El reproductor respeta tres
cosas por encima de esta opción, y en los tres casos espera al play aunque esté en automático:
que el visitante haya pedido menos animación en su sistema, que tenga activado el ahorro de
datos, o que el navegador rechace el arranque automático.</p>
<h2>Avisos de compra</h2>
<p class="nota">El recuadro que asoma con reseñas reales de Hotmart. Desde aquí se apaga, se
cambia de esquina y se ajusta cada cuánto aparece, sin volver a desplegar.</p>
${faltaPrueba ? `<div class="aviso"><b>Falta la migración.</b> Ejecuta
<code>npx wrangler d1 migrations apply sably-pulso --remote</code> para crear la tabla
<code>widget_prueba_social</code>. Hasta entonces se usan los valores de siempre.</div>` : ''}
<form method="post" class="caja" style="padding:1.25rem;display:grid;gap:1.1rem;max-width:560px">
  <label style="display:flex;gap:.6rem;align-items:center">
    <input type="checkbox" name="activo" value="1"${prueba.activo ? ' checked' : ''}>
    <span><b>Mostrar los avisos</b><br>
    <span class="nota">Al desmarcarlo dejan de aparecer en todo el sitio.</span></span>
  </label>

  <label>Esquina<br>
    <select name="posicion" style="padding:.5rem;width:100%;max-width:260px">
      ${ESQUINAS.map(([v, etiqueta]) =>
        `<option value="${v}"${prueba.posicion === v ? ' selected' : ''}>${etiqueta}</option>`).join('')}
    </select>
    <span class="nota">Abajo a la izquierda es lo habitual. Si la barra de compra estorba,
    arriba se lee mejor: el aviso se aparta solo de esa barra cuando va anclado abajo.</span>
  </label>

  <div style="display:flex;gap:1rem;flex-wrap:wrap">
    <label>Separación horizontal (px)<br>
      <input type="number" name="offset_x" min="0" max="400" value="${prueba.offset_x}"
             style="padding:.5rem;width:130px"></label>
    <label>Separación vertical (px)<br>
      <input type="number" name="offset_y" min="0" max="400" value="${prueba.offset_y}"
             style="padding:.5rem;width:130px"></label>
  </div>

  <div style="display:flex;gap:1rem;flex-wrap:wrap">
    <label>Tarda en salir (s)<br>
      <input type="number" name="espera_seg" min="0" max="600" value="${prueba.espera_seg}"
             style="padding:.5rem;width:130px">
      <span class="nota">Deja leer antes de interrumpir.</span></label>
    <label>Entre aviso y aviso (s)<br>
      <input type="number" name="intervalo_seg" min="5" max="3600" value="${prueba.intervalo_seg}"
             style="padding:.5rem;width:130px">
      <span class="nota">Cuanto más bajo, más insistente.</span></label>
  </div>

  <label>No mostrar en estas rutas<br>
    <textarea name="paginas" rows="3" placeholder="/contacto/&#10;/legal*"
              style="padding:.5rem;width:100%;font-family:ui-monospace,monospace">${
      e((() => { try { const l = JSON.parse(prueba.paginas_ocultas); return Array.isArray(l) ? l.join('\n') : ''; } catch { return ''; } })())
    }</textarea>
    <span class="nota">Una por línea. Admite <code>*</code> al final para cubrir todo lo que cuelgue.</span>
  </label>

  <input type="hidden" name="seccion" value="prueba">
  <div><button class="pri" type="submit">Guardar avisos</button></div>
</form>
`);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { email: mod, motivo } = await sesion(request, env);
  if (!mod) return noAutorizado(motivo);

  const f = await request.formData();

  // Los dos bloques envían al mismo sitio; el campo oculto dice cuál es. Sin él,
  // guardar el video borraría el número de WhatsApp con los campos vacíos.
  if (f.get('seccion') === 'video') {
    const modo = f.get('modo') === 'auto' ? 'auto' : 'play';
    const bucle = f.get('bucle') === '1' ? 1 : 0;
    try {
      await env.DB.prepare(
        `UPDATE widget_video
            SET modo = ?, bucle = ?, actualizado = unixepoch(), por = ?
          WHERE id = 1`,
      ).bind(modo, bucle, mod).run();
    } catch (err) {
      console.error('No se pudo guardar el video:', err);
      return pagina('Widgets', mod, 'widgets',
        `<div class="aviso"><b>No se guardó.</b> Suele ser que falta la migración: ejecuta
<code>npx wrangler d1 migrations apply sably-pulso --remote</code> y vuelve a intentarlo.</div>
<p><a class="boton" href="/admin/widgets">Volver</a></p>`);
    }
    return irA('/admin/widgets?ok=1');
  }

  const acotar = (v: unknown, min: number, max: number, defecto: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : defecto;
  };

  /** Rutas: una por línea, solo caracteres de ruta y el comodín. */
  const rutas = (v: unknown): string[] =>
    String(v ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && l.length <= 120 && /^[\w\-\/.*]+$/.test(l))
      .slice(0, 100);

  if (f.get('seccion') === 'prueba') {
    const posicion = ESQUINAS.some(([v]) => v === f.get('posicion'))
      ? String(f.get('posicion'))
      : PRUEBA_DEFECTO.posicion;
    try {
      await env.DB.prepare(
        `UPDATE widget_prueba_social
            SET activo = ?, posicion = ?, offset_x = ?, offset_y = ?,
                espera_seg = ?, intervalo_seg = ?, paginas_ocultas = ?,
                actualizado = unixepoch(), por = ?
          WHERE id = 1`,
      ).bind(
        f.get('activo') === '1' ? 1 : 0,
        posicion,
        acotar(f.get('offset_x'), 0, 400, 16),
        acotar(f.get('offset_y'), 0, 400, 16),
        acotar(f.get('espera_seg'), 0, 600, 8),
        acotar(f.get('intervalo_seg'), 5, 3600, 14),
        JSON.stringify(rutas(f.get('paginas'))),
        mod,
      ).run();
    } catch (err) {
      console.error('No se pudo guardar la prueba social:', err);
      return pagina('Widgets', mod, 'widgets',
        `<div class="aviso"><b>No se guardó.</b> Suele ser que falta la migración: ejecuta
<code>npx wrangler d1 migrations apply sably-pulso --remote</code> y vuelve a intentarlo.</div>
<p><a class="boton" href="/admin/widgets">Volver</a></p>`);
    }
    return irA('/admin/widgets?ok=1');
  }

  const activo = f.get('activo') === '1' ? 1 : 0;
  const numero = String(f.get('numero') ?? '').replace(/\D/g, '').slice(0, 20);
  const x = acotar(f.get('offset_x'), 0, 400, 21);
  const y = acotar(f.get('offset_y'), 0, 800, 58);

  const paginas = rutas(f.get('paginas'));

  try {
    await env.DB.prepare(
      `UPDATE widget_whatsapp
          SET activo = ?, numero = ?, offset_x = ?, offset_y = ?, paginas_ocultas = ?,
              actualizado = unixepoch(), por = ?
        WHERE id = 1`,
    ).bind(activo, numero, x, y, JSON.stringify(paginas), mod).run();
  } catch (err) {
    console.error('No se pudo guardar el widget:', err);
    return pagina('Widgets', mod, 'widgets',
      `<div class="aviso"><b>No se guardó.</b> Suele ser que falta la migración: ejecuta
<code>npx wrangler d1 migrations apply sably-pulso --remote</code> y vuelve a intentarlo.</div>
<p><a class="boton" href="/admin/widgets">Volver</a></p>`);
  }

  return irA('/admin/widgets?ok=1');
};
