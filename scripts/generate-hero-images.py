"""Imagen de héroe por país: collage de oficios recortado para el home.

Se coloca a la derecha del texto en la home de cada país (patrón EDteam).
Salida: public/heroes/{cc}.png (transparente si el modelo lo soporta) + .webp.

Uso:
  python3 scripts/generate-hero-images.py --only co     # prueba con un país
  python3 scripts/generate-hero-images.py               # todos
"""

import argparse
import base64
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

MODEL = 'nano-banana-pro-preview'
FALLBACK = 'gemini-3.1-flash-image'

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())
KEY = os.environ['GEMINI_API_KEY']

BASE = (
    'Composición publicitaria de 5 personas latinas adultas de oficios distintos, agrupadas en '
    'dos filas (3 adelante de cuerpo entero hasta las rodillas, 2 atrás asomando entre ellas), '
    'sonriendo con confianza y mirando a cámara. Cada una con su ropa de trabajo y la herramienta '
    'de su oficio en las manos. Alrededor del grupo, flotando en el aire con ligereza, algunos '
    'objetos sueltos del mismo oficio a modo de collage dinámico. '
    'FONDO DE UN VERDE CROMA PURO Y UNIFORME (#00B140) que cubre todo el lienzo de borde a borde, '
    'sin degradados, sin viñeta, sin suelo ni horizonte, sin sombras proyectadas sobre el fondo. '
    'Nadie viste prendas verdes y ningún objeto es verde. Fotografía publicitaria de estudio, luz '
    'cálida, colores vivos, contornos nítidos, márgenes libres alrededor de la composición. '
    'SIN texto, SIN logos, SIN marcas de agua, SIN patrón de cuadros.'
)

# El modelo NO produce canal alfa: si se le pide "fondo transparente" dibuja el damero
# de Photoshop como píxeles. Por eso se genera sobre croma verde y el recorte se hace
# aquí con PIL, que sí deja un PNG con alfa real utilizable sobre cualquier fondo.
CHROMA = (0x00, 0xB1, 0x40)
TOLERANCIA = 105

# Oficios distintos por país para que ninguna home se vea igual
PAISES = {
    'co': ('un barbero con tijeras, una panadera con una hogaza de pan artesanal, un electricista '
           'con multímetro, una manicurista con esmaltes y un mecánico de motos con llave',
           'tijeras de barbero, panes, un multímetro y frascos de esmalte'),
    'mx': ('una decoradora con globos de colores, un chef con sartén, una repostera con cupcakes, '
           'un barbero con navaja y una costurera con tijeras de tela',
           'globos de colores, cupcakes, una sartén y carretes de hilo'),
    'pe': ('una estilista de uñas con lámpara UV, un barista con taza de café latte art, una '
           'costurera con metro de sastre, un soldador con careta levantada y una masajista con toallas',
           'una taza de café, esmaltes, un metro de sastre y piedras de masaje'),
    'ec': ('un mecánico de motos con llave inglesa, una repostera con una torta decorada, una '
           'peluquera con secador, un carpintero con formón y un instructor de yoga con esterilla',
           'una torta decorada, llaves de mecánico, un secador y una esterilla enrollada'),
    'cl': ('un soldador con careta levantada, una diseñadora de modas con tela, un peluquero canino '
           'con un perro pequeño, una chef con cuchillo y un electricista con cables',
           'una careta de soldar, rollos de tela, un cepillo de grooming y cables de colores'),
    'ar': ('un parrillero con pinzas, una maquilladora con brochas, un carpintero con formón, una '
           'panadera con facturas y un bartender con coctelera',
           'pinzas de parrilla, brochas de maquillaje, facturas y una coctelera'),
    'es': ('un fontanero con llave de tubo, una pastelera con manga pastelera, un tatuador con '
           'máquina, una peluquera con tijeras y un instructor de inglés con libro',
           'una llave de tubo, una manga pastelera, tijeras y libros'),
    'us': ('una barbera con máquina de cortar, un instructor de inglés con libro, un bartender con '
           'coctelera, una nail artist con pinceles y un chef con sartén',
           'una máquina de cortar cabello, libros, una coctelera y pinceles de uñas'),
}



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


def recortar(src: Path, dest: Path) -> None:
    """Quita el croma verde y deja alfa real, con borde suavizado."""
    from PIL import Image, ImageFilter

    img = Image.open(src).convert('RGBA')
    px = img.load()
    w, h = img.size
    cr, cg, cb = CHROMA
    mask = Image.new('L', (w, h), 255)
    mpx = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            # Verde dominante y cercano al croma → fondo
            if g > r + 40 and g > b + 40 and abs(r - cr) + abs(g - cg) + abs(b - cb) < TOLERANCIA * 3:
                mpx[x, y] = 0
    # Suavizar el borde para que no quede aserrado
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    img.putalpha(mask)
    img = img.resize((900, round(900 * h / w)), Image.LANCZOS)
    img.save(dest, 'PNG', optimize=True)


def has_alpha(path: Path) -> bool:
    out = subprocess.run(['sips', '-g', 'hasAlpha', str(path)], capture_output=True, text=True)
    return 'yes' in out.stdout.lower()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', help='Código de país (co, mx…)')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()

    out = Path('public/heroes')
    out.mkdir(parents=True, exist_ok=True)
    items = {args.only: PAISES[args.only]} if args.only else PAISES

    for cc, (oficios, objetos) in items.items():
        dest = out / f'{cc}.png'
        if dest.exists() and not args.force:
            print(f'skip {cc}')
            continue
        prompt = f'{BASE}\n\nLas cinco personas son: {oficios}.\nLos objetos flotantes son: {objetos}.'
        raw = None
        for model in (MODEL, FALLBACK):
            try:
                raw = generate(prompt, model)
                break
            except Exception as e:  # noqa: BLE001
                print(f'  {cc} con {model}: {str(e)[:80]}')
                time.sleep(3)
        if not raw:
            continue
        tmp = out / f'{cc}-raw.png'
        tmp.write_bytes(raw)
        recortar(tmp, dest)
        tmp.unlink()
        kb = dest.stat().st_size // 1024
        print(f'✓ {cc}: {kb}KB · alfa: {"SÍ" if has_alpha(dest) else "NO"}')
        time.sleep(1.5)


if __name__ == '__main__':
    main()
