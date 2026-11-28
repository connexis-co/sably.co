import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trackEvent } from '../src/lib/analytics';

type Llamada = unknown[];

/** Navegador mínimo: ruta, cookies vacías y un `fbq` que anota (o que falta, o que falla). */
function navegar(modo: 'gtm' | 'direct', ruta: string, fbq: 'anota' | 'falta' | 'falla' = 'anota') {
  const llamadas: Llamada[] = [];
  const window = {
    sablyTrackingMode: modo,
    dataLayer: [] as Record<string, unknown>[],
    fbq: fbq === 'falta' ? undefined : (...args: unknown[]) => { if (fbq === 'falla') throw new Error('fbq'); llamadas.push(args); },
  };
  Object.assign(globalThis, { window, document: { cookie: '' }, location: { pathname: ruta } });
  return { window, llamadas };
}

const clic = () => trackEvent('click_cta_hotmart', { page: location.pathname, cta_position: 'panel' });

test('modo directo: el clic de compra es un AddToCart con curso y país, sin valor ni moneda', () => {
  const { llamadas } = navegar('direct', '/co/curso-de-barismo/');
  clic();
  assert.deepEqual(llamadas, [['track', 'AddToCart', {
    content_ids: ['curso-de-barismo'], content_type: 'product', content_name: 'curso-de-barismo', content_category: 'co',
  }]]);
});

test('fuera de una ficha el AddToCart no inventa un curso', () => {
  for (const ruta of ['/co/cursos/', '/co/homologaciones/programa/']) {
    const { llamadas } = navegar('direct', ruta);
    clic();
    assert.deepEqual(llamadas, [['track', 'AddToCart', {}]], ruta);
  }
});

test('modo gtm: el código no llama a fbq (lo hace Tag Manager y se contaría dos veces)', () => {
  const { window, llamadas } = navegar('gtm', '/co/curso-de-barismo/');
  clic();
  assert.deepEqual(llamadas, []);
  assert.equal(window.dataLayer.at(-1)?.event, 'click_cta_hotmart', 'el activador de Tag Manager sigue llegando');
});

test('sin fbq, o si fbq falla, el clic no se rompe', () => {
  for (const estado of ['falta', 'falla'] as const) {
    const { window } = navegar('direct', '/co/curso-de-barismo/', estado);
    assert.doesNotThrow(clic, estado);
    assert.equal(window.dataLayer.length, 1);
  }
});

test('las dos fichas emiten click_cta_hotmart en todos sus botones de compra', () => {
  for (const ficha of ['../src/components/CourseLanding.astro', '../src/themes/sably-v2/components/CourseLanding.astro']) {
    const fuente = readFileSync(new URL(ficha, import.meta.url), 'utf8');
    assert.match(fuente, /querySelectorAll<HTMLAnchorElement>\('\[data-cta-hotmart\]'\)/, ficha);
    assert.match(fuente, /trackEvent\('click_cta_hotmart'/, ficha);
  }
});
