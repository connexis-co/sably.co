"""Publica los heroes en R2 con el hash del contenido en el nombre.

Los assets se sirven con `Cache-Control: immutable, max-age=1 año`. Eso solo es
correcto si el nombre cambia cuando cambia el contenido. Sobrescribir
`heroes/co.webp` en sitio dejó la versión vieja cacheada un año en el edge: la
subida a R2 iba bien y aun así el usuario seguía viendo la imagen anterior, y
el token de Connexis no tiene permiso de purga para arreglarlo a mano.

Así que el nombre lleva el hash: `heroes/co-a1b2c3d4.webp`. Cambia el contenido
→ cambia la URL → el edge no puede servir nada viejo. El mapa se escribe en
src/lib/hero-assets.ts para que el build use siempre la URL vigente.

Uso:  python3 scripts/publicar-heroes.py
"""

import hashlib
import json
import os
import urllib.request
from pathlib import Path

HEROES = Path('public/heroes')
MANIFIESTO = Path('src/lib/hero-assets.ts')
BUCKET = 'sably-assets'

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

TOKEN = os.environ['CLOUDFLARE_API_TOKEN']
ACCOUNT = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '6e36c2fb07c21f30ed3c0d6e824884bc')
API = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/r2/buckets/{BUCKET}/objects'


def existe(key: str) -> bool:
    req = urllib.request.Request(f'{API}/{key}', method='HEAD',
                                 headers={'Authorization': f'Bearer {TOKEN}'})
    try:
        return urllib.request.urlopen(req, timeout=30).status == 200
    except Exception:  # noqa: BLE001
        return False


def subir(key: str, datos: bytes) -> None:
    req = urllib.request.Request(
        f'{API}/{key}', data=datos, method='PUT',
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    )
    r = json.load(urllib.request.urlopen(req, timeout=120))
    if not r.get('success'):
        raise RuntimeError(f'{key}: {r.get("errors")}')


def main() -> None:
    mapa: dict[str, str] = {}
    for f in sorted(HEROES.glob('*.webp')):
        datos = f.read_bytes()
        h = hashlib.md5(datos).hexdigest()[:8]
        nombre = f'{f.stem}-{h}.webp'
        key = f'heroes/{nombre}'
        if existe(key):
            print(f'  = {nombre} (ya publicado)')
        else:
            subir(key, datos)
            print(f'  ↑ {nombre} ({len(datos) // 1024}KB)')
        mapa[f.stem] = nombre

    entradas = '\n'.join(f"  {cc}: '{n}'," for cc, n in sorted(mapa.items()))
    MANIFIESTO.write_text(
        '/* Generado por scripts/publicar-heroes.py — no editar a mano.\n'
        ' *\n'
        ' * El nombre lleva el hash del contenido porque el CDN sirve estos archivos\n'
        ' * como inmutables durante un año: sin hash, cambiar un hero dejaría la\n'
        ' * versión vieja servida desde el edge sin forma de purgarla.\n'
        ' */\n'
        f'export const HERO_ASSETS: Record<string, string> = {{\n{entradas}\n}};\n'
    )
    print(f'\n→ {MANIFIESTO} ({len(mapa)} heroes)')


if __name__ == '__main__':
    main()
