/**
 * Animaciones ligadas al scroll (`animation-timeline`) tras el minificador.
 *
 * 25-nov-2026: en producción estaban todas muertas (cabecera, apariciones y
 * barra de progreso del artículo, `animationName: none`). La compilación pasa el
 * CSS por Lightning CSS, que funde `animation: x linear both;
 * animation-timeline: scroll(root)` en `animation: linear both x scroll(root)`;
 * Chrome no acepta la línea de tiempo dentro de la abreviada y descarta la
 * declaración entera. Escritas con longhands (sin todas las de `animation`), el
 * minificador no puede fundirlas.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { transform } from 'lightningcss';

const RAIZ = fileURLToPath(new URL('../src/', import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(css|astro)$/.test(n) ? [ruta] : [];
  });
}

/** CSS de un archivo: entero si es .css; los bloques <style> si es .astro. */
const cssDe = (ruta: string, texto: string) =>
  ruta.endsWith('.css') ? texto : [...texto.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

const conLineaDeTiempo = archivos(RAIZ)
  .map((ruta) => ({ ruta: ruta.slice(RAIZ.length), css: cssDe(ruta, readFileSync(ruta, 'utf8')) }))
  .filter((a) => /animation-timeline\s*:/.test(a.css));

/** Una abreviada `animation:` con línea de tiempo dentro: scroll(), view() o un nombre --x. */
const ABREVIADA_CON_TIEMPO = /(?<![-\w])animation\s*:[^;{}]*(?:scroll\(|view\(|\s--[\w-]+)/;

test('hay animaciones de scroll que vigilar (cabecera, apariciones y progreso del artículo)', () => {
  const rutas = conLineaDeTiempo.map((a) => a.ruta);
  for (const esperada of ['styles/v2.css', 'themes/sably-v2/estilos.css', 'themes/sably-v2/blog.css'])
    assert.ok(rutas.includes(esperada), `${esperada} ya no declara animation-timeline`);
});

for (const objetivo of [undefined, { chrome: 120 << 16 }]) {
  test(`el minificador conserva cada animation-timeline (${objetivo ? 'Chrome 120' : 'sin objetivo'})`, () => {
    for (const { ruta, css } of conLineaDeTiempo) {
      const { code } = transform({ filename: ruta, code: Buffer.from(css), minify: true, targets: objetivo, errorRecovery: true });
      const salida = code.toString();
      assert.doesNotMatch(salida, ABREVIADA_CON_TIEMPO, `${ruta}: la línea de tiempo acabó dentro de la abreviada «animation»`);
      const antes = css.match(/animation-timeline\s*:/g)!.length;
      const despues = salida.match(/animation-timeline:/g)?.length ?? 0;
      assert.equal(despues, antes, `${ruta}: ${antes} animation-timeline en el origen y ${despues} tras minificar`);
    }
  });
}

test('el detector reconoce el CSS roto de producción', () => {
  assert.match('.v2-cabecera{animation:linear both v2-cabecera-sombra scroll(root);animation-range:0 64px}', ABREVIADA_CON_TIEMPO);
  assert.match('.v2-progreso{animation:linear both v2-progreso --v2-lectura}', ABREVIADA_CON_TIEMPO);
  assert.doesNotMatch('.a{animation-name:x;animation-timeline:scroll(root)}', ABREVIADA_CON_TIEMPO);
});
