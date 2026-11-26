#!/usr/bin/env python3
"""Carga en el CMS (EmDash) el docente real de cada curso con fuente clara.

Escribe, por curso, el JSON `instructor` (nombre, oficio, trayectoria, `source_url`, `source_quote`, `read_at`) y los
campos del panel `instructor_name`, `instructor_title` e `instructor_bio`, que son los que mandan en la ficha
(src/lib/docente.ts solo pinta un docente con `source_url` y `read_at`). Nada más del curso cambia.

Uso (desde emdash-dev, con la sesión de la CLI de EmDash ya guardada):
  python3 -I scripts/cargar-docentes.py --datos docentes-carga.json [--url https://sably.co]
      → modo de prueba: lee cada curso y dice qué cambiaría; no escribe.
  python3 -I scripts/cargar-docentes.py --datos … --aplicar --respaldo DIR
      → guarda DIR/<curso>.json (el curso entero, antes de tocarlo) y actualiza con su `_rev`.
  python3 -I scripts/cargar-docentes.py --revertir DIR [--url …]
      → devuelve los cuatro campos de cada curso de DIR a su valor del respaldo.

Fotos: un docente con `photo_file` (ruta relativa al JSON de datos) sube esa imagen a la mediateca con `emdash media
upload` al aplicar y guarda el objeto en `photo` con `original` (de dónde salió). La reversión no borra la imagen subida
(queda en la mediateca sin usar; su id va en DIR/_medios.json).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys
import tempfile

CAMPOS = ('instructor', 'instructor_name', 'instructor_title', 'instructor_bio')
CLI = ['npx', '--no-install', 'emdash']


def cli(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(CLI + list(args), capture_output=True, text=True)


def leer(curso: str, url: str) -> dict:
    r = cli('content', 'get', 'courses', curso, '--url', url, '--json', '--raw')
    if r.returncode:
        sys.exit(f'No pude leer {curso}: {r.stderr[-300:]}')
    return json.loads(r.stdout)


def escribir(curso: str, url: str, data: dict, rev: str) -> None:
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(data, f, ensure_ascii=False)
    r = cli('content', 'update', 'courses', curso, '--url', url, '--file', f.name, '--rev', rev)
    pathlib.Path(f.name).unlink(missing_ok=True)
    if r.returncode:
        sys.exit(f'ERROR al escribir {curso}: {r.stderr[-300:]}')


def validar(curso: str, d: dict) -> None:
    faltan = [k for k in ('slug', 'name', 'source_url', 'source_quote', 'read_at') if not d.get(k)]
    if faltan or not d['source_url'].startswith('https://'):
        sys.exit(f'{curso}: docente sin fuente completa ({faltan})')


def subir_foto(d: dict, base: pathlib.Path, url: str) -> dict:
    archivo = (base / d['photo_file']).resolve()
    r = cli('media', 'upload', str(archivo), '--url', url, '--json', '--alt', f"Foto de {d['name']}")
    if r.returncode:
        sys.exit(f"No pude subir la foto de {d['name']}: {r.stderr[-300:]}")
    m = json.loads(r.stdout)
    m = m.get('item', m.get('data', m)) if isinstance(m, dict) else m
    foto = {k: m[k] for k in ('id', 'url', 'src', 'width', 'height', 'filename', 'mimeType', 'meta') if k in m}
    if 'url' in foto and 'src' not in foto:
        foto['src'] = foto.pop('url')
    foto.update(provider='local', alt=f"Foto de {d['name']}", original=d.get('photo_original', ''))
    return foto


def nuevos_campos(d: dict) -> dict:
    d = {k: v for k, v in d.items() if k not in ('photo_file', 'photo_original')}
    return {'instructor': d, 'instructor_name': d['name'], 'instructor_title': d.get('title') or None, 'instructor_bio': d.get('bio') or None}


def main() -> None:
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--datos')
    a.add_argument('--url', default='https://sably.co')
    a.add_argument('--aplicar', action='store_true')
    a.add_argument('--respaldo', default='respaldo-docentes')
    a.add_argument('--revertir')
    o = a.parse_args()

    if o.revertir:
        for f in sorted(p for p in pathlib.Path(o.revertir).glob('*.json') if not p.name.startswith('_')):
            antes = json.loads(f.read_text('utf-8'))['data']
            e = leer(f.stem, o.url)
            data = e['data']
            for k in CAMPOS:
                data[k] = antes.get(k)
            escribir(f.stem, o.url, data, e['_rev'])
            print(f'{f.stem}: revertido')
        return

    if not o.datos:
        a.error('--datos es obligatorio salvo con --revertir')
    base = pathlib.Path(o.datos).resolve().parent
    datos = json.loads(pathlib.Path(o.datos).read_text('utf-8'))['docentes']
    carpeta = pathlib.Path(o.respaldo)
    medios = []
    for curso, d in datos.items():
        validar(curso, d)
        if d.get('photo_file') and not (base / d['photo_file']).is_file():
            sys.exit(f"{curso}: no existe la foto {d['photo_file']}")
        e = leer(curso, o.url)
        antes = {k: e['data'].get(k) for k in CAMPOS}
        actual = e['data'].get('instructor') or {}
        if d.get('photo_file') and isinstance(actual, dict) and (actual.get('photo') or {}).get('original') == d.get('photo_original'):
            d = {**d, 'photo': actual['photo']}  # la foto ya se subió en una pasada anterior
        despues = nuevos_campos(d)
        if antes == despues:
            print(f'{curso}: ya estaba así')
            continue
        foto = ' · con foto' if d.get('photo_file') or d.get('photo') else ''
        print(f"{curso}: «{antes['instructor_name'] or '—'}» → «{d['name']}»{foto} · fuente {d['source_url']}")
        if not o.aplicar:
            continue
        carpeta.mkdir(parents=True, exist_ok=True)
        (carpeta / f'{curso}.json').write_text(json.dumps(e, ensure_ascii=False, indent=1), 'utf-8')
        if d.get('photo_file') and not d.get('photo'):
            d = {**d, 'photo': subir_foto(d, base, o.url)}
            medios.append({'curso': curso, 'foto': d['photo']})
            (carpeta / '_medios.json').write_text(json.dumps(medios, ensure_ascii=False, indent=1), 'utf-8')
        despues = nuevos_campos(d)
        data = e['data']
        data.update(despues)
        escribir(curso, o.url, data, e['_rev'])
        comprobado = leer(curso, o.url)['data']
        if comprobado.get('instructor_name') != d['name'] or (comprobado.get('instructor') or {}).get('source_url') != d['source_url']:
            sys.exit(f'{curso}: la lectura tras escribir no coincide; revierte con --revertir {carpeta}')
    if not o.aplicar:
        print('Modo de prueba: no se escribió nada. Añade --aplicar --respaldo DIR para cargar.')


if __name__ == '__main__':
    main()
