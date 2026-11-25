/**
 * Lado del navegador de las piezas de promoción: la barra y el bloque del tema
 * clásico (PromoBanner.astro) y la barra, la banda, la franja y la tarjeta del
 * megamenú del tema V2 (`data-promo-v2`). Antes vivía dentro de PromoBanner;
 * se sacó aquí para que los dos temas compartan la misma regla sin copiarla.
 *
 * El servidor ya pintó la promoción vigente. Esto la vuelve a pedir porque el
 * HTML puede venir de la caché del borde: la confirma, la cambia o la retira,
 * pone el cupón en los enlaces de pago y, en el clásico, arranca la cuenta atrás.
 */
import {
  campaignDePromocion,
  cargarPromos,
  formatCountdown,
  mejorPromocion,
  msRestantes,
  type PromoCampaign,
  type PromoTheme,
} from '@/lib/promo';
import { fechaCorta } from '@/lib/cuenta-atras';

type Pintable = Omit<PromoCampaign, 'endsAt'> & { endsAt: string | null };

const CLAVE_CERRADA = 'sably:promo-cerrada';

/** La campaña que dejó pintada el servidor (o un pintado anterior), si hay. */
const pintada = (el: HTMLElement): Pintable | null => {
  try {
    return el.dataset.promoSsr ? (JSON.parse(el.dataset.promoSsr) as Pintable) : null;
  } catch {
    return null;
  }
};

/** Pone o quita las clases de un tema en los mismos nodos, en ambas variantes del clásico. */
function aplicarTema(el: HTMLElement, tema: PromoTheme, accion: 'add' | 'remove'): void {
  // Las piezas V2 tienen su propio aspecto (banda «Noche»): el tema de la campaña no las pinta.
  if (el.dataset.promoV2 !== undefined) return;
  const op = (n: Element, cls?: string) => cls && n.classList[accion](...cls.split(' '));
  const en = (sel: string, cls?: string) => el.querySelectorAll(sel).forEach((n) => op(n, cls));
  op(el, tema.fondo);
  op(el, tema.texto);
  // El CSS base fija `color` en h1..h4, y una regla explícita gana a la
  // herencia del contenedor: sin esto el titular sale azul marino sobre el
  // fondo negro de Black Friday y no se lee.
  en('h2', tema.texto);
  en('[data-promo-filete]', tema.filete);
  en('[data-u],[data-caja],[data-promo-cupon]', tema.caja);
  en('[data-promo-pct],[data-promo-cta]', tema.acento);
}

const cerradaEnSesion = (id: string) => {
  try { return sessionStorage.getItem(CLAVE_CERRADA) === id; } catch { return false; }
};

let iniciado = false;

export function iniciarPromos(): void {
  if (iniciado) return;
  iniciado = true;
  const nodos = document.querySelectorAll<HTMLElement>('[data-promo-barra],[data-promo-bloque],[data-promo-v2]');
  /* En una página de un creador sin cupón el banner NO se pinta.
     No es solo que el descuento no aplique: anunciar «−50%» donde el checkout
     cobra la tarifa entera es discrepancia entre anuncio y destino, y eso Meta
     lo penaliza y Google puede desaprobar el anuncio. */
  if (!nodos.length || document.body.hasAttribute('data-sin-cupon')) return;
  const pais = document.body.dataset.country ?? document.documentElement.lang?.split('-')[1]?.toLowerCase() ?? 'co';
  const urlKey = new URLSearchParams(location.search).get('promo');
  const proveedor = document.body.dataset.proveedor ?? 'masterclasses';

  // El slug del curso sale de la ruta: /<pais>/[ciudad/]<slug>/. Sirve para el
  // alcance por curso (incluir/excluir) de las promociones del panel.
  const tramos = location.pathname.split('/').filter(Boolean);
  const courseSlug = tramos.find((t) => t.startsWith('curso-'));

  // Copiar el cupón de un toque (un solo manejador para todas las piezas).
  document.addEventListener('click', async (evento) => {
    const objetivo = evento.target as Element;
    const cerrar = objetivo.closest<HTMLElement>('[data-promo-cerrar]');
    if (cerrar) {
      const pieza = cerrar.closest<HTMLElement>('[data-promo-v2]');
      if (pieza) {
        pieza.hidden = true;
        try { sessionStorage.setItem(CLAVE_CERRADA, pintada(pieza)?.id ?? ''); } catch { /* sin almacenamiento: solo esta vista */ }
      }
      return;
    }
    const boton = objetivo.closest<HTMLElement>('[data-promo-cupon]');
    const pieza = boton?.closest<HTMLElement>('[data-promo-barra],[data-promo-bloque],[data-promo-v2]');
    const promo = pieza && pintada(pieza);
    if (!boton || !promo) return;
    try {
      await navigator.clipboard.writeText(promo.couponCode);
    } catch {
      return; // Sin permiso de portapapeles el código sigue visible para copiarlo.
    }
    const aviso = boton.querySelector<HTMLElement>('[data-promo-copiado]');
    const texto = boton.querySelector<HTMLElement>('[data-promo-copiar-texto]');
    aviso?.classList.remove('hidden');
    if (texto) texto.textContent = 'Copiado';
    setTimeout(() => {
      aviso?.classList.add('hidden');
      if (texto) texto.textContent = 'Copiar';
    }, 1800);
  });

  // EmDash es la fuente del calendario. Sin promoción vigente no se anuncia descuento.
  cargarPromos().then((promos) => {
    if (promos === null) {
      // Sin respuesta no se sabe si cambió: se queda lo del servidor, con reloj.
      nodos.forEach((el) => {
        const previa = pintada(el);
        if (previa) pintar(el, previa);
      });
      return;
    }
    const p = mejorPromocion(promos, { countryCode: pais, proveedor, courseSlug, urlKey });
    const manual = p && campaignDePromocion(p);
    nodos.forEach((el) => {
      if (manual) pintar(el, manual);
      else el.hidden = true;
    });
  });
}

