export interface City {
  slug: string;
  name: string;
}

export interface Country {
  /** Código de país usado en la URL: /co/, /mx/... */
  code: string;
  name: string;
  flag: string;
  /** hreflang, ej. es-CO */
  hreflang: string;
  currency: string;
  currencySymbol: string;
  /** Tasa estática aproximada USD→moneda local. Fase 2: tasa dinámica desde el backend. */
  usdRate: number;
  /** Redondeo "bonito" del precio local (ej. 1000 → $119.000 COP). */
  priceRound: number;
  /** Línea WhatsApp central Sably (+57 311 457 4788); TODO(JP): números locales por país cuando existan. */
  whatsapp: string;
  phoneDisplay: string;
  cities: City[];
}

export const COUNTRIES: Country[] = [
  {
    code: 'co',
    name: 'Colombia',
    flag: '🇨🇴',
    hreflang: 'es-CO',
    currency: 'COP',
    currencySymbol: '$',
    usdRate: 4000,
    priceRound: 1000,
    whatsapp: '573114574788',
    phoneDisplay: '+57 311 457 4788',
    cities: [
      { slug: 'bogota', name: 'Bogotá' },
      { slug: 'medellin', name: 'Medellín' },
      { slug: 'cali', name: 'Cali' },
      { slug: 'barranquilla', name: 'Barranquilla' },
      { slug: 'cartagena', name: 'Cartagena' },
      { slug: 'bucaramanga', name: 'Bucaramanga' },
    ],
  },
  {
    code: 'mx',
    name: 'México',
    flag: '🇲🇽',
    hreflang: 'es-MX',
    currency: 'MXN',
    currencySymbol: '$',
    usdRate: 18,
    priceRound: 10,
    whatsapp: '573114574788',
    phoneDisplay: '+52 55 0000 0000',
    cities: [
      { slug: 'cdmx', name: 'Ciudad de México' },
      { slug: 'guadalajara', name: 'Guadalajara' },
      { slug: 'monterrey', name: 'Monterrey' },
      { slug: 'puebla', name: 'Puebla' },
      { slug: 'cancun', name: 'Cancún' },
    ],
  },
  {
    code: 'pe',
    name: 'Perú',
    flag: '🇵🇪',
    hreflang: 'es-PE',
    currency: 'PEN',
    currencySymbol: 'S/',
    usdRate: 3.7,
    priceRound: 1,
    whatsapp: '573114574788',
    phoneDisplay: '+51 1 000 0000',
    cities: [
      { slug: 'lima', name: 'Lima' },
      { slug: 'arequipa', name: 'Arequipa' },
      { slug: 'trujillo', name: 'Trujillo' },
      { slug: 'cusco', name: 'Cusco' },
    ],
  },
  {
    code: 'ec',
    name: 'Ecuador',
    flag: '🇪🇨',
    hreflang: 'es-EC',
    currency: 'USD',
    currencySymbol: '$',
    usdRate: 1,
    priceRound: 1,
    whatsapp: '573114574788',
    phoneDisplay: '+593 90 000 0000',
    cities: [
      { slug: 'quito', name: 'Quito' },
      { slug: 'guayaquil', name: 'Guayaquil' },
      { slug: 'cuenca', name: 'Cuenca' },
    ],
  },
  {
    code: 'cl',
    name: 'Chile',
    flag: '🇨🇱',
    hreflang: 'es-CL',
    currency: 'CLP',
    currencySymbol: '$',
    usdRate: 950,
    priceRound: 1000,
    whatsapp: '573114574788',
    phoneDisplay: '+56 2 0000 0000',
    cities: [
      { slug: 'santiago', name: 'Santiago' },
      { slug: 'valparaiso', name: 'Valparaíso' },
      { slug: 'concepcion', name: 'Concepción' },
    ],
  },
  {
    code: 'ar',
    name: 'Argentina',
    flag: '🇦🇷',
    hreflang: 'es-AR',
    currency: 'ARS',
    currencySymbol: '$',
    usdRate: 1400,
    priceRound: 1000,
    whatsapp: '573114574788',
    phoneDisplay: '+54 11 0000 0000',
    cities: [
      { slug: 'buenosaires', name: 'Buenos Aires' },
      { slug: 'cordoba', name: 'Córdoba' },
      { slug: 'rosario', name: 'Rosario' },
      { slug: 'mendoza', name: 'Mendoza' },
    ],
  },
  {
    code: 'es',
    name: 'España',
    flag: '🇪🇸',
    hreflang: 'es-ES',
    currency: 'EUR',
    currencySymbol: '€',
    usdRate: 0.92,
    priceRound: 1,
    whatsapp: '573114574788',
    phoneDisplay: '+57 311 457 4788',
    cities: [
      { slug: 'madrid', name: 'Madrid' },
      { slug: 'barcelona', name: 'Barcelona' },
      { slug: 'valencia', name: 'Valencia' },
      { slug: 'sevilla', name: 'Sevilla' },
      { slug: 'malaga', name: 'Málaga' },
      { slug: 'bilbao', name: 'Bilbao' },
    ],
  },
  {
    code: 'us',
    name: 'Estados Unidos',
    flag: '🇺🇸',
    hreflang: 'es-US',
    currency: 'USD',
    currencySymbol: '$',
    usdRate: 1,
    priceRound: 1,
    whatsapp: '573114574788',
    phoneDisplay: '+1 305 000 0000',
    cities: [
      { slug: 'miami', name: 'Miami' },
      { slug: 'houston', name: 'Houston' },
      { slug: 'losangeles', name: 'Los Ángeles' },
      { slug: 'newyork', name: 'Nueva York' },
      { slug: 'chicago', name: 'Chicago' },
    ],
  },
];

export const DEFAULT_COUNTRY = 'co';

export function getCountry(code: string): Country {
  const country = COUNTRIES.find((c) => c.code === code);
  if (!country) throw new Error(`País desconocido: ${code}`);
  return country;
}

export function getCity(country: Country, citySlug: string): City {
  const city = country.cities.find((c) => c.slug === citySlug);
  if (!city) throw new Error(`Ciudad desconocida: ${citySlug} (${country.code})`);
  return city;
}

/** Convierte un precio base USD a moneda local con redondeo comercial. */
export function localPrice(priceUSD: number, country: Country): number {
  const raw = priceUSD * country.usdRate;
  return Math.round(raw / country.priceRound) * country.priceRound;
}

export function formatPrice(priceUSD: number, country: Country): string {
  const value = localPrice(priceUSD, country);
  const formatted = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
  return `${country.currencySymbol}${formatted} ${country.currency}`;
}
