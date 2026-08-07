"""Genera contenido SEO por curso × país (× ciudad) con Gemini y mide su costo.

Es el piloto de la fase inicial (sin backend): produce el contenido en JSON
estructurado, lo valida contra el checklist SEO y registra los tokens exactos
que reporta `usageMetadata` — el costo sale de datos medidos, no de estimados.

Dos niveles de modelo, como el plan:
  - flash-lite (gemini-3.1-flash-lite): secciones de template con poca variación
  - flash (gemini-3.6-flash): contenido creativo que carga el SEO

Los testimonios NO se generan: inventar reseñas con nombres plausibles es
fabricar valoraciones falsas (riesgo legal y política de spam de Google, y el
AggregateRating del schema quedaría respaldado por nada). Hotmart tiene
valoraciones reales de compradores: eso es lo que se importa.

Uso:
  python3 scripts/generar-contenido.py --curso curso-de-globoflexia --pais mx
  python3 scripts/generar-contenido.py --curso curso-de-barberia --pais co --ciudad medellin
"""

import argparse
import difflib
import json
import os
import re
import urllib.request
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())
KEY = os.environ['GEMINI_API_KEY']

MODELOS = {'template': 'gemini-3.1-flash-lite', 'creativo': 'gemini-3.6-flash'}

# USD por 1M de tokens, verificados contra ai.google.dev/gemini-api/docs/pricing
# el 2026-08-06. Batch API = 50% de ambos.
PRECIOS = {
    'gemini-3.1-flash-lite': {'in': 0.25, 'out': 1.50},
    'gemini-3.6-flash': {'in': 1.50, 'out': 7.50},
    'gemini-3.1-pro-preview': {'in': 2.00, 'out': 12.00},
}

PAISES = {
    'co': {'nombre': 'Colombia', 'moneda': 'COP', 'pagos': 'PSE, Nequi, Daviplata o tarjeta'},
    'mx': {'nombre': 'México', 'moneda': 'MXN', 'pagos': 'OXXO, SPEI o tarjeta'},
    'pe': {'nombre': 'Perú', 'moneda': 'PEN', 'pagos': 'Yape, Plin o tarjeta'},
    'ec': {'nombre': 'Ecuador', 'moneda': 'USD', 'pagos': 'transferencia o tarjeta'},
    'cl': {'nombre': 'Chile', 'moneda': 'CLP', 'pagos': 'Webpay o tarjeta'},
    'ar': {'nombre': 'Argentina', 'moneda': 'ARS', 'pagos': 'Mercado Pago o tarjeta'},
    'es': {'nombre': 'España', 'moneda': 'EUR', 'pagos': 'Bizum, transferencia o tarjeta'},
    'us': {'nombre': 'Estados Unidos', 'moneda': 'USD', 'pagos': 'tarjeta o PayPal'},
}

# Frases-firma de texto generado; si aparecen, la página no pasa.
FRASES_IA = [
    'en el mundo de hoy', 'desbloquea tu potencial', 'lleva al siguiente nivel',
    'en un mundo cada vez más', 'sumérgete en', 'embárcate en', 'da el primer paso hacia',
    'no busques más', 'tesoro escondido', 'la clave del éxito', 'transformarás tu vida',
]

SYSTEM = """Eres un copywriter SEO senior de cursos online de oficios, en español latinoamericano natural (o de España si el país es España).

REGLAS ESTRICTAS:
- Prohibidas las frases de IA: "en el mundo de hoy", "desbloquea tu potencial", "lleva al siguiente nivel", "en un mundo cada vez más", "sumérgete", "embárcate", "no busques más".
- Nada de voz pasiva en exceso ni superlativos vacíos.
- La keyword principal aparece en el primer párrafo y máximo 3 veces por cada 500 palabras.
- Datos concretos cuando el contexto los traiga; si no hay dato, no lo inventes — omite la afirmación.
- Varía la estructura entre secciones: no siempre párrafo-lista-párrafo.
- El ángulo narrativo indicado gobierna el enfoque de toda la página."""

ESQUEMA_CREATIVO = {
    'type': 'OBJECT',
    'properties': {
        'meta_title': {'type': 'STRING', 'description': '50-60 caracteres, keyword al inicio'},
        'meta_description': {'type': 'STRING', 'description': '150-160 caracteres, con CTA'},
        'h1': {'type': 'STRING', 'description': 'distinto del meta_title'},
        'subtitulo': {'type': 'STRING'},
        'descripcion': {'type': 'STRING', 'description': '500-700 palabras, markdown con H2/H3'},
        'faqs': {'type': 'ARRAY', 'items': {'type': 'OBJECT', 'properties': {
            'q': {'type': 'STRING'}, 'a': {'type': 'STRING'}}, 'required': ['q', 'a']}},
    },
    'required': ['meta_title', 'meta_description', 'h1', 'subtitulo', 'descripcion', 'faqs'],
}

