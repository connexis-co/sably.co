"""Genera los libros .xlsx de análisis SEO por dominio en docs/entregables/.

Fuentes: docs/data/*.json (Keyword Planner + Ubersuggest, 2026-08-05).
"""

import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

DATA = Path('docs/data')
OUT = Path('docs/entregables')
OUT.mkdir(parents=True, exist_ok=True)

NAVY = '1B1B3A'
CORAL = 'E8456B'
HEADER_FONT = Font(name='Arial', size=10, bold=True, color='FFFFFF')
BASE_FONT = Font(name='Arial', size=10)
TITLE_FONT = Font(name='Arial', size=14, bold=True, color=NAVY)
NOTE_FONT = Font(name='Arial', size=9, italic=True, color='666666')
HEADER_FILL = PatternFill('solid', start_color=NAVY)
PRIO_FILL = {
    'ALTA': PatternFill('solid', start_color='FDE8EE'),
    'MEDIA': PatternFill('solid', start_color='FFF6E0'),
}


def load(name):
    return json.loads((DATA / name).read_text())


def style_headers(ws, row, ncols):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(vertical='center')


def add_table(ws, start_row, headers, rows, widths=None, num_cols=()):
    ws.append([])
    for i, h in enumerate(headers, 1):
        ws.cell(row=start_row, column=i, value=h)
    style_headers(ws, start_row, len(headers))
    for r in rows:
        ws.append(r)
    last = start_row + len(rows)
    for c in range(1, len(headers) + 1):
        col = get_column_letter(c)
        if widths and c <= len(widths):
            ws.column_dimensions[col].width = widths[c - 1]
        for rr in range(start_row + 1, last + 1):
            cell = ws.cell(row=rr, column=c)
            cell.font = BASE_FONT
            if c in num_cols:
                cell.number_format = '#,##0'
    ws.freeze_panes = ws.cell(row=start_row + 1, column=1)
    ws.auto_filter.ref = f'A{start_row}:{get_column_letter(len(headers))}{last}'
    return last


def sheet_title(ws, text, subtitle=''):
    ws['A1'] = text
    ws['A1'].font = TITLE_FONT
    if subtitle:
        ws['A2'] = subtitle
        ws['A2'].font = NOTE_FONT


def prio(volume, competition):
    comp = (competition or '').upper()
    if volume >= 150 and comp == 'LOW':
        return '🔴 ALTA'
    if volume >= 500:
        return '🟡 MEDIA'
    if volume >= 50:
        return '⚪ BAJA'
    return '⚪ COLA LARGA'


# ══════════════ 1. SABLY.CO ══════════════
wb = Workbook()

# — Resumen —
ws = wb.active
ws.title = 'Resumen'
sheet_title(ws, 'sably.co — Análisis SEO', 'Datos: Google Ads Keyword Planner + Ubersuggest tier3 · 2026-08-05 · CPCs en COP')
resumen = [
    ('Cursos publicados', "=COUNTA(Auditoria_CO!A:A)-1"),
    ('Cursos MANTENER (≥500/mes CO)', '=COUNTIF(Auditoria_CO!F:F,"MANTENER")'),
    ('Cursos OPTIMIZAR (100-499)', '=COUNTIF(Auditoria_CO!F:F,"OPTIMIZAR")'),
    ('Cursos cola larga (<100)', '=COUNTIF(Auditoria_CO!F:F,"LONG-TAIL")'),
    ('Keywords dataset CO', "=COUNTA(KW_CO!A:A)-1"),
    ('Volumen agregado dataset CO (búsq/mes)', '=SUM(KW_CO!B:B)'),
    ('Geo Bogotá: keywords con volumen', "=COUNTA(Geo_Bogota!A:A)-1"),
    ('Geo CDMX: keywords con volumen', "=COUNTA(Geo_CDMX!A:A)-1"),
    ('Candidatos expansión validados', "=COUNTA(Nuevos_Propuestos!A:A)-1"),
]
ws.append([])
ws.append([])
r = 4
ws.cell(row=r, column=1, value='Métrica')
ws.cell(row=r, column=2, value='Valor')
style_headers(ws, r, 2)
for label, formula in resumen:
    r += 1
    ws.cell(row=r, column=1, value=label).font = BASE_FONT
    cell = ws.cell(row=r, column=2, value=formula)
    cell.font = BASE_FONT
    cell.number_format = '#,##0'
