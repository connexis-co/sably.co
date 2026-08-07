"""Correcciones puntuales al contenido generado que no requieren regenerarlo.

Salieron de una auditoría con varias lentes sobre las 919 variantes. Solo se
tocan los casos verificados uno a uno; lo dudoso se deja y se documenta, porque
una sustitución masiva sobre texto generado rompe frases con facilidad.

Uso:  python3 scripts/corregir-locales.py [--aplicar]
"""

import argparse
import json
import re
from pathlib import Path

D = Path('src/content/course-locales')

# 1. "curso de curso del negocio de las comidas rápidas": el título del MDX es
#    "Curso del Negocio de..." y el generador solo recortaba "Curso de ", así
#    que anteponía otro "curso de". Ya está corregido en el generador; aquí se
#    limpia lo que se publicó.
DOBLE_CURSO = re.compile(r'\bcurso de curso\b', re.I)

# 2. "validez curricular" es ambiguo: significa tanto "sirve para tu CV" (cierto)
#    como "reconocido por el sistema educativo" (falso). Las respuestas describen
#    lo primero, pero la pregunta invita a leer lo segundo. Se añade la
#    aclaración al final en vez de reescribir la respuesta, que es lo que no
#    puede romper la frase.
PREG_VALIDEZ = re.compile(r'validez (oficial|legal|curricular)|licencia|t[ií]tulo oficial|convalid', re.I)
AFIRMA = re.compile(r'^\s*(s[íi]\b|as[íi] es|efectivamente|por supuesto|claro que s[íi])', re.I)
ACLARACION = (
    ' Es un certificado de finalización emitido a través de Hotmart: acredita '
    'las horas cursadas ante clientes y empleadores, no es un título oficial '
    'ni una licencia profesional.'
)

# 3. Palabras repetidas seguidas ("técnica técnica").
DUPLICADA = re.compile(r'\b(\w{4,})(\s+)\1\b', re.I)


TEXTO = ('meta_title', 'meta_description', 'h1', 'subtitulo', 'descripcion',
         'certificado', 'garantia')
LISTAS = ('beneficios', 'para_quien', 'requisitos')


def corregir(d: dict) -> list[str]:
    hechos = []

    def limpia_doble(s: str) -> str:
        # Se conserva la mayúscula del primer "Curso": sustituir por una
        # constante en minúscula dejaba títulos empezando en minúscula.
        return DOBLE_CURSO.sub(lambda m: m.group(0).split()[0], s)

    for campo in TEXTO:
        if campo in d and DOBLE_CURSO.search(str(d[campo])):
            d[campo] = limpia_doble(d[campo])
            hechos.append(f'doble-curso:{campo}')
    for campo in LISTAS:
        if campo in d and any(DOBLE_CURSO.search(x) for x in d[campo]):
            d[campo] = [limpia_doble(x) for x in d[campo]]
            hechos.append(f'doble-curso:{campo}')
    for i, q in enumerate(d.get('faqs', [])):
        for k in ('q', 'a'):
            if DOBLE_CURSO.search(q[k]):
                q[k] = limpia_doble(q[k])
                hechos.append(f'doble-curso:faq{i}')

    for i, q in enumerate(d.get('faqs', [])):
        if PREG_VALIDEZ.search(q['q']) and AFIRMA.match(q['a']) and 'no es un título oficial' not in q['a']:
            q['a'] = q['a'].rstrip() + ACLARACION
            hechos.append(f'aclara-certificado:faq{i}')

    for campo in ('descripcion', 'subtitulo'):
        if campo in d:
            nuevo = DUPLICADA.sub(r'\1', d[campo])
            if nuevo != d[campo]:
                d[campo] = nuevo
                hechos.append(f'palabra-duplicada:{campo}')

    return hechos


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--aplicar', action='store_true')
    args = ap.parse_args()

    from collections import Counter
    total = Counter()
    tocados = 0
    for f in sorted(D.glob('*.json')):
        d = json.loads(f.read_text())
        hechos = corregir(d)
        if not hechos:
            continue
        tocados += 1
        for h in hechos:
            total[h.split(':')[0]] += 1
        if args.aplicar:
            f.write_text(json.dumps(d, ensure_ascii=False, indent=2))

    print(f'{tocados} archivos con correcciones\n')
    for k, n in total.most_common():
        print(f'  {k:<24}{n:>4}')
    if not args.aplicar:
        print('\n(sin --aplicar no se escribió nada)')


if __name__ == '__main__':
    main()
