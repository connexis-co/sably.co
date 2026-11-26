/**
 * Promoción vigente para las piezas V2 (barra de campaña, tarjeta del megamenú,
 * banda de la portada y franja del listado). Misma regla que PromoBanner.astro:
 * país de la página, proveedor, curso de la ruta y `?promo=`. Se resuelve una
 * vez por petición; el navegador la confirma con src/lib/promo-cliente.ts.
 */
import { env } from 'virtual:sably-runtime';
import { campaignDePromocion, mejorPromocion } from '@/lib/promo';
import { readActivePromosForRequest } from '@/plugins/sably-operations/public';
import { fechaCorta } from '@/lib/cuenta-atras';
import { temaDeLaPeticion, type MuestraCampana } from '@/lib/ajustes-tema';

export interface PromoV2 {
  id: string;
  etiqueta: string;
  titular: string;
  pct: number;
  cupon: string;
  /** «25 nov., 7:00 p. m.» en hora de Colombia; null si la promoción no tiene fin. */
  fin: string | null;
  /** Fecha de fin en ms (para el contador); null sin fin. */
  finMs: number | null;
  /** Qué enseña cada aviso (panel → Campañas y cupones). */
  muestra: Record<'barra' | 'banda' | 'megamenu' | 'listado', MuestraCampana>;
  /** JSON que lee el navegador para confirmar o retirar la pieza. */
  ssr: string;
}

const cache = new WeakMap<object, Promise<PromoV2 | null>>();

export function promoDeLaPagina(
  astro: { url: URL; locals: object },
  opciones: { pais: string; proveedor?: string; sinCupon?: boolean },
): Promise<PromoV2 | null> {
  if (opciones.sinCupon) return Promise.resolve(null);
  const previa = cache.get(astro.locals);
  if (previa) return previa;
  const promesa = (async () => {
    const promos = await readActivePromosForRequest((env as unknown as { SABLY_DB: D1Database }).SABLY_DB, astro.locals).catch(() => []);
    const tramos = astro.url.pathname.split('/').filter(Boolean);
    const elegida = mejorPromocion(promos, {
      countryCode: opciones.pais,
      proveedor: opciones.proveedor ?? 'masterclasses',
      courseSlug: tramos.find(t => t.startsWith('curso-')),
      urlKey: astro.url.searchParams.get('promo'),
    });
    if (!elegida) return null;
    const c = campaignDePromocion(elegida);
    if (c.endsAt && Date.parse(c.endsAt) <= Date.now()) return null;
    const { ajustes } = await temaDeLaPeticion(astro as { url: URL; locals: App.Locals });
    return {
      id: c.id,
      etiqueta: c.label,
      titular: c.titular ?? c.label,
      pct: c.discountPct,
      cupon: c.couponCode,
      fin: c.endsAt ? fechaCorta(Date.parse(c.endsAt)) : null,
      finMs: c.endsAt ? Date.parse(c.endsAt) : null,
      muestra: ajustes.campana,
      ssr: JSON.stringify(c),
    };
  })();
  cache.set(astro.locals, promesa);
  return promesa;
}
