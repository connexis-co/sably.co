/**
 * Pinta la cuenta en la cabecera después de cargar, solo si existe la cookie pista. Nada personal
 * viaja en el HTML: nombre, foto y CSRF llegan de `/api/cuenta/yo` (`private, no-store`).
 */
interface Yo { cuenta: { nombre: string; correo: string; iniciales: string; foto: string | null; pais: string | null } | null; csrf?: string }

const PISTA = /(?:^|;\s*)sably_cuenta_ui=1(?:;|$)/;

function olvidar() {
  document.documentElement.removeAttribute('data-cuenta');
  // La cookie pista no es HttpOnly: si la sesión ya no vale, se quita para no volver a preguntar.
  document.cookie = `sably_cuenta_ui=; Max-Age=0; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

export async function pintarCuenta(): Promise<void> {
  if (!PISTA.test(document.cookie)) return;
  document.documentElement.setAttribute('data-cuenta', '1');
  let datos: Yo;
  try {
    const r = await fetch('/api/cuenta/yo', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (r.status === 401 || r.status === 404) { olvidar(); return; }
    if (!r.ok) return;
    datos = await r.json() as Yo;
  } catch { return; }
  const c = datos.cuenta;
  if (!c) { olvidar(); return; }
  const nombre = document.querySelector<HTMLElement>('[data-cuenta-nombre]');
  if (nombre && c.nombre) nombre.textContent = c.nombre;
  const correo = document.querySelector<HTMLElement>('[data-cuenta-correo]');
  if (correo) correo.textContent = c.correo ?? '';
  // El avatar sale dos veces: en el botón de la cabecera y en la cabeza del menú.
  document.querySelectorAll<HTMLElement>('[data-cuenta-iniciales]').forEach(n => { n.textContent = c.iniciales; });
  const avatar = document.querySelector<HTMLElement>('[data-cuenta-con]');
  if (avatar) avatar.setAttribute('aria-label', c.nombre ? `Tu cuenta: ${c.nombre}` : 'Tu cuenta');
  if (c.foto) {
    for (const foto of document.querySelectorAll<HTMLImageElement>('[data-cuenta-foto]')) {
      const iniciales = foto.parentElement?.querySelector<HTMLElement>('[data-cuenta-iniciales]');
      foto.addEventListener('load', () => { foto.hidden = false; if (iniciales) iniciales.hidden = true; }, { once: true });
      foto.src = c.foto;
    }
  }
  const csrf = document.querySelector<HTMLInputElement>('[data-cuenta-salir] [name="csrf"]');
  if (csrf && datos.csrf) csrf.value = datos.csrf;
  // Sin CSRF (raro), «Cerrar sesión» lleva a la página de confirmación, que sí lo trae.
  const salir = document.querySelector<HTMLFormElement>('[data-cuenta-salir]');
  if (salir && !datos.csrf) salir.addEventListener('submit', e => { e.preventDefault(); location.href = '/mi-cuenta/salir/'; });
  // Preferencia de país de la cuenta → la del dispositivo, si este no tiene ninguna (preferencias.md §5.4).
  try { if (c.pais && !localStorage.getItem('sably:country')) localStorage.setItem('sably:country', c.pais); } catch { /* sin almacenamiento */ }
}