ESQUEMA_TEMPLATE = {
    'type': 'OBJECT',
    'properties': {
        'beneficios': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
        'para_quien': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
        'requisitos': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
        'certificado': {'type': 'STRING'},
        'garantia': {'type': 'STRING'},
    },
    'required': ['beneficios', 'para_quien', 'requisitos', 'certificado', 'garantia'],
}

ESQUEMA_CIUDAD = {
    'type': 'OBJECT',
    'properties': {
        'contexto_local': {'type': 'STRING', 'description': '200-350 palabras sobre el oficio en esa ciudad'},
        'faqs_geo': {'type': 'ARRAY', 'items': {'type': 'OBJECT', 'properties': {
            'q': {'type': 'STRING'}, 'a': {'type': 'STRING'}}, 'required': ['q', 'a']}},
    },
    'required': ['contexto_local', 'faqs_geo'],
}


def frontmatter(slug: str) -> dict:
    txt = (Path('src/content/courses') / f'{slug}.mdx').read_text()
    fm = txt.split('---')[1]
    out = {'body': txt.split('---', 2)[2].strip()}
    for campo in ('title', 'category', 'durationHours', 'lessonsCount', 'priceUSD'):
        m = re.search(rf'^{campo}: (.+)$', fm, re.M)
        if m:
            out[campo] = m.group(1).strip().strip('"')
    out['modulos'] = len(re.findall(r'^  - title:', fm, re.M))
    m = re.search(r'^instructor:\n  name: (.+)$', fm, re.M)
    out['instructor'] = m.group(1).strip() if m else 'el equipo Sably'
    return out


def llamar(modelo: str, user: str, schema: dict) -> tuple[dict, dict]:
    body = json.dumps({
        'system_instruction': {'parts': [{'text': SYSTEM}]},
        'contents': [{'parts': [{'text': user}]}],
        'generationConfig': {
            'responseMimeType': 'application/json',
            'responseSchema': schema,
            'temperature': 0.9,
        },
    }).encode()
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent',
        data=body, method='POST',
        headers={'x-goog-api-key': KEY, 'Content-Type': 'application/json'},
    )
    resp = json.load(urllib.request.urlopen(req, timeout=300))
    texto = resp['candidates'][0]['content']['parts'][0]['text']
    return json.loads(texto), resp.get('usageMetadata', {})


def costo(modelo: str, usage: dict) -> float:
    p = PRECIOS[modelo]
    return (usage.get('promptTokenCount', 0) * p['in']
            + usage.get('candidatesTokenCount', 0) * p['out']) / 1_000_000


