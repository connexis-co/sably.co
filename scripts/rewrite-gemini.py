"""Reescritura de contenido con Gemini API orientada a keywords (prompt maestro §10).

Reescribe la descripción (cuerpo MDX) de un curso integrando las keywords objetivo
de Ubersuggest/Keyword Planner, siguiendo las reglas anti-duplicación del plan.

Uso:
  python3 scripts/rewrite-gemini.py src/content/courses/curso-de-barberia.mdx \
      --keywords "curso de barbería online" "curso de barbería con certificado" \
      --dry-run          # muestra sin escribir

Reglas aplicadas (del prompt maestro):
- Keyword principal en primer y último párrafo, integración natural (sin stuffing).
- 150-250 palabras, tono profesional-cercano, español LATAM.
- Nunca frases plantilla ni texto que suene a IA.
"""

import argparse
import json
import os
import re
import urllib.request
from pathlib import Path

MODEL = 'gemini-3.5-flash'

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())


def rewrite(body: str, title: str, keywords: list[str]) -> str:
    prompt = f"""Eres redactor senior de Sably (cursos online de oficios, LATAM). Reescribe la descripción
de este curso integrando las keywords objetivo de forma NATURAL.

CURSO: {title}
KEYWORDS OBJETIVO (la primera es la principal): {json.dumps(keywords, ensure_ascii=False)}

REGLAS ESTRICTAS:
- Keyword principal en el primer párrafo y en el último, sin forzar. Densidad ≤2%.
- Mantén la estructura EXACTA: intro (2 párrafos), luego "### Un oficio que la IA no puede tocar"
  (1 párrafo), luego "### Del hobby al negocio" (1 párrafo). Sin H1 ni H2.
- 150-250 palabras. Español neutro LATAM, profesional pero cercano. Cero frases infladas
  ("desbloquea tu potencial"), cero listas, cero texto que suene a IA.
- Conserva los datos concretos del original (precios de mercado, cifras) si los hay.

TEXTO ORIGINAL:
{body}

Responde SOLO con el texto reescrito en el mismo formato markdown."""

    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
        data=json.dumps({'contents': [{'parts': [{'text': prompt}]}]}).encode(),
        headers={'x-goog-api-key': os.environ['GEMINI_API_KEY'], 'Content-Type': 'application/json'},
        method='POST',
    )
    resp = json.load(urllib.request.urlopen(req, timeout=120))
    return resp['candidates'][0]['content']['parts'][0]['text'].strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('file')
    parser.add_argument('--keywords', nargs='+', required=True)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    path = Path(args.file)
    text = path.read_text()
    m = re.match(r'^(---\n.*?\n---\n)(.*)$', text, re.S)
    if not m:
        raise SystemExit('El archivo no tiene frontmatter válido')
    frontmatter, body = m.groups()
    title_m = re.search(r'^title: (.+)$', frontmatter, re.M)
    title = title_m.group(1) if title_m else path.stem

    nuevo = rewrite(body.strip(), title, args.keywords)
    palabras = len(nuevo.split())
    print(f'--- Reescrito ({palabras} palabras) ---\n{nuevo}\n')
    if palabras < 120 or palabras > 300:
        print('⚠️  Fuera del rango 150-250 palabras — revisar antes de usar')
    if args.dry_run:
        print('(dry-run: no se escribió)')
        return
    path.write_text(frontmatter + '\n' + nuevo + '\n')
    print(f'✓ {path}')


if __name__ == '__main__':
    main()
