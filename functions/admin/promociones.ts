/**
 * /admin/promociones — varias campañas a la vez, cada una con su alcance.
 *
 * El calendario de `src/lib/promo.ts` cubre las fechas fijas del año. Esto cubre
 * lo vivo: abrir un descuento sin desplegar, dirigirlo a un proveedor concreto,
 * excluir cursos sueltos y dejarlo programado. Cada fila de `promocion` es una
 * campaña independiente; el sitio aplica a cada curso la de mayor prioridad que
 * lo cubre por proveedor, país y fechas.
 *
 * Por qué multi-instancia: un único interruptor no distinguía de quién era el
 * curso, así que un 50 % «para todos» tocaba también a creadores cuyo checkout
 * no honra el cupón, y el visitante veía media tarifa y pagaba entera. Ahora una
 * promoción apunta a `['masterclasses']` y los demás quedan fuera sin listarlos.
 */
import { type Env, e, fecha, irA, noAutorizado, pagina, sesion } from './_ui';

/** Los dos únicos cupones que Hotmart reconoce. Verificados en el checkout. */
const CUPONES: Record<string, string> = { '25': '010775', '50': '031016' };

/**
 * Proveedores objetivo posibles. Copia legible de src/lib/proveedores.ts: el
 * panel corre en el bundle de Pages Functions, aparte del de `src/`, así que se
 * duplican los tres nombres en vez de acoplar los dos build. Si allí se añade un
 * proveedor, se añade aquí.
 */
const PROVEEDORES: [string, string][] = [
  ['masterclasses', 'Mauricio Duque · MasterClasses'],
  ['cursosdecocina', 'Escuela Cursosdecocina'],
  ['peluqueria', 'Peluquería (productor externo)'],
];

const PAISES: [string, string][] = [
  ['co', 'Colombia'], ['mx', 'México'], ['es', 'España'], ['ar', 'Argentina'],
  ['cl', 'Chile'], ['pe', 'Perú'], ['ec', 'Ecuador'], ['us', 'Estados Unidos'],
];

interface Fila {
  id: string;
  nombre: string;
  activa: number;
  pct: number;
  cupon: string;
  titular: string;
  proveedores: string;
  incluir: string;
  excluir: string;
  paises: string;
  desde: number | null;
  hasta: number | null;
  prioridad: number;
  actualizado: number;
  por: string | null;
}

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

/** Convierte `datetime-local` en hora de Bogotá a epoch, o `null` si viene vacío. */
const aEpoch = (bruto: string): number | null => {
  const v = bruto.trim();
  if (!v) return null;
  const ms = new Date(`${v}:00-05:00`).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
};

type Estado = 'inactiva' | 'vigente' | 'programada' | 'vencida';

function estadoDe(f: Fila, ahora: number): Estado {
  if (!f.activa) return 'inactiva';
  if (f.desde && f.desde > ahora) return 'programada';
  if (f.hasta && f.hasta <= ahora) return 'vencida';
  return 'vigente';
}

const COLOR: Record<Estado, string> = {
  vigente: 'var(--ok)', programada: '#3367d6', vencida: 'var(--alerta)', inactiva: 'var(--apagado)',
};

async function leerTodas(env: Env): Promise<{ filas: Fila[]; falta: boolean }> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, nombre, activa, pct, cupon, titular, proveedores, incluir, excluir,
              paises, desde, hasta, prioridad, actualizado, por
         FROM promocion
        ORDER BY activa DESC, prioridad DESC, actualizado DESC`,
    ).all<Fila>();
    return { filas: results ?? [], falta: false };
  } catch {
    return { filas: [], falta: true };
  }
}

function ventanaTexto(f: Fila): string {
  const desde = f.desde ? `desde ${e(fecha(f.desde))}` : '';
  const hasta = f.hasta ? `hasta ${e(fecha(f.hasta))}` : 'sin fin (perpetua)';
  return [desde, hasta].filter(Boolean).join(' · ');
}

function tarjetas(filas: Fila[], ahora: number): string {
  const vigentes = filas.filter((f) => estadoDe(f, ahora) === 'vigente').length;
  const programadas = filas.filter((f) => estadoDe(f, ahora) === 'programada').length;
  return `
<div class="tarjetas" style="margin-bottom:1.5rem">
  <div class="tarjeta${vigentes ? '' : ''}"><div class="n" style="${vigentes ? 'color:var(--ok)' : ''}">${vigentes}</div>
    <div class="t">Vigentes ahora</div></div>
  <div class="tarjeta"><div class="n">${programadas}</div><div class="t">Programadas</div></div>
  <div class="tarjeta"><div class="n">${filas.length}</div><div class="t">Total de promociones</div></div>
