"""Sondeo multi-país del catálogo de academiadebelleza.edu.co.

La filial lleva años vendiendo estos 17 cursos en Colombia: son demanda ya
validada con dinero, no una hipótesis. Este script mide cada uno en los 8
mercados de Sably para separar los que solo funcionan en CO de los que son
oportunidad regional.

Uso:  python3 scripts/sondeo-belleza.py
Salida: docs/data/sondeo-belleza.json
"""

import importlib.util
import json
import time
from pathlib import Path

_spec = importlib.util.spec_from_file_location('kp', Path(__file__).parent / 'keyword-planner.py')
kp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(kp)

# El slug del sitio → la keyword que la gente realmente teclea.
# No siempre coinciden: nadie busca "curso cejas y pestañas", buscan cada uno por
# separado, y "curso de uñas" gana por goleada a "curso de manicure y pedicure".
CURSOS = {
    'curso-de-barberia': ['curso de barberia', 'curso de barberia online'],
    'curso-de-unas-acrilicas': ['curso de uñas acrilicas', 'curso de uñas'],
    'curso-de-unas-semipermanente': ['curso de uñas semipermanentes', 'curso de esmaltado semipermanente'],
    'curso-decoracion-de-unas': ['curso de decoracion de uñas', 'curso de nail art'],
    'curso-de-manicure-y-pedicure': ['curso de manicure y pedicure', 'curso de pedicure'],
    'curso-de-maquillaje': ['curso de maquillaje', 'curso de maquillaje profesional'],
    'curso-de-automaquillaje': ['curso de automaquillaje'],
    'curso-de-peluqueria': ['curso de peluqueria', 'curso de corte de cabello'],
    'curso-de-peinados': ['curso de peinados'],
    'curso-de-trenzas': ['curso de trenzas'],
    'curso-cejas-y-pestanas': ['curso de cejas', 'curso de diseño de cejas', 'curso de laminado de cejas'],
    'curso-pestanas-pelo-a-pelo': ['curso de pestañas', 'curso de extensiones de pestañas', 'curso de lifting de pestañas'],
    'curso-de-limpieza-facial': ['curso de limpieza facial', 'curso de cosmetologia'],
    'curso-depilacion-con-cera': ['curso de depilacion', 'curso de depilacion con cera'],
    'curso-de-masajes': ['curso de masajes', 'curso de masoterapia'],
    'curso-de-masajes-relajantes': ['curso de masajes relajantes'],
    'curso-de-masaje-reductor': ['curso de masaje reductor', 'curso de masajes reductores'],
}

PAISES = ['CO', 'MX', 'PE', 'EC', 'CL', 'AR', 'ES', 'US']


def norm(s: str) -> str:
    """Colapsa tildes para casar semilla y respuesta.

    La ñ NO se colapsa: "curso de unas" es una keyword real distinta de
    "curso de uñas" (10/mes contra 4.400 en MX). Colapsarlas hacía que la
    variante sin ñ sobrescribiera a la buena según el orden de la respuesta.
    """
    for a, b in zip('áéíóú', 'aeiou'):
        s = s.replace(a, b)
    return s.lower().strip()


def main() -> None:
    objetivo = {norm(k) for kws in CURSOS.values() for k in kws}
    datos: dict[str, dict] = {}

    for pais in PAISES:
        # La API devuelve ideas relacionadas además de las semillas; pedimos en
        # lotes para no pasarnos del límite de semillas por petición.
        semillas = sorted({k for kws in CURSOS.values() for k in kws})
        encontrados = 0
        for i in range(0, len(semillas), 18):
            for r in kp.keyword_ideas(semillas[i:i + 18], pais):
                k = norm(r.get('text', ''))
                if k not in objetivo:
                    continue
                m = r.get('keywordIdeaMetrics', {})
                datos.setdefault(k, {})[pais] = {
                    'volume': int(m.get('avgMonthlySearches', 0) or 0),
                    'competition': m.get('competition', 'UNKNOWN'),
                    'cpc_high': round(int(m.get('highTopOfPageBidMicros') or 0) / 1_000_000, 2),
                }
                encontrados += 1
            time.sleep(1)
        print(f'{pais}: {encontrados} keywords medidas')

    out = Path('docs/data/sondeo-belleza.json')
    out.write_text(json.dumps({'cursos': CURSOS, 'metricas': datos}, ensure_ascii=False, indent=2))
    print(f'\n→ {out} ({len(datos)} keywords)')


if __name__ == '__main__':
    main()