function pintar(el: HTMLElement, promo: Pintable): void {
  const tema = promo.theme;
  const poner = (sel: string, txt: string) =>
    el.querySelectorAll<HTMLElement>(sel).forEach((n) => (n.textContent = txt));

  // La caché del borde puede traer otra campaña pintada: primero se retira su tema.
  const previa = pintada(el);
  if (previa?.theme && previa.id !== promo.id) aplicarTema(el, previa.theme, 'remove');
  if (tema) aplicarTema(el, tema, 'add');
  el.dataset.promoSsr = JSON.stringify(promo);

  poner('[data-promo-gorro]', promo.label);
  poner('[data-promo-titular]', promo.titular ?? promo.label);
  poner('[data-promo-pct]', `−${promo.discountPct}%`);
  poner('[data-promo-pct-v2]', `${promo.discountPct} %`);
  poner('[data-promo-codigo]', promo.couponCode);
  el.querySelectorAll<HTMLElement>('[data-promo-fin]').forEach((n) => {
    n.hidden = !promo.endsAt;
    const fecha = n.querySelector<HTMLElement>('[data-promo-fecha]');
    if (fecha && promo.endsAt) fecha.textContent = fechaCorta(Date.parse(promo.endsAt));
  });

  // El cupón se añade a TODOS los CTA de pago de la página, no solo a los de
  // la ficha de curso: este código vive en el layout, así que también cubre las
  // páginas de homologaciones, que no llevan la ficha y por tanto se quedaban
  // sin cupón mientras el banner lo anunciaba.
  document.querySelectorAll<HTMLAnchorElement>('a[data-cta-hotmart]').forEach((a) => {
    try {
      const url = new URL(a.href);
      /* Solo enlaces de pago de Hotmart: las homologaciones marcan con data-cta-hotmart
         su botón de WhatsApp, que no lleva cupón. */
      if (!/(^|\.)hotm(art)?\.(io|art|com)$/.test(url.hostname)) return;
      url.searchParams.set('offDiscount', promo.couponCode);
      a.href = url.toString();
    } catch {
      /* href no parseable: mejor dejar el enlace de pago intacto. */
    }
  });

  const cta = el.querySelector<HTMLAnchorElement>('[data-promo-cta]');
  if (cta) cta.href = `/${document.body.dataset.country ?? document.documentElement.lang?.split('-')[1]?.toLowerCase() ?? 'co'}/cursos/`;

  const vence = msRestantes(promo, new Date());
  const v2 = el.dataset.promoV2 !== undefined;
  if (vence <= 0) { el.hidden = true; return; }
  // La barra V2 que se cerró en esta sesión no vuelve a salir en cada página.
  el.hidden = v2 && el.dataset.promoV2 === 'barra' && cerradaEnSesion(promo.id);
  if (v2) {
    // Sin segundos ni reloj que corre: la fecha de fin va en texto. Al llegar, se retira sola.
    if (promo.endsAt && Number.isFinite(vence) && vence < 2 ** 31) setTimeout(() => { el.hidden = true; }, vence);
    return;
  }

  const reloj = el.querySelector<HTMLElement>('[data-promo-reloj]');
  // Promoción sin fecha de fin: se enseña la oferta, no un contador inventado.
  if (!promo.endsAt) {
    if (reloj) reloj.hidden = true;
    return;
  }
  if (reloj) reloj.hidden = false;

  const unidades = el.querySelectorAll<HTMLElement>('[data-u]');
  const previo = Number(el.dataset.tick);
  if (previo) clearInterval(previo);

  let id: number | undefined;
  const tick = (): void => {
    const ms = msRestantes(promo, new Date());
    if (ms <= 0) {
      // La campaña venció con la pestaña abierta: la barra se retira sola.
      el.hidden = true;
      if (id !== undefined) clearInterval(id);
      return;
    }
    const t = formatCountdown(ms);
    unidades.forEach((n) => {
      const u = n.dataset.u as 'd' | 'h' | 'm' | 's';
      n.textContent = t[u];
    });
  };
  tick();
  id = setInterval(tick, 1000) as unknown as number;
  el.dataset.tick = String(id);
}
