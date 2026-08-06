"""Difumina los bordes de los heroes donde el modelo cortó la composición.

El generador recorta piernas y objetos contra el marco. En vez de reintentar
hasta que salga con margen (el modelo no lo garantiza), se desvanece el alfa
en los bordes que tienen contenido: lo cortado se funde con el fondo del hero
en lugar de terminar en seco.

Idempotente por medición: solo actúa sobre los bordes que superan el umbral.
"""

from pathlib import Path

from PIL import Image

UMBRAL = 5          # % de píxeles con contenido en el borde para considerarlo cortado
FADE_ABAJO = 0.28   # el desvanecido inferior es largo: disuelve piernas/torsos
FADE_LADOS = 0.10   # laterales y superior: cortos, para objetos flotantes clipados


def borde_ocupado(alpha: Image.Image, lado: str) -> int:
    w, h = alpha.size
    if lado == 'top':
        return sum(1 for x in range(w) if alpha.getpixel((x, 1)) > 30) * 100 // w
    if lado == 'bottom':
        return sum(1 for x in range(w) if alpha.getpixel((x, h - 2)) > 30) * 100 // w
    if lado == 'left':
        return sum(1 for y in range(h) if alpha.getpixel((1, y)) > 30) * 100 // h
    return sum(1 for y in range(h) if alpha.getpixel((w - 2, y)) > 30) * 100 // h


def aplicar(path: Path) -> str:
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    alpha = img.split()[3]
    lados = {l: borde_ocupado(alpha, l) for l in ('top', 'bottom', 'left', 'right')}
    afectados = [l for l, pct in lados.items() if pct > UMBRAL]
    if not afectados:
        return 'sin cortes'

    px = alpha.load()
    for lado in afectados:
        span = int((h if lado in ('top', 'bottom') else w) * (FADE_ABAJO if lado == 'bottom' else FADE_LADOS))
        if span < 2:
            continue
        for i in range(span):
            # Curva suave (ease-in cuadrática): el desvanecido no tiene bordes duros
            t = i / span
            factor = t * t
            if lado == 'bottom':
                y = h - 1 - i
                for x in range(w):
                    px[x, y] = int(px[x, y] * factor)
            elif lado == 'top':
                for x in range(w):
                    px[x, i] = int(px[x, i] * factor)
            elif lado == 'left':
                for y in range(h):
                    px[i, y] = int(px[i, y] * factor)
            else:
                x = w - 1 - i
                for y in range(h):
                    px[x, y] = int(px[x, y] * factor)

    img.putalpha(alpha)
    img.save(path, 'WEBP', quality=82, method=6)
    return 'difuminado: ' + ', '.join(f'{l} ({lados[l]}%)' for l in afectados)


def main() -> None:
    for f in sorted(Path('public/heroes').glob('*.webp')):
        print(f'{f.stem}: {aplicar(f)}')


if __name__ == '__main__':
    main()