ws.column_dimensions['A'].width = 44
ws.column_dimensions['B'].width = 16

r += 2
ws.cell(row=r, column=1, value='Hallazgos clave').font = Font(name='Arial', size=11, bold=True, color=NAVY)
hallazgos = [
    'aprende.com y platzi.com perdieron ~85% de tráfico orgánico en 24 meses: el SERP de cursos está en reorganización.',
    'La categoría NO predice demanda geo; el tamaño de ciudad sí (inglés Bogotá 1.300/mes > cualquier oficio).',
    'Cobertura geo total decidida: todo curso × toda ciudad, con 10 requisitos de diferenciación por página.',
    "El cluster 'curso de X en el SENA' (720+590+480/mes) es oportunidad de contenido comparativo.",
    "Prioridad de publicación: volumen ≥150 + competencia LOW primero (barbería Bogotá 480, CDMX 390).",
]
for h in hallazgos:
    r += 1
    ws.cell(row=r, column=1, value='• ' + h).font = BASE_FONT

# — Auditoría CO —
ws = wb.create_sheet('Auditoria_CO')
sheet_title(ws, 'Auditoría del catálogo — Colombia', '87 cursos publicados · keyword principal por curso')
audit = load('auditoria-cursos-co.json')
rows = [(a['slug'], a['keyword'], a.get('volume', 0), a.get('competition', '-'),
         a.get('cpc_high', 0), a.get('verdict', '-')) for a in audit]
add_table(ws, 4, ['Slug del curso', 'Keyword principal', 'Vol/mes CO', 'Competencia', 'CPC alto (COP)', 'Veredicto'],
          rows, widths=[46, 40, 12, 13, 14, 12], num_cols=(3, 5))

# — Nuevos propuestos —
ws = wb.create_sheet('Nuevos_Propuestos')
sheet_title(ws, 'Expansión de catálogo — candidatos validados',
            'Tanda 1 = publicar primero (LOW/MEDIUM). Datos CO; validar MX/ES antes de redactar.')
exp = load('expansion-nuevas-categorias-co.json')
rows = [(e['keyword'], e.get('volume', 0), e.get('competition', '-'),
         prio(e.get('volume', 0), e.get('competition', '')),
         'Tanda 2 (tech)' if e.get('volume', 0) >= 800 else 'Tanda 1') for e in exp]
last = add_table(ws, 4, ['Keyword candidata', 'Vol/mes CO', 'Competencia', 'Prioridad', 'Tanda'],
                 rows, widths=[42, 12, 13, 14, 14], num_cols=(2,))
ws.cell(row=last + 2, column=1,
        value='Nota: lista corta inicial. El pipeline completo de 50 se valida por tandas con scripts/seo-audit.py (criterios: vol≥300, SD≤65, CPC≥$0.30, sin canibalizar).').font = NOTE_FONT

# — Keywords por país —
for sheet, fname, note in (
    ('KW_CO', 'keywords-co.json', 'Dataset completo Colombia (3.186 keywords, semillas: barbería/uñas/electricidad/repostería/inglés)'),
    ('KW_MX', 'keywords-mx.json', 'México — semillas geo CDMX'),
    ('KW_ES', 'mercado-es.json', 'España — head terms de dimensionamiento'),
):
    ws = wb.create_sheet(sheet)
    sheet_title(ws, f'Keywords — {sheet.split("_")[1]}', note + ' · CPC en moneda de la cuenta (COP)')
    kws = load(fname)
    rows = [(k['keyword'], k.get('volume', 0), k.get('competition', '-'),
             k.get('cpc_low', 0), k.get('cpc_high', 0),
             prio(k.get('volume', 0), k.get('competition', ''))) for k in kws]
    add_table(ws, 4, ['Keyword', 'Vol/mes', 'Competencia', 'CPC bajo', 'CPC alto', 'Prioridad'],
              rows, widths=[48, 10, 13, 11, 11, 14], num_cols=(2, 4, 5))

