/**
 * Enlace de WhatsApp junto al precio de la ficha (caja de compra de los dos temas).
 *
 * Una sola fuente: la configuración del plugin `sably-whatsapp` (panel → Sably · WhatsApp), la misma de la burbuja
 * flotante. EmDash guarda el KV del plugin en `options` como `plugin:sably-whatsapp:config`; se lee igual que los
 * ajustes del tema (ajustes-tema.ts): una consulta por render de una página que va a caché, y guardar el panel
 * invalida las páginas (public-delivery.ts). El número, las reglas, el horario y las rutas ocultas los resuelve el
 * modelo del plugin: si la burbuja no sale en la página, este enlace tampoco.
 */
import { resolvePriceLink, withDefaults, type WhatsAppPriceLink, type WhatsAppSettings } from '@/plugins/sably-whatsapp/model';
import type { Country } from '@/lib/countries';

const CLAVE = 'plugin:sably-whatsapp:config';

async function leerConfig(): Promise<WhatsAppSettings | null> {
  try {
    const { getDb } = await import('emdash/runtime');
    const fila = await (await getDb()).selectFrom('options').select('value').where('name', '=', CLAVE).executeTakeFirst();
    return withDefaults(fila ? (JSON.parse(fila.value) as Partial<WhatsAppSettings>) : null);
  } catch {
    // Sin base o con un valor ilegible no se adivina el número: sin enlace.
    return null;
  }
}

interface Datos {
  url: URL;
  course: { id: string; data: { title: string; category?: string | null } };
  country: Pick<Country, 'code' | 'name' | 'whatsapp'>;
  /** Nombre del curso con su preposición: «del Curso de Uñas» (ficha.ts, `deNombre`). */
  deNombre: string;
}

export async function enlaceWhatsAppFicha({ url, course, country, deNombre }: Datos): Promise<WhatsAppPriceLink | null> {
  const config = await leerConfig();
  if (!config) return null;
  return resolvePriceLink(config, {
    path: url.pathname, course: course.id, title: course.data.title, category: course.data.category ?? '',
    country: country.code, countryName: country.name, countryNumber: country.whatsapp, url: url.origin + url.pathname,
  }, deNombre);
}
