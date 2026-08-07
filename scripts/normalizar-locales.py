"""Normaliza y audita el formato de las variantes por país.

El modelo devuelve el markdown de dos formas incompatibles: unas veces con
saltos de línea reales y otras con la secuencia barra-n escapada como texto.
En el segundo caso la landing sale como un único párrafo con los `###` a la
vista, que es el fallo que se vio en producción.

Aquí se arregla lo que es reparable sin inventar (des-escapar los saltos) y se
listan los que no lo son: cuando el markdown viene TODO en una línea, el límite
de cada encabezado es ambiguo ("...18 lecciones El curso...") y reconstruirlo
con heurística inventaría títulos. Esos se regeneran.

Uso:
  python3 scripts/normalizar-locales.py --auditar   # solo informa
  python3 scripts/normalizar-locales.py --arreglar  # des-escapa y reporta
"""

import argparse
import json
import re
from pathlib import Path

DIR = Path('src/content/course-locales')
CAMPOS_TEXTO = ('h1', 'subtitulo', 'meta_title', 'meta_description', 'certificado', 'garantia')
CAMPOS_LISTA = ('beneficios', 'para_quien', 'requisitos')


def desescapar(s: str) -> str:
    return s.replace('\\r\\n', '\n').replace('\\n', '\n').replace('\\r', '\n').replace('\\t', ' ')


def limpiar_plano(s: str) -> str:
    """Campos que se pintan como texto plano: sin markdown ni saltos escapados."""
    return re.sub(r'\s+', ' ', desescapar(s).replace('**', '').replace('##', '')).strip()


def diagnostico(desc: str) -> str | None:
    tiene_saltos = '\n' in desc
    if '\\n' in desc or '\\r' in desc:
        return 'escapado'          # reparable: des-escapar
    if not tiene_saltos:
        # Sin un solo salto la página sale como un párrafo único de miles de
        # caracteres. Si además trae encabezados, su límite es ambiguo
        # ("...18 lecciones El curso...") y reconstruirlo inventaría títulos.
        return 'una-linea'
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--arreglar', action='store_true')
    ap.add_argument('--auditar', action='store_true')
    args = ap.parse_args()

    reparados, irreparables, limpiados = [], [], []

    for f in sorted(DIR.glob('*.json')):
        d = json.loads(f.read_text())
        antes = json.dumps(d, ensure_ascii=False, sort_keys=True)

        estado = diagnostico(d['descripcion'])
        if estado == 'escapado':
            d['descripcion'] = desescapar(d['descripcion'])
            reparados.append(f.stem)
        elif estado == 'una-linea':
            irreparables.append(f.stem)

        # Los campos planos nunca deben llevar markdown ni saltos escapados.
        for c in CAMPOS_TEXTO:
            if c in d:
                d[c] = limpiar_plano(str(d[c]))
        for c in CAMPOS_LISTA:
            if c in d:
                d[c] = [limpiar_plano(x) for x in d[c]]
        d['faqs'] = [{'q': limpiar_plano(x['q']), 'a': limpiar_plano(x['a'])} for x in d.get('faqs', [])]

        if json.dumps(d, ensure_ascii=False, sort_keys=True) != antes:
            limpiados.append(f.stem)
            if args.arreglar:
                f.write_text(json.dumps(d, ensure_ascii=False, indent=2))

    print(f'{len(list(DIR.glob("*.json")))} variantes revisadas\n')
    print(f'  saltos des-escapados      {len(reparados):>4}')
    print(f'  archivos tocados en total {len(limpiados):>4}')
    print(f'  irreparables (regenerar)  {len(irreparables):>4}')
    if irreparables:
        Path('/tmp/regenerar.txt').write_text('\n'.join(irreparables))
        print('\n  lista en /tmp/regenerar.txt · ejemplos:')
        for s in irreparables[:5]:
            print(f'    {s}')
    if not args.arreglar:
        print('\n(sin --arreglar no se escribió nada)')


if __name__ == '__main__':
    main()
