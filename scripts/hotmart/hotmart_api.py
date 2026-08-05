#!/usr/bin/env python3
"""Cliente de la API de Hotmart para validar el estado de la afiliación.

Uso:
    cp .env.example .env   # y completar credenciales
    python3 hotmart_api.py token        # probar autenticación
    python3 hotmart_api.py ventas       # historial de ventas/comisiones (¿está llegando la comisión?)
    python3 hotmart_api.py resumen      # resumen de comisiones por producto
    python3 hotmart_api.py shortener    # sondear si existe endpoint de acortadores (no documentado)

Requiere: pip install requests python-dotenv
"""
import json
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

AUTH_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token"
API_BASE = "https://developers.hotmart.com"

CLIENT_ID = os.environ["HOTMART_CLIENT_ID"]
CLIENT_SECRET = os.environ["HOTMART_CLIENT_SECRET"]


def get_token() -> str:
    r = requests.post(
        AUTH_URL,
        params={"grant_type": "client_credentials"},
        auth=(CLIENT_ID, CLIENT_SECRET),
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    return data["access_token"]


def api_get(token: str, path: str, params: dict | None = None) -> requests.Response:
    return requests.get(
        f"{API_BASE}{path}",
        headers={"Authorization": f"Bearer {token}"},
        params=params or {},
        timeout=30,
    )


def cmd_token() -> None:
    token = get_token()
    print("Autenticación OK. Token (primeros 24 chars):", token[:24], "…")


def cmd_ventas() -> None:
    """Historial de ventas: confirma si las comisiones de afiliado están llegando."""
    token = get_token()
    r = api_get(token, "/payments/api/v1/sales/history", {"max_results": 50})
    r.raise_for_status()
    data = r.json()
    items = data.get("items", [])
    print(f"Ventas devueltas: {len(items)}")
    for it in items:
        product = it.get("product", {}).get("name")
        status = it.get("purchase", {}).get("status")
        date = it.get("purchase", {}).get("order_date")
        price = it.get("purchase", {}).get("price", {})
        print(f"- {date} | {product} | {status} | {price.get('value')} {price.get('currency_code')}")
    with open("ventas_hotmart.json", "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Detalle completo en ventas_hotmart.json")


def cmd_resumen() -> None:
    token = get_token()
    r = api_get(token, "/payments/api/v1/sales/summary")
    print(r.status_code, json.dumps(r.json(), indent=2, ensure_ascii=False)[:2000])

    r = api_get(token, "/payments/api/v1/sales/commissions", {"max_results": 50})
    print("commissions:", r.status_code)
    if r.ok:
        with open("comisiones_hotmart.json", "w") as f:
            json.dump(r.json(), f, indent=2, ensure_ascii=False)
        print("Comisiones guardadas en comisiones_hotmart.json")


def cmd_shortener() -> None:
    """La API pública de Hotmart NO documenta creación de acortadores hotm.art.

    Este comando sondea rutas plausibles para confirmarlo empíricamente y deja
    constancia del resultado. Si todas devuelven 404/403, los acortadores deben
    crearse desde la UI de Hotmart (botón "Acortar link") o usar un acortador
    propio (p. ej. redirects 301 en sably.co/go/<slug>).
    """
    token = get_token()
    candidates = [
        "/products/api/v1/products",
        "/affiliates/api/v1/affiliations",
        "/payments/api/v1/offers",
        "/shortener/api/v1/links",
        "/hotlinks/api/v1/hotlinks",
    ]
    for path in candidates:
        r = api_get(token, path)
        body = r.text[:200].replace("\n", " ")
        print(f"{r.status_code}  {path}  {body}")


COMMANDS = {
    "token": cmd_token,
    "ventas": cmd_ventas,
    "resumen": cmd_resumen,
    "shortener": cmd_shortener,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(1)
    COMMANDS[sys.argv[1]]()
