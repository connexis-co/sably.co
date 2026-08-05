#!/usr/bin/env bash
# Conecta sably.co y www.sably.co al proyecto de Cloudflare Pages "sably".
# 1) Agrega ambos custom domains al proyecto Pages.
# 2) Reemplaza los AAAA 100:: (placeholder) del apex y www por CNAME → sably.pages.dev.
# NO toca MX, TXT (correo/verificaciones) ni chat.sably.co.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

ACCOUNT="6e36c2fb07c21f30ed3c0d6e824884bc"
ZONE="85bd9d8511517bb5a741e99df5dc78b0"
API="https://api.cloudflare.com/client/v4"
AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json")

for D in sably.co www.sably.co; do
  echo "→ Agregando custom domain $D al proyecto Pages..."
  curl -s -X POST "$API/accounts/$ACCOUNT/pages/projects/sably/domains" "${AUTH[@]}" \
    --data "{\"name\":\"$D\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  ', 'OK' if d['success'] else d['errors'])"
done

echo "→ Reemplazando AAAA 100:: por CNAME → sably.pages.dev..."
python3 - "$CLOUDFLARE_API_TOKEN" << 'PYEOF'
import json, sys, urllib.request

token = sys.argv[1]
zone = "85bd9d8511517bb5a741e99df5dc78b0"
api = f"https://api.cloudflare.com/client/v4/zones/{zone}/dns_records"

def req(url, method="GET", data=None):
    r = urllib.request.Request(url, method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(data).encode() if data else None)
    return json.load(urllib.request.urlopen(r))

records = req(f"{api}?per_page=100")["result"]
for name in ("sably.co", "www.sably.co"):
    for rec in records:
        if rec["name"] == name and rec["type"] == "AAAA" and rec["content"] == "100::":
            req(f"{api}/{rec['id']}", "DELETE")
            print(f"   AAAA 100:: de {name} eliminado")
    req(api, "POST", {"type": "CNAME", "name": name, "content": "sably.pages.dev", "proxied": True})
    print(f"   CNAME {name} → sably.pages.dev creado (proxied)")
PYEOF

echo "✅ Listo. Verifica en unos minutos: https://sably.co/co/"
