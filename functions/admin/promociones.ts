/**
 * /admin/promociones — encender y apagar el descuento sin desplegar.
 *
 * El calendario de `src/lib/promo.ts` cubre las fechas previstas del año. Esto
 * cubre lo otro: «necesito vender hoy». Lo que se guarde aquí manda sobre el
 * calendario mientras esté activo.
 *
 * Sobre el modo perpetuo: existe porque a veces hace falta y la decisión es de
 * quien vende. Lo único que no hace es enseñar una cuenta atrás, porque un reloj
 * que se reinicia cada día es lo único de aquí que sí sería mentir. Sin reloj,
 * el descuento es real y el visitante no recibe una urgencia falsa.
 */
import { type Env, e, fecha, irA, noAutorizado, pagina, sesion } from './_ui';

/** Los dos únicos cupones que Hotmart reconoce. Verificados en el checkout. */
const CUPONES: Record<string, string> = { '25': '010775', '50': '031016' };

const PAISES: [string, string][] = [
  ['co', 'Colombia'], ['mx', 'México'], ['es', 'España'], ['ar', 'Argentina'],
  ['cl', 'Chile'], ['pe', 'Perú'], ['ec', 'Ecuador'], ['us', 'Estados Unidos'],
];

interface Fila {
  activa: number;
  pct: number;
  cupon: string;
  titular: string;
  alcance: string;
  slugs: string;
  modo: string;
  hasta: number | null;
  paises: string;
  actualizado: number;
  por: string | null;
}

const VACIA: Fila = {
  activa: 0, pct: 25, cupon: '010775', titular: 'Descuento activo',
  alcance: 'todos', slugs: '[]', modo: 'ventana', hasta: null,
  paises: '[]', actualizado: 0, por: null,
};

const lista = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

