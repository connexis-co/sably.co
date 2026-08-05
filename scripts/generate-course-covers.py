"""Portada fotorrealista ÚNICA por curso con Gemini (nano-banana).

Lee título+categoría del frontmatter y genera public/covers/cursos/{slug}.jpg
(800px) + {slug}-card.jpg (480px). Idempotente: salta las existentes.
Los componentes hacen fallback a la portada de categoría si falta alguna.
"""

import base64
import json
import os
import re
import subprocess
import time
import urllib.request
from pathlib import Path

MODEL = 'nano-banana-pro-preview'
FALLBACK_MODEL = 'gemini-3.1-flash-image'

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())
KEY = os.environ['GEMINI_API_KEY']

STYLE = (
    'Fotografía hiperrealista profesional, iluminación cálida natural, estilo editorial premium, '
    'manos latinas trabajando en primer plano con profundidad de campo. SIN texto, SIN logos, '
    'SIN marcas de agua, SIN rostros reconocibles en primer plano. Composición horizontal 3:2.'
)

CATEGORY_CONTEXT = {
    'belleza-online': 'ambiente de estudio de belleza luminoso',
    'panaderia-y-pasteleria': 'cocina artesanal con mesa de madera',
    'gastronomia': 'cocina profesional',
    'oficios': 'taller técnico con herramientas',
    'moda-y-confeccion': 'taller de costura con telas',
    'bienestar': 'espacio sereno de bienestar',
    'manualidades': 'mesa de taller creativo',
    'emprendimiento': 'espacio de trabajo emprendedor con laptop',
    'cuidado-animal': 'espacio de cuidado de mascotas',
    'idiomas': 'espacio de estudio luminoso',
    'musica': 'home studio musical cálido',
    'hospitalidad': 'ambiente de hospitalidad elegante',
}


def scene_for(title: str, category: str) -> str:
    tema = re.sub(r'^(Curso de |Diplomado (en |de )?)', '', title, flags=re.I)
    ctx = CATEGORY_CONTEXT.get(category, 'ambiente profesional')
    return (
        f'Escena real y específica de "{tema}": una persona practicando exactamente esa '
        f'habilidad, {ctx}. Los objetos y acciones deben corresponder al tema exacto '
        f'(no genéricos de la categoría). {STYLE}'
    )


def generate(prompt: str, model: str) -> bytes:
    body = json.dumps({
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'responseModalities': ['IMAGE']},
    }).encode()
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        data=body, method='POST',
        headers={'x-goog-api-key': KEY, 'Content-Type': 'application/json'},
    )
    resp = json.load(urllib.request.urlopen(req, timeout=180))
    part = next(p for p in resp['candidates'][0]['content']['parts'] if 'inlineData' in p)
    return base64.b64decode(part['inlineData']['data'])


def main() -> None:
    out = Path('public/covers/cursos')
    out.mkdir(parents=True, exist_ok=True)
    files = sorted(Path('src/content/courses').glob('*.mdx'))
    ok = skip = err = 0
    for f in files:
        slug = f.stem
        dest = out / f'{slug}.jpg'
        if dest.exists():
            skip += 1
            continue
        text = f.read_text()
        title = re.search(r'^title: (.+)$', text, re.M).group(1).strip()
        category = re.search(r'^category: (.+)$', text, re.M).group(1).strip()
        prompt = scene_for(title, category)
        raw = out / f'{slug}.png'
        for model in (MODEL, FALLBACK_MODEL):
            try:
                raw.write_bytes(generate(prompt, model))
                break
            except Exception as e:  # noqa: BLE001
                if model == FALLBACK_MODEL:
                    print(f'ERR {slug}: {str(e)[:90]}')
                    err += 1
                    raw.unlink(missing_ok=True)
                time.sleep(3)
        if not raw.exists():
            continue
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '70',
                        '--resampleWidth', '800', str(raw), '--out', str(dest)],
                       check=True, capture_output=True)
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '66',
                        '--resampleWidth', '480', str(raw), '--out', str(out / f'{slug}-card.jpg')],
                       check=True, capture_output=True)
        raw.unlink()
        ok += 1
        print(f'✓ {slug} ({dest.stat().st_size // 1024}KB)')
        time.sleep(1.2)
    print(f'\nGeneradas {ok} · existentes {skip} · errores {err}')


if __name__ == '__main__':
    main()
