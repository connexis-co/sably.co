"""Genera portadas fotorrealistas por categoría con Gemini y las comprime.

Lee GEMINI_API_KEY desde .env (el secreto no pasa por la CLI).
Salida: public/covers/{slug}.jpg (~800px, calidad 72).
"""

import base64
import json
import os
import subprocess
import urllib.request
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

KEY = os.environ['GEMINI_API_KEY']
MODEL = 'gemini-3.1-flash-image'
URL = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent'

BASE_STYLE = (
    'Fotografía hiperrealista profesional, iluminación cálida natural, estilo editorial '
    'premium para un sitio de cursos online latinoamericano. Manos latinas trabajando, '
    'primer plano con profundidad de campo. SIN texto, SIN logos, SIN marcas de agua. '
    'Composición horizontal 3:2.'
)

SCENES = {
    'belleza': 'Manicurista profesional aplicando esmalte en un salón de belleza elegante con tonos dorados y rosas',
    'panaderia-y-pasteleria': 'Manos de panadero amasando masa madre sobre mesa de madera enharinada, hogazas doradas al fondo',
    'gastronomia': 'Chef emplatando un plato gourmet colorido en cocina profesional, vapor y llamas de fondo',
    'oficios': 'Electricista instalando un tablero eléctrico residencial con herramientas profesionales, chispas de soldadura al fondo',
    'moda-y-confeccion': 'Costurera cosiendo tela vibrante en máquina de coser profesional, hilos de colores y patrones alrededor',
    'bienestar': 'Masajista dando masaje relajante con piedras calientes en spa sereno con velas y plantas',
    'manualidades': 'Artesana vertiendo cera en moldes de velas junto a jabones artesanales y flores secas',
    'emprendimiento': 'Joven emprendedora latina gestionando su tienda online desde laptop en taller propio con productos empacados',
    'cuidado-animal': 'Peluquera canina recortando el pelo de un perro golden feliz en grooming profesional',
    'idiomas': 'Estudiante latina practicando inglés con audífonos frente a laptop con notas de vocabulario, ambiente luminoso de estudio',
    'musica': 'Manos tocando guitarra acústica junto a piano y micrófono de estudio en home studio cálido',
    'hospitalidad': 'Bartender preparando un coctel colorido con hielo y fuego en barra elegante de madera',
}

out_dir = Path('public/covers')
out_dir.mkdir(parents=True, exist_ok=True)

for slug, scene in SCENES.items():
    dest = out_dir / f'{slug}.jpg'
    if dest.exists():
        print(f'skip {slug} (ya existe)')
        continue
    body = json.dumps({
        'contents': [{'parts': [{'text': f'{scene}. {BASE_STYLE}'}]}],
        'generationConfig': {'responseModalities': ['IMAGE']},
    }).encode()
    req = urllib.request.Request(
        URL, data=body, method='POST',
        headers={'x-goog-api-key': KEY, 'Content-Type': 'application/json'},
    )
    try:
        resp = json.load(urllib.request.urlopen(req, timeout=120))
        parts = resp['candidates'][0]['content']['parts']
        img_b64 = next(p['inlineData']['data'] for p in parts if 'inlineData' in p)
        raw = out_dir / f'{slug}.png'
        raw.write_bytes(base64.b64decode(img_b64))
        subprocess.run(
            ['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72',
             '--resampleWidth', '800', str(raw), '--out', str(dest)],
            check=True, capture_output=True,
        )
        raw.unlink()
        print(f'{slug}: {dest.stat().st_size // 1024}KB')
    except Exception as e:  # noqa: BLE001
        print(f'ERROR {slug}: {e}')

print('listo')
