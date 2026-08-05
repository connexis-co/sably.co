#!/usr/bin/env python3
"""Valida que los enlaces de venta lleven al checkout real de Hotmart con la comisión.

Recorre el mapa de enlaces (mapa_enlaces.json), sigue las redirecciones de cada
URL (hotm.art / go.hotmart.com) y verifica:
  1. Que el enlace resuelve (no 404/410).
  2. Que aterriza en un dominio de Hotmart (go.hotmart.com / pay.hotmart.com /
     hotmart.com) y no en una página muerta.
  3. Que el parámetro de afiliado sobrevive la cadena de redirecciones:
     - hotlinks con ?ap=XXXX (checkout directo con atribución)
     - o que la URL final/cookies contengan referencia de afiliado (sck/aff).

Uso:
    python3 validar_enlaces.py            # valida mapa_enlaces.json
    python3 validar_enlaces.py URL [...]  # valida URLs sueltas

Requiere: pip install requests
"""
import json
import os
import sys
from urllib.parse import parse_qs, urlparse

import requests

HOTMART_HOSTS = {"go.hotmart.com", "pay.hotmart.com", "hotmart.com", "www.hotmart.com", "hotm.art"}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"


def validar(url: str) -> dict:
    resultado = {"url": url, "ok": False, "cadena": [], "afiliado": None, "error": None}
    try:
        s = requests.Session()
        s.headers["User-Agent"] = UA
        r = s.get(url, allow_redirects=True, timeout=30)
        cadena = [h.url for h in r.history] + [r.url]
        resultado["cadena"] = cadena
        resultado["status_final"] = r.status_code

        final = urlparse(r.url)
        resultado["host_final"] = final.netloc

        # ¿el parámetro de afiliado sobrevive en alguna URL de la cadena?
        for u in cadena:
            q = parse_qs(urlparse(u).query)
            for key in ("ap", "aff", "a", "sck", "src"):
                if key in q:
                    resultado["afiliado"] = {key: q[key][0], "en": u}
                    break
            if resultado["afiliado"]:
                break

        en_hotmart = final.netloc in HOTMART_HOSTS or final.netloc.endswith(".hotmart.com")
        resultado["ok"] = r.status_code == 200 and en_hotmart
    except Exception as e:  # noqa: BLE001
        resultado["error"] = str(e)
    return resultado


def main() -> None:
    if len(sys.argv) > 1:
        urls = [{"nombre": u, "url": u} for u in sys.argv[1:]]
    else:
        mapa_path = os.path.join(os.path.dirname(__file__), "mapa_enlaces.json")
        with open(mapa_path) as f:
            urls = json.load(f)

    informes = []
    for item in urls:
        r = validar(item["url"])
        r["nombre"] = item.get("nombre", "")
        informes.append(r)
        estado = "OK " if r["ok"] else "FALLO"
        af = r["afiliado"] or "SIN CÓDIGO DE AFILIADO"
        print(f"[{estado}] {r['nombre']}\n        {item['url']}\n        → {r.get('host_final')} | afiliado: {af}")
        if r["error"]:
            print(f"        error: {r['error']}")

    with open("informe_enlaces.json", "w") as f:
        json.dump(informes, f, indent=2, ensure_ascii=False)
    fallos = [i for i in informes if not i["ok"]]
    sin_af = [i for i in informes if i["ok"] and not i["afiliado"]]
    print(f"\nTotal: {len(informes)} | Fallos: {len(fallos)} | Sin código de afiliado: {len(sin_af)}")
    print("Informe completo: informe_enlaces.json")


if __name__ == "__main__":
    main()
