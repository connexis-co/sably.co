"""Reparte los 300 slots del proyecto de Ubersuggest de cursodeglobosonline.com.

Ubersuggest cuenta el límite como keyword × ubicación. Las 53 keywords actuales
están replicadas en 4 ubicaciones (CO, Bogotá, MX, PE) = 212 slots, y solo 67
de ellos tienen volumen medible en su país. El resto trackea posiciones para
búsquedas que nadie hace.

Este script reparte los 300 slots por valor real: volumen medido en ESE país,
ponderado por intención de compra y por competencia.

Uso:  python3 scripts/globos-asignar-300.py [--aplicar]
Salida: docs/data/globos-plan-300.json
"""

import argparse
import json
from pathlib import Path

LOC = {'CO': 2170, 'MX': 2484, 'PE': 2604, 'EC': 2218,
       'CL': 2152, 'AR': 2032, 'ES': 2724, 'US': 2840}
UMBRAL = 30          # por debajo de esto un slot no se paga solo
TOTAL_SLOTS = 300

# La intención manda sobre el volumen bruto: quien busca "curso de decoración
# con globos" puede comprar hoy; quien busca "decoración con globos de frozen"
# está mirando fotos. Ambas valen, pero no lo mismo por slot.
PESO_INTENCION = {
    'transaccional': 3.0,
    'comparativa': 2.5,
    'negocio': 1.6,
    'eventos': 1.4,
    'geo': 1.3,
    'informacional': 1.0,
}
PESO_COMPETENCIA = {'LOW': 1.3, 'MEDIUM': 1.0, 'HIGH': 0.7, 'UNKNOWN': 1.0}

TRANS = ('curso', 'cursos', 'clases', 'taller', 'aprender', 'comprar', 'precio curso')
COMPAR = ('mejor', 'opiniones', 'vale la pena', 'hotmart', 'gratis', 'reseñas')
NEGOCIO = ('cuanto gana', 'cuanto cobrar', 'negocio', 'proveedores', 'materiales',
           'precio arco', 'rentable', 'emprender')
EVENTOS = ('boda', 'matrimonio', 'baby shower', 'bautizo', 'graduacion', '15 años',
           'primera comunion', 'gender reveal', 'aniversario', 'eventos', 'fiestas')
GEO = ('bogota', 'medellin', 'cdmx', 'guadalajara', 'lima', 'santiago',
       'buenos aires', 'madrid', 'sena', 'cerca de mi', 'bucaramanga', 'pereira')


def intencion(k: str) -> str:
    if any(g in k for g in GEO):
        return 'geo'
    if any(c in k for c in COMPAR):
        return 'comparativa'
    if any(n in k for n in NEGOCIO):
        return 'negocio'
    if k.startswith(TRANS) or ' curso' in k:
        return 'transaccional'
    if any(e in k for e in EVENTOS):
        return 'eventos'
    return 'informacional'


def cargar() -> dict:
    """Une las tres fuentes medidas; ante duplicado gana el volumen mayor."""
    fusion: dict[str, dict] = {}
    for f in ('globos-keywords.json', 'globos-descubiertas.json', 'globos-existentes.json'):
        p = Path('docs/data') / f
        if not p.exists():
            continue
        d = json.loads(p.read_text())
        d = d.get('metricas', d)
        for k, per in d.items():
            for pais, m in per.items():
                cur = fusion.setdefault(k, {}).get(pais)
                if not cur or m['volume'] > cur['volume']:
                    fusion[k][pais] = m
    return fusion


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--aplicar', action='store_true')
    args = ap.parse_args()

    fusion = cargar()
    candidatos = []
    for k, per in fusion.items():
        tipo = intencion(k)
        for pais, m in per.items():
            if m['volume'] < UMBRAL:
                continue
            score = (m['volume'] ** 0.6) * PESO_INTENCION[tipo] \
                * PESO_COMPETENCIA.get(m['competition'], 1.0)
            candidatos.append({
                'keyword': k, 'pais': pais, 'loc_id': LOC[pais],
                'volume': m['volume'], 'competition': m['competition'],
                'cpc': m['cpc_high'], 'intencion': tipo, 'score': round(score, 1),
            })

    candidatos.sort(key=lambda c: -c['score'])

    # Las categorías de alta intención son escasas de verdad: en este nicho solo
    # existen 64 pares transaccionales, 6 de negocio y 2 comparativos con volumen
    # medible. Se toman TODOS antes de rellenar con informacional, que sobra.
    ALTA = ('transaccional', 'comparativa', 'negocio', 'geo', 'eventos')
    alta = [c for c in candidatos if c['intencion'] in ALTA]
    resto = [c for c in candidatos if c['intencion'] not in ALTA]
    plan = (alta + resto)[:TOTAL_SLOTS]
    plan.sort(key=lambda c: -c['score'])

    from collections import Counter
    por_pais = Counter(c['pais'] for c in plan)
    por_int = Counter(c['intencion'] for c in plan)

    print(f'Universo con vol >= {UMBRAL}: {len(candidatos)} pares keyword×país')
    print(f'Plan: {len(plan)} slots\n')
    print('POR PAÍS')
    for p in LOC:
        n = por_pais[p]
        print(f'  {p}  {n:>3}  {n * 100 // max(len(plan), 1):>3}%')
    print('\nPOR INTENCIÓN')
    for t, n in por_int.most_common():
        print(f'  {t:<16}{n:>3}  {n * 100 // max(len(plan), 1):>3}%')

    mapa: dict[str, list] = {}
    for c in plan:
        mapa.setdefault(c['keyword'], []).append({'lang': 'es', 'loc_id': c['loc_id']})

    Path('docs/data/globos-plan-300.json').write_text(
        json.dumps({'plan': plan, 'keywords_map': mapa}, ensure_ascii=False, indent=2)
    )
    print(f'\n{len(mapa)} keywords únicas en {len(plan)} slots')
    print('→ docs/data/globos-plan-300.json')
    if not args.aplicar:
        print('\n(usa --aplicar para ver el mapa listo para add_project_keywords)')


if __name__ == '__main__':
    main()
