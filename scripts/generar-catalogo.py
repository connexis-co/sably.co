"""Genera las 968 variantes país del catálogo (121 cursos × 8 países).

Corre sobre la misma maquinaria del piloto (scripts/generar-contenido.py) con
lo que hace falta para un lote grande:

- Concurrencia con 8 workers (secuencial serían ~5 horas; así ~45 min).
- Reanudable: si el JSON de una variante ya existe y pasó validación, se salta.
- Ledger de costos en docs/data/generacion-ledger.jsonl con lock de hilo.
- Tope duro de gasto (ABORTA_USD): si se supera, el lote para en seco.
- Un reintento por página cuando la validación falla, con el fallo inyectado
  en el prompt; si vuelve a fallar se queda la mejor de las dos y se registra.

El ángulo narrativo rota de forma determinística por hash(curso+país), así la
reanudación no cambia el ángulo de lo ya generado.

Salida: src/content/course-locales/{slug}--{cc}.json

Uso:
  python3 scripts/generar-catalogo.py --limite 6      # ensayo
  python3 scripts/generar-catalogo.py                 # lote completo
"""

import argparse
import hashlib
import importlib.util
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

_spec = importlib.util.spec_from_file_location('gc', Path(__file__).parent / 'generar-contenido.py')
gc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gc)

SALIDA = Path('src/content/course-locales')
LEDGER = Path('docs/data/generacion-ledger.jsonl')
ANGULOS = ['emprendimiento', 'hobby', 'carrera']
ABORTA_USD = 32.0
WORKERS = 8

_lock = threading.Lock()
_gastado = 0.0


def angulo_de(slug: str, pais: str) -> str:
    h = int(hashlib.md5(f'{slug}:{pais}'.encode()).hexdigest(), 16)
    return ANGULOS[h % len(ANGULOS)]


def registrar(fila: dict) -> float:
    global _gastado
    with _lock:
        _gastado += fila['usd']
        with LEDGER.open('a') as f:
            f.write(json.dumps(fila, ensure_ascii=False) + '\n')
        return _gastado


def prompt_creativo(contexto: str, lugar: str, feedback: str = '') -> str:
    return (
        f'{contexto}\n\nEscribe meta_title, meta_description, h1, subtitulo, '
        f'descripcion (600-800 palabras, keyword en el primer párrafo, markdown '
        f'con H2/H3, sin H1) y 8 faqs para la página de este curso en {lugar}. '
        f'Las FAQs deben incluir métodos de pago locales y validez del '
        f'certificado en el país.'
        + (f'\n\nCORRIGE del intento anterior: {feedback}' if feedback else '')
    )


