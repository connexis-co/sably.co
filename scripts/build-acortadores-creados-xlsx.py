#!/usr/bin/env python3
"""Genera docs/data/acortadores-creados.xlsx: el listado de todos los acortadores.

Es el entregable de consulta: por cada curso, sus dos acortadores, el hotlink del
que cuelgan, el checkout al que llevan y el `ref` que acredita la comisión.

Entradas:
  docs/data/acortadores-resultado.json   lo que creó scripts/hotmart-acortadores.mjs
  docs/data/afiliacion-seminarios.tsv    los que no tienen producto y por qué
  src/content/courses/*.mdx              lo que quedó publicado de verdad

La última columna es la que importa: un acortador creado que no llegó al curso no
sirve de nada, y es el fallo que pasa desapercibido.
"""

from __future__ import annotations

import json
import pathlib
import re

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = pathlib.Path(__file__).resolve().parent.parent

COLUMNS = [
    ("estado", 16),
    ("slug_sably", 44),
    ("nombre_en_el_club", 48),
    ("acortador_crashing", 62),
    ("acortador_venta_SO", 62),
    ("hotlink", 40),
    ("checkout_destino", 46),
    ("ref_comision", 18),
    ("id_producto", 13),
    ("publicado_en_sably", 62),
    ("nota", 60),
]


def frontmatter(t: str) -> str:
    m = re.match(r"^---\n(.*?)\n---", t, re.S)
    return m.group(1) if m else ""


def campo(b: str, k: str) -> str:
    m = re.search(rf"^{k}:\s*(.+)$", b, re.M)
    return m.group(1).strip().strip("'\"") if m else ""


def main() -> None:
    resultado = json.loads((ROOT / "docs/data/acortadores-resultado.json").read_text("utf-8"))

    sin_producto: dict[str, str] = {}
    for linea in (ROOT / "docs/data/afiliacion-seminarios.tsv").read_text("utf-8").splitlines():
        if linea.startswith("#") or not linea.strip():
            continue
        p = (linea.split("\t") + ["", ""])[:3]
        slug, codigo, nota = (x.strip() for x in p)
        if not codigo and nota:
            sin_producto[slug] = nota

    publicado = {}
    for path in (ROOT / "src/content/courses").glob("*.mdx"):
        fm = frontmatter(path.read_text("utf-8"))
        publicado[path.stem] = campo(fm, "hotmartUrl")

    filas = []
    for r in resultado:
        slug = r["slugSably"]
        url = publicado.get(slug, "")
        filas.append(
            {
                "estado": r.get("estado", ""),
                "slug_sably": slug,
                "nombre_en_el_club": r.get("nombreClub", ""),
                "acortador_crashing": r.get("crashing") or "",
                "acortador_venta_SO": r.get("ventaSO") or "",
                "hotlink": r.get("hotlink") or "",
                "checkout_destino": (r.get("checkoutFinal") or "").split("?")[0],
                "ref_comision": ((r.get("checkoutFinal") or "").split("ref=") + [""])[1].split("&")[0],
                "id_producto": r.get("idProducto") or "",
                "publicado_en_sably": "PENDIENTE (capta lead)" if "PENDIENTE" in url else url,
                "nota": (r.get("nota") or "")[:200],
            }
        )

    for slug, motivo in sorted(sin_producto.items()):
        url = publicado.get(slug, "")
        filas.append(
            {
                "estado": "SIN_PRODUCTO",
                "slug_sably": slug,
                "nombre_en_el_club": "",
                "acortador_crashing": "",
                "acortador_venta_SO": "",
                "hotlink": "",
                "checkout_destino": "",
                "ref_comision": "",
                "id_producto": "",
                "publicado_en_sably": "PENDIENTE (capta lead)" if "PENDIENTE" in url else url,
                "nota": motivo[:200],
            }
        )

    wb = Workbook()
    wb.remove(wb.active)
    cabecera = Font(bold=True, color="FFFFFF")
    relleno = PatternFill("solid", fgColor="1F2937")
    COLOR = {
        "OK": PatternFill("solid", fgColor="C6EFCE"),
        "SIN_PRODUCTO": PatternFill("solid", fgColor="FFF2CC"),
        "ERROR": PatternFill("solid", fgColor="FFC7CE"),
    }

    def hoja(nombre: str, datos: list[dict]) -> None:
        ws = wb.create_sheet(nombre[:31])
        ws.append([c for c, _ in COLUMNS])
        for celda in ws[1]:
            celda.font, celda.fill = cabecera, relleno
            celda.alignment = Alignment(vertical="center")
        for fila in datos:
            ws.append([fila[c] for c, _ in COLUMNS])
            pinta = COLOR.get(fila["estado"])
            if pinta:
                for celda in ws[ws.max_row]:
                    celda.fill = pinta
        for i, (_, ancho) in enumerate(COLUMNS, start=1):
            ws.column_dimensions[get_column_letter(i)].width = ancho
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

    orden = {"OK": 0, "ERROR": 1, "SIN_PRODUCTO": 2}
    hoja("TODOS", sorted(filas, key=lambda f: (orden.get(f["estado"], 9), f["slug_sably"])))
    hoja("CREADOS OK", [f for f in filas if f["estado"] == "OK"])
    pendientes = [f for f in filas if f["estado"] != "OK"]
    if pendientes:
        hoja("SIN ENLACE", pendientes)

    destino = ROOT / "docs/data/acortadores-creados.xlsx"
    wb.save(destino)

    ok = sum(1 for f in filas if f["estado"] == "OK")
    print(f"{destino.relative_to(ROOT)}")
    print(f"  {len(filas)} filas · {ok} cursos con los dos acortadores ({ok * 2} enlaces)")
    print(f"  {len(pendientes)} sin enlace")


if __name__ == "__main__":
    main()