# — Geo —
for sheet, fname, title in (
    ('Geo_Bogota', 'keywords-geo-bogota.json', 'Geo — Bogotá (semillas curso+ciudad)'),
    ('Geo_CDMX', 'keywords-mx.json', 'Geo — CDMX'),
    ('Geo_Ciudades2', 'geo-ciudades2-co.json', 'Geo — ciudades secundarias CO (Medellín, B/manga, Cartagena)'),
):
    ws = wb.create_sheet(sheet)
    sheet_title(ws, title, 'Estas páginas existen todas (cobertura total); la prioridad ordena la inversión.')
    kws = load(fname)
    kws = sorted(kws, key=lambda k: -k.get('volume', 0))[:400]
    rows = [(k['keyword'], k.get('volume', 0), k.get('competition', '-'),
             prio(k.get('volume', 0), k.get('competition', ''))) for k in kws]
    last = add_table(ws, 4, ['Keyword', 'Vol/mes', 'Competencia', 'Prioridad'],
                     rows, widths=[52, 10, 13, 14], num_cols=(2,))
    for rr in range(5, last + 1):
        p = ws.cell(row=rr, column=4).value or ''
        if 'ALTA' in p:
            for c in range(1, 5):
                ws.cell(row=rr, column=c).fill = PRIO_FILL['ALTA']
        elif 'MEDIA' in p:
            for c in range(1, 5):
                ws.cell(row=rr, column=c).fill = PRIO_FILL['MEDIA']

# — Competencia —
ws = wb.create_sheet('Competencia')
sheet_title(ws, 'Competencia — Ubersuggest (tier3)', 'DA, tráfico y tendencia 24 meses por dominio')
comp = load('competencia-ubersuggest.json')
rows = [(d['dominio'], d['mercado'], d['DA'], d['trafico_mes'], d['kw_organicas'],
         d['backlinks'], d['ref_domains'], d['tendencia_24m'], d['notas']) for d in comp['dominios']]
last = add_table(ws, 4, ['Dominio', 'Mercado', 'DA', 'Tráfico/mes', 'KW orgánicas', 'Backlinks', 'Ref. domains', 'Tend. 24m', 'Notas'],
                 rows, widths=[26, 9, 6, 12, 12, 12, 12, 10, 90], num_cols=(4, 5, 6, 7))
last += 2
ws.cell(row=last, column=1, value='SD (dificultad SEO) de keywords clave').font = Font(name='Arial', size=11, bold=True, color=NAVY)
sd_rows = [(k['kw'], k['pais'], k['vol'], k['sd']) for k in comp['sd_clave']]
add_table(ws, last + 1, ['Keyword', 'País', 'Vol/mes', 'SD'], sd_rows, widths=[40, 8, 10, 8], num_cols=(3,))