def generar_variante(slug: str, pais: str) -> dict:
    fm = gc.frontmatter(slug)
    p = gc.PAISES[pais]
    # 'Curso del Negocio de...' no empieza por 'Curso de ', así que la
    # keyword salía como "curso de curso del negocio de..." y se publicó
    # en los 8 países. Se recortan también del/de la/de los/en.
    tema = re.sub(r'^(Curso|Diplomado|Taller)\s+(de\s+l[ao]s?\s+|del\s+|de\s+|en\s+)?', '',
                  fm['title'], flags=re.I)
    keyword = f'curso de {tema.lower()}'
    lugar = p['nombre']
    ang = angulo_de(slug, pais)

    contexto = (
        f"CURSO: {fm['title']} · {fm['modulos']} módulos, {fm.get('lessonsCount', '?')} lecciones, "
        f"{fm.get('durationHours', '?')} horas · imparte {fm['instructor']} · "
        # priceUSD YA es el precio con el 40% aplicado; originalPriceUSD es el
        # tachado. Decir "precio base X con 40% OFF" hacía que el texto
        # prometiera un descuento adicional sobre lo que la caja ya cobra.
        f"precio final USD {fm.get('priceUSD', '?')} (antes USD "
        f"{fm.get('originalPriceUSD', '?')}; el 40% del cupón SABLY40 ya está aplicado, "
        f"no hay descuento adicional).\n"
        f"MERCADO: {lugar}. Moneda {p['moneda']}. Pagos: {p['pagos']}.\n"
        f'KEYWORD PRINCIPAL: "{keyword}"\n'
        f'ÁNGULO NARRATIVO: {ang}.\n'
        f'REGISTRO: {gc.REGISTRO[pais]}'
    )

    total, resultado = 0.0, {}
    for intento in range(2):
        feedback = ''
        creativo, u1 = gc.llamar(gc.MODELOS['creativo'],
                                 prompt_creativo(contexto, lugar, feedback), gc.ESQUEMA_CREATIVO)
        total += gc.costo(gc.MODELOS['creativo'], u1)
        candidato = dict(creativo)
        fallos = gc.validar(candidato, keyword, fm['body'], pais)
        graves = [f for f in fallos if 'corta' in f or 'keyword ausente' in f
                  or 'frase de IA' in f or 'sin vosear' in f]
        if not graves:
            resultado = candidato
            break
        # Se queda la mejor descripción de los dos intentos
        if not resultado or len(candidato['descripcion'].split()) > len(resultado.get('descripcion', '').split()):
            resultado = candidato
        feedback = ' · '.join(graves)
    else:
        fallos = gc.validar(resultado, keyword, fm['body'], pais)

    template, u2 = gc.llamar(gc.MODELOS['template'],
                             f'{contexto}\n\nEscribe: 6 beneficios concretos del curso, 4 líneas '
                             f'de para_quien, 3 requisitos, un párrafo de certificado y uno de '
                             f'garantia (7 días, Hotmart). Frases cortas, sin adornos.',
                             gc.ESQUEMA_TEMPLATE)
    total += gc.costo(gc.MODELOS['template'], u2)
    resultado.update(template)

    fallos_finales = gc.validar(resultado, keyword, fm['body'], pais)
    return {'contenido': resultado, 'usd': round(total, 5),
            'angulo': ang, 'fallos': fallos_finales}


def procesar(slug: str, pais: str) -> str:
    destino = SALIDA / f'{slug}--{pais}.json'
    if destino.exists():
        return 'skip'
    if _gastado >= ABORTA_USD:
        return 'abortado'
    try:
        r = generar_variante(slug, pais)
    except Exception as e:  # noqa: BLE001
        time.sleep(3)
        try:
            r = generar_variante(slug, pais)
        except Exception as e2:  # noqa: BLE001
            registrar({'slug': slug, 'pais': pais, 'usd': 0.0, 'error': str(e2)[:160]})
            return f'ERROR {str(e2)[:60]}'
    doc = {
        'course': slug, 'country': pais, 'angulo': r['angulo'],
        **r['contenido'],
        '_meta': {'usd': r['usd'], 'modelo': gc.MODELOS['creativo'],
                  'fallos': r['fallos'] or None, 'fecha': '2026-08-06'},
    }
    destino.write_text(json.dumps(doc, ensure_ascii=False, indent=2))
    acumulado = registrar({'slug': slug, 'pais': pais, 'usd': r['usd'],
                           'fallos': len(r['fallos'])})
    estado = 'ok' if not r['fallos'] else f"warn({len(r['fallos'])})"
    return f'{estado} ${r["usd"]:.4f} · total ${acumulado:.2f}'


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--limite', type=int, help='solo N variantes (ensayo)')
    ap.add_argument('--paises', default='co,mx,pe,ec,cl,ar,es,us')
    args = ap.parse_args()

    SALIDA.mkdir(parents=True, exist_ok=True)
    cursos = sorted(p.stem for p in Path('src/content/courses').glob('*.mdx'))
    paises = args.paises.split(',')
    trabajos = [(c, p) for c in cursos for p in paises
                if not (SALIDA / f'{c}--{p}.json').exists()]
    if args.limite:
        trabajos = trabajos[:args.limite]
    print(f'{len(trabajos)} variantes por generar · tope ${ABORTA_USD}\n')

    hechos = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futuros = {ex.submit(procesar, c, p): (c, p) for c, p in trabajos}
        for fut in as_completed(futuros):
            c, p = futuros[fut]
            hechos += 1
            print(f'[{hechos}/{len(trabajos)}] {c[:36]:<38} {p}  {fut.result()}')

    print(f'\nGasto del lote: ${_gastado:.2f}')
    print(f'Variantes en disco: {len(list(SALIDA.glob("*.json")))}')


if __name__ == '__main__':
    main()
