import assert from 'node:assert/strict';
import test from 'node:test';
import { bloqueAutor, extraerAutor } from './hotmart-autores.mjs';
import { productoCapturado } from './hotmart-precios.mjs';

// Recortes de la página pública del producto en Hotmart: primero los textos de
// interfaz (uno por idioma) y después el bloque de datos del autor.
const interfaz = '"hotmarter":{"years":"{{count}} Año Hotmarter","years_plural":"{{count}} Años Hotmarter"},"checkout":{"name":"x"}';
const datosNoviembre = '"hotmarter":{"name":"MasterClasses.La®","avatarFinal":"https:\\u002F\\u002Fhotmart.s3.amazonaws.com\\u002Fp\\u002Fmclafw.png","socialMedia":[],"slug":"masterclasses-la","language":"ES","userSince":2019,"biography":"Master Classes Latinoamérica es una empresa desarrolladora de cursos virtuales en video.","activeBadges":["BEST_SELLER","VERIFIED_PROFILE"],"ownerInfoCompact":{"name":"Otro","slug":"otro"}}';
const datosAgosto = '"hotmarter":{"userId":123,"name":"Mauricio Duque Zuluaga","slug":"mauricio-duque","userSince":2018,"biography":"Trabajando en Internet desde 1996","activeBadges":["VERIFIED_PROFILE"]}';

test('el autor se reconoce por su contenido, no por el orden de sus claves', () => {
  assert.equal(bloqueAutor(interfaz), '');
  assert.ok(bloqueAutor(`${interfaz}…${datosNoviembre}`).startsWith('"hotmarter":{"name":"MasterClasses'));
  assert.deepEqual(extraerAutor(`<html>${interfaz}${interfaz}…${datosNoviembre}</html>`), {
    slug: 'masterclasses-la',
    nombre: 'MasterClasses.La®',
    bio: 'Master Classes Latinoamérica es una empresa desarrolladora de cursos virtuales en video.',
    avatar: 'https://hotmart.s3.amazonaws.com/p/mclafw.png',
    desde: 2019,
    verificado: true,
    bestSeller: true,
  });
  // El formato anterior sigue valiendo.
  assert.equal(extraerAutor(`${interfaz}${datosAgosto}`)?.slug, 'mauricio-duque');
  assert.equal(extraerAutor(`${interfaz}${datosAgosto}`)?.bestSeller, false);
});

test('sin bloque de autor no hay creador: nunca se inventa uno', () => {
  assert.equal(extraerAutor('<html>página de error 404</html>'), null);
  assert.equal(extraerAutor(interfaz), null);
});

test('el refresco de precios conserva el autor del mismo producto y lo suelta si cambia', () => {
  const previo = { payUrl: 'https://pay.hotmart.com/L64043354A', hotlink: 'B1', titulo: 'Uñas', autor: 'masterclasses-la' };
  assert.deepEqual(productoCapturado(previo, { payUrl: 'https://pay.hotmart.com/L64043354A', hotlink: 'B2', titulo: 'Uñas 2' }), {
    payUrl: 'https://pay.hotmart.com/L64043354A', hotlink: 'B2', titulo: 'Uñas 2', autor: 'masterclasses-la',
  });
  // Otro checkout puede ser de otro creador: no se arrastra el autor viejo.
  assert.equal('autor' in productoCapturado(previo, { payUrl: 'https://pay.hotmart.com/OTRO', hotlink: 'B1', titulo: 'Uñas' }), false);
  assert.equal('autor' in productoCapturado(undefined, { payUrl: 'https://pay.hotmart.com/L64043354A', hotlink: 'B1', titulo: 'Uñas' }), false);
});
