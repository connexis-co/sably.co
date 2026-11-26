#!/usr/bin/env node
/**
 * Campos de presentación por artículo en la colección `blog` del CMS (DISENO.md §5.2 y §12.9). Aditivo e idempotente:
 * solo crea los campos que faltan; nunca cambia ni borra uno existente ni toca contenido. Vacíos = «heredar del panel».
 *
 *   node scripts/blog-campos-articulo.mjs <emdash.db>             # dice qué falta (no escribe)
 *   node scripts/blog-campos-articulo.mjs <emdash.db> --aplicar   # los crea
 *
 * Sin los campos el sitio funciona igual (src/lib/blog-presentacion.ts los trata como «heredar»). Hacer copia antes.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Las opciones de select en EmDash son texto: la primera es «heredar». Mismo orden que src/lib/blog-presentacion.ts. */
export const CAMPOS_BLOG = [
  { slug: 'cabecera', label: 'Presentación · Cabecera', type: 'select', defaultValue: 'Heredar del panel',
    validation: { options: ['Heredar del panel', 'A · Foto a sangre', 'B · Título primero', 'C · Dos columnas', 'D · Mínima, sin foto',
      'E · Editorial, titular grande', 'F · Vídeo protagonista', 'G · Narración protagonista', 'H · Color de la categoría', 'J · Título con el índice al lado'] } },
  { slug: 'indice', label: 'Presentación · Índice', type: 'select', defaultValue: 'Heredar del panel',
    validation: { options: ['Heredar del panel', 'Lateral', 'Al inicio', 'Ninguno'] } },
  { slug: 'publicidad', label: 'Presentación · Publicidad', type: 'select', defaultValue: 'Heredar del panel',
    validation: { options: ['Heredar del panel', 'Ninguna en este artículo'] } },
  { slug: 'curso_relacionado', label: 'Presentación · Curso relacionado (dirección o slug; vacío = el primero que enlaza el texto)', type: 'string' },
  { slug: 'actualizado_el', label: 'Presentación · Actualizado el (solo si se revisó el contenido)', type: 'datetime' },
];

export async function camposQueFaltan(registry) {
  const faltan = [];
  for (const campo of CAMPOS_BLOG) if (!await registry.getField('blog', campo.slug)) faltan.push(campo);
  return faltan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [ruta, modo] = process.argv.slice(2);
  if (!ruta || (modo && modo !== '--aplicar')) { console.error('Uso: blog-campos-articulo.mjs <emdash.db> [--aplicar]'); process.exit(2); }
  const { Kysely } = await import('kysely');
  const { createDialect } = await import('emdash/db/sqlite');
  const { SchemaRegistry } = await import('emdash');
  const db = new Kysely({ dialect: createDialect({ url: `file:${resolve(ruta)}` }) });
  const registry = new SchemaRegistry(db);
  const faltan = await camposQueFaltan(registry);
  if (!faltan.length) console.log('La colección blog ya tiene todos los campos de presentación.');
  else if (modo !== '--aplicar') console.log(`Faltan ${faltan.length}: ${faltan.map(c => c.slug).join(', ')}. Repite con --aplicar.`);
  else for (const campo of faltan) { await registry.createField('blog', campo); console.log(`Creado: blog.${campo.slug}`); }
  await db.destroy();
}
