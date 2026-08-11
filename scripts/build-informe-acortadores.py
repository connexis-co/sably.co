#!/usr/bin/env python3
"""Genera docs/ESTADO_ENLACES_HOTMART.md: qué curso quedó vendible y cuál no.

Es el parte de cierre del trabajo de acortadores. Cruza tres fuentes:

  docs/data/afiliacion-seminarios.tsv       qué cursos tienen producto en el club
  docs/data/acortadores-resultado.json      qué acortadores se crearon y verificaron
  src/content/courses/*.mdx                 qué enlace quedó publicado de verdad

La última es la que manda: un acortador creado que no llegó al .mdx no sirve de
nada, y es justo el fallo que pasa desapercibido.

Uso:  python3 scripts/build-informe-acortadores.py
"""

from __future__ import annotations

import json
import pathlib
import re
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
DESTINO = ROOT / "docs/ESTADO_ENLACES_HOTMART.md"

MOTIVOS = {
    "NO_EXISTE_EN_CATALOGO": "No existe en el catálogo de Seminarios Online",
    "VARIOS_CANDIDATOS": "Hay varios productos candidatos; falta elegir",
}


def frontmatter(texto: str) -> str:
    m = re.match(r"^---\n(.*?)\n---", texto, re.S)
    return m.group(1) if m else ""


def campo(bloque: str, clave: str) -> str:
    m = re.search(rf"^{clave}:\s*(.+)$", bloque, re.M)
    return m.group(1).strip().strip("'\"") if m else ""