/** `datetime-local` en la zona de Bogotá, que es donde se decide esto. */
const paraInput = (epoch: number | null): string => {
  if (!epoch) return '';
  const d = new Date(epoch * 1000 - 5 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
};

async function leer(env: Env): Promise<{ fila: Fila; falta: boolean }> {
  try {
    const f = await env.DB.prepare(
      `SELECT activa, pct, cupon, titular, alcance, slugs, modo, hasta, paises,
              actualizado, por FROM promo_override WHERE id = 1`,
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
  const slugs = lista(fila.slugs);
  const paises = lista(fila.paises);
  const guardado = new URL(request.url).searchParams.has('ok');

  const sel = (v: boolean) => (v ? ' selected' : '');
  const chk = (v: boolean) => (v ? ' checked' : '');

  return pagina('Promociones', mod, 'promociones', `
${falta ? `<div class="aviso"><b>Falta la migración.</b> Ejecuta
<code>npx wrangler d1 migrations apply sably-pulso --remote</code> para crear la tabla
<code>promo_override</code>. Hasta entonces este panel no guarda nada y la web se rige
solo por el calendario de campañas.</div>` : ''}
${guardado ? '<div class="aviso" style="background:#e8f5e9;border-color:#a5d6a7">Guardado. Tarda hasta un minuto en verse en la web: la respuesta se cachea 60 s en el borde.</div>' : ''}

<div class="tarjetas" style="margin-bottom:1.5rem">
  <div class="tarjeta${fila.activa ? '' : ' avisa'}">
    <div class="n" style="${fila.activa ? 'color:var(--ok)' : ''}">${fila.activa ? 'SÍ' : 'NO'}</div>
    <div class="t">Descuento manual activo</div>
  </div>
  <div class="tarjeta"><div class="n">${fila.activa ? `−${fila.pct}%` : '—'}</div>
    <div class="t">${fila.activa ? `Cupón ${e(fila.cupon)}` : 'Rige el calendario de campañas'}</div></div>
  <div class="tarjeta"><div class="n" style="font-size:1.1rem;padding-top:.5rem">${
    fila.activa ? (fila.modo === 'perpetua' ? 'Sin fecha de fin' : e(fecha(fila.hasta ?? 0))) : '—'
  }</div><div class="t">${fila.modo === 'perpetua' ? 'Modo perpetuo: sin cuenta atrás' : 'Termina'}</div></div>
  <div class="tarjeta"><div class="n" style="font-size:1.1rem;padding-top:.5rem">${
    fila.alcance === 'todos' ? 'Todo el catálogo' : `${slugs.length} curso${slugs.length === 1 ? '' : 's'}`
  }</div><div class="t">Alcance</div></div>
</div>

<form method="post" class="caja" style="padding:1.25rem;display:grid;gap:1.1rem;max-width:760px">
  <label style="display:flex;gap:.6rem;align-items:center;font-weight:700">
    <input type="checkbox" name="activa" value="1"${chk(!!fila.activa)}>
    Activar el descuento manual
  </label>
  <p class="nota" style="margin:-.6rem 0 0">Mientras esté activo manda sobre el calendario.
  Al desactivarlo, la web vuelve sola a las campañas por fecha.</p>

  <div style="display:grid;gap:1.1rem;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
    <label>Descuento<br>
      <select name="pct" style="width:100%;padding:.45rem;margin-top:.3rem">
        <option value="25"${sel(fila.pct === 25)}>−25 % · cupón 010775</option>
        <option value="50"${sel(fila.pct === 50)}>−50 % · cupón 031016</option>
      </select>
    </label>

    <label>Duración<br>
      <select name="modo" style="width:100%;padding:.45rem;margin-top:.3rem">
        <option value="ventana"${sel(fila.modo === 'ventana')}>Hasta una fecha · con cuenta atrás</option>
        <option value="perpetua"${sel(fila.modo === 'perpetua')}>Sin fecha de fin · sin cuenta atrás</option>
      </select>
    </label>

    <label>Termina el (solo si eligió fecha)<br>
      <input type="datetime-local" name="hasta" value="${paraInput(fila.hasta)}"
             style="width:100%;padding:.45rem;margin-top:.3rem">
    </label>

    <label>Alcance<br>
      <select name="alcance" style="width:100%;padding:.45rem;margin-top:.3rem">
        <option value="todos"${sel(fila.alcance === 'todos')}>Todos los cursos</option>
        <option value="algunos"${sel(fila.alcance === 'algunos')}>Solo los cursos que liste</option>
      </select>
    </label>
  </div>

  <label>Titular del banner<br>
    <input type="text" name="titular" maxlength="70" value="${e(fila.titular)}"
           style="width:100%;padding:.45rem;margin-top:.3rem">
  </label>

  <label>Cursos (un slug por línea; solo se usa si el alcance es «algunos»)<br>
    <textarea name="slugs" rows="5" placeholder="curso-de-barberia&#10;curso-de-masajes"
              style="width:100%;padding:.45rem;margin-top:.3rem;font-family:ui-monospace,monospace"
              >${e(slugs.join('\n'))}</textarea>
  </label>

  <fieldset style="border:1px solid var(--borde);border-radius:8px;padding:.9rem">
    <legend style="font-size:.8rem;color:var(--apagado);padding:0 .4rem">Países (ninguno marcado = todos)</legend>
    <div style="display:flex;flex-wrap:wrap;gap:.9rem">
      ${PAISES.map(([cc, nombre]) =>
        `<label style="display:flex;gap:.35rem;align-items:center;font-size:.88rem">
          <input type="checkbox" name="paises" value="${cc}"${chk(paises.includes(cc))}> ${nombre}
        </label>`).join('')}
    </div>
  </fieldset>

  <div><button type="submit" class="pri">Guardar</button></div>
</form>

${fila.actualizado ? `<p class="nota">Última vez: ${e(fecha(fila.actualizado))}${
  fila.por ? ` por ${e(fila.por)}` : ''
}.</p>` : ''}

<p class="nota">El descuento viaja al checkout como <code>?offDiscount=&lt;cupón&gt;</code>, que es el
parámetro que Hotmart aplica de verdad. Los acortadores conservan el parámetro al redirigir, así que
la comisión se sigue acreditando: <code>hotm.io/…-curso-crashing?offDiscount=031016</code> acaba en
<code>pay.hotmart.com/…?ref=…&amp;offDiscount=031016</code>.</p>

<p class="nota"><b>Por qué el modo perpetuo no lleva cuenta atrás.</b> El descuento perpetuo es real y
se aplica igual. Lo que no se hace es acompañarlo de un reloj: un contador que se reinicia solo es
lo único de esta pantalla que el visitante puede pillar, y cuando lo pilla deja de creerse también
los descuentos que sí tienen fecha.</p>`);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { email: mod, motivo } = await sesion(request, env);
  if (!mod) return noAutorizado(motivo);

  const f = await request.formData();
  const pct = f.get('pct') === '50' ? 50 : 25;
  const modo = f.get('modo') === 'perpetua' ? 'perpetua' : 'ventana';
  const alcance = f.get('alcance') === 'algunos' ? 'algunos' : 'todos';

  const slugs = String(f.get('slugs') ?? '')
    .split('\n')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const paises = f.getAll('paises').map(String).filter((p) => PAISES.some(([cc]) => cc === p));

  const bruto = String(f.get('hasta') ?? '').trim();
  // El input llega en hora de Bogotá sin zona; sin el desplazamiento, la promo
  // terminaría cinco horas antes de lo que puso quien la creó.
  const hasta = bruto ? Math.floor(new Date(`${bruto}:00-05:00`).getTime() / 1000) : null;

  // Una ventana sin fecha no puede activarse: el CHECK de la tabla lo rechaza y
  // el visitante vería una cuenta atrás sin destino.
  const activa = f.get('activa') === '1' && (modo === 'perpetua' || !!hasta) ? 1 : 0;

  // Un alcance «algunos» sin ningún slug apagaría el descuento en toda la web
  // sin decirlo. Mejor tratarlo como lo que quiso decir: todo el catálogo.
  const alcanceReal = alcance === 'algunos' && slugs.length === 0 ? 'todos' : alcance;

  const titular = String(f.get('titular') ?? '').trim().slice(0, 70) || 'Descuento activo';

  try {
    await env.DB.prepare(
      `UPDATE promo_override
          SET activa = ?, pct = ?, cupon = ?, titular = ?, alcance = ?, slugs = ?,
              modo = ?, hasta = ?, paises = ?, actualizado = unixepoch(), por = ?
        WHERE id = 1`,
    )
      .bind(activa, pct, CUPONES[String(pct)]!, titular, alcanceReal, JSON.stringify(slugs),
            modo, modo === 'perpetua' ? null : hasta, JSON.stringify(paises), mod)
      .run();
  } catch (err) {
    console.error('No se pudo guardar la promoción:', err);
    return pagina('Promociones', mod, 'promociones',
      `<div class="aviso"><b>No se guardó.</b> Suele ser que falta la migración: ejecuta
<code>npx wrangler d1 migrations apply sably-pulso --remote</code> y vuelve a intentarlo.</div>
<p><a class="boton" href="/admin/promociones">Volver</a></p>`);
  }

  return irA('/admin/promociones?ok=1');
};
