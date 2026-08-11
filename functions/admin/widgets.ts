/**
 * /admin/widgets — el botón flotante de WhatsApp, editable sin desplegar.
 *
 * Número y posición (x desde la derecha, y desde abajo). `numero` vacío usa el
 * número del país que ya trae el sitio, así que lo normal es no tocarlo salvo
 * campañas puntuales con una línea distinta.
 */
import { type Env, e, fecha, irA, noAutorizado, pagina, sesion } from './_ui';

interface Fila {
  activo: number;
  numero: string;
  offset_x: number;
  offset_y: number;
  actualizado: number;
  por: string | null;
}

const VACIA: Fila = { activo: 1, numero: '', offset_x: 21, offset_y: 58, actualizado: 0, por: null };

async function leer(env: Env): Promise<{ fila: Fila; falta: boolean }> {
  try {
    const f = await env.DB.prepare(
      'SELECT activo, numero, offset_x, offset_y, actualizado, por FROM widget_whatsapp WHERE id = 1',
    ).first<Fila>();
    return { fila: f ?? VACIA, falta: false };
  } catch {
    return { fila: VACIA, falta: true };
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { email: mod, motivo } = await sesion(request, env);
  if (!mod) return noAutorizado(motivo);

  const { fila, falta } = await leer(env);
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

  <div><button type="submit" class="pri">Guardar</button></div>
</form>

${fila.actualizado ? `<p class="nota">Última vez: ${e(fecha(fila.actualizado))}${fila.por ? ` por ${e(fila.por)}` : ''}.</p>` : ''}
<p class="nota">En móvil el botón se eleva solo por encima de la barra fija de compra;
los valores de aquí son su posición natural. El mensaje pre-llenado sigue saliendo del
contexto de cada página (nombre del curso).</p>`);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { email: mod, motivo } = await sesion(request, env);
  if (!mod) return noAutorizado(motivo);

  const f = await request.formData();
  const activo = f.get('activo') === '1' ? 1 : 0;
  const numero = String(f.get('numero') ?? '').replace(/\D/g, '').slice(0, 20);
  const acotar = (v: unknown, min: number, max: number, defecto: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : defecto;
  };
  const x = acotar(f.get('offset_x'), 0, 400, 21);
  const y = acotar(f.get('offset_y'), 0, 800, 58);

  try {
    await env.DB.prepare(
      `UPDATE widget_whatsapp
          SET activo = ?, numero = ?, offset_x = ?, offset_y = ?, actualizado = unixepoch(), por = ?
        WHERE id = 1`,
    ).bind(activo, numero, x, y, mod).run();
  } catch (err) {
    console.error('No se pudo guardar el widget:', err);
    return pagina('Widgets', mod, 'widgets',
      `<div class="aviso"><b>No se guardó.</b> Suele ser que falta la migración: ejecuta
<code>npx wrangler d1 migrations apply sably-pulso --remote</code> y vuelve a intentarlo.</div>
<p><a class="boton" href="/admin/widgets">Volver</a></p>`);
  }

  return irA('/admin/widgets?ok=1');
};
