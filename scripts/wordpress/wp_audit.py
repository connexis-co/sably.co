#!/usr/bin/env python3
"""Auditoría técnica de un WordPress: contenido, formularios, enlaces Hotmart y custom fields.

Funciona en dos niveles:
  A) Público (sin login): REST API wp-json + crawl de páginas → inventario de
     URLs, formularios (action), enlaces salientes a Hotmart, tema y plugins
     detectables, versiones, errores de código visibles (scripts rotos, mixed
     content, HTML malformado).
  B) Autenticado (con WP_USER/WP_PASS en .env): inicia sesión en wp-login.php y
     extrae plugins instalados/activos, actualizaciones pendientes, usuarios,
     custom fields (post meta) con enlaces de Hotmart para redirecciones de
     formularios.

Uso:
    python3 wp_audit.py publico
    python3 wp_audit.py admin
    python3 wp_audit.py custom-fields   # busca postmeta con enlaces hotmart (requiere login)

Requiere: pip install requests beautifulsoup4 python-dotenv
"""
import json
import os
import re
import sys
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "hotmart", ".env"))

BASE = os.environ.get("WP_BASE_URL", "https://academiadebelleza.edu.co").rstrip("/")
UA = "Mozilla/5.0 (compatible; AuditoriaSably/1.0)"
HOTMART_RE = re.compile(r"https?://(?:go\.hotmart\.com|hotm\.art|pay\.hotmart\.com)/[^\s\"'<>]+")

session = requests.Session()
session.headers["User-Agent"] = UA


