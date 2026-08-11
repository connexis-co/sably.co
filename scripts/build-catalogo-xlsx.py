#!/usr/bin/env python3
"""Genera docs/data/catalogo-seminarios.xlsx: el catálogo del club de Seminarios Online.

Es un inventario, no un plan de trabajo: lista lo que Mauricio Duque tiene publicado
con su enlace de afiliación, sin afiliarse a nada. El XLSX de acortadores
(build-acortadores-xlsx.py) es el que lleva el estado de la ejecución.

Entradas:
  docs/data/catalogo-modulos.tsv     índice -> nombre del módulo
  docs/data/catalogo-seminarios.tsv  modIdx|hash|codigo|nombre
  docs/data/seleccion-cursos.json    para marcar qué ya está publicado en sably

El enlace de afiliación se arma con el código:
  https://app-vlc.hotmart.com/affiliate-recruiting/view/<codigo>
Y la lección se abre en:
  https://hotmart.com/es/club/virtualeducation/products/209718/content/<hash>
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
CLUB = "https://hotmart.com/es/club/virtualeducation/products/209718"
AFIL = "https://app-vlc.hotmart.com/affiliate-recruiting/view"

COLUMNS = [
    ("modulo", 44),
    ("nombre_curso", 62),
    ("link_afiliacion", 64),
    ("codigo_afiliacion", 20),
    ("url_contenido", 76),
    ("hash", 14),
    ("curso_sably", 42),
    ("ya_en_sably", 14),
]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def main() -> None:
    modulos = {}
    for linea in (ROOT / "docs/data/catalogo-modulos.tsv").read_text("utf-8").splitlines():
        if not linea.strip():
            continue
        i, nombre = linea.split("\t", 1)
        modulos[i] = nombre

    seleccion = json.loads((ROOT / "docs/data/seleccion-cursos.json").read_text("utf-8"))
    # El archiveSlug es el nombre del producto en MasterClasses.LA; normalizado
    # coincide con el título del contenido en el club.
    por_archive = {norm(c["archiveSlug"].replace("-", " ")): c["sablySlug"] for c in seleccion}

    filas = []
    for linea in (ROOT / "docs/data/catalogo-seminarios.tsv").read_text("utf-8").splitlines():
        if not linea.strip() or linea.startswith("#"):
            continue
        partes = linea.split("|")
        if len(partes) < 4:
            continue
        mod_idx, hash_, codigo, nombre = partes[0], partes[1], partes[2], "|".join(partes[3:])
        clave = norm(nombre)
        sably = por_archive.get(clave, "")
        if not sably:
            # Segundo intento: por inclusión, porque el club a veces añade sufijos.
            for k, v in por_archive.items():
                if k and (k in clave or clave in k):
                    sably = v
                    break
        filas.append(
            {
                "modulo": modulos.get(mod_idx, mod_idx),
                "nombre_curso": nombre,
                "link_afiliacion": f"{AFIL}/{codigo}" if codigo else "",
                "codigo_afiliacion": codigo,
                "url_contenido": f"{CLUB}/content/{hash_}",
                "hash": hash_,
                "curso_sably": sably,
                "ya_en_sably": "SI" if sably else "NO",
            }
        )

    wb = Workbook()
    wb.remove(wb.active)

    cabecera = Font(bold=True, color="FFFFFF")
    relleno = PatternFill("solid", fgColor="1F2937")
    # Amarillo = ya tiene curso publicado en sably: son los primeros a afiliar,
    # porque ya hay tráfico esperando ese enlace.
    destaca = PatternFill("solid", fgColor="FFF2CC")
    sin_link = PatternFill("solid", fgColor="FFC7CE")

    def hoja(nombre: str, datos: list[dict]) -> None:
        limpio = re.sub(r"[\\/*?:\[\]]", "", nombre)[:31] or "sin-nombre"
        ws = wb.create_sheet(limpio)
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
            elif fila["ya_en_sably"] == "SI":
                for celda in ws[ws.max_row]:
                    celda.fill = destaca
        for i, (_, ancho) in enumerate(COLUMNS, start=1):
            ws.column_dimensions[get_column_letter(i)].width = ancho
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

    hoja("TODOS", sorted(filas, key=lambda f: (f["modulo"], f["nombre_curso"])))
    hoja("EN SABLY", [f for f in filas if f["ya_en_sably"] == "SI"])

    por_modulo: dict[str, list[dict]] = defaultdict(list)
    for fila in filas:
        # Los nombres de módulo traen emojis y puntos suspensivos que Excel rechaza.
        limpio = re.sub(r"[^\w\s-]", "", fila["modulo"], flags=re.UNICODE).strip() or "otros"
        por_modulo[limpio].append(fila)
    for modulo in sorted(por_modulo):
        hoja(modulo, sorted(por_modulo[modulo], key=lambda f: f["nombre_curso"]))

    destino = ROOT / "docs/data/catalogo-seminarios.xlsx"
    wb.save(destino)

    en_sably = sum(1 for f in filas if f["ya_en_sably"] == "SI")
    print(f"{destino.relative_to(ROOT)}")
    print(f"  {len(filas)} cursos · {len(por_modulo)} módulos")
    print(f"  {en_sably} ya publicados en sably (resaltados en amarillo)")


if __name__ == "__main__":
    main()
