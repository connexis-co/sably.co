#!/usr/bin/env python3
"""Publica una tanda de contenido y la verifica en producción.

Uso: python3 -I scripts/publicar-tanda.py <n> <slugs separados por coma> [--revertir-si-falla]

Pasos: validar → foto y seo-test de antes → cargar --aplicar (con respaldo) → foto y seo-test de después →
verificar-contenido en los 8 países → apuntar la tanda en tandas.json → regenerar ESTADO.md.
Sale con código 1 si hay un error nuevo (algo que no estaba antes de cargar).
"""
import datetime, json, os, re, shutil, subprocess, sys, time, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.environ.get('SABLY_DOCS', os.path.normpath(os.path.join(RAIZ, '../../../../docs')))
OUT = os.path.join(DOCS, 'equipo/2026-11-26/contenido')
PAISES = ['co', 'mx', 'pe', 'ec', 'cl', 'ar', 'es', 'us']
URL = 'https://sably.co'
n, cursos = int(sys.argv[1]), sys.argv[2]
lista = cursos.split(',')
D = os.path.join(OUT, 'tandas', f't{n}')
os.makedirs(D, exist_ok=True)


def corre(args, salida=None, obligatorio=False):
    r = subprocess.run(args, cwd=RAIZ, capture_output=True, text=True)
    texto = r.stdout + r.stderr
    if salida:
        open(os.path.join(D, salida), 'w').write(texto)
    if obligatorio and r.returncode:
        print(texto[-3000:])
        sys.exit(f'fallo en {" ".join(args[:3])}')
    return r.returncode, texto


def ahora():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def seo(fase):
    urls = [x for s in lista for cc in PAISES for x in ('--url', f'/{cc}/{s}/')]
    corre(['node', 'scripts/seo-test.mjs', *urls, '--concurrencia', '3', '--json', os.path.join(D, f'seo-{fase}.json')], f'seo-{fase}.txt')
    return {(h['url'], h['regla'], h['nivel']) for h in json.load(open(os.path.join(D, f'seo-{fase}.json')))['hallazgos']}


corre(['node', 'scripts/contenido-cursos.mjs', 'validar', '--cursos', cursos], obligatorio=True)
SOLO = '--solo-verificar' in sys.argv  # no carga ni toma la foto de antes: repite la verificación de una tanda ya cargada
if SOLO:
    antes = {(h['url'], h['regla'], h['nivel']) for h in json.load(open(os.path.join(D, 'seo-antes.json')))['hallazgos']}
    previo = next(t for t in json.load(open(os.path.join(OUT, 'tandas.json'))) if t['n'] == n)
else:
    corre(['node', 'scripts/foto-fichas.mjs', 'tomar', '--cursos', cursos, '--salida', os.path.join(D, 'foto-antes.json')], obligatorio=True)
    antes = seo('antes')

inicio = ahora()
codigo, log = (0, '') if SOLO else corre(['node', 'scripts/contenido-cursos.mjs', 'cargar', '--url', URL, '--cursos', cursos, '--aplicar'], 'carga.txt')
fin = ahora()
t_fin = time.time()
m = re.search(r'Respaldo y registro: (\S+)', log)
if SOLO:
    inicio, fin, t_fin = previo['inicio'], previo['fin'], 0
elif codigo or not m:
    # La carga es idempotente: se puede repetir. Los respaldos de lo ya escrito están en contenido/respaldos/.
    print(log[-3000:])
    sys.exit('la carga no terminó: repetir o revertir con la carpeta más reciente de contenido/respaldos/sably.co/')
if not SOLO:
    shutil.copytree(os.path.join(RAIZ, m.group(1)), os.path.join(D, 'respaldo'), dirs_exist_ok=True)

corre(['node', 'scripts/foto-fichas.mjs', 'tomar', '--cursos', cursos, '--salida', os.path.join(D, 'foto-despues.json'), '--fresco'], obligatorio=True)
a, b = (json.load(open(os.path.join(D, f'foto-{f}.json'))) for f in ('antes', 'despues'))
graves, avisos = [], []
for url, d in b.items():
    x = a[url]
    corta = url.replace(URL, '')
    if d['status'] != 200:
        graves.append(f'{corta}: HTTP {d["status"]}')
    for k in ('title', 'h1', 'canonica', 'ciudades', 'enlaces'):
        if x[k] != d[k]:
            graves.append(f'{corta}: cambió {k}: {str(x[k])[:120]} → {str(d[k])[:120]}')
    if x['importes'] and not d['importes']:
        graves.append(f'{corta}: sin precio visible')
    elif x['importes'] != d['importes']:
        avisos.append(f'{corta}: importes -{[v for v in x["importes"] if v not in d["importes"]]} +{[v for v in d["importes"] if v not in x["importes"]]}')
    for k in ('pregunta_precio', 'pregunta_pago'):
        if x[k] and not d[k]:
            graves.append(f'{corta}: desapareció {k}')

