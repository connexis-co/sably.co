import { persistentAtom } from '@nanostores/persistent';
import { DEFAULT_COUNTRY } from '@/lib/countries';

/**
 * Preferencia geo del usuario, compartida entre scripts/islands y persistida
 * en localStorage. La página en sí es estática por país (SSG): estos átomos
 * solo guían la navegación y el pre-llenado de formularios.
 */
export const $country = persistentAtom<string>('sably:country', DEFAULT_COUNTRY);
export const $city = persistentAtom<string>('sably:city', '');