</div>`;
}

function tabla(filas: Fila[], ahora: number): string {
  if (!filas.length) {
    return `<div class="caja"><div class="vacio">No hay promociones todavía. Crea la primera abajo.</div></div>`;
  }
  const filasHtml = filas.map((f) => {
    const est = estadoDe(f, ahora);
    const provs = lista(f.proveedores);
    const alcance = provs.length
      ? provs.map((p) => PROVEEDORES.find(([id]) => id === p)?.[1] ?? p).join(', ')
      : 'Todos los proveedores';
    const inc = lista(f.incluir).length;
    const exc = lista(f.excluir).length;
    const pais = lista(f.paises);
    return `<tr>
  <td><b>${e(f.nombre)}</b><br><span style="color:var(--apagado);font-size:.8rem">Prioridad ${f.prioridad}</span></td>
  <td><b>−${f.pct}%</b><br><code>${e(f.cupon)}</code></td>
  <td>${e(alcance)}${inc ? `<br><span style="color:var(--apagado);font-size:.8rem">+${inc} suelto${inc === 1 ? '' : 's'}</span>` : ''}${
    exc ? `<br><span style="color:var(--alerta);font-size:.8rem">−${exc} excluido${exc === 1 ? '' : 's'}</span>` : ''
  }</td>
  <td>${e(ventanaTexto(f))}<br><span style="color:var(--apagado);font-size:.8rem">${
    pais.length ? pais.join(', ') : 'todos los países'
  }</span></td>
  <td><span style="color:${COLOR[est]};font-weight:700;text-transform:capitalize">${est}</span></td>
  <td style="white-space:nowrap">
    <a class="boton" href="/admin/promociones?editar=${encodeURIComponent(f.id)}">Editar</a>
    <form method="post" class="fila" onsubmit="return true">
      <input type="hidden" name="accion" value="${f.activa ? 'desactivar' : 'activar'}">
      <input type="hidden" name="id" value="${e(f.id)}">
      <button type="submit" class="${f.activa ? '' : 'ok'}">${f.activa ? 'Desactivar' : 'Activar'}</button>
    </form>
    <form method="post" class="fila" onsubmit="return confirm('¿Eliminar «${e(f.nombre)}»? No se puede deshacer.')">
      <input type="hidden" name="accion" value="eliminar">
      <input type="hidden" name="id" value="${e(f.id)}">
      <button type="submit" class="no">Eliminar</button>
    </form>
  </td>
</tr>`;
  }).join('');
  return `<div class="caja"><table>
<thead><tr><th>Nombre</th><th>Descuento</th><th>Alcance</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead>
<tbody>${filasHtml}</tbody></table></div>`;
}

function formulario(edit: Fila | null): string {
  const sel = (v: boolean) => (v ? ' selected' : '');
  const chk = (v: boolean) => (v ? ' checked' : '');
  const provs = edit ? lista(edit.proveedores) : ['masterclasses'];
  const pais = edit ? lista(edit.paises) : [];
  const inc = edit ? lista(edit.incluir).join('\n') : '';
  const exc = edit ? lista(edit.excluir).join('\n') : '';

  return `
