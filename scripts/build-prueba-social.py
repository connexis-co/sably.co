#!/usr/bin/env python3
"""Genera src/data/prueba-social.json a partir de las ventas REALES de Hotmart.

Por qué así y no como lo hacen otros: los avisos tipo «Juan de Bogotá compró hace
5 minutos» que se ven por ahí suelen ser inventados. Aquí no se fabrica nada —
todo sale del histórico de la API de Hotmart (`payments/api/v1/sales/history`),
que da producto, fecha y moneda, pero NO identifica al comprador.

De ahí que los mensajes sean agregados y comprobables («18 personas se inscribieron
en los últimos 30 días») en lugar de eventos individuales con nombre y hora, que
serían imposibles de sostener con estos datos.

Entrada:  el JSON del histórico de ventas (argumento, o docs/data/ventas-hotmart.json)
Salida:   src/data/prueba-social.json
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
SALIDA = ROOT / "src/data/prueba-social.json"

# La API no da país del comprador; la moneda de la compra es el mejor indicio.
#
# `cierto` marca las monedas de un solo país: con COP la compra es de Colombia y
# punto. EUR y USD circulan por muchos sitios, así que sus avisos se publican sin
# nombrar país — decir «alguien de España» cuando solo consta que pagó en euros
# sería afirmar algo que no se sostiene.
MONEDA_PAIS = {
    "COP": ("Colombia", "co", True),
    "MXN": ("México", "mx", True),
    "PEN": ("Perú", "pe", True),
    "CLP": ("Chile", "cl", True),
    "ARS": ("Argentina", "ar", True),
    "EUR": ("España", "es", False),
    "USD": ("Estados Unidos y otros", "us", False),
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def main() -> None:
    origen = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs/data/ventas-hotmart.json"
    if not origen.exists():
        raise SystemExit(f"No encuentro el histórico de ventas en {origen}")

    ventas = json.loads(origen.read_text("utf-8"))

    # Nombre del producto en el club -> slug de sably, vía el TSV de afiliación.
    a_sably: dict[str, str] = {}
    for linea in (ROOT / "docs/data/afiliacion-seminarios.tsv").read_text("utf-8").splitlines():
        if linea.startswith("#") or not linea.strip():
            continue
        p = (linea.split("\t") + ["", ""])[:3]
        slug, codigo, nombre = (x.strip() for x in p)
        if codigo and nombre:
            a_sably[norm(nombre)] = slug

    # Título de cada curso tal y como se muestra en la web, para nombrarlo bien.
    titulos: dict[str, str] = {}
    for mdx in sorted((ROOT / "src/content/courses").glob("*.mdx")):
        for linea in mdx.read_text("utf-8").splitlines()[:40]:
            if linea.startswith("title:"):
                titulos[mdx.stem] = linea.split(":", 1)[1].strip().strip("\"'")
                break

    por_curso: dict[str, Counter] = defaultdict(Counter)
    ultima: dict[str, int] = {}
    paises = Counter()
    pares: set[tuple[str, str]] = set()
    total = 0

    for v in ventas:
        compra = v.get("purchase", {})
        if compra.get("status") not in (None, "APPROVED", "COMPLETE"):
            continue
        nombre = (v.get("product") or {}).get("name") or ""
        slug = a_sably.get(norm(nombre))
        moneda = (compra.get("price") or {}).get("currency_code") or "USD"
        pais, cc, cierto = MONEDA_PAIS.get(moneda, ("otros países", "", False))
        fecha = compra.get("approved_date") or compra.get("order_date") or 0

        total += 1
        paises[pais] += 1
        if slug:
            por_curso[slug][pais] += 1
            pares.add((slug, pais if cierto else ""))
            if fecha > ultima.get(slug, 0):
                ultima[slug] = fecha

    cursos = {}
    for slug, cuenta in por_curso.items():
        top = cuenta.most_common(3)
        cursos[slug] = {
            "compras": sum(cuenta.values()),
            "paises": [{"pais": p, "n": n} for p, n in top],
            "ultimaCompra": ultima.get(slug),
        }

    # Avisos rotatorios: un par (curso, país) por cada combinación que consta en
    # el histórico. Sin nombre y sin «hace 5 minutos» porque la API no da ni lo
    # uno ni lo otro; lo que queda —que esa compra existió— sí es cierto.
    avisos = [
        {"slug": slug, "titulo": titulos.get(slug, slug), "pais": pais}
        for slug, pais in sorted(pares)
        if slug in titulos
    ]

    datos = {
        "_fuente": (
            "Histórico real de la API de Hotmart (payments/api/v1/sales/history). "
            "No incluye datos del comprador: la API no los expone, así que los avisos "
            "no llevan nombre ni hora. Cada aviso corresponde a una compra que existe "
            "en el histórico; ninguno está inventado."
        ),
        "_generado": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "totalCompras": total,
        "paises": [{"pais": p, "n": n} for p, n in paises.most_common()],
        "avisos": avisos,
        "cursos": cursos,
    }

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"{SALIDA.relative_to(ROOT)}")
    print(f"  {total} compras reales · {len(cursos)} cursos con datos")
    for p, n in paises.most_common(5):
        print(f"    {n:4d}  {p}")


if __name__ == "__main__":
    main()
