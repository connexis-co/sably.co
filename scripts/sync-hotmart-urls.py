"""Sincroniza las URLs reales de checkout Hotmart en el frontmatter de los cursos.

Consulta la Hotmart Products API, empareja cada producto con su curso por
similitud de título y escribe el `hotmartUrl` real (checkout limpio). El código
de afiliado se agrega en runtime vía src/lib/hotmart.ts (parámetro `src`).

Requiere en .env (Hotmart → Herramientas → Credenciales de API):
  HOTMART_CLIENT_ID
  HOTMART_CLIENT_SECRET
  HOTMART_BASIC            # el token Basic que muestra el panel
  HOTMART_AFFILIATE_CODE   # tu código de afiliado (opcional pero recomendado)

Uso:
  python3 scripts/sync-hotmart-urls.py --dry-run   # muestra el emparejamiento
  python3 scripts/sync-hotmart-urls.py             # escribe los MDX
"""

import argparse
import json
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token'
PRODUCTS_URL = 'https://developers.hotmart.com/products/api/v1/products'


def norm(s: str) -> str:
    s = unicodedata.normalize('NFD', s.lower())
    s = re.sub(r'[̀-ͯ]', '', s)
    s = re.sub(r'^(curso|diplomado|master|taller)\s+(de|en)?\s*', '', s)
    return re.sub(r'[^a-z0-9 ]', ' ', s).strip()


def token() -> str:
    missing = [k for k in ('HOTMART_CLIENT_ID', 'HOTMART_CLIENT_SECRET', 'HOTMART_BASIC')
               if not os.environ.get(k)]
    if missing:
        raise SystemExit(
            'Faltan credenciales en .env: ' + ', '.join(missing) + '\n'
            'Se obtienen en Hotmart → Herramientas → Credenciales de API (OAuth2).'
        )
    params = urllib.parse.urlencode({
        'grant_type': 'client_credentials',
        'client_id': os.environ['HOTMART_CLIENT_ID'],
        'client_secret': os.environ['HOTMART_CLIENT_SECRET'],
    })
    req = urllib.request.Request(
        f'{AUTH_URL}?{params}', method='POST',
        headers={'Authorization': f"Basic {os.environ['HOTMART_BASIC']}"},
    )
    return json.load(urllib.request.urlopen(req, timeout=30))['access_token']


def products(tok: str) -> list[dict]:
    out, page_token = [], None
    while True:
        url = PRODUCTS_URL + (f'?page_token={page_token}' if page_token else '')
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {tok}'})
        data = json.load(urllib.request.urlopen(req, timeout=45))
        out.extend(data.get('items', []))
        page_token = data.get('page_info', {}).get('next_page_token')
        if not page_token:
            return out


def checkout_url(product: dict) -> str | None:
    """URL de checkout limpia. Prioriza la oferta por defecto del producto."""
    for offer in product.get('offers', []) or []:
        if code := offer.get('code'):
            return f"https://pay.hotmart.com/{product['ucode']}?off={code}"
    return f"https://pay.hotmart.com/{product['ucode']}" if product.get('ucode') else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--threshold', type=float, default=0.62)
    args = parser.parse_args()

    prods = products(token())
    print(f'{len(prods)} productos en Hotmart')

    matched = unmatched = 0
    for f in sorted(Path('src/content/courses').glob('*.mdx')):
        text = f.read_text()
        title = re.search(r'^title: (.+)$', text, re.M).group(1).strip()
        nt = norm(title)
        best, score = None, 0.0
        for p in prods:
            s = SequenceMatcher(None, nt, norm(p.get('name', ''))).ratio()
            if s > score:
                best, score = p, s
        url = checkout_url(best) if best and score >= args.threshold else None
        if not url:
            unmatched += 1
            print(f'  ✗ {f.stem}  (mejor: {best.get("name","-") if best else "-"} · {score:.2f})')
            continue
        matched += 1
        print(f'  ✓ {f.stem} → {best["name"]} ({score:.2f})')
        if not args.dry_run:
            f.write_text(re.sub(r'^hotmartUrl: .+$', f'hotmartUrl: {url}', text, flags=re.M))

    print(f'\nEmparejados {matched} · sin match {unmatched}')
    if args.dry_run:
        print('(dry-run: no se escribió nada)')


if __name__ == '__main__':
    main()
