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
    # Solo cuando la PÁGINA promete el ingreso. Aconsejar al alumno cómo
    # asegurarse ingresos con su propio negocio no es una promesa del curso,
    # y las frases negadas ya se filtran antes de llegar aquí.
    'garantía de ingresos':
        r'(este curso|el curso|el programa|la formaci[óo]n|te)\s+'
        r'(asegur|garantiz)\w*[^.]{0,45}(ingres|ganancia|clientela|trabajo fijo)',
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


NIEGA = re.compile(r'\b(no|ni|nunca|jam[áa]s|sin)\b', re.I)


def afirmaciones(d: dict) -> list[str]:
    """Frases donde la página AFIRMA algo, listas para contrastar.

    Auditar el JSON crudo como un solo bloque producía falsos positivos: una
    pregunta de FAQ ("¿me garantiza ingresos?") respondida con "No" salía
    marcada como promesa. Aquí las preguntas se descartan, las respuestas
    negativas también, y cada frase se evalúa suelta para que la negación de
    una no tape la afirmación de la siguiente.
    """
    piezas = [d.get('descripcion', ''), d.get('subtitulo', ''), d.get('h1', ''),
              *d.get('beneficios', []), *d.get('para_quien', []), *d.get('requisitos', [])]
    for q in d.get('faqs', []):
        # La pregunta no afirma nada, y si la respuesta arranca negando, la
        # página está poniendo techo a las expectativas, que es lo que se pide.
        if not re.match(r'\s*(no\b|nunca\b|jam[áa]s\b)', q.get('a', ''), re.I):
            piezas.append(q.get('a', ''))
    frases = []
    for p in piezas:
        frases += [f.strip() for f in re.split(r'(?<=[.!?])\s+|\n', p) if f.strip()]
    return [f for f in frases if not NIEGA.search(f)]


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
        frases = afirmaciones(d)
        inst = re.escape(instructores.get(d.get('course', ''), '\x00'))
        for nombre, patron in RIESGOS.items():
            pat = re.compile(patron.replace('{instructor}', inst), re.I | re.M)
            hit = next((pat.search(fr) for fr in frases if pat.search(fr)), None)
            if hit:
                total[nombre] += 1
                ejemplos.setdefault(nombre, []).append((f.stem, hit.group()[:110]))
        if d.get('country') == 'ar':
            todo = ' '.join([d.get('descripcion', ''),
                             *(q['q'] + ' ' + q['a'] for q in d.get('faqs', []))])
            tu, vos = len(TUTEO.findall(todo)), len(VOSEO.findall(todo))
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
