#!/usr/bin/env python3
"""Vuelca docs/data/acortadores-resultado.json al catálogo publicado.

Escribe en cada .mdx el checkout real y su `ref`, que es lo que acredita la
comisión. La URL se toma resolviendo el acortador, no montándola a mano: así lo
que queda publicado es exactamente lo que Hotmart devuelve.

Se aplica solo a las filas con estado OK (acortador creado Y verificado). Una
fila CREADO_SIN_VERIFICAR se deja fuera a propósito: publicar un enlace que no se
comprobó es justo el error que hace perder comisiones.

Uso:  python3 scripts/aplicar-acortadores.py [--dry]
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
RESULTADO = ROOT / "docs/data/acortadores-resultado.json"
CURSOS = ROOT / "src/content/courses"
DRY = "--dry" in sys.argv


def resolver(url: str) -> tuple[str, str] | None:
    """Sigue el acortador y devuelve (checkout_sin_query, ref)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "sably-bot"})
        with urllib.request.urlopen(req, timeout=25) as r:
            final = r.geturl()
    except Exception as e:  # noqa: BLE001 - se reporta y se sigue con el resto
        print(f"    no pude resolver {url}: {e}")
        return None
    m = re.match(r"(https://pay\.hotmart\.com/[A-Z0-9]+)\?.*?ref=([A-Za-z0-9]+)", final)
    return (m.group(1), m.group(2)) if m else None


def aplicar_acortador(slug: str, acortador: str) -> bool:
    """Publica el acortador `hotm.io/<slug>-curso-crashing` como enlace del curso.

    Se publica el acortador y no su destino final por dos razones de negocio:
    el Link Manager de Hotmart cuenta los clics de cada acortador, y permite
    cambiar a dónde apunta sin volver a tocar el sitio ni desplegar.

    No se escribe `hotmartRef`: el acortador ya lleva la atribución embebida, y
    añadir un segundo `ref` en la query duplicaría el parámetro.
    """
    path = CURSOS / f"{slug}.mdx"
    if not path.exists():
        print(f"    no existe {path.name}")
        return False
    texto = path.read_text("utf-8")
    nuevo = re.sub(r"^hotmartUrl:.*$", f"hotmartUrl: {acortador}", texto, count=1, flags=re.M)
    # El ref viaja dentro del acortador; dejarlo aquí lo duplicaría en la URL.
    nuevo = re.sub(r"^hotmartRef:.*\n", "", nuevo, count=1, flags=re.M)
    if nuevo == texto:
        return False
    if not DRY:
        path.write_text(nuevo, encoding="utf-8")
    return True


def aplicar(slug: str, checkout: str, ref: str) -> bool:
    path = CURSOS / f"{slug}.mdx"
    if not path.exists():
        print(f"    no existe {path.name}")
        return False
    texto = path.read_text("utf-8")
    nuevo = re.sub(r"^hotmartUrl:.*$", f"hotmartUrl: {checkout}", texto, count=1, flags=re.M)
    if "hotmartRef:" in nuevo:
        nuevo = re.sub(r"^hotmartRef:.*$", f"hotmartRef: {ref}", nuevo, count=1, flags=re.M)
    else:
        nuevo = nuevo.replace(f"hotmartUrl: {checkout}", f"hotmartUrl: {checkout}\nhotmartRef: {ref}", 1)
    if nuevo == texto:
        return False
    if not DRY:
        path.write_text(nuevo, encoding="utf-8")
    return True


def main() -> None:
    if not RESULTADO.exists():
        raise SystemExit(f"Falta {RESULTADO.relative_to(ROOT)}. Ejecuta antes scripts/hotmart-acortadores.mjs")

    filas = json.loads(RESULTADO.read_text("utf-8"))
    listos = [f for f in filas if f.get("estado") == "OK" and f.get("crashing")]
    print(f"{len(listos)} de {len(filas)} filas verificadas.{' (dry-run)' if DRY else ''}\n")

    aplicados = 0
    for f in listos:
        # Se comprueba el acortador antes de publicarlo: tiene que llevar a un
        # checkout y conservar el `ref`. Si no, no se toca el curso.
        r = resolver(f["crashing"])
        if not r:
            print(f"    {f['slugSably']}: el acortador no resuelve a un checkout con ref; no lo publico")
            continue
        checkout, ref = r
        if aplicar_acortador(f["slugSably"], f["crashing"]):
            aplicados += 1
            print(f"  ✓ {f['slugSably']:44s} {f['crashing']}")
            print(f"      → {checkout}?ref={ref}")

    print(f"\n{aplicados} cursos actualizados.")
    pendientes = [f for f in filas if f.get("estado") not in ("OK",)]
    if pendientes:
        print(f"{len(pendientes)} filas sin aplicar (revisar en el XLSX):")
        for f in pendientes[:15]:
            print(f"  {f.get('estado','?'):22s} {f['slugSably']:44s} {f.get('nota','')[:60]}")


if __name__ == "__main__":
    main()