<h2>${edit ? `Editar «${e(edit.nombre)}»` : 'Nueva promoción'}</h2>
<form method="post" class="caja" style="padding:1.25rem;display:grid;gap:1.1rem;max-width:820px">
  <input type="hidden" name="accion" value="guardar">
  <input type="hidden" name="id" value="${edit ? e(edit.id) : ''}">

  <div style="display:grid;gap:1.1rem;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
    <label>Nombre interno<br>
      <input type="text" name="nombre" maxlength="60" required value="${edit ? e(edit.nombre) : ''}"
             placeholder="Black Friday MasterClasses" style="width:100%;padding:.45rem;margin-top:.3rem">
    </label>
    <label>Descuento<br>
      <select name="pct" style="width:100%;padding:.45rem;margin-top:.3rem">
        <option value="25"${sel(!edit || edit.pct === 25)}>−25 % · cupón 010775</option>
        <option value="50"${sel(edit?.pct === 50)}>−50 % · cupón 031016</option>
      </select>
    </label>
    <label>Prioridad (mayor gana)<br>
      <input type="number" name="prioridad" min="0" max="9999" value="${edit ? edit.prioridad : 100}"
             style="width:100%;padding:.45rem;margin-top:.3rem">
    </label>
  </div>

  <label>Titular del banner<br>
    <input type="text" name="titular" maxlength="70" value="${edit ? e(edit.titular) : 'Descuento activo'}"
           style="width:100%;padding:.45rem;margin-top:.3rem">
  </label>

  <fieldset style="border:1px solid var(--borde);border-radius:8px;padding:.9rem">
    <legend style="font-size:.8rem;color:var(--apagado);padding:0 .4rem">Proveedores objetivo (ninguno = todos)</legend>
    <div style="display:flex;flex-wrap:wrap;gap:.9rem">
      ${PROVEEDORES.map(([id, nombre]) =>
        `<label style="display:flex;gap:.35rem;align-items:center;font-size:.88rem">
          <input type="checkbox" name="proveedores" value="${id}"${chk(provs.includes(id))}> ${e(nombre)}
        </label>`).join('')}
    </div>
    <p class="nota" style="margin:.6rem 0 0">Marca <b>MasterClasses</b> para el descuento del cupón 031016.
    Los creadores cuyo checkout no acepta ese cupón nunca reciben el descuento, aunque los marques aquí.</p>
  </fieldset>

  <div style="display:grid;gap:1.1rem;grid-template-columns:1fr 1fr">
    <label>Incluir además estos cursos (un slug por línea)<br>
      <textarea name="incluir" rows="4" placeholder="curso-de-barberia"
                style="width:100%;padding:.45rem;margin-top:.3rem;font-family:ui-monospace,monospace">${e(inc)}</textarea>
    </label>
    <label>Excluir estos cursos, aunque su proveedor entre (un slug por línea)<br>
      <textarea name="excluir" rows="4" placeholder="curso-de-maquillaje"
                style="width:100%;padding:.45rem;margin-top:.3rem;font-family:ui-monospace,monospace">${e(exc)}</textarea>
    </label>
  </div>

  <div style="display:grid;gap:1.1rem;grid-template-columns:1fr 1fr">
    <label>Empieza el (vacío = ya)<br>
      <input type="datetime-local" name="desde" value="${paraInput(edit?.desde ?? null)}"
             style="width:100%;padding:.45rem;margin-top:.3rem">
    </label>
    <label>Termina el (vacío = perpetua, sin cuenta atrás)<br>
      <input type="datetime-local" name="hasta" value="${paraInput(edit?.hasta ?? null)}"
             style="width:100%;padding:.45rem;margin-top:.3rem">
    </label>
  </div>

  <fieldset style="border:1px solid var(--borde);border-radius:8px;padding:.9rem">
    <legend style="font-size:.8rem;color:var(--apagado);padding:0 .4rem">Países (ninguno = todos)</legend>
    <div style="display:flex;flex-wrap:wrap;gap:.9rem">
      ${PAISES.map(([cc, nombre]) =>
        `<label style="display:flex;gap:.35rem;align-items:center;font-size:.88rem">
          <input type="checkbox" name="paises" value="${cc}"${chk(pais.includes(cc))}> ${nombre}
        </label>`).join('')}
    </div>
  </fieldset>

  <label style="display:flex;gap:.6rem;align-items:center;font-weight:700">
    <input type="checkbox" name="activa" value="1"${chk(!edit || !!edit.activa)}>
    Activar esta promoción al guardar
  </label>

  <div style="display:flex;gap:.7rem">
    <button type="submit" class="pri">${edit ? 'Guardar cambios' : 'Crear promoción'}</button>
    ${edit ? '<a class="boton" href="/admin/promociones">Cancelar</a>' : ''}
  </div>
</form>`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { email: mod, motivo } = await sesion(request, env);
  if (!mod) return noAutorizado(motivo);

  const { filas, falta } = await leerTodas(env);
  const url = new URL(request.url);
  const ahora = Math.floor(Date.now() / 1000);
  const editId = url.searchParams.get('editar');
  const edit = editId ? filas.find((f) => f.id === editId) ?? null : null;
  const guardado = url.searchParams.has('ok');

  return pagina('Promociones', mod, 'promociones', `
${falta ? `<div class="aviso"><b>Falta la migración.</b> Ejecuta
<code>npx wrangler d1 migrations apply sably-pulso --remote</code> para crear la tabla
<code>promocion</code>. Hasta entonces este panel no guarda nada y la web se rige por el
calendario horneado y, si existe, por el descuento manual anterior.</div>` : ''}
${guardado ? '<div class="aviso" style="background:#e8f5e9;border-color:#a5d6a7">Guardado. Tarda hasta un minuto en verse en la web: la respuesta se cachea 60 s en el borde.</div>' : ''}

${tarjetas(filas, ahora)}
${tabla(filas, ahora)}
${formulario(edit)}

