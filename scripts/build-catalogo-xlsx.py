#!/usr/bin/env python3
"""Genera docs/data/catalogo-seminarios.xlsx: el catálogo completo del club.

Es un inventario, no un plan de trabajo: lista TODO lo que Mauricio Duque tiene
publicado en Seminarios Online con su enlace de afiliación, sin afiliarse a nada.
El XLSX de acortadores (build-acortadores-xlsx.py) es el que sí lleva el estado.

La hoja CRUCE marca qué contenidos corresponden a un curso ya publicado en sably,
que es lo que permite decidir a qué afiliarse primero.

Entrada: docs/data/catalogo-seminarios.json (lo produce scripts/hotmart-catalogo.mjs)
"""

from __future__ import annotations

import json
import pathlib
import re
import unicodedata
from collections import defaultdict

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENTRADA = ROOT / "docs/data/catalogo-seminarios.json"

COLUMNS = [
    ("modulo", 44),
    ("nombre_curso", 60),
    ("link_afiliacion", 62),
    ("codigo_afiliacion", 20),
    ("hash", 14),
    ("url_contenido", 74),
    ("curso_sably", 40),
    ("ya_publicado_en_sably", 22),
]


def norm(s: str) -> str:
    """Normaliza para comparar: sin emojis, tildes ni signos."""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def main() -> None:
    if not ENTRADA.exists():
        raise SystemExit(f"Falta {ENTRADA.relative_to(ROOT)}. Ejecuta antes scripts/hotmart-catalogo.mjs")

    catalogo = json.loads(ENTRADA.read_text("utf-8"))
    seleccion = json.loads((ROOT / "docs/data/seleccion-cursos.json").read_text("utf-8"))

    # El archiveSlug es el nombre del producto en MasterClasses.LA, así que
    # normalizado coincide con el título del contenido en el club.
    por_archive = {norm(c["archiveSlug"].replace("-", " ")): c for c in seleccion}

    filas = []
    for item in catalogo:
        clave = norm(item["nombre"])
        sel = por_archive.get(clave)
        filas.append(
            {
                "modulo": item["modulo"],
                "nombre_curso": item["nombre"],
                "link_afiliacion": item.get("linkAfiliacion") or "",
                "codigo_afiliacion": item.get("codigoAfiliacion") or "",
                "hash": item["hash"],
                "url_contenido": item["urlContenido"],
                "curso_sably": sel["sablySlug"] if sel else "",
                "ya_publicado_en_sably": "SI" if sel else "NO",
            }
        )

    wb = Workbook()
    wb.remove(wb.active)

    cabecera = Font(bold=True, color="FFFFFF")
    relleno = PatternFill("solid", fgColor="1F2937")
    # Resaltado: contenidos que ya tienen curso publicado en sably. Son los que
    # hay que afiliar primero, porque ya tienen tráfico esperando.
    destaca = PatternFill("solid", fgColor="FFF2CC")
    sin_link = PatternFill("solid", fgColor="FFC7CE")

    def hoja(nombre: str, datos: list[dict]) -> None:
        ws = wb.create_sheet(re.sub(r"[\\/*?:\[\]]", "", nombre)[:31] or "sin-nombre")
        ws.append([c for c, _ in COLUMNS])
        for celda in ws[1]:
            celda.font = cabecera
            celda.fill = relleno
            celda.alignment = Alignment(vertical="center")
        for fila in datos:
            ws.append([fila[c] for c, _ in COLUMNS])
            if not fila["link_afiliacion"]:
                for celda in ws[ws.max_row]:
                    celda.fill = sin_link
            elif fila["ya_publicado_en_sably"] == "SI":
                for celda in ws[ws.max_row]:
                    celda.fill = destaca
        for i, (_, ancho) in enumerate(COLUMNS, start=1):
            ws.column_dimensions[get_column_letter(i)].width = ancho
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

    hoja("TODOS", filas)
    hoja("EN SABLY", [f for f in filas if f["ya_publicado_en_sably"] == "SI"])

    por_modulo: dict[str, list[dict]] = defaultdict(list)
    for fila in filas:
        # El nombre del módulo trae emojis y puntos suspensivos que Excel no admite.
        limpio = re.sub(r"[^\w\s-]", "", fila["modulo"], flags=re.UNICODE).strip() or "otros"
        por_modulo[limpio].append(fila)
    for modulo in sorted(por_modulo):
        hoja(modulo, por_modulo[modulo])

    destino = ROOT / "docs/data/catalogo-seminarios.xlsx"
    wb.save(destino)

    con_link = sum(1 for f in filas if f["link_afiliacion"])
    en_sably = sum(1 for f in filas if f["ya_publicado_en_sably"] == "SI")
    print(f"{destino.relative_to(ROOT)}")
    print(f"  {len(filas)} contenidos · {len(por_modulo)} módulos")
    print(f"  {con_link} con enlace de afiliación · {len(filas) - con_link} sin enlace (en rojo)")
    print(f"  {en_sably} ya publicados en sably (en amarillo)")


if __name__ == "__main__":
    main()