def main() -> None:
    # --- Qué dice el TSV ------------------------------------------------------
    tsv: dict[str, dict] = {}
    for linea in (ROOT / "docs/data/afiliacion-seminarios.tsv").read_text("utf-8").splitlines():
        if linea.startswith("#") or not linea.strip():
            continue
        partes = (linea.split("\t") + ["", ""])[:3]
        slug, codigo, nota = (p.strip() for p in partes)
        tsv[slug] = {"codigo": codigo, "nota": nota}

    # --- Qué hizo el script ---------------------------------------------------
    ruta_res = ROOT / "docs/data/acortadores-resultado.json"
    resultado = {r["slugSably"]: r for r in json.loads(ruta_res.read_text("utf-8"))} if ruta_res.exists() else {}

    # --- Qué quedó publicado --------------------------------------------------
    publicado: dict[str, dict] = {}
    for path in sorted((ROOT / "src/content/courses").glob("*.mdx")):
        fm = frontmatter(path.read_text("utf-8"))
        url = campo(fm, "hotmartUrl")
        publicado[path.stem] = {
            "titulo": campo(fm, "title"),
            "categoria": campo(fm, "category"),
            "url": url,
            "ref": campo(fm, "hotmartRef"),
            "vendible": "PENDIENTE" not in url and bool(campo(fm, "hotmartRef")),
        }

    vendibles = [s for s, p in publicado.items() if p["vendible"]]
    sin_enlace = [s for s, p in publicado.items() if not p["vendible"]]

    # Los sin enlace, agrupados por la razón real.
    por_motivo: dict[str, list[str]] = defaultdict(list)
    for slug in sin_enlace:
        nota = tsv.get(slug, {}).get("nota", "")
        codigo = tsv.get(slug, {}).get("codigo", "")
        res = resultado.get(slug)
        if not codigo and nota.startswith("NO_EXISTE"):
            por_motivo["No existe en el catálogo de Seminarios Online"].append(slug)
        elif not codigo and nota.startswith("VARIOS"):
            por_motivo["Varios candidatos: falta elegir cuál"].append(slug)
        elif slug not in tsv:
            por_motivo["Fuera del cruce: no está en el TSV"].append(slug)
        elif res and res.get("estado") not in ("OK",):
            por_motivo[f"Acortador sin cerrar ({res.get('estado')})"].append(slug)
        else:
            por_motivo["Con producto pero sin enlace aplicado"].append(slug)

    estados = Counter(r.get("estado") for r in resultado.values())

    # --- Informe --------------------------------------------------------------
    L: list[str] = []
    L.append("# Estado de los enlaces de Hotmart en sably.co\n")
    L.append(
        f"De los **{len(publicado)} cursos publicados**, **{len(vendibles)}** llevan a un checkout "
        f"real con atribución de comisión y **{len(sin_enlace)}** todavía no.\n"
    )
    L.append(
        "Un curso cuenta como vendible cuando su `.mdx` tiene un `hotmartUrl` real (no el "
        "placeholder `PENDIENTE`) **y** un `hotmartRef`. El `ref` es lo que acredita la "
        "comisión: sin él el checkout funciona igual, pero la venta se le abona al productor.\n"
    )
    L.append("Los cursos sin enlace no se despublican: su CTA capta el lead y avisa de que las "
             "inscripciones están cerradas por ahora.\n")

    L.append("\n## Resumen\n")
    L.append("| Estado | Cursos |")
    L.append("|---|---|")
    L.append(f"| Vendibles (checkout + ref) | **{len(vendibles)}** |")
    for motivo, slugs in sorted(por_motivo.items(), key=lambda kv: -len(kv[1])):
        L.append(f"| {motivo} | {len(slugs)} |")

    if estados:
        L.append("\nEstados que dejó `scripts/hotmart-acortadores.mjs`:\n")
        L.append("| Estado | Cursos | Significado |")
        L.append("|---|---|---|")
        glosario = {
            "OK": "Los dos acortadores creados y verificados con el `ref` correcto",
            "YA_EXISTIA": "Ya estaban creados de antes y verifican",
            "SIN_ATRIBUCION": "Alguno resuelve sin `ref` o falta por crear",
            "PENDIENTE": "No se llegó a procesar",
            "ERROR": "Falló; el motivo queda en el campo `nota`",
            "FALTAN_LOS_DOS": "Ninguno de los dos existía todavía",
            "DRY": "Solo simulado, no se creó nada",
        }
        for estado, n in estados.most_common():
            L.append(f"| `{estado}` | {n} | {glosario.get(estado, '')} |")

    for motivo, slugs in sorted(por_motivo.items(), key=lambda kv: -len(kv[1])):
        L.append(f"\n## {motivo} ({len(slugs)})\n")
        if motivo.startswith("No existe"):
            L.append(
                "Mauricio Duque no tiene un producto equivalente. Para venderlos hay que buscar "
                "otro productor en el mercado de afiliación con comisión superior al 20 %, "
                "afiliarse y repetir el proceso.\n"
            )
        elif motivo.startswith("Varios"):
            L.append(
                "Hay más de un producto que encaja y la elección es comercial, no técnica. "
                "Los candidatos están en la tercera columna de `docs/data/afiliacion-seminarios.tsv`; "
                "al dejar uno solo, el script los procesa en la siguiente pasada.\n"
            )
        elif motivo.startswith("Acortador"):
            L.append(
                "El producto existe y la cuenta está afiliada, pero el acortador no quedó "
                "verificado. Se resuelve relanzando el script: reprocesa todo lo que no esté en `OK`.\n"
            )
        L.append("| Curso | Categoría | Detalle |")
        L.append("|---|---|---|")
        for slug in sorted(slugs):
            p = publicado[slug]
            res = resultado.get(slug, {})
            detalle = res.get("nota") or tsv.get(slug, {}).get("nota", "") or "—"
            detalle = detalle.replace("|", "/")[:110]
            L.append(f"| `{slug}` | {p['categoria']} | {detalle} |")

    L.append("\n## Cómo se retoma\n")
    L.append("```bash")
    L.append("# Chrome cerrado del todo, luego:")
    L.append("/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\")
    L.append('  --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-hotmart"')
    L.append("# inicia sesión en app.hotmart.com y:")
    L.append("node scripts/hotmart-acortadores.mjs     # reprocesa todo lo que no esté en OK")
    L.append("python3 scripts/aplicar-acortadores.py   # vuelca los verificados al catálogo")
    L.append("python3 scripts/build-informe-acortadores.py  # regenera este informe")
    L.append("```")

    DESTINO.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"{DESTINO.relative_to(ROOT)}")
    print(f"  {len(vendibles)}/{len(publicado)} cursos vendibles")
    for motivo, slugs in sorted(por_motivo.items(), key=lambda kv: -len(kv[1])):
        print(f"  {len(slugs):3d}  {motivo}")


if __name__ == "__main__":
    main()
