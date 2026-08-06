"""Configura el contenedor GTM de Sably.co contra GA4 y lo publica.

Crea variables de dataLayer, triggers de evento personalizado y tags de GA4
para los 11 eventos que la web ya empuja desde src/lib/analytics.ts. No inventa
eventos: solo cablea los que el código dispara de verdad.

Idempotente: no duplica nada que ya exista con el mismo nombre.

Uso:  python3 scripts/configurar-gtm.py [--publicar]
"""

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, '/tmp')
from gapi import call as _call  # noqa: E402  (helper de auth con service account)


PAUSA = 4.5  # la API acepta ~15 peticiones/minuto por usuario


def call(*a, **kw):
    r = _call(*a, **kw)
    time.sleep(PAUSA)
    return r

SCOPE = 'https://www.googleapis.com/auth/tagmanager.edit.containers'
SCOPE_PUB = 'https://www.googleapis.com/auth/tagmanager.publish'
BASE = 'https://tagmanager.googleapis.com/tagmanager/v2'
CONTENEDOR = 'accounts/6067344844/containers/260445179'
GA4_ID = 'G-RZF4MSX5B7'

# Parámetros que viajan en el dataLayer, extraídos de las llamadas reales a
# trackEvent(). Cada uno necesita su variable para poder mandarlo a GA4.
VARIABLES = [
    'page', 'page_type', 'cta_position', 'course_interest', 'country',
    'source', 'query', 'results', 'category', 'article', 'rating', 'depth',
]

# El tercer campo marca si el evento es una conversión de negocio.
EVENTOS = [
    ('view_course', ['page'], False),
    ('click_cta_hotmart', ['page', 'cta_position'], True),
    ('submit_lead_form', ['course_interest', 'country', 'source'], True),
    ('click_whatsapp', ['page_type'], True),
    ('site_search', ['query', 'results'], False),
    ('blog_search', ['query'], False),
    ('blog_filter', ['category'], False),
    ('rate_article', ['article', 'rating'], False),
    ('scroll_depth', ['page_type', 'depth'], False),
    ('exit_intent_shown', ['page_type'], False),
    ('exit_intent_converted', ['page_type'], True),
    ('select_country', ['country'], False),
]


def workspace() -> str:
    r = call(f'{BASE}/{CONTENEDOR}/workspaces', SCOPE)
    ws = r.get('workspace', [])
    if not ws:
        raise SystemExit(f'sin workspace: {r}')
    return ws[0]['path']


def existentes(ws: str, tipo: str) -> dict:
    r = call(f'{BASE}/{ws}/{tipo}', SCOPE)
    clave = {'variables': 'variable', 'triggers': 'trigger', 'tags': 'tag'}[tipo]
    return {x['name']: x for x in r.get(clave, [])}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--publicar', action='store_true')
    args = ap.parse_args()

    ws = workspace()
    print(f'workspace: {ws}\n')

    # 1. Variables de dataLayer
    ya = existentes(ws, 'variables')
    for v in VARIABLES:
        nombre = f'dlv - {v}'
        if nombre in ya:
            continue
        r = call(f'{BASE}/{ws}/variables', SCOPE, 'POST', {
            'name': nombre, 'type': 'v',
            'parameter': [
                {'type': 'integer', 'key': 'dataLayerVersion', 'value': '2'},
                {'type': 'boolean', 'key': 'setDefaultValue', 'value': 'false'},
                {'type': 'template', 'key': 'name', 'value': v},
            ],
        })
        print(f"  var  {nombre:<26}{'✓' if 'variableId' in r else r}")

    # 2. Tag base de GA4 en todas las páginas
    ya_t = existentes(ws, 'tags')
    if 'GA4 - Configuración' not in ya_t:
        r = call(f'{BASE}/{ws}/tags', SCOPE, 'POST', {
            'name': 'GA4 - Configuración', 'type': 'googtag',
            'parameter': [{'type': 'template', 'key': 'tagId', 'value': GA4_ID}],
            'firingTriggerId': ['2147479553'],  # All Pages
        })
        print(f"\n  tag  GA4 - Configuración        {'✓' if 'tagId' in r else r}")

    # 3. Un trigger y un tag de evento GA4 por cada evento del dataLayer
    ya_tr = existentes(ws, 'triggers')
    ya_t = existentes(ws, 'tags')
    print()
    for evento, params, conversion in EVENTOS:
        tr_nombre = f'CE - {evento}'
        if tr_nombre in ya_tr:
            trigger_id = ya_tr[tr_nombre]['triggerId']
        else:
            r = call(f'{BASE}/{ws}/triggers', SCOPE, 'POST', {
                'name': tr_nombre, 'type': 'customEvent',
                'customEventFilter': [{
                    'type': 'equals',
                    'parameter': [
                        {'type': 'template', 'key': 'arg0', 'value': '{{_event}}'},
                        {'type': 'template', 'key': 'arg1', 'value': evento},
                    ],
                }],
            })
            if 'triggerId' not in r:
                print(f'  ! trigger {evento}: {r}')
                continue
            trigger_id = r['triggerId']

        tag_nombre = f"GA4 - {evento}{' ★' if conversion else ''}"
        if tag_nombre in ya_t:
            continue
        # El tag gaawe nombra las columnas 'parameter'/'parameterValue';
        # con 'name'/'value' la API responde 400 Unknown column name.
        lista = [{'type': 'map', 'map': [
            {'type': 'template', 'key': 'parameter', 'value': p},
            {'type': 'template', 'key': 'parameterValue', 'value': f'{{{{dlv - {p}}}}}'},
        ]} for p in params]
        r = call(f'{BASE}/{ws}/tags', SCOPE, 'POST', {
            'name': tag_nombre, 'type': 'gaawe',
            'parameter': [
                {'type': 'template', 'key': 'eventName', 'value': evento},
                {'type': 'tagReference', 'key': 'measurementId', 'value': 'GA4 - Configuración'},
                {'type': 'list', 'key': 'eventSettingsTable', 'list': lista},
            ],
            'firingTriggerId': [trigger_id],
        })
        marca = '★ conversión' if conversion else ''
        print(f"  tag  {tag_nombre:<34}{'✓' if 'tagId' in r else r}  {marca}")

    if args.publicar:
        r = call(f'{BASE}/{ws}:create_version', SCOPE_PUB, 'POST',
                 {'name': 'Plan de medición Sably v1',
                  'notes': 'GA4 + 12 eventos del dataLayer de src/lib/analytics.ts'})
        ver = (r.get('containerVersion') or {}).get('path')
        if not ver:
            raise SystemExit(f'no se pudo versionar: {r}')
        p = call(f'{BASE}/{ver}:publish', SCOPE_PUB, 'POST')
        print(f"\npublicado: {'✓' if 'containerVersion' in p else p}")


if __name__ == '__main__':
    main()
