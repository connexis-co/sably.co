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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { email: mod, motivo } = await sesion(request, env);
  if (!mod) return noAutorizado(motivo);

  const { fila, falta } = await leer(env);
  const { fila: video, falta: faltaVideo } = await leerVideo(env);
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
datos, o que el navegador rechace el arranque automático.</p>`);
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

  const activo = f.get('activo') === '1' ? 1 : 0;
  const numero = String(f.get('numero') ?? '').replace(/\D/g, '').slice(0, 20);
  const acotar = (v: unknown, min: number, max: number, defecto: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : defecto;
  };
  const x = acotar(f.get('offset_x'), 0, 400, 21);
  const y = acotar(f.get('offset_y'), 0, 800, 58);

  // Rutas: una por línea, solo caracteres de ruta y el comodín *. Un patrón
  // malformado se descarta en silencio antes que romper el guardado entero.
  const paginas = String(f.get('paginas') ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l.length <= 120 && /^[\w\-\/.*]+$/.test(l))
    .slice(0, 100);

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
