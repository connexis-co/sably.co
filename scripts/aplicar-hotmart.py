"""Asigna a cada curso su URL real de checkout Hotmart.

Los enlaces salen de los dos WordPress de Connexis que ya venden estos cursos
(academiadebelleza.edu.co y cursodeglobosonline.com); el mapeo vive en
docs/data/hotmart-map.json. Sustituye el placeholder pay.hotmart.com/PENDIENTE.

Se guarda la URL directa a pay.hotmart.com y no el acortador hotm.art: quita un
salto de redirección del checkout y buildHotmartUrl() ya añade cupón y utm.

Uso:  python3 scripts/aplicar-hotmart.py [--dry-run]
"""

import argparse
import json
import re
import sys
from pathlib import Path

MAPA = Path('docs/data/hotmart-map.json')
CURSOS = Path('src/content/courses')
PLACEHOLDER = 'https://pay.hotmart.com/PENDIENTE'


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    mapa = json.loads(MAPA.read_text())['existentes']
    cambiados, faltantes, ya = [], [], []

    for slug, info in mapa.items():
        f = CURSOS / f'{slug}.mdx'
        if not f.exists():
            faltantes.append(slug)
            continue
        texto = f.read_text()
        url = f"https://pay.hotmart.com/{info['id']}"
        if url in texto:
            ya.append(slug)
            continue
        nuevo, n = re.subn(
            r'^hotmartUrl: .*$', f'hotmartUrl: {url}', texto, count=1, flags=re.M
        )
        if n == 0:
            # El frontmatter no traía la clave: se apoya en el default del schema.
            nuevo = re.sub(r'^(title: .*)$', rf'\1\nhotmartUrl: {url}', texto, count=1, flags=re.M)
        if not args.dry_run:
            f.write_text(nuevo)
        cambiados.append((slug, info['id'], info['producto']))

    for slug, hid, prod in cambiados:
        print(f'  ✓ {slug:<44} {hid}  ({prod})')
    if ya:
        print(f'\n  = {len(ya)} ya tenían la URL correcta')
    if faltantes:
        print(f'\n  ! No existen todavía: {", ".join(faltantes)}')

    restantes = sum(1 for f in CURSOS.glob('*.mdx') if PLACEHOLDER in f.read_text())
    print(f'\n{len(cambiados)} asignados · {restantes} cursos siguen con PENDIENTE')
    if args.dry_run:
        print('(dry-run: no se escribió nada)')
        sys.exit(0)


if __name__ == '__main__':
    main()