# — URLs Geo —
ws = wb.create_sheet('URLs_Geo')
sheet_title(ws, 'Arquitectura de URLs', 'Patrón definitivo /{cc}/{ciudad}/{curso-slug}/ · doc completo en docs/ARQUITECTURA_URLS.md')
urls = [
    ('Home país', 'sably.co/{cc}/', 'sably.co/co/', 'hreflang todos + x-default'),
    ('Catálogo país', 'sably.co/{cc}/cursos/', 'sably.co/co/cursos/', 'hreflang'),
    ('Categoría país', 'sably.co/{cc}/cursos/{cat}/', 'sably.co/co/cursos/oficios/', 'hreflang'),
    ('Curso país', 'sably.co/{cc}/{curso-slug}/', 'sably.co/co/curso-de-barberia/', 'hreflang'),
    ('Landing ciudad', 'sably.co/{cc}/{ciudad}/', 'sably.co/co/bogota/', 'solo canonical'),
    ('Categoría ciudad', 'sably.co/{cc}/{ciudad}/cursos/{cat}/', 'sably.co/co/bogota/cursos/oficios/', 'solo canonical'),
    ('Curso ciudad', 'sably.co/{cc}/{ciudad}/{curso-slug}/', 'sably.co/co/bogota/curso-de-barberia/', 'solo canonical + 10 requisitos de diferenciación'),
]
add_table(ws, 4, ['Tipo de página', 'Patrón', 'Ejemplo', 'Señales'], urls, widths=[20, 38, 42, 40])

# — Priorización —
ws = wb.create_sheet('Priorizacion')
sheet_title(ws, 'Roadmap de inversión SEO', 'Qué atacar primero con contenido extra, enlazado y pauta')
prio_rows = [
    ('1', 'Conectar dominio sably.co + enviar sitemap a GSC', 'JP (1 comando)', 'Bloqueante de indexación'),
    ('2', 'Geo 🔴 alta: barbería Bogotá/CDMX/Medellín, cocina B/manga, globos CDMX', 'Contenido extendido + enlaces desde home país', 'Vol ≥150 y competencia LOW'),
    ('3', 'Publicar 18 cursos de belleza en sably (variantes online+certificado)', 'Workflow redacción con splitting', 'Head terms quedan en academiadebelleza'),
    ('4', 'Relanzar cursodeglobosonline.com foco MX', 'Astro + design system', 'DA 18 y 27K backlinks ya existentes; SD 15'),
    ('5', 'Tanda 1 expansión (LOW/MEDIUM): atención al cliente, cejas, drywall…', 'Pipeline curación→redacción→QA', 'Validados en Nuevos_Propuestos'),
    ('6', 'Blog cluster "SENA vs online" por categoría', 'Redacción editorial', '720+590+480/mes medidos'),
    ('7', 'terapiadpareja.com: SEO editorial (sin Ads: categoría restringida)', 'Contenido especializado', 'KP devuelve 0 por restricción de política'),
    ('8', 'España por long-tail + geo (Madrid, Barcelona…)', 'Fase 2', 'Head terms HIGH en todo'),
]
add_table(ws, 4, ['Orden', 'Acción', 'Cómo', 'Justificación (datos)'], prio_rows, widths=[7, 58, 40, 44])

wb.save(OUT / 'sably_co_analisis_seo.xlsx')
print('✓ sably_co_analisis_seo.xlsx')

# ══════════════ 2-4. FILIALES ══════════════
sel = load('seleccion-cursos.json')
filiales_data = {f.stem.split('-')[1]: load(f.name) for f in DATA.glob('filiales-*.json')}

def libro_filial(nombre_archivo, titulo, cursos, kw_rows, competencia_nota, urls_ejemplo):
    wbf = Workbook()
    ws = wbf.active
    ws.title = 'Cursos_Asignados'
    sheet_title(ws, titulo, 'Regla: head terms en la filial; variantes online+certificado y geo en sably.co')
    add_table(ws, 4, ['Curso / tema', 'Keyword head (filial)', 'Variante para sably.co'],
              cursos, widths=[40, 34, 44])
    ws = wbf.create_sheet('Keywords')
    sheet_title(ws, 'Keywords por país', 'Volúmenes Keyword Planner · CPC en COP')
    add_table(ws, 4, ['Keyword', 'País', 'Vol/mes', 'Competencia'], kw_rows,
              widths=[40, 8, 10, 14], num_cols=(3,))
    ws = wbf.create_sheet('Competencia_Nicho')
    sheet_title(ws, 'Posición competitiva', '')
    ws['A4'] = competencia_nota
    ws['A4'].font = BASE_FONT
    ws['A4'].alignment = Alignment(wrap_text=True, vertical='top')
    ws.column_dimensions['A'].width = 110
    ws.row_dimensions[4].height = 90
    ws = wbf.create_sheet('URLs_Geo')
    sheet_title(ws, 'Estructura de URLs (misma lógica que sably.co)', '')
    add_table(ws, 4, ['Tipo', 'Ejemplo'], urls_ejemplo, widths=[22, 62])
    wbf.save(OUT / nombre_archivo)
    print(f'✓ {nombre_archivo}')

