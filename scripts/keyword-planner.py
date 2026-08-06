"""Keyword Planner (Google Ads API) — volúmenes y CPC reales por país.

Uso:  python3 scripts/keyword-planner.py "curso de barberia" "curso de uñas" --country CO

Requiere en .env:
  GOOGLE_APPLICATION_CREDENTIALS  → ruta al service account (ya configurado)
  GOOGLE_ADS_DEVELOPER_TOKEN      → pídelo en una cuenta MCC: Google Ads → Herramientas →
                                    Configuración de API. Nivel "Basic" basta para Keyword Planner.
  GOOGLE_ADS_CUSTOMER_ID          → ID de la cuenta Ads (solo dígitos, sin guiones)
  GOOGLE_ADS_LOGIN_CUSTOMER_ID    → ID del MCC (opcional, si la cuenta cuelga de un manager)

El service account debe estar agregado como usuario en la cuenta de Google Ads.
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

API_VERSION = 'v24'

# Criterios de geo-targeting de Google Ads por país
GEO_TARGETS = {
    'CO': '2170', 'MX': '2484', 'PE': '2604', 'EC': '2218',
    'CL': '2152', 'AR': '2032', 'US': '2840', 'ES': '2724',
}
LANG_ES = '1003'

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


def keyword_ideas(keywords: list[str], country: str) -> list[dict]:
    dev_token = os.environ.get('GOOGLE_ADS_DEVELOPER_TOKEN')
    customer_id = os.environ.get('GOOGLE_ADS_CUSTOMER_ID', '').replace('-', '')
    if not dev_token or not customer_id:
        sys.exit(
            'Faltan GOOGLE_ADS_DEVELOPER_TOKEN y/o GOOGLE_ADS_CUSTOMER_ID en .env.\n'
            'El developer token se solicita en Google Ads (cuenta MCC) → Herramientas → '
            'Configuración de API.'
        )

    headers = {
        'Authorization': f'Bearer {access_token()}',
        'developer-token': dev_token,
        'Content-Type': 'application/json',
    }
    if login_id := os.environ.get('GOOGLE_ADS_LOGIN_CUSTOMER_ID'):
        headers['login-customer-id'] = login_id.replace('-', '')

    body = json.dumps({
        'language': f'languageConstants/{LANG_ES}',
        'geoTargetConstants': [f'geoTargetConstants/{GEO_TARGETS[country.upper()]}'],
        'keywordSeed': {'keywords': keywords},
        'keywordPlanNetwork': 'GOOGLE_SEARCH',
    }).encode()

    url = (f'https://googleads.googleapis.com/{API_VERSION}/customers/{customer_id}'
           ':generateKeywordIdeas')
    try:
        resp = urllib.request.urlopen(
            urllib.request.Request(url, data=body, headers=headers), timeout=60
        )
        return json.load(resp).get('results', [])
    except urllib.error.HTTPError as e:
        sys.exit(f'HTTP {e.code}: {e.read().decode()[:600]}')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('keywords', nargs='+')
    parser.add_argument('--country', default='CO', choices=list(GEO_TARGETS))
    parser.add_argument('--limit', type=int, default=40)
    args = parser.parse_args()

    results = keyword_ideas(args.keywords, args.country)
    rows = []
    for r in results:
        m = r.get('keywordIdeaMetrics', {})
        low, high = m.get('lowTopOfPageBidMicros'), m.get('highTopOfPageBidMicros')
        rows.append({
            'keyword': r.get('text', ''),
            'volume': int(m.get('avgMonthlySearches', 0) or 0),
            'competition': m.get('competition', 'UNKNOWN'),
            'cpc_low': round(int(low or 0) / 1_000_000, 2),
            'cpc_high': round(int(high or 0) / 1_000_000, 2),
        })
    rows.sort(key=lambda r: r['volume'], reverse=True)

    print(f"{'keyword':<48} {'vol/mes':>9} {'comp':<12} {'CPC (moneda cuenta)'}")
    print('-' * 88)
    for row in rows[: args.limit]:
        cpc = f"${row['cpc_low']}–{row['cpc_high']}"
        print(f"{row['keyword'][:48]:<48} {row['volume']:>9,} {row['competition']:<12} {cpc}")

    out = Path('docs/data') / f'keywords-{args.country.lower()}.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    print(f'\n{len(rows)} keywords → {out}')


if __name__ == '__main__':
    main()
