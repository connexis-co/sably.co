"""Audita las variantes buscando afirmaciones que no podemos respaldar.

Los patrones salen de un duelo a ciegas entre dos redactores (ver
docs/DUELO_REDACTORES.md): son exactamente los inventos que cometió cada uno.
Un texto algo más plano cuesta menos que un dato falso publicado, así que esto
corre antes de desplegar.

No modifica nada: informa y devuelve código 1 si encuentra algo, para poder
encadenarlo en CI.

Uso:  python3 scripts/auditar-calidad.py [--detalle]
"""

import argparse
import importlib.util
import json
import re
import sys
from collections import Counter
from pathlib import Path

_spec = importlib.util.spec_from_file_location('gc', Path(__file__).parent / 'generar-contenido.py')
gc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gc)

D = Path('src/content/course-locales')

# {nombre: patrón}. `{instructor}` se sustituye por el nombre real del curso.
RIESGOS = {
    'biografía inventada del instructor':
        r'{instructor}[^.]{{0,70}}(a[ñn]os de|lleva \d|desde hace|trayectoria|experiencia de)',
    'prueba social inventada':
        r'(varios|muchos|la mayor[íi]a de los)\s+alumnos[^.]{0,60}(cobran|logran|consiguen|reportan)',
    'cifra de mercado sin fuente':
        r'\d[\d.,]*\s*(pesos|d[óo]lares|euros|soles)[^.]{0,30}(por (corte|servicio|hora|evento)|el corte)',
    'plazo de retorno prometido':
        r'recuper\w+[^.]{0,45}(inversi[óo]n|en pocas semanas|en \d+ meses)',
    # El "no/ni" delante es la anti-promesa que sí se pide ("ni te garantiza
    # ingresos fijos"), así que solo cuenta la afirmación sin negar.
    'garantía de ingresos':
        r'(?<!no )(?<!ni )(?<!no te )(?<!ni te )(asegur|garantiz)\w*[^.]{0,45}'
        r'(ingres|ganancia|clientela|trabajo fijo)',
    'descuento adicional inexistente':
        r'(aplica|ingresa|introduce)\w*[^.]{0,45}cup[óo]n[^.]{0,45}(para|y)\s+(obtener|conseguir|acceder)',
    'certificado con validez oficial':
        r'(s[íi]|efectivamente)[^.]{0,40}validez (oficial|legal|curricular)(?![^.]{0,120}no es un)',
    'repite el temario de la plantilla':
        r'(^|\n)#{2,4} *M[óo]dulo\s*\d',
}

# El voseo argentino se comprueba aparte: es conteo, no coincidencia.
TUTEO = re.compile(r'\b(puedes|tienes|quieres|sabes|recibes|debes|necesitas)\b', re.I)
VOSEO = re.compile(r'\b(pod[ée]s|ten[ée]s|quer[ée]s|sab[ée]s|recib[ií]s|deb[ée]s|necesit[áa]s)\b', re.I)


def texto_de(d: dict) -> str:
    return ' '.join([
        d.get('descripcion', ''), d.get('subtitulo', ''), d.get('h1', ''),
        *(f"{q['q']} {q['a']}" for q in d.get('faqs', [])),
        *d.get('beneficios', []), *d.get('para_quien', []), *d.get('requisitos', []),
    ])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--detalle', action='store_true')
    args = ap.parse_args()

    instructores = {}
    for m in Path('src/content/courses').glob('*.mdx'):
        instructores[m.stem] = gc.frontmatter(m.stem)['instructor']

    total = Counter()
    ejemplos: dict[str, list] = {}
    archivos = sorted(D.glob('*.json'))

    for f in archivos:
        d = json.loads(f.read_text())
        t = texto_de(d)
        inst = re.escape(instructores.get(d.get('course', ''), '\x00'))
        for nombre, patron in RIESGOS.items():
            m = re.search(patron.replace('{instructor}', inst), t, re.I | re.M)
            if m:
                total[nombre] += 1
                ejemplos.setdefault(nombre, []).append((f.stem, m.group()[:110]))
        if d.get('country') == 'ar':
            tu, vos = len(TUTEO.findall(t)), len(VOSEO.findall(t))
            if tu > vos:
                total['Argentina sin vosear'] += 1
                ejemplos.setdefault('Argentina sin vosear', []).append((f.stem, f'tuteo {tu} vs voseo {vos}'))

    print(f'{len(archivos)} variantes auditadas\n')
    if not total:
        print('  ✅ ningún riesgo detectado')
        return
    for k, v in total.most_common():
        print(f'  {k:<38}{v:>5}')
        if args.detalle:
            for s, frag in ejemplos[k][:3]:
                print(f'      {s}: …{frag}…')
    sys.exit(1)


if __name__ == '__main__':
    main()
