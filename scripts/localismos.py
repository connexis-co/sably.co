"""Qué palabra usa cada país para el mismo oficio.

"Plomería", "gasfitería" y "fontanería" son el mismo curso y tres keywords
distintas. Publicar una sola pierde el mercado de las otras dos. Este script
mide cada familia de sinónimos en los 8 mercados para saber qué término gana
en cada uno y cuál debe ser el H1 de cada versión de país.

Uso:  python3 scripts/localismos.py
Salida: docs/data/localismos.json
"""

import importlib.util
import json
import time
from pathlib import Path

_spec = importlib.util.spec_from_file_location('kp', Path(__file__).parent / 'keyword-planner.py')
kp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(kp)

# Familias de sinónimos: mismo curso, distinta palabra según el país.
FAMILIAS = {
    'plomería': ['curso de plomeria', 'curso de gasfiteria', 'curso de fontaneria',
                 'curso de plomero', 'curso de gasfiter'],
    'peluquería': ['curso de peluqueria', 'curso de estilismo', 'curso de estilista',
                   'curso de corte de cabello', 'curso de corte de pelo'],
    'uñas': ['curso de uñas', 'curso de manicura', 'curso de manicure', 'curso de manicuria',
             'curso de uñas esculpidas', 'curso de uñas acrilicas', 'curso de uñas de gel'],
    'repostería': ['curso de reposteria', 'curso de pasteleria', 'curso de panaderia'],
    'costura': ['curso de costura', 'curso de corte y confeccion', 'curso de modisteria',
                'curso de patronaje', 'curso de confeccion'],
    'celulares': ['curso de reparacion de celulares', 'curso de reparacion de moviles',
                  'curso de reparacion de telefonos'],
    'mecánica': ['curso de mecanica automotriz', 'curso de mecanica de autos',
                 'curso de mecanica de carros', 'curso de mecanica de coches',
                 'curso de mecanica de motos', 'curso de mecanica de motocicletas'],
    'masajes': ['curso de masajes', 'curso de masoterapia', 'curso de quiromasaje',
                'curso de masajista'],
    'electricidad': ['curso de electricista', 'curso de electricidad',
                     'curso de instalaciones electricas'],
    'estética': ['curso de cosmetologia', 'curso de estetica', 'curso de esteticista',
                 'curso de cosmiatria'],
    'depilación': ['curso de depilacion', 'curso de depilacion con cera',
                   'curso de depilacion laser'],
    'barbería': ['curso de barberia', 'curso de barbero'],
}

PAISES = ['CO', 'MX', 'PE', 'EC', 'CL', 'AR', 'ES', 'US']


def norm(s: str) -> str:
    """Colapsa tildes, pero NO la ñ: "unas" y "uñas" son keywords distintas."""
    for a, b in zip('áéíóú', 'aeiou'):
        s = s.replace(a, b)
    return s.lower().strip()


def main() -> None:
    objetivo = {norm(k) for kws in FAMILIAS.values() for k in kws}
    datos: dict[str, dict] = {}
    semillas = sorted(objetivo)

    for pais in PAISES:
        for i in range(0, len(semillas), 18):
            for r in kp.keyword_ideas(semillas[i:i + 18], pais):
                k = norm(r.get('text', ''))
                if k not in objetivo:
                    continue
                m = r.get('keywordIdeaMetrics', {})
                datos.setdefault(k, {})[pais] = {
                    'volume': int(m.get('avgMonthlySearches', 0) or 0),
                    'competition': m.get('competition', 'UNKNOWN'),
                }
            time.sleep(1)
        print(f'{pais} ✓')

    Path('docs/data/localismos.json').write_text(
        json.dumps({'familias': FAMILIAS, 'metricas': datos}, ensure_ascii=False, indent=2)
    )
    print(f'\n→ docs/data/localismos.json ({len(datos)} variantes)')


if __name__ == '__main__':
    main()
