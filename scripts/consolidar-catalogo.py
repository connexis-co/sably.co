"""Consolida el catálogo para que cada head term tenga un solo dueño.

Dos problemas que resuelve:

1. **Slugs diluidos.** `curso-de-soldadura-mig-tig-y-arco-electrico` compite por
   una cola larga cuando "curso de soldadura" vale 10.810 búsquedas/mes. El slug
   pasa al head term y el viejo queda con 301.

2. **Canibalización interna.** Cuatro cursos de barbería peleando por
   "curso de barbería" reparten la señal en vez de sumarla. Se designa un pilar
   por clúster —el más general y más completo— que es el único que apunta al
   head term; los satélites se quedan con su cola larga y enlazan hacia arriba.

Uso:  python3 scripts/consolidar-catalogo.py [--dry-run]
"""

import argparse
import re
from pathlib import Path

CURSOS = Path('src/content/courses')
REDIRECTS = Path('public/_redirects')

# slug actual → (slug nuevo, head term, volumen/mes medido en los 8 mercados)
RENOMBRAR = {
    'curso-de-cocina-desde-cero-a-profesional': ('curso-de-cocina', 'curso de cocina', 11230),
    'curso-de-soldadura-mig-tig-y-arco-electrico': ('curso-de-soldadura', 'curso de soldadura', 10810),
    'curso-de-marketing-digital-para-emprendedores': ('curso-de-marketing-digital', 'curso de marketing digital', 9140),
    'curso-de-reposteria-fina-y-postres-gourmet': ('curso-de-reposteria', 'curso de repostería', 7880),
    'curso-de-mecanica-de-motos-desde-cero': ('curso-de-mecanica-de-motos', 'curso de mecánica de motos', 5460),
    'curso-de-aire-acondicionado-y-refrigeracion': ('curso-de-aire-acondicionado', 'curso de aire acondicionado', 3660),
    'curso-de-resina-epoxica-paso-a-paso': ('curso-de-resina-epoxica', 'curso de resina epóxica', 3540),
    'curso-de-panaderia-artesanal-y-masa-madre': ('curso-de-panaderia', 'curso de panadería', 3380),
    'curso-de-corte-y-confeccion-desde-cero': ('curso-de-corte-y-confeccion', 'curso de corte y confección', 2640),
}

# pilar → satélites. El pilar es el curso más general y más completo del clúster:
# es el único que puede apuntar al head term sin competir consigo mismo.
CLUSTERES = {
    'curso-de-barberia': ['curso-de-barberia-artistica', 'curso-de-barberia-como-negocio',
                          'curso-de-barberia-infantil'],
    'curso-de-maquillaje': ['curso-de-maquillaje-de-fantasia', 'curso-de-maquillaje-permanente',
                            'curso-de-maquillaje-profesional-de-novias'],
    'curso-de-masajes': ['curso-de-masaje-reductor', 'curso-de-masaje-descontracturante',
                         'curso-de-masajes-terapeuticos-y-relajantes'],
    'curso-de-unas': ['curso-de-unas-acrilicas', 'curso-de-decoracion-de-unas'],
    'curso-de-peluqueria': ['curso-de-peinados', 'curso-de-trenzas-y-peinados',
                            'curso-de-extensiones-de-cabello', 'curso-de-alisados-y-keratina',
                            'curso-de-colorimetria', 'curso-de-balayage'],
    'curso-de-reposteria': ['curso-de-pasteleria', 'curso-de-tortas-decoradas-desde-cero'],
    'curso-de-fotografia': ['curso-de-fotografia-con-celular'],
    'curso-de-cejas-y-pestanas': ['curso-de-microblading', 'curso-de-extensiones-de-pestanas',
                                  'curso-de-pestanas-volumen-ruso',
                                  'curso-de-diseno-de-cejas-con-hilo-y-henna'],
    'curso-de-globoflexia': ['curso-de-flores-con-globos', 'curso-de-bouquets-con-globos',
                             'curso-de-globos-burbuja', 'curso-de-decoracion-con-globos'],
    'curso-de-corte-y-confeccion': ['curso-de-confeccion-de-ropa-interior',
                                    'curso-de-confeccion-de-trajes-de-bano',
                                    'curso-de-costura-industrial',
                                    'curso-de-lenceria-y-ropa-interior-a-medida',
                                    'curso-de-molderia-y-confeccion',
                                    'curso-de-patronaje-profesional-de-ropa'],
    'curso-de-ingles': ['curso-de-ingles-para-ninos'],
    'curso-de-primeros-auxilios': ['curso-de-primeros-auxilios-para-mascotas'],
}