def validar(contenido: dict, keyword: str, cuerpo_existente: str) -> list[str]:
    fallos = []
    desc_cruda = contenido['descripcion']
    # El modelo devuelve el markdown de dos formas incompatibles: con saltos
    # reales o con la secuencia barra-n escapada como texto. La segunda pinta
    # la landing entera como un párrafo con los ### a la vista — pasó en
    # producción, así que se valida en origen y no solo al renderizar.
    if '\\n' in desc_cruda or '\\r' in desc_cruda:
        fallos.append('saltos de línea escapados como texto')
    if '\n' not in desc_cruda:
        fallos.append('descripción sin saltos de línea: saldría como un solo párrafo')
    if re.search(r'</?(strong|em|p|br|ul|li|h[123])\b', desc_cruda, re.I):
        fallos.append('HTML literal en vez de markdown')
    for campo in ('h1', 'subtitulo', 'meta_title', 'meta_description'):
        if '**' in str(contenido.get(campo, '')) or '#' in str(contenido.get(campo, '')):
            fallos.append(f'markdown en {campo}, que se pinta como texto plano')
    t, d = contenido['meta_title'], contenido['meta_description']
    if not 45 <= len(t) <= 65:
        fallos.append(f'meta_title {len(t)} chars (objetivo 50-60)')
    if not 140 <= len(d) <= 170:
        fallos.append(f'meta_description {len(d)} chars (objetivo 150-160)')
    if t.strip().lower() == contenido['h1'].strip().lower():
        fallos.append('h1 idéntico al meta_title')
    desc = contenido['descripcion']
    palabras = desc.split()
    if len(palabras) < 450:
        fallos.append(f'descripción corta: {len(palabras)} palabras')
    kw = keyword.lower()
    if kw not in ' '.join(palabras[:100]).lower():
        fallos.append('keyword ausente en las primeras 100 palabras')
    densidad = desc.lower().count(kw) / max(len(palabras), 1) * 100 * len(kw.split())
    if densidad > 3:
        fallos.append(f'keyword stuffing: densidad {densidad:.1f}%')
    bajo = desc.lower()
    for frase in FRASES_IA:
        if frase in bajo:
            fallos.append(f'frase de IA: "{frase}"')
    if len(contenido.get('faqs', [])) < 6:
        fallos.append(f"solo {len(contenido.get('faqs', []))} FAQs (mínimo 6)")
    sim = difflib.SequenceMatcher(None, desc, cuerpo_existente).ratio()
    if sim > 0.30:
        fallos.append(f'duplica el contenido existente: {sim * 100:.0f}%')
    return fallos


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--curso', required=True)
    ap.add_argument('--pais', required=True, choices=list(PAISES))
    ap.add_argument('--ciudad')
    ap.add_argument('--angulo', default='emprendimiento',
                    choices=['emprendimiento', 'hobby', 'carrera'])
    args = ap.parse_args()

    fm = frontmatter(args.curso)
    pais = PAISES[args.pais]
    tema = re.sub(r'^Curso de ', '', fm['title'], flags=re.I)
    keyword = f'curso de {tema.lower()}'
    lugar = f"{args.ciudad.title()}, {pais['nombre']}" if args.ciudad else pais['nombre']

    contexto = (
        f"CURSO: {fm['title']} · {fm['modulos']} módulos, {fm.get('lessonsCount', '?')} lecciones, "
        f"{fm.get('durationHours', '?')} horas · imparte {fm['instructor']} · "
        f"precio base USD {fm.get('priceUSD', '?')} con 40% OFF cupón SABLY40.\n"
        f"MERCADO: {lugar}. Moneda {pais['moneda']}. Pagos: {pais['pagos']}.\n"
        f"KEYWORD PRINCIPAL: \"{keyword}\""
        + (f' + variante local "curso de {tema.lower()} en {args.ciudad}"' if args.ciudad else '')
        + f'\nÁNGULO NARRATIVO: {args.angulo}. Trato de tú'
        + (' (usar el "tú" peninsular y euros).' if args.pais == 'es' else '.')
    )

    total, resultado = 0.0, {}
    medidas = []

    tareas = [
        ('creativo', ESQUEMA_CREATIVO,
         f'{contexto}\n\nEscribe meta_title, meta_description, h1, subtitulo, '
         f'descripcion (500-700 palabras, keyword en el primer párrafo, sin H1) '
         f'y 8 faqs para la página de este curso en {lugar}. Las FAQs deben '
         f'incluir métodos de pago locales y validez del certificado en el país.'),
        ('template', ESQUEMA_TEMPLATE,
         f'{contexto}\n\nEscribe: 6 beneficios concretos del curso, 4 líneas de '
         f'para_quien, 3 requisitos, un párrafo de certificado y uno de garantia '
         f'(7 días, Hotmart). Frases cortas, sin adornos.'),
    ]
    if args.ciudad:
        tareas.append(('creativo', ESQUEMA_CIUDAD,
                       f'{contexto}\n\nEscribe contexto_local (200-350 palabras: el mercado '
                       f'de este oficio en {args.ciudad.title()}, dónde se concentra la '
                       f'demanda, sin inventar cifras) y 3 faqs_geo específicas de tomar '
                       f'el curso desde {args.ciudad.title()}.'))

    for tier, schema, prompt in tareas:
        modelo = MODELOS[tier]
        datos, usage = llamar(modelo, prompt, schema)
        c = costo(modelo, usage)
        total += c
        resultado.update(datos)
        medidas.append({'modelo': modelo, 'in': usage.get('promptTokenCount', 0),
                        'out': usage.get('candidatesTokenCount', 0), 'usd': round(c, 6)})
        print(f"  {modelo:<26} in {usage.get('promptTokenCount', 0):>5} · "
              f"out {usage.get('candidatesTokenCount', 0):>5} → ${c:.5f}")

    fallos = validar(resultado, keyword, fm['body'])
    salida = Path('docs/data/pilotos')
    salida.mkdir(parents=True, exist_ok=True)
    nombre = f"{args.curso}--{args.pais}{'--' + args.ciudad if args.ciudad else ''}"
    (salida / f'{nombre}.json').write_text(json.dumps(
        {'contenido': resultado, 'medidas': medidas, 'costo_usd': round(total, 5),
         'validacion': fallos or 'OK'}, ensure_ascii=False, indent=2))

    print(f'\n  costo total página: ${total:.5f}  (batch API: ${total / 2:.5f})')
    print(f"  validación: {'✅ pasa todo' if not fallos else '⚠️  ' + ' · '.join(fallos)}")
    print(f'  → docs/data/pilotos/{nombre}.json')


if __name__ == '__main__':
    main()
