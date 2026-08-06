"""Mide las keywords semilla de cursodeglobosonline.com en los 8 mercados.

El proyecto de Ubersuggest cuenta el límite como keyword × ubicación, no como
keyword única: 53 keywords en 4 ubicaciones consumen 212 de 300 slots. Así que
antes de añadir nada hay que saber dónde tiene volumen cada término, para no
gastar un slot en un país donde nadie lo busca.

Uso:  python3 scripts/globos-keywords.py
Salida: docs/data/globos-keywords.json
"""

import importlib.util
import json
import time
from pathlib import Path

_spec = importlib.util.spec_from_file_location('kp', Path(__file__).parent / 'keyword-planner.py')
kp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(kp)

PAISES = ['CO', 'MX', 'PE', 'EC', 'CL', 'AR', 'ES', 'US']

# Semillas agrupadas por intención. La intención decide la prioridad después:
# una transaccional con 100 búsquedas vale más que una informacional con 5.000.
SEMILLAS = {
    'transaccional': [
        'curso de decoracion con globos', 'curso de decoracion con globos online',
        'curso de arcos de globos', 'curso de arcos organicos de globos',
        'curso de globoflexia', 'curso de globoflexia profesional',
        'curso de globos para fiestas', 'curso de columnas de globos',
        'curso de bouquets de globos', 'curso de figuras con globos',
        'curso de lettering con globos', 'curso de centros de mesa con globos',
        'aprender a decorar con globos', 'clases de decoracion con globos',
        'taller de decoracion con globos online', 'curso de globos burbuja',
        'curso de flores con globos', 'comprar curso de decoracion con globos',
        'precio curso de decoracion con globos', 'curso de globos con certificado',
    ],
    'informacional': [
        'como hacer arco de globos', 'como hacer arco de globos paso a paso',
        'como hacer arco organico de globos', 'como hacer columna de globos',
        'como inflar globos con helio', 'tipos de globos para decorar',
        'como hacer figuras con globos', 'ideas decoracion con globos',
        'decoracion con globos para cumpleanos', 'decoracion con globos para baby shower',
        'decoracion con globos para boda', 'decoracion con globos sencilla',
        'decoracion con globos economica', 'como hacer flores con globos',
        'globoflexia paso a paso', 'decoracion con bombas',
    ],
    'eventos': [
        'curso de organizacion de eventos', 'curso de decoracion de fiestas infantiles',
        'curso de decoracion para bodas', 'curso de decoracion para baby shower',
        'curso de decoracion para 15 anos', 'curso de decoracion para gender reveal',
        'curso de mesa de dulces', 'curso de candy bar',
        'curso de decoracion de eventos', 'curso de ambientacion con globos',
    ],
    'negocio': [
        'cuanto gana un decorador de eventos', 'cuanto cobrar por un arco de globos',
        'como montar negocio de decoracion con globos', 'como empezar negocio de globos',
        'materiales para decoracion con globos', 'proveedores de globos al por mayor',
        'precio arco de globos', 'negocio de globos rentable',
        'como cobrar decoracion con globos',
    ],
    'comparativa': [
        'mejor curso de decoracion con globos', 'mejor curso de globos online',
        'opiniones curso de decoracion con globos', 'curso de globos hotmart',
        'vale la pena curso de globos', 'curso de globos gratis',
    ],
    'geo': [
        'curso de globos en bogota', 'curso de decoracion con globos en medellin',
        'curso de globos en cdmx', 'curso de decoracion en guadalajara',
        'curso de globos en lima', 'curso de decoracion en santiago',
        'curso de globos en buenos aires', 'curso de globos en madrid',
        'curso de globos en colombia', 'curso de decoracion con globos en mexico',
    ],
}


def norm(s: str) -> str:
    """Colapsa tildes pero NO la ñ: 'cumpleanos' y 'cumpleaños' son distintas."""
    for a, b in zip('áéíóú', 'aeiou'):
        s = s.replace(a, b)
    return s.lower().strip()


def main() -> None:
    todas = [k for grupo in SEMILLAS.values() for k in grupo]
    intencion = {norm(k): tipo for tipo, ks in SEMILLAS.items() for k in ks}
    objetivo = set(intencion)
    datos: dict[str, dict] = {}

    for pais in PAISES:
        n = 0
        for i in range(0, len(todas), 18):
            for r in kp.keyword_ideas(todas[i:i + 18], pais):
                k = norm(r.get('text', ''))
                if k not in objetivo:
                    continue
                m = r.get('keywordIdeaMetrics', {})
                datos.setdefault(k, {})[pais] = {
                    'volume': int(m.get('avgMonthlySearches', 0) or 0),
                    'competition': m.get('competition', 'UNKNOWN'),
                    'cpc_high': round(int(m.get('highTopOfPageBidMicros') or 0) / 1_000_000, 2),
                }
                n += 1
            time.sleep(1)
        print(f'{pais}: {n} medidas')

    Path('docs/data/globos-keywords.json').write_text(
        json.dumps({'intencion': intencion, 'metricas': datos}, ensure_ascii=False, indent=2)
    )
    print(f'\n→ docs/data/globos-keywords.json ({len(datos)} keywords)')


if __name__ == '__main__':
    main()