<p class="nota">El descuento viaja al checkout como <code>?offDiscount=&lt;cupón&gt;</code>, el
parámetro que Hotmart aplica de verdad. Solo se pinta en cursos cuyo proveedor acepta ese cupón:
un curso marcado sin-cupón nunca recibe el descuento aunque una promoción lo incluya, porque
anunciar media tarifa donde el checkout cobra entera es la peor forma de perder una venta.</p>

<p class="nota"><b>Cómo se elige la promoción de un curso.</b> Entre las vigentes que lo cubren
—por proveedor, o porque está en «incluir», y nunca si está en «excluir»— gana la de mayor
prioridad. Así puedes tener un 50 % de MasterClasses y un 25 % de otro proveedor a la vez, cada
uno tocando solo sus cursos.</p>

<p class="nota"><b>Programar Black Friday.</b> Crea la promoción, pon «empieza el» en la fecha
futura y «termina el» en su cierre, y déjala activa. No se verá hasta que llegue su fecha, y se
apagará sola al terminar. El «termina el» enciende la cuenta atrás; déjalo vacío para un descuento
perpetuo sin reloj.</p>`);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { email: mod, motivo } = await sesion(request, env);
  if (!mod) return noAutorizado(motivo);

  const f = await request.formData();
  const accion = String(f.get('accion') ?? '');
  const id = String(f.get('id') ?? '').trim();

  const fallo = (msg: string) =>
    pagina('Promociones', mod, 'promociones',
      `<div class="aviso"><b>No se guardó.</b> ${e(msg)}</div>
<p><a class="boton" href="/admin/promociones">Volver</a></p>`);

  try {
    if (accion === 'eliminar' && id) {
      await env.DB.prepare('DELETE FROM promocion WHERE id = ?').bind(id).run();
      return irA('/admin/promociones?ok=1');
    }

    if ((accion === 'activar' || accion === 'desactivar') && id) {
      await env.DB.prepare('UPDATE promocion SET activa = ?, actualizado = unixepoch(), por = ? WHERE id = ?')
        .bind(accion === 'activar' ? 1 : 0, mod, id)
        .run();
      return irA('/admin/promociones?ok=1');
    }

    if (accion === 'guardar') {
      const nombre = String(f.get('nombre') ?? '').trim().slice(0, 60) || 'Promoción';
      const pct = f.get('pct') === '50' ? 50 : 25;
      const titular = String(f.get('titular') ?? '').trim().slice(0, 70) || 'Descuento activo';
      const prioridad = Math.max(0, Math.min(9999, Number(f.get('prioridad')) || 100));

      const proveedores = f.getAll('proveedores').map(String)
        .filter((p) => PROVEEDORES.some(([pid]) => pid === p));
      const paises = f.getAll('paises').map(String).filter((p) => PAISES.some(([cc]) => cc === p));

      const trocear = (campo: string) =>
        String(f.get(campo) ?? '').split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean);
      const incluir = trocear('incluir');
      const excluir = trocear('excluir');

      const desde = aEpoch(String(f.get('desde') ?? ''));
      const hasta = aEpoch(String(f.get('hasta') ?? ''));
      if (desde !== null && hasta !== null && hasta <= desde) {
        return fallo('La fecha de fin va después de la de inicio.');
      }
      const activa = f.get('activa') === '1' ? 1 : 0;

      const nuevoId = id || (crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}`);

      await env.DB.prepare(
        `INSERT INTO promocion
           (id, nombre, activa, pct, cupon, titular, proveedores, incluir, excluir,
            paises, desde, hasta, prioridad, actualizado, por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), ?)
         ON CONFLICT(id) DO UPDATE SET
           nombre = excluded.nombre, activa = excluded.activa, pct = excluded.pct,
           cupon = excluded.cupon, titular = excluded.titular,
           proveedores = excluded.proveedores, incluir = excluded.incluir,
           excluir = excluded.excluir, paises = excluded.paises,
           desde = excluded.desde, hasta = excluded.hasta,
           prioridad = excluded.prioridad, actualizado = unixepoch(), por = excluded.por`,
      )
        .bind(nuevoId, nombre, activa, pct, CUPONES[String(pct)]!, titular,
              JSON.stringify(proveedores), JSON.stringify(incluir), JSON.stringify(excluir),
              JSON.stringify(paises), desde, hasta, prioridad, mod)
        .run();

      return irA('/admin/promociones?ok=1');
    }

    return irA('/admin/promociones');
  } catch (err) {
    console.error('No se pudo guardar la promoción:', err);
    return fallo('Suele ser que falta la migración: ejecuta '
      + 'npx wrangler d1 migrations apply sably-pulso --remote y vuelve a intentarlo.');
  }
};