belleza = [c for c in sel if c['category'] == 'belleza']
kw_belleza = []
for cc, rows_ in filiales_data.items():
    for k in rows_:
        if any(t in k['keyword'] for t in ('barberia', 'unas', 'maquillaje')):
            kw_belleza.append((k['keyword'], cc.upper(), k.get('volume', 0), k.get('competition', '-')))
libro_filial(
    'academiadebelleza_analisis_seo.xlsx',
    'academiadebelleza.edu.co — dueña de los head terms de belleza',
    [(c['title'], c['keyword'], c['keyword'] + ' online con certificado') for c in belleza],
    kw_belleza,
    'DA 14 · 17.501 backlinks · tráfico 592/mes (cayó de 5.900 en ago-2024 por el funnel roto de dic-2025, no por el modelo SEO: '
    "sus geo-páginas siguen rankeando — 'curso de estetica' pos 2 (SD 17), 'curso de barberia barranquilla' pos 12, "
    "'academia de belleza en bucaramanga' pos 8, 'donde estudiar cosmetologia en bogota' pos 14. "
    'Acción: aplicar el fix del funnel, refrescar contenido y defender head terms mientras sably toma variantes y geo.',
    [('Head global', 'academiadebelleza.edu.co/cursos-belleza/barberia/'),
     ('Geo ciudad (ya existe)', 'academiadebelleza.edu.co/bucaramanga/cursos-belleza/barberia/'),
     ('Blog informacional', 'academiadebelleza.edu.co/20-mejores-tipos-de-cortes-de-cabello-para-mujer/')])

globos_kw = []
for cc, rows_ in filiales_data.items():
    for k in rows_:
        if 'globo' in k['keyword']:
            globos_kw.append((k['keyword'], cc.upper(), k.get('volume', 0), k.get('competition', '-')))
libro_filial(
    'cursodeglobosonline_analisis_seo.xlsx',
    'cursodeglobosonline.com — foco MÉXICO (14.800/mes "decoración con globos")',
    [('Decoración con globos (head)', 'curso de decoracion con globos', 'curso de decoración con globos online con certificado'),
     ('Globoflexia', 'curso de globoflexia', 'curso de globoflexia online'),
     ('Arcos y estructuras', 'arcos de globos', 'curso de arcos de globos online'),
     ('Negocio de eventos', 'decoracion de eventos', 'curso de decoración de eventos online')],
    globos_kw,
    'DA 18 · 26.960 backlinks · 149 ref-domains — MEJORES fundamentos que academiadebelleza, pero tráfico 139/mes por contenido débil: '
    "posiciones 32-75 en sus propias keywords ('curso de globoflexia' pos 47 con SD 23; 'cursos de decoración de globos' pos 52 con SD 15). "
    'Acción: relanzamiento con Astro (design system Sably), landings por keyword y foco geo MX (CDMX primero). Upside inmediato: SD 15-23 con la autoridad ya construida.',
    [('Head global', 'cursodeglobosonline.com/curso-de-decoracion-con-globos/'),
     ('País', 'cursodeglobosonline.com/mx/curso-de-decoracion-con-globos/'),
     ('Ciudad', 'cursodeglobosonline.com/mx/cdmx/curso-de-decoracion-con-globos/')])

