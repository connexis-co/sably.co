#!/usr/bin/env node
/**
 * Comprueba que reordenar el panel no cambia ningún ajuste guardado (docs/equipo/2026-11-25/panel/ORDEN.md).
 *
 *   node scripts/verificar-ajustes-panel.mjs <emdash.db> --guardar antes.json   # foto de los ajustes de plugins
 *   node scripts/verificar-ajustes-panel.mjs <emdash.db> --comparar antes.json  # sale con 1 si algo cambió
 *
 * Solo lee la tabla `options` (filas `plugin:%:settings:%`). Úsalo sobre una COPIA de los datos.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';

const [db, modo, archivo] = process.argv.slice(2);
if (!db || !['--guardar', '--comparar'].includes(modo) || !archivo) {
  console.error('Uso: verificar-ajustes-panel.mjs <emdash.db> --guardar|--comparar <archivo.json>');
  process.exit(2);
}
const sql = new DatabaseSync(db, { readOnly: true });
const filas = Object.fromEntries(sql.prepare("SELECT name, value FROM options WHERE name LIKE 'plugin:%:settings:%' ORDER BY name").all().map(r => [r.name, r.value]));
sql.close();

if (modo === '--guardar') {
  writeFileSync(archivo, JSON.stringify(filas, null, 1));
  console.log(`${Object.keys(filas).length} ajustes guardados en ${archivo}`);
} else {
  const antes = JSON.parse(readFileSync(archivo, 'utf8'));
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(filas)])].sort();
  const cambios = claves.filter(k => antes[k] !== filas[k]).map(k => `${k}: ${antes[k] ?? '(sin guardar)'} → ${filas[k] ?? '(sin guardar)'}`);
  if (cambios.length) { console.error(`Cambiaron ${cambios.length} ajustes:\n${cambios.join('\n')}`); process.exit(1); }
  console.log(`Sin cambios: ${claves.length} ajustes iguales.`);
}
