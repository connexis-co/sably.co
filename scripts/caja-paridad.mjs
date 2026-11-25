#!/usr/bin/env node
/**
 * Regenera `tests/fixtures/caja-paridad.json` ejecutando el núcleo de caja DE LA ACADEMIA.
 *
 *   node --import tsx scripts/caja-paridad.mjs --academia "/ruta/a/academiadebelleza.edu.co" [--ref origin/main]
 *
 * Extrae con `git archive` (sin tocar ese repositorio ni su rama) el núcleo y los cuatro
 * módulos de los que depende su `validar.ts`, ejecuta los casos de `tests/caja-paridad-casos.ts`
 * y guarda las salidas y la revisión de la que salieron. La prueba de Sably compara su copia
 * con este archivo: si la academia cambia el núcleo, se porta el cambio y se regenera.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { ejecutar } from '../tests/caja-paridad-casos.ts';

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const academia = opcion('academia');
const ref = opcion('ref') ?? 'origin/main';
if (!academia) { console.error('Falta --academia <ruta del repositorio de la academia>'); process.exit(1); }
const revision = execFileSync('git', ['-C', academia, 'rev-parse', ref], { encoding: 'utf8' }).trim();
const rutas = ['web/src/lib/academia/caja', 'web/plugins/adb-design/textos.ts', 'web/plugins/adb-design/errors.ts', 'web/plugins/_shared/vocabulario.ts',
  'web/plugins/_shared/paises.ts', 'web/plugins/_shared/routes.ts', 'web/plugins/adb-promos/model.ts', 'web/plugins/adb-landings/model.ts'];
const dir = mkdtempSync(join(tmpdir(), 'caja-paridad-'));
try {
  const tar = execFileSync('git', ['-C', academia, 'archive', revision, ...rutas]);
  mkdirSync(dir, { recursive: true });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  // `import.meta.glob` es de Vite: en textos.ts solo carga los grupos de textos de las
  // plantillas (TEXT_GROUPS), que el núcleo no usa. Fuera de Vite se sustituye por {}.
  const textos = join(dir, 'web/plugins/adb-design/textos.ts');
  writeFileSync(textos, readFileSync(textos, 'utf8').replace(/import\.meta\.glob\([^)]*\)/g, '({})'));
  const base = join(dir, 'web/src/lib/academia/caja');
  const cargar = (m) => import(pathToFileURL(join(base, `${m}.ts`)).href);
  const nucleo = Object.fromEntries(await Promise.all(['model', 'fabrica', 'parche', 'resolver', 'validar', 'migrar'].map(async (m) => [m, await cargar(m)])));
  // Huellas de los seis archivos. En validar.ts las tres importaciones de plugins de la
  // academia se sustituyen por la única de Sably (./sitio): es la sola diferencia permitida.
  const IMPORTS_ACADEMIA = /import \{ textProblems \} from "[^"]+";\nimport \{ PERCENT_RE, URGENCY_RE \} from "[^"]+";\nimport \{ PRICE_RE \} from "[^"]+";\n/;
  const huellas = Object.fromEntries(['model', 'fabrica', 'parche', 'resolver', 'validar', 'migrar'].map((m) => {
    let texto = readFileSync(join(base, `${m}.ts`), 'utf8');
    if (m === 'validar') texto = texto.replace(IMPORTS_ACADEMIA, 'import { PERCENT_RE, PRICE_RE, URGENCY_RE, textProblems } from "./sitio";\n');
    return [m, createHash('sha256').update(texto).digest('hex')];
  }));
  const salida = { academia: revision, huellas, generado: new Date().toISOString().slice(0, 10), salidas: ejecutar(nucleo) };
  writeFileSync(new URL('../tests/fixtures/caja-paridad.json', import.meta.url), JSON.stringify(salida, null, 1) + '\n');
  console.log(`caja-paridad.json regenerado desde la academia ${revision.slice(0, 7)}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