def rest(path: str, params: dict | None = None):
    r = session.get(f"{BASE}/wp-json{path}", params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json()


def paginado(path: str, params: dict | None = None):
    """Itera todos los resultados de un endpoint paginado de wp-json."""
    page = 1
    while True:
        p = dict(params or {}, per_page=100, page=page)
        r = session.get(f"{BASE}/wp-json{path}", params=p, timeout=30)
        if r.status_code == 400:  # página fuera de rango
            return
        r.raise_for_status()
        batch = r.json()
        if not batch:
            return
        yield from batch
        total_pages = int(r.headers.get("X-WP-TotalPages", page))
        if page >= total_pages:
            return
        page += 1


def analizar_html(url: str) -> dict:
    """Extrae de una página: formularios, enlaces hotmart, señales de error."""
    r = session.get(url, timeout=30)
    soup = BeautifulSoup(r.text, "html.parser")
    formularios = []
    for f in soup.find_all("form"):
        formularios.append({
            "action": f.get("action"),
            "method": (f.get("method") or "get").lower(),
            "id": f.get("id"),
            "clases": " ".join(f.get("class", [])),
            "campos": [i.get("name") for i in f.find_all(["input", "select", "textarea"]) if i.get("name")],
        })
    hotmart_links = sorted(set(HOTMART_RE.findall(r.text)))
    problemas = []
    if r.status_code != 200:
        problemas.append(f"HTTP {r.status_code}")
    if "http://" in r.text and url.startswith("https://"):
        mixed = sorted(set(re.findall(r'src=["\'](http://[^"\']+)', r.text)))[:10]
        if mixed:
            problemas.append(f"mixed content: {mixed}")
    for patron in ("Fatal error", "Warning:", "Notice:", "jQuery is not defined", "Uncaught"):
        if patron in r.text:
            problemas.append(f"texto de error visible: {patron}")
    return {
        "url": url,
        "status": r.status_code,
        "titulo": soup.title.get_text(strip=True) if soup.title else None,
        "formularios": formularios,
        "enlaces_hotmart": hotmart_links,
        "problemas": problemas,
    }


def cmd_publico() -> None:
    out = {"base": BASE}
    # Identidad del sitio y rutas REST expuestas
    root = session.get(f"{BASE}/wp-json/", timeout=30).json()
    out["nombre"] = root.get("name")
    out["descripcion"] = root.get("description")
    out["namespaces"] = root.get("namespaces", [])  # plugins visibles: contact-form-7, elementor, acf...

    # Inventario de contenido
    tipos = rest("/wp/v2/types")
    out["tipos_contenido"] = list(tipos.keys())
    paginas = [
        {"id": p["id"], "link": p["link"], "titulo": p["title"]["rendered"], "modificado": p["modified"]}
        for p in paginado("/wp/v2/pages", {"_fields": "id,link,title,modified"})
    ]
    posts = [
        {"id": p["id"], "link": p["link"], "titulo": p["title"]["rendered"], "modificado": p["modified"]}
        for p in paginado("/wp/v2/posts", {"_fields": "id,link,title,modified"})
    ]
    out["paginas"] = paginas
    out["posts"] = posts
    print(f"Páginas: {len(paginas)} | Posts: {len(posts)} | Namespaces: {out['namespaces']}")

    # Análisis página por página: formularios + enlaces hotmart + errores
    analisis = []
    for p in paginas + posts:
        a = analizar_html(p["link"])
        analisis.append(a)
        marcas = []
        if a["enlaces_hotmart"]:
            marcas.append(f"hotmart×{len(a['enlaces_hotmart'])}")
        if a["formularios"]:
            marcas.append(f"forms×{len(a['formularios'])}")
        if a["problemas"]:
            marcas.append("⚠ " + "; ".join(a["problemas"]))
        print(f"- {a['url']} {' | '.join(marcas)}")
    out["analisis_paginas"] = analisis

    with open("wp_auditoria_publica.json", "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("Guardado en wp_auditoria_publica.json")


def login() -> None:
    user, pw = os.environ["WP_USER"], os.environ["WP_PASS"]
    session.get(f"{BASE}/wp-login.php", timeout=30)
    r = session.post(
        f"{BASE}/wp-login.php",
        data={
            "log": user, "pwd": pw, "wp-submit": "Log In",
            "redirect_to": f"{BASE}/wp-admin/", "testcookie": "1",
        },
        timeout=30,
    )
    if "wp-admin" not in r.url or "login" in r.url:
        raise SystemExit(f"Login fallido (URL final: {r.url}). Revisa WP_USER/WP_PASS o captcha/2FA.")
    print("Login OK →", r.url)


def cmd_admin() -> None:
    login()
    out = {}
    # Plugins instalados y su estado (parse de wp-admin/plugins.php)
    r = session.get(f"{BASE}/wp-admin/plugins.php", timeout=30)
    soup = BeautifulSoup(r.text, "html.parser")
    plugins = []
    for row in soup.select("table.plugins tr[data-slug]"):
        plugins.append({
            "slug": row.get("data-slug"),
            "activo": "active" in (row.get("class") or []),
            "version": (row.select_one(".plugin-version-author-uri") or {}).get_text(" ", strip=True)[:120]
            if row.select_one(".plugin-version-author-uri") else None,
        })
    out["plugins"] = plugins
    print(f"Plugins: {len(plugins)} ({sum(1 for p in plugins if p['activo'])} activos)")

    # Actualizaciones pendientes
    r = session.get(f"{BASE}/wp-admin/update-core.php", timeout=30)
    out["actualizaciones_html"] = BeautifulSoup(r.text, "html.parser").get_text(" ", strip=True)[:3000]

    # Salud del sitio
    r = session.get(f"{BASE}/wp-admin/site-health.php", timeout=30)
    out["site_health_html"] = BeautifulSoup(r.text, "html.parser").get_text(" ", strip=True)[:3000]

    # Usuarios
    r = session.get(f"{BASE}/wp-admin/users.php", timeout=30)
    soup = BeautifulSoup(r.text, "html.parser")
    out["usuarios"] = [u.get_text(strip=True) for u in soup.select("td.username strong")]

    with open("wp_auditoria_admin.json", "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("Guardado en wp_auditoria_admin.json")


def cmd_custom_fields() -> None:
    """Busca custom fields (post meta) que contengan enlaces de Hotmart.

    Los enlaces de redirección post-formulario suelen guardarse como custom
    fields (ACF u otros). Con login de admin, los leemos vía el editor:
    wp-admin/post.php?post=<id>&action=edit y también vía REST con contexto edit.
    """
    login()
    # Nonce REST para contexto edit
    r = session.get(f"{BASE}/wp-admin/", timeout=30)
    m = re.search(r'"nonce":"([a-f0-9]+)"', r.text) or re.search(r"wpApiSettings[^}]*nonce['\"]?:['\"]([a-f0-9]+)", r.text)
    headers = {"X-WP-Nonce": m.group(1)} if m else {}

    hallazgos = []
    for tipo in ("pages", "posts"):
        for p in paginado(f"/wp/v2/{tipo}", {"context": "edit" if headers else "view"}):
            texto = json.dumps(p, ensure_ascii=False)
            links = sorted(set(HOTMART_RE.findall(texto)))
            meta = p.get("meta") or {}
            acf = p.get("acf") or {}
            meta_links = {k: v for k, v in {**meta, **acf}.items() if isinstance(v, str) and HOTMART_RE.search(v)}
            if links or meta_links:
                hallazgos.append({
                    "id": p["id"], "tipo": tipo, "link": p.get("link"),
                    "titulo": (p.get("title") or {}).get("rendered"),
                    "enlaces_en_contenido": links,
                    "custom_fields_con_hotmart": meta_links,
                })
                print(f"- [{p['id']}] {p.get('link')}: {len(links)} en contenido, {len(meta_links)} en custom fields")

    with open("wp_custom_fields_hotmart.json", "w") as f:
        json.dump(hallazgos, f, indent=2, ensure_ascii=False)
    print(f"Total con enlaces Hotmart: {len(hallazgos)} → wp_custom_fields_hotmart.json")


COMMANDS = {"publico": cmd_publico, "admin": cmd_admin, "custom-fields": cmd_custom_fields}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(1)
    COMMANDS[sys.argv[1]]()