# Head terms extra del pilar: "costura" gana en 6 de los 8 mercados y
# "corte y confección" solo en México, así que el pilar debe cubrir ambos.
KEYWORDS_EXTRA = {
    'curso-de-corte-y-confeccion': ['curso de costura'],
}


def leer(slug: str) -> tuple[Path, str] | None:
    f = CURSOS / f'{slug}.mdx'
    return (f, f.read_text()) if f.exists() else None


def renombrar(dry: bool) -> list[tuple[str, str]]:
    hechos = []
    for viejo, (nuevo, head, _vol) in RENOMBRAR.items():
        r = leer(viejo)
        if not r:
            print(f'  ! {viejo} no existe')
            continue
        f, texto = r
        # El head term puro pasa a ser la primera keyword: es la que debe rankear.
        texto = re.sub(
            r'^keywords:\n', f'keywords:\n  - {head}\n', texto, count=1, flags=re.M
        )
        if not dry:
            (CURSOS / f'{nuevo}.mdx').write_text(texto)
            f.unlink()
        hechos.append((viejo, nuevo))
    return hechos


def añadir_keywords_extra(dry: bool) -> int:
    n = 0
    for slug, extras in KEYWORDS_EXTRA.items():
        r = leer(slug)
        if not r:
            continue
        f, texto = r
        nuevas = [k for k in extras if f'  - {k}\n' not in texto]
        if not nuevas:
            continue
        bloque = ''.join(f'  - {k}\n' for k in nuevas)
        texto = re.sub(r'^keywords:\n', f'keywords:\n{bloque}', texto, count=1, flags=re.M)
        if not dry:
            f.write_text(texto)
        n += len(nuevas)
    return n


def marcar_pilares(dry: bool) -> int:
    n = 0
    for pilar, satelites in CLUSTERES.items():
        if not (CURSOS / f'{pilar}.mdx').exists():
            print(f'  ! pilar inexistente: {pilar}')
            continue
        for sat in satelites:
            r = leer(sat)
            if not r:
                print(f'  ! satélite inexistente: {sat}')
                continue
            f, texto = r
            if re.search(r'^pillar:', texto, re.M):
                continue
            texto = re.sub(r'^(category: .*)$', rf'\1\npillar: {pilar}', texto, count=1, flags=re.M)
            if not dry:
                f.write_text(texto)
            n += 1
    return n


def escribir_redirects(renombrados: list[tuple[str, str]], dry: bool) -> None:
    if not renombrados:
        return
    marca = '# Consolidación de head terms: los slugs largos diluían la keyword principal.'
    lineas = [marca]
    for viejo, nuevo in renombrados:
        lineas.append(f'/:country/{viejo}/ /:country/{nuevo}/ 301')
        lineas.append(f'/:country/:city/{viejo}/ /:country/:city/{nuevo}/ 301')
    actual = REDIRECTS.read_text()
    if marca in actual:
        actual = re.sub(rf'{re.escape(marca)}\n(?:/.*\n)*', '', actual)
    # Las reglas concretas van antes del catch-all de la raíz.
    nuevo_txt = actual.replace('\n/ /co/ 302', '\n' + '\n'.join(lineas) + '\n\n/ /co/ 302')
    if not dry:
        REDIRECTS.write_text(nuevo_txt)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--dry-run', action='store_true')
    args = p.parse_args()

    print('RENOMBRADOS (head term recuperado)')
    hechos = renombrar(args.dry_run)
    for viejo, nuevo in hechos:
        _, head, vol = RENOMBRAR[viejo]
        print(f'  {viejo}\n    → {nuevo}   "{head}" · {vol:,}/mes')

    print(f'\nPILARES ({len(CLUSTERES)} clústeres)')
    n = marcar_pilares(args.dry_run)
    print(f'  {n} satélites apuntados a su pilar')
    print(f'  {añadir_keywords_extra(args.dry_run)} keywords extra en pilares multi-término')

    escribir_redirects(hechos, args.dry_run)
    print(f'\n{len(hechos)*2} reglas 301 en public/_redirects')
    if args.dry_run:
        print('(dry-run: no se escribió nada)')


if __name__ == '__main__':
    main()