terapia_kw = []
for cc, rows_ in filiales_data.items():
    for k in rows_:
        if 'terapia' in k['keyword'] or 'pareja' in k['keyword']:
            terapia_kw.append((k['keyword'], cc.upper(), k.get('volume', 0), k.get('competition', '-')))
libro_filial(
    'terapiadpareja_analisis_seo.xlsx',
    'terapiadpareja.com — jugada 100% SEO editorial (Ads restringido)',
    [('Terapia de pareja (curso)', 'curso de terapia de pareja', '— no va a sably: vertical completo en la filial'),
     ('Comunicación en pareja', 'como mejorar la comunicacion en pareja', '—'),
     ('Superar rupturas', 'como superar una ruptura', '—'),
     ('Dependencia emocional', 'dependencia emocional', '—')],
    terapia_kw,
    'HALLAZGO CRÍTICO: Google Ads NO devuelve métricas para "terapia de pareja" en ningún país (categoría restringida: dificultades personales). '
    'Implicación: cero pauta search posible → toda la adquisición es SEO editorial + social. El dominio EMD es la ventaja. '
    'Estrategia: 20+ artículos informacionales (preguntas reales), curso como conversión, y NADA de presupuesto Ads en este vertical (moverlo a globos/belleza).',
    [('Head global', 'terapiadpareja.com/curso-de-terapia-de-pareja/'),
     ('País', 'terapiadpareja.com/co/curso-de-terapia-de-pareja/'),
     ('Blog', 'terapiadpareja.com/blog/como-salvar-mi-matrimonio/')])

# ══════════════ 5. BENCHMARKING ══════════════
wbb = Workbook()
ws = wbb.active
ws.title = 'Comparativa'
sheet_title(ws, 'Benchmarking — plataformas de cursos', 'Ubersuggest 2026-08-05 · tendencia = tráfico jul-2026 vs ago-2024')
rows = [(d['dominio'], d['mercado'], d['DA'], d['trafico_mes'], d['kw_organicas'], d['backlinks'], d['tendencia_24m'])
        for d in comp['dominios']]
last = add_table(ws, 4, ['Dominio', 'Mercado', 'DA', 'Tráfico/mes', 'KW', 'Backlinks', 'Tend. 24m'],
                 rows, widths=[26, 9, 6, 12, 10, 12, 10], num_cols=(4, 5, 6))
last += 2
ws.cell(row=last, column=1, value='Lectura estratégica').font = Font(name='Arial', size=11, bold=True, color=NAVY)
lecturas = [
    'Los dos referentes (aprende, platzi) dependen de blogs informacionales que la IA/AI-Overviews está canibalizando → su colapso del 85%.',
    'Ninguno tiene landings transaccionales GEO por ciudad: exactamente el espacio que sably ocupa.',
    'academiadebelleza valida el modelo geo propio: rankea con DA 14 gracias a URLs ciudad+categoría.',
    'cursodeglobosonline tiene autoridad dormida (DA 18, 27K backlinks) esperando contenido.',
    'Conclusión: atacar transaccional+geo con cola larga, no informacional head — es la debilidad estructural de todos.',
]
for h in lecturas:
    last += 1
    ws.cell(row=last, column=1, value='• ' + h).font = BASE_FONT
for d in comp['dominios']:
    wsd = wbb.create_sheet(d['dominio'].split('.')[0][:28])
    sheet_title(wsd, d['dominio'], f"Mercado {d['mercado']} · DA {d['DA']} · {d['trafico_mes']:,} visitas/mes")
    wsd['A4'] = d['notas']
    wsd['A4'].font = BASE_FONT
    wsd['A4'].alignment = Alignment(wrap_text=True, vertical='top')
    wsd.column_dimensions['A'].width = 110
    wsd.row_dimensions[4].height = 80
wbb.save(OUT / 'benchmarking_competencia.xlsx')
print('✓ benchmarking_competencia.xlsx')
print('\nEntregables en', OUT)
