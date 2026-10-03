#!/usr/bin/env python3
"""Overlays 1080x1920 para los anuncios verticales de Meta (Reels/Stories).

En Stories/Reels el texto del anuncio NO se muestra: si el mensaje no va quemado
en el video, el anuncio queda mudo (que es justo lo que pasaba). Este script arma
la capa: logo real arriba, titular y oferta abajo, con degradados para legibilidad.

Zonas seguras de Instagram: los primeros ~250px los tapa el perfil y los últimos
~250px el botón de CTA. Todo el texto vive entre esos límites.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

BRAND = os.path.expanduser("~/Documents/JP Projects/sably.co/brand")
OUT = os.environ.get("VERT_DIR", "/private/tmp/claude-501/-Users-jpmisat-Documents-JP-Projects-sably-co/5f29e299-ac62-468a-a79a-d79f903ab867/scratchpad/videos-vertical")
W, H = 1080, 1920
GOLD = (222, 184, 120, 255)
WHITE = (255, 255, 255, 255)
ACCENT = (232, 62, 106, 255)

S, SUP = "/System/Library/Fonts", "/System/Library/Fonts/Supplemental"

def font(size, bold=True):
    for p, idx in [(f"{S}/HelveticaNeue.ttc", 1 if bold else 0), (f"{SUP}/Arial Bold.ttf", 0), (f"{SUP}/Georgia Bold.ttf", 0)]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size, index=idx)
            except Exception:
                continue
    return ImageFont.load_default()

def fit(draw, text, max_w, start, bold=True):
    size = start
    while size > 20:
        f = font(size, bold)
        if max(draw.textlength(l, font=f) for l in text.split("\n")) <= max_w:
            return f
        size -= 4
    return font(20, bold)

def scrim(img, y0, y1, top_down=True, strength=205):
    """Degradado negro para que el texto se lea sobre cualquier fotograma."""
    band = Image.new("RGBA", (W, y1 - y0), (0, 0, 0, 0))
    d = ImageDraw.Draw(band)
    n = y1 - y0
    for i in range(n):
        a = int(strength * ((i / n) if top_down else (1 - i / n)) ** 1.4)
        d.line([(0, i), (W, i)], fill=(10, 10, 24, a))
    img.alpha_composite(band, (0, y0))

def build(slug, titular):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    scrim(img, 0, 620, top_down=False)      # oscurece arriba (más fuerte en el borde)
    scrim(img, 1180, H, top_down=True)      # oscurece abajo
    d = ImageDraw.Draw(img)

    # Logo real arriba, bajo el chrome de Instagram
    logo = Image.open(f"{BRAND}/sably-logo-white.png").convert("RGBA")
    lw = 420
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    img.alpha_composite(logo, ((W - lw) // 2, 300))

    # Titular
    f_t = fit(d, titular, W - 150, 92)
    y = 1330
    for line in titular.split("\n"):
        tw = d.textlength(line, font=f_t)
        d.text(((W - tw) / 2, y), line, font=f_t, fill=WHITE,
               stroke_width=3, stroke_fill=(10, 10, 24, 190))
        y += int(f_t.size * 1.16)

    # Píldora de oferta
    f_b = font(46)
    txt = "50% DE DESCUENTO HOY"
    bw = d.textlength(txt, font=f_b)
    pad_x, pad_y = 44, 22
    bx0, by0 = (W - bw) / 2 - pad_x, y + 34
    d.rounded_rectangle([bx0, by0, bx0 + bw + pad_x * 2, by0 + f_b.size + pad_y * 2],
                        radius=60, fill=ACCENT)
    d.text(((W - bw) / 2, by0 + pad_y - 4), txt, font=f_b, fill=WHITE)

    # Refuerzos de la oferta
    f_s = font(40, bold=False)
    sub = "Certificado · Acceso de por vida"
    sw = d.textlength(sub, font=f_s)
    d.text(((W - sw) / 2, by0 + f_b.size + pad_y * 2 + 26), sub, font=f_s, fill=GOLD)

    os.makedirs(OUT, exist_ok=True)
    path = f"{OUT}/{slug}-overlay.png"
    img.save(path, "PNG")
    return path

if __name__ == "__main__":
    import json
    pares = json.loads(sys.argv[1]) if len(sys.argv) > 1 else []
    for slug, titular in pares:
        print("✓", os.path.basename(build(slug, titular)))