despues = seo('despues')
nuevos = sorted(h for h in despues - antes if h[2] == 'error')
graves += [f'seo-test nuevo: {u} {r}' for u, r, _ in nuevos]


def calentar():
    # Cloudflare puede guardar una copia tomada a mitad de la carga (max-age 120 y una copia vieja más).
    for s in lista:
        for cc in PAISES:
            try:
                urllib.request.urlopen(urllib.request.Request(f'{URL}/{cc}/{s}/', headers={'user-agent': 'sably-verificar-contenido/1.0'}), timeout=60).read()
            except Exception:
                pass


for intento in (1, 2, 3):
    time.sleep(max(0, 150 - (time.time() - t_fin)) if intento == 1 else 130)
    calentar()
    time.sleep(8)
    corre(['node', 'scripts/verificar-contenido.mjs', '--base', URL, '--cursos', cursos, '--paises', ','.join(PAISES)], 'verificar.txt')
    if not re.search(r'^    falta ', open(os.path.join(D, 'verificar.txt')).read(), re.M):
        break
ya = {(u, r) for u, r, niv in antes if niv == 'error'}
actual, bien, mal = None, 0, 0
for linea in open(os.path.join(D, 'verificar.txt')):
    if linea.startswith(('✓', '✗')):
        actual = linea.split()[1].replace(URL, '')
        bien += linea.startswith('✓')
        mal += linea.startswith('✗')
    elif linea.startswith('    ') and actual:
        regla = re.match(r'\s+seo-onpage ([\w-]+):', linea)
        if not (regla and (actual, regla.group(1)) in ya):
            graves.append(f'verificar: {actual} {linea.strip()[:200]}')
if not bien + mal:
    graves.append('verificar-contenido no dio resultados')

v = list(b.values())
errores_previos = sum(1 for h in antes if h[2] == 'error')
resumen = (f'{sum(x["status"] == 200 for x in v)}/{len(v)} páginas 200; preguntas de precio {sum(x["pregunta_precio"] for x in a.values())}→{sum(x["pregunta_precio"] for x in v)} y de pago '
           f'{sum(x["pregunta_pago"] for x in a.values())}→{sum(x["pregunta_pago"] for x in v)}; verificar-contenido {bien}/{bien + mal}; errores seo previos {errores_previos}; '
           f'{"0 errores nuevos; título, H1, canónica, enlaces y ciudades idénticos" if not graves else f"{len(graves)} PROBLEMAS"}')
json.dump({'graves': graves, 'avisos': avisos, 'resumen': resumen}, open(os.path.join(D, 'resultado.json'), 'w'), ensure_ascii=False, indent=1)
tandas = [t for t in json.load(open(os.path.join(OUT, 'tandas.json'))) if t['n'] != n]
tandas.append({'n': n, 'inicio': inicio, 'fin': fin, 'cursos': lista, 'respaldo': f'tandas/t{n}/respaldo', 'verificacion': resumen})
json.dump(sorted(tandas, key=lambda t: t['n']), open(os.path.join(OUT, 'tandas.json'), 'w'), ensure_ascii=False, indent=1)
print(f'Tanda {n}: {inicio} → {fin}\n{resumen}')
for g in graves[:40]:
    print('  GRAVE', g)
for g in avisos[:15]:
    print('  aviso', g)
if graves and '--revertir-si-falla' in sys.argv:
    _, r = corre(['node', 'scripts/contenido-cursos.mjs', 'revertir', '--url', URL, '--respaldo', os.path.join(D, 'respaldo'), '--aplicar'], 'revertir.txt')
    print('REVERTIDA:\n' + r[-1500:])
    t = json.load(open(os.path.join(OUT, 'tandas.json')))
    json.dump([x for x in t if x['n'] != n], open(os.path.join(OUT, 'tandas.json'), 'w'), ensure_ascii=False, indent=1)
subprocess.run(['python3', '-I', os.path.join(OUT, 'estado.py'), os.path.join(RAIZ, 'contenido', 'cursos')])
sys.exit(1 if graves else 0)
