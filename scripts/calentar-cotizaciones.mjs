#!/usr/bin/env node
/**
 * Llena el almacén de cotizaciones (`hotmart_cotizacion`) justo después de desplegar.
 *
 *   node scripts/calentar-cotizaciones.mjs                         # https://sably.co, ocho países
 *   node scripts/calentar-cotizaciones.mjs --base http://127.0.0.1:4321 --paises co,mx --minutos 8
 *
 * Las tarjetas ya no preguntan a Hotmart al renderizar: leen la última cotización guardada y piden
 * las que faltan o tienen más de 30 min a una cola de fondo (2 a la vez). Recién desplegado, el
 * almacén puede estar vacío y las tarjetas salen sin cifra hasta que la cola termina. Esto pide el
 * listado de cada país (con un parámetro nuevo, sin caché) cada 20 s, lo que mete en la cola los
 * cursos sin cotización, hasta que todas las tarjetas tienen precio, deja de avanzar tres vueltas
 * seguidas o se acaba el tiempo. Lo que no avanza son cursos sin producto, sin fuente de cotización o
 * con la fuente desfasada (el registro dice «[cotizacion] … respuesta ilegible»). Solo lee: no toca la
 * base ni el panel. Sale con 1 si se acaba el tiempo y aún avanzaba.
 */
import { leerTarjetas } from './verificar-precio-hotmart.mjs';

const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BASE = opcion('base', 'https://sably.co').replace(/\/$/, '');
const PAISES = opcion('paises', 'co,mx,pe,ec,cl,ar,es,us').split(',');
const LIMITE = Date.now() + Number(opcion('minutos', '10')) * 60_000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

let pendientes = new Set(PAISES);
let anterior = '', quietas = 0;
for (let vuelta = 1; pendientes.size && Date.now() < LIMITE && quietas < 3; vuelta++) {
  const linea = [];
  for (const pais of [...pendientes]) {
    const r = await fetch(`${BASE}/${pais}/cursos/?calentar=${Date.now()}`, { headers: { 'user-agent': UA } }).catch(() => null);
    const tarjetas = r?.ok ? leerTarjetas(await r.text(), pais) : [];
    const sin = tarjetas.filter((t) => !t.precio).length;
    linea.push(`${pais} ${tarjetas.length - sin}/${tarjetas.length}`);
    if (tarjetas.length && !sin) pendientes.delete(pais);
  }
  console.log(`vuelta ${vuelta}: ${linea.join(' · ')}`);
  const estado = linea.join('|');
  quietas = estado === anterior ? quietas + 1 : 0;
  anterior = estado;
  if (pendientes.size && quietas < 3) await espera(20_000);
}
if (!pendientes.size) console.log('\nAlmacén lleno: todas las tarjetas tienen precio.');
else if (quietas >= 3) console.log(`\nAlmacén listo. Sin precio y sin avance en ${[...pendientes].join(', ')}: cursos sin producto, sin fuente o con la fuente desfasada.`);
else console.log(`\nSe acabó el tiempo y aún avanzaba en: ${[...pendientes].join(', ')}.`);
process.exit(pendientes.size && quietas < 3 ? 1 : 0);
