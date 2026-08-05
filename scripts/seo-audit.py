"""Auditoría SEO del catálogo: volumen/competencia/CPC reales por país (Google Ads API).

Uso:
  python3 scripts/seo-audit.py --country CO            # audita las keywords de los 87 cursos
  python3 scripts/seo-audit.py --country ES --seeds "curso de uñas" "curso de barberia"

Salida: docs/data/auditoria-cursos-{cc}.json + tabla en consola.
"""

import argparse
import base64
import json
import os
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

API_VERSION = 'v21'
GEO_TARGETS = {
    'CO': '2170', 'MX': '2484', 'PE': '2604', 'EC': '2218',
    'CL': '2152', 'AR': '2032', 'US': '2840', 'ES': '2724',
}
LANG_ES = '1003'
BATCH = 10  # seeds por request (límite API: 20)

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())


def access_token() -> str:
    sa = json.loads(Path(os.environ['GOOGLE_APPLICATION_CREDENTIALS']).read_text())
    b64 = lambda d: base64.urlsafe_b64encode(d).decode().rstrip('=')  # noqa: E731
    now = int(time.time())
    header = b64(json.dumps({'alg': 'RS256', 'typ': 'JWT'}).encode())
    claims = b64(json.dumps({
        'iss': sa['client_email'],
        'scope': 'https://www.googleapis.com/auth/adwords',
        'aud': 'https://oauth2.googleapis.com/token',
        'exp': now + 3600, 'iat': now,
    }).encode())
    key = serialization.load_pem_private_key(sa['private_key'].encode(), password=None)
    sig = b64(key.sign(f'{header}.{claims}'.encode(), padding.PKCS1v15(), hashes.SHA256()))
    data = urllib.parse.urlencode({
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': f'{header}.{claims}.{sig}',
    }).encode()
    resp = urllib.request.urlopen(
        urllib.request.Request('https://oauth2.googleapis.com/token', data=data), timeout=30
    )
    return json.load(resp)['access_token']


def norm(s: str) -> str:
    s = unicodedata.normalize('NFD', s.lower())
    return re.sub(r'[^a-z0-9 ]', '', s).strip()


def keyword_ideas(token: str, seeds: list[str], country: str) -> list[dict]:
    headers = {
        'Authorization': f'Bearer {token}',
        'developer-token': os.environ['GOOGLE_ADS_DEVELOPER_TOKEN'],
        'Content-Type': 'application/json',
    }
    body = json.dumps({
        'language': f'languageConstants/{LANG_ES}',
        'geoTargetConstants': [f'geoTargetConstants/{GEO_TARGETS[country]}'],
        'keywordSeed': {'keywords': seeds},
        'keywordPlanNetwork': 'GOOGLE_SEARCH',
    }).encode()
    url = (f'https://googleads.googleapis.com/{API_VERSION}/customers/'
           f"{os.environ['GOOGLE_ADS_CUSTOMER_ID']}:generateKeywordIdeas")
    for attempt in range(4):
        try:
            resp = urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=90)
            return json.load(resp).get('results', [])
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 3:
                time.sleep(20 * (attempt + 1))
                continue
            raise
    return []


def course_keywords() -> list[dict]:
    """Keyword principal de cada curso publicado (frontmatter `keywords[0]` o selección)."""
    sel = {}
    sel_path = Path('docs/data/seleccion-cursos.json')
    if sel_path.exists():
        for c in json.loads(sel_path.read_text()):
            sel[c['sablySlug']] = c['keyword']
    out = []
    for f in sorted(Path('src/content/courses').glob('*.mdx')):
        slug = f.stem
        kw = sel.get(slug)
        if not kw:
            m = re.search(r'^keywords:\n  - (.+)$', f.read_text(), re.M)
            kw = m.group(1).strip().strip('"\'') if m else None
        if kw:
            out.append({'slug': slug, 'keyword': kw})
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--country', default='CO', choices=list(GEO_TARGETS))
    parser.add_argument('--seeds', nargs='*', help='Seeds manuales (si no, keywords del catálogo)')
    parser.add_argument('--out', default=None)
    args = parser.parse_args()

    if args.seeds:
        items = [{'slug': '-', 'keyword': s} for s in args.seeds]
    else:
        items = course_keywords()
    print(f'{len(items)} keywords a auditar en {args.country}')

    token = access_token()
    metrics: dict[str, dict] = {}
    seeds = [i['keyword'] for i in items]
    for i in range(0, len(seeds), BATCH):
        batch = seeds[i:i + BATCH]
        try:
            for r in keyword_ideas(token, batch, args.country):
                m = r.get('keywordIdeaMetrics', {})
                metrics.setdefault(norm(r.get('text', '')), {
                    'volume': int(m.get('avgMonthlySearches', 0) or 0),
                    'competition': m.get('competition', 'UNKNOWN'),
                    'cpc_low': round(int(m.get('lowTopOfPageBidMicros') or 0) / 1e6, 2),
                    'cpc_high': round(int(m.get('highTopOfPageBidMicros') or 0) / 1e6, 2),
                })
        except urllib.error.HTTPError as e:
            print(f'  batch {i // BATCH + 1}: HTTP {e.code} {e.read().decode()[:150]}')
        time.sleep(1)

    rows = []
    for item in items:
        m = metrics.get(norm(item['keyword']), {})
        vol = m.get('volume', 0)
        comp = m.get('competition', 'SIN DATOS')
        verdict = ('MANTENER' if vol >= 500 else 'OPTIMIZAR' if vol >= 100 else 'LONG-TAIL')
        rows.append({**item, **m, 'verdict': verdict} if m else
                    {**item, 'volume': 0, 'competition': 'SIN DATOS', 'verdict': 'SIN DATOS'})
    rows.sort(key=lambda r: r.get('volume', 0), reverse=True)

    out = Path(args.out or f'docs/data/auditoria-cursos-{args.country.lower()}.json')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=2))

    print(f"\n{'keyword':<46} {'vol/mes':>8} {'comp':<10} {'veredicto'}")
    print('-' * 80)
    for r in rows:
        print(f"{r['keyword'][:46]:<46} {r.get('volume', 0):>8,} {r.get('competition', '-'):<10} {r['verdict']}")
    print(f'\n→ {out}')


if __name__ == '__main__':
    main()
