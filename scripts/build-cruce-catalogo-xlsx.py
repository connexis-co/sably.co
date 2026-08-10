#!/usr/bin/env python3
"""Genera docs/data/cruce-catalogo.xlsx: qué cursos de sably tienen producto y cuáles no.

Responde a la pregunta de negocio: de los cursos publicados, ¿cuáles puedo vender ya,
cuáles hay que resolver buscando otro productor, y cuáles no valen la pena?

Entradas:
  src/content/courses/*.mdx             catálogo publicado (121 cursos)
  docs/data/afiliacion-seminarios.tsv   cruce ya verificado a mano contra el club
  docs/data/catalogo-seminarios.tsv     los 643 contenidos del club con su código
  docs/data/auditoria-cursos-co.json    volumen medido por slug, con veredicto
  docs/data/sondeo-oficios-8paises.json, head-terms-restantes.json, keywords-co.json

Tres cautelas que condicionan el diseño, todas aprendidas de fallos reales:

1. El cruce va contra el CATÁLOGO COMPLETO del club, no contra seleccion-cursos.json.
   Ese archivo solo cubre 100 de los 121 cursos, y usarlo como única fuente daba por
   inexistentes productos que sí están publicados (Maquillaje Social, Peluquería para
   Perros, Velas Artesanales...).

2. Un volumen ausente NO es un volumen cero. `keywords-co.json` es una muestra de
   3.069 keywords y no contiene "soldadura", "tatuaje", "maquillaje" ni "peluquería",
   que son términos de alto volumen. Por eso solo se propone eliminar cuando el
   volumen está MEDIDO; sin medir se marca VERIFICAR_DEMANDA.

3. El cotejo por tokens usa el SLUG, no el título del MDX. Un título largo aporta
   palabras que ningún producto del club comparte y hundía coincidencias exactas
   ("curso-de-sushi" contra "⚫ Sushi en Casa").

Clasificación:
  CON_PRODUCTO       → hay producto en el club; falta afiliarse y acortar.
  AMBIGUO            → varios candidatos; la elección es comercial.
  BUSCAR_ALTERNATIVA → no está en el club y la keyword tiene volumen medido: merece
                       buscar otro productor con comisión > 20%.
  VERIFICAR_DEMANDA  → no está en el club y no hay dato de volumen: medir antes de decidir.
  CANDIDATO_ELIMINAR → no está en el club y el volumen MEDIDO es marginal.
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
UMBRAL_VOLUMEN = 100
AFIL = "https://app-vlc.hotmart.com/affiliate-recruiting/view"

COLUMNS = [
    ("estado", 20),
    ("categoria", 22),
    ("slug_sably", 44),
    ("titulo", 50),
    ("volumen_mes_co", 16),
    ("keyword_medida", 32),
    ("veredicto_auditoria", 20),
    ("producto_en_seminarios", 48),
    ("codigo_afiliacion", 20),
    ("link_afiliacion", 62),
    ("accion", 58),
]

# Palabras que no distinguen un curso de otro: fuera del cotejo por tokens.
VACIAS = {
    "curso", "de", "del", "la", "el", "los", "las", "y", "en", "para", "con", "como",
    "negocio", "desde", "cero", "a", "tu", "un", "una", "por", "al", "master", "pro",
    "profesional", "experto", "aprende", "casa", "domicilio", "paso", "online",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def tokens(s: str) -> set[str]:
    return {t for t in norm(s).split() if t not in VACIAS and len(t) > 2}


def frontmatter(texto: str) -> str:
    m = re.match(r"^---\n(.*?)\n---", texto, re.S)
    return m.group(1) if m else ""


def campo(bloque: str, clave: str) -> str:
    m = re.search(rf"^{clave}:\s*(.+)$", bloque, re.M)
    return m.group(1).strip().strip("'\"") if m else ""


def main() -> None:
    # --- Catálogo del club ---------------------------------------------------
    club = []
    for linea in (ROOT / "docs/data/catalogo-seminarios.tsv").read_text("utf-8").splitlines():
        if not linea.strip() or linea.startswith("#"):
            continue
        p = linea.split("|")
        if len(p) < 4:
            continue
        nombre = "|".join(p[3:])
        club.append({"hash": p[1], "codigo": p[2], "nombre": nombre, "tokens": tokens(nombre)})

    # Cruce ya curado a mano (84 códigos verificados + ambiguos + inexistentes).
    # Manda sobre el automático: se revisó uno a uno contra el club.
    curado: dict[str, dict] = {}
    ruta_tsv = ROOT / "docs/data/afiliacion-seminarios.tsv"
    if ruta_tsv.exists():
        for linea in ruta_tsv.read_text("utf-8").splitlines():
            if linea.startswith("#") or not linea.strip():
                continue
            p = linea.split("\t")
            curado[p[0]] = {
                "codigo": p[1] if len(p) > 1 else "",
                "nota": p[2] if len(p) > 2 else "",
            }

    def buscar_en_club(slug: str, subcat: str) -> list[dict]:
        """Candidatos del club ordenados por solapamiento de tokens.

        El objetivo son los tokens del SLUG (el tema puro), no los del título del
        MDX: un título largo como "Curso de Sushi Casero desde Cero: Aprende a Hacer
        Rolls" aporta tokens que ningún producto del club comparte, y hundía el
        score de coincidencias que en realidad eran exactas.
        """
        objetivo = tokens(slug.replace("curso-de-", ""))
        if not objetivo:
            return []
        puntuados = []
        for c in club:
            if not c["tokens"]:
                continue
            comunes = objetivo & c["tokens"]
            if not comunes:
                continue
            score = len(comunes) / len(objetivo)
            if score >= 0.6:
                puntuados.append({**c, "score": score})
        # Empate a score: gana el nombre más corto, que suele ser el producto
        # principal y no una variante ("Sushi en Casa" antes que "Sensei del Sushi").
        return sorted(puntuados, key=lambda x: (-x["score"], len(x["nombre"])))[:3]

    # --- Volumen -------------------------------------------------------------
    # Tres fuentes, de más fiable a menos:
    #   1. auditoria-cursos-co.json  → medido por slug exacto, con veredicto.
    #   2. sondeo-oficios / head-terms → medido por keyword, multi-país.
    #   3. keywords-co.json          → muestra general de 3.069 keywords.
    # Ninguna cubre todo, de ahí que se distinga "medido 0" de "sin medir".
    auditoria = {
        x["slug"]: x for x in json.loads((ROOT / "docs/data/auditoria-cursos-co.json").read_text("utf-8"))
    }

    multipais: dict[str, int] = {}
    for fichero in ("sondeo-oficios-8paises.json", "head-terms-restantes.json"):
        ruta = ROOT / "docs/data" / fichero
        if not ruta.exists():
            continue
        for kw, paises in json.loads(ruta.read_text("utf-8")).items():
            if isinstance(paises, dict) and "CO" in paises:
                multipais[norm(kw)] = paises["CO"].get("volume", 0)

    keywords = json.loads((ROOT / "docs/data/keywords-co.json").read_text("utf-8"))
    por_kw: dict[str, dict] = {}
    for k in keywords:
        clave = norm(k["keyword"])
        if clave not in por_kw or k["volume"] > por_kw[clave]["volume"]:
            por_kw[clave] = k

    def volumen(slug: str, titulo: str) -> tuple[int | None, str, str]:
        """(volumen, keyword, veredicto) — volumen None si el término no está medido."""
        a = auditoria.get(slug)
        if a:
            return a.get("volume", 0), a.get("keyword", ""), a.get("verdict", "")

        tema = slug.replace("curso-de-", "").replace("-", " ")
        candidatas = [f"curso de {tema}", tema, norm(titulo)]
        mejor: tuple[int | None, str, str] = (None, "", "")
        for c in candidatas:
            n = norm(c)
            if n in multipais and (mejor[0] is None or multipais[n] > mejor[0]):
                mejor = (multipais[n], c, "")
            k = por_kw.get(n)
            if k and (mejor[0] is None or k["volume"] > mejor[0]):
                mejor = (k["volume"], k["keyword"], "")
        return mejor

    # --- Cruce ---------------------------------------------------------------
    filas = []
    for path in sorted((ROOT / "src/content/courses").glob("*.mdx")):
        fm = frontmatter(path.read_text("utf-8"))
        slug, titulo = path.stem, campo(fm, "title")
        vol, kw, veredicto = volumen(slug, titulo)
        cur = curado.get(slug, {})
        candidatos = buscar_en_club(slug, campo(fm, "subcategory"))

        if cur.get("codigo"):
            # Verificado a mano contra el club: no se discute.
            estado, codigo = "CON_PRODUCTO", cur["codigo"]
            producto = cur["nota"]
            accion = "Afiliarse y crear los 2 acortadores"
        elif cur.get("nota", "").startswith("VARIOS_CANDIDATOS"):
            estado, codigo = "AMBIGUO", ""
            producto = cur["nota"].replace("VARIOS_CANDIDATOS: ", "")
            accion = "Elegir cuál de los candidatos"
        elif cur.get("nota", "").startswith("NO_EXISTE") and vol is None:
            estado, codigo, producto = "VERIFICAR_DEMANDA", "", ""
            accion = "Confirmado que no está en el club; medir la keyword antes de decidir"
        elif candidatos and candidatos[0]["score"] >= 0.99 and len(candidatos) == 1:
            c = candidatos[0]
            estado, codigo = "CON_PRODUCTO", c["codigo"]
            producto = c["nombre"]
            accion = "Afiliarse y crear los 2 acortadores"
        elif len(candidatos) > 1:
            estado, codigo = "AMBIGUO", ""
            producto = " | ".join(f"{c['codigo']} {c['nombre']}" for c in candidatos)
            accion = "Elegir cuál de los candidatos"
        elif candidatos:
            c = candidatos[0]
            estado, codigo = "CON_PRODUCTO", c["codigo"]
            producto = c["nombre"]
            accion = "Afiliarse y crear los 2 acortadores (verificar que es el correcto)"
        elif vol is None:
            estado, codigo, producto = "VERIFICAR_DEMANDA", "", ""
            accion = "Sin producto y sin dato de volumen: medir la keyword antes de decidir"
        elif vol >= UMBRAL_VOLUMEN:
            estado, codigo, producto = "BUSCAR_ALTERNATIVA", "", ""
            accion = f"Buscar productor con comisión > 20% ({vol}/mes lo justifica)"
        else:
            estado, codigo, producto = "CANDIDATO_ELIMINAR", "", ""
            accion = (
                f"Sin producto y solo {vol}/mes medidos"
                + (f" ({veredicto})" if veredicto else "")
                + ": valorar despublicar o fusionar con un curso hermano"
            )

        filas.append(
            {
                "estado": estado,
                "categoria": campo(fm, "category"),
                "slug_sably": slug,
                "titulo": titulo,
                "volumen_mes_co": vol if vol is not None else "sin dato",
                "keyword_medida": kw,
                "veredicto_auditoria": veredicto,
                "producto_en_seminarios": producto,
                "codigo_afiliacion": codigo,
                "link_afiliacion": f"{AFIL}/{codigo}" if codigo else "",
                "accion": accion,
            }
        )

    # --- XLSX ----------------------------------------------------------------
    wb = Workbook()
    wb.remove(wb.active)
    cabecera = Font(bold=True, color="FFFFFF")
    relleno = PatternFill("solid", fgColor="1F2937")
    COLOR = {
        "CON_PRODUCTO": PatternFill("solid", fgColor="C6EFCE"),
        "AMBIGUO": PatternFill("solid", fgColor="FFF2CC"),
        "BUSCAR_ALTERNATIVA": PatternFill("solid", fgColor="FCE4D6"),
        "VERIFICAR_DEMANDA": PatternFill("solid", fgColor="DDEBF7"),
        "CANDIDATO_ELIMINAR": PatternFill("solid", fgColor="FFC7CE"),
    }

    def clave_orden(f: dict) -> tuple:
        v = f["volumen_mes_co"]
        return (-v if isinstance(v, int) else 1, f["slug_sably"])

    def hoja(nombre: str, datos: list[dict]) -> None:
        ws = wb.create_sheet(re.sub(r"[\\/*?:\[\]]", "", nombre)[:31] or "hoja")
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

    ORDEN = ["BUSCAR_ALTERNATIVA", "VERIFICAR_DEMANDA", "CANDIDATO_ELIMINAR", "AMBIGUO", "CON_PRODUCTO"]
    hoja("RESUMEN", sorted(filas, key=lambda f: (ORDEN.index(f["estado"]), clave_orden(f))))
    for estado in ORDEN:
        datos = [f for f in filas if f["estado"] == estado]
        if datos:
            hoja(estado, sorted(datos, key=clave_orden))

    destino = ROOT / "docs/data/cruce-catalogo.xlsx"
    wb.save(destino)

    cuenta: dict[str, int] = defaultdict(int)
    for f in filas:
        cuenta[f["estado"]] += 1
    print(f"{destino.relative_to(ROOT)}  ({len(filas)} cursos)")
    for estado in ORDEN:
        print(f"  {estado:20s} {cuenta[estado]:3d}")
    for estado in ("BUSCAR_ALTERNATIVA", "CANDIDATO_ELIMINAR", "VERIFICAR_DEMANDA"):
        datos = [f for f in filas if f["estado"] == estado]
        if not datos:
            continue
        print(f"\n-- {estado} --")
        for f in sorted(datos, key=clave_orden):
            print(f"  {str(f['volumen_mes_co']):>9}/mes  {f['slug_sably']:44s} {f['categoria']}")


if __name__ == "__main__":
    main()
