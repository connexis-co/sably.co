#!/usr/bin/env python3
"""Genera el calendario comercial de sably.co en XLSX y PDF.

Cubre los 8 países del sitio (CO, MX, ES, AR, CL, PE, EC, US) más las fechas
globales, con: relevancia, descuento sugerido, contenido orgánico, contenido de
pago y su papel en el ciclo de conversión.

El descuento sugerido usa los dos únicos cupones que Hotmart reconoce hoy —
010775 (25 %) y 031016 (50 %) — y respeta la misma regla que `src/lib/promo.ts`:
el 50 % se reserva a los picos del año. Si estuviera disponible siempre, dejaría
de ser un motivo para comprar hoy.

Salidas:
  docs/data/calendario-marketing.xlsx
  docs/CALENDARIO_MARKETING.pdf

Uso:  python3 scripts/build-calendario-marketing.py
"""

from __future__ import annotations

import pathlib

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (mes, fecha, evento, países, relevancia 1-5, %desc, orgánico, pago, papel en el ciclo)
FECHAS: list[tuple] = [
    # ---------------- ENERO ----------------
    ("01", "1–15 ene", "Propósitos de Año Nuevo", "TODOS", 5, 25,
     "Serie «este año sí»: testimonios de quien cambió de oficio. Reels de antes/después.",
     "Meta Ads a frío con ángulo de reinvención. Búsqueda: «curso de X desde cero».",
     "Pico de intención de cambio. Capta lead ahora y véndele en el segundo contacto."),
    ("01", "6 ene", "Reyes Magos", "ES, MX", 3, 25,
     "Regalo tardío: «el regalo que sí se usa». Formato carrusel.",
     "Retargeting a quien vio cursos en diciembre y no compró.",
     "Recupera el tráfico navideño que no convirtió."),
    ("01", "7 ene – feb", "Rebajas de invierno", "ES", 4, 25,
     "Comparativa de precio/valor frente a academia presencial.",
     "Google Shopping y búsqueda con modificador «barato/oferta».",
     "El usuario español ya viene con mentalidad de rebaja."),
    ("01", "2.ª quincena", "Regreso a clases (Cono Sur)", "AR, CL", 4, 25,
     "«Aprende un oficio mientras estudias»: público joven.",
     "TikTok Ads a 18-25. Creatividad vertical mostrando el aula virtual.",
     "Entrada de audiencia joven al embudo, con ticket bajo."),

    # ---------------- FEBRERO ----------------
    ("02", "14 feb", "San Valentín", "TODOS", 3, 25,
     "Cursos en pareja: barbería, cocina, fotografía. Ángulo «hagan algo juntos».",
     "Meta Ads con público de intereses de pareja y regalos.",
     "Fecha menor: úsala para llenar lista, no para forzar venta."),
    ("02", "Carnaval", "Carnaval", "CO, EC", 2, 0,
     "Contenido de oportunidad: maquillaje artístico, decoración.",
     "Sin pauta. Aprovecha el pico orgánico de búsqueda estacional.",
     "Visibilidad barata. Sin descuento: no hay intención de compra."),

    # ---------------- MARZO ----------------
    ("03", "8 mar", "Día de la Mujer", "TODOS", 4, 25,
     "Historias reales de emprendedoras del catálogo (uñas, belleza, repostería).",
     "Meta Ads a mujeres 25-45 con ángulo de independencia económica.",
     "Encaja con el núcleo del catálogo. Alto potencial de guardado y compartido."),
    ("03", "Fin de mes", "Cierre de trimestre", "TODOS", 2, 0,
     "Contenido educativo puro: mini-tutoriales que demuestren método.",
     "Solo retargeting de bajo coste.",
     "Mes de nutrir, no de vender. Prepara al público para abril."),

    # ---------------- ABRIL ----------------
    ("04", "Semana Santa", "Semana Santa", "TODOS", 2, 0,
     "Recetas y manualidades de temporada. Formato corto.",
     "Bajar pauta: caen las conversiones y sube el CPC.",
     "Semana de mantenimiento. No quemes presupuesto."),
    ("04", "Última semana", "Previa Día de la Madre", "MX, CO, ES", 4, 25,
     "«Regálale un ingreso, no un objeto». Testimonios madre-hija.",
     "Empieza a calentar públicos: vídeo view para retargetear en mayo.",
     "Aquí se construye la audiencia que compra en mayo."),

    # ---------------- MAYO ----------------
    ("05", "10 may", "Día de la Madre", "MX", 5, 50,
     "Contenido emocional + demostración de oficio rentable.",
     "Meta Ads con vídeo emotivo y CTA directo a checkout con cupón.",
     "Fecha comercial fuerte en México. Justifica el 50 %."),
    ("05", "2.º domingo", "Día de la Madre", "CO, PE, EC, US", 5, 50,
     "Mismo ángulo, adaptado a cada país en las landings geo.",
     "Búsqueda + Meta. Segmentar por ciudad con las landings hiperlocales.",
     "Uno de los tres picos del año en Colombia."),
    ("05", "1.º domingo", "Día de la Madre", "ES", 4, 25,
     "Adaptar el mensaje: en España el ticket medio es mayor.",
     "Google Ads en búsqueda; Meta rinde peor en este mercado.",
     "Menor volumen que LATAM pero mejor margen."),
    ("05", "Mediados", "Hot Sale", "AR, MX", 5, 50,
     "Cuenta atrás diaria en stories. Urgencia real con el countdown del sitio.",
     "Presupuesto agresivo: es cuando el usuario está comprando.",
     "El evento de descuento más grande antes de noviembre."),

    # ---------------- JUNIO ----------------
    ("06", "Inicio", "CyberDay", "CL", 5, 50,
     "Landing específica del evento con los cursos más vendidos.",
     "Meta + Google con presupuesto concentrado en 72 h.",
     "El evento comercial chileno por excelencia."),
    ("06", "3.er domingo", "Día del Padre", "CO, MX, ES, US", 3, 25,
     "Oficios asociados: barbería, mecánica, carpintería, parrilla.",
     "Meta Ads a mujeres 25-50 (compran ellas el regalo).",
     "Menos volumen que el Día de la Madre, pero mejor ticket."),
    ("06", "Mediados", "Prima de mitad de año", "CO", 5, 50,
     "«Invierte tu prima en algo que te dé ingresos». Muy potente en Colombia.",
     "Pauta fuerte: hay liquidez real en el mercado.",
     "Ventana de poder adquisitivo. Aprovéchala aunque no sea festivo."),

    # ---------------- JULIO ----------------
    ("07", "Todo el mes", "Rebajas de verano", "ES", 4, 25,
     "Contenido de aprovechar el verano para formarse.",
     "Google Ads con modificadores de oferta.",
     "Temporada de descuento asumida por el consumidor español."),
    ("07", "28–29 jul", "Fiestas Patrias", "PE", 4, 25,
     "Cursos de cocina peruana y emprendimiento local.",
     "Meta Ads geosegmentado a Lima, Arequipa, Trujillo.",
     "Pico de consumo nacional peruano."),
    ("07", "Vacaciones", "Vacaciones de mitad de año", "TODOS", 3, 25,
     "«Aprovecha las vacaciones para aprender un oficio».",
     "Pauta media. Sube el tiempo disponible, baja la urgencia.",
     "Buen momento para cursos largos y de mayor compromiso."),

    # ---------------- AGOSTO ----------------
    ("08", "15–25 ago", "Vuelta a clases", "TODOS", 4, 25,
     "«Formación que sí da trabajo» frente a la carrera tradicional.",
     "Búsqueda: alta intención en «curso de X con certificado».",
     "Mentalidad de matrícula. Enlaza con la sección de certificado."),
    ("08", "3.er domingo", "Día del Niño", "AR", 2, 0,
     "Cursos de manualidades y repostería infantil.",
     "Sin pauta específica.",
     "Contenido de oportunidad, sin descuento."),

    # ---------------- SEPTIEMBRE ----------------
    ("09", "3.er sábado", "Amor y Amistad", "CO", 5, 50,
     "LA fecha comercial colombiana. Regalo con utilidad real.",
     "Presupuesto máximo del trimestre. Meta + búsqueda + retargeting.",
     "Pico anual en Colombia, el mercado principal del sitio."),
    ("09", "18 sept", "Fiestas Patrias", "CL", 4, 25,
     "Cocina chilena, parrilla, repostería para celebrar.",
     "Meta Ads geosegmentado a Santiago, Valparaíso, Concepción.",
     "Consumo alto, pero enfocado en alimentación y ocio."),
    ("09", "Variable", "Día sin IVA", "CO", 4, 50,
     "Aclarar que el descuento es propio, no del beneficio fiscal.",
     "Aprovechar el pico de tráfico comercial del país.",
     "Sube la intención de compra general. Requiere fecha oficial cada año."),

    # ---------------- OCTUBRE ----------------
    ("10", "Inicio", "CyberDay / Cyber Days", "PE, CL", 4, 25,
     "Landing de evento con los más vendidos por país.",
     "Presupuesto concentrado en 72–96 h.",
     "Segundo evento cíber del año en el Pacífico."),
    ("10", "3.er domingo", "Día de la Madre", "AR", 5, 50,
     "En Argentina la fecha es en octubre: no reciclar el creativo de mayo.",
     "Meta Ads con presupuesto alto y creatividad local.",
     "Pico argentino del año."),
    ("10", "31 oct", "Halloween", "MX, US, CO", 3, 25,
     "Maquillaje de fantasía, FX, disfraces: hay cursos específicos.",
     "TikTok e Instagram con creatividad muy visual.",
     "Nicho concreto con conversión alta en su categoría."),

    # ---------------- NOVIEMBRE ----------------
    ("11", "1–2 nov", "Día de Muertos", "MX", 3, 25,
     "Repostería temática, decoración, maquillaje artístico.",
     "Meta Ads geosegmentado a México.",
     "Antesala del Buen Fin: calienta públicos para retargetear."),
    ("11", "13–17 nov", "El Buen Fin", "MX", 5, 50,
     "Cuenta atrás y landing dedicada. Comunicar días exactos.",
     "El mayor presupuesto del año en México.",
     "Equivalente mexicano del Black Friday."),
    ("11", "4.º viernes", "Black Friday", "TODOS", 5, 50,
     "Campaña con countdown en toda la web. Email a toda la lista.",
     "Presupuesto máximo anual. Retargeting a todo el año de tráfico.",
     "El pico global. Aquí se cobra el trabajo de captación de meses."),
    ("11", "Lunes siguiente", "Cyber Monday", "TODOS, AR", 5, 50,
     "«Última oportunidad»: urgencia real de cierre.",
     "Extensión del presupuesto de Black Friday.",
     "Recupera a quien dudó el viernes."),

    # ---------------- DICIEMBRE ----------------
    ("12", "1–15 dic", "Prima / Aguinaldo", "CO, MX", 5, 50,
     "«Invierte tu prima»: el mismo ángulo que en junio, y funciona igual.",
     "Pauta fuerte: hay liquidez en el mercado.",
     "Ventana de poder adquisitivo, no de festividad."),
    ("12", "15–26 dic", "Navidad", "TODOS", 5, 50,
     "Regalo con utilidad. Formato «regalo que dura todo el año».",
     "Meta + búsqueda. Cerrar pauta el 24 y retomar el 26.",
     "Segundo pico global del año."),
    ("12", "26–31 dic", "Entre fiestas", "TODOS", 3, 25,
     "Preparar el terreno para enero: contenido de balance y propósitos.",
     "Bajar pauta; el CPC sube y la atención cae.",
     "Siembra para el pico de enero."),
]

"""Qué fechas del calendario están ya dadas de alta en `src/lib/promo.ts`.

El calendario es la estrategia; `promo.ts` es lo que la web hace hoy. Sin esta
columna las dos cosas se leen como si fueran la misma y no lo son: hay fechas
recomendadas al 50 % que en el código están al 25 %, y otras que directamente no
existen todavía. Clave: (mes, evento) -> id de campaña o None.
"""
IMPLANTADO: dict[tuple[str, str], str | None] = {
    ("01", "Propósitos de Año Nuevo"): "ano-nuevo-2027",
    ("05", "Día de la Madre"): "dia-madre-2027 · hoy al 25 %, y solo CO y MX",
    ("05", "Hot Sale"): "hot-sale-2027 · hoy al 25 %",
    ("06", "CyberDay"): "cyber-cl-pe-2026 · hoy en octubre, no en junio",
    ("08", "Vuelta a clases"): "regreso-clases-2026",
    ("09", "Amor y Amistad"): "amor-amistad-co-2026",
    ("10", "CyberDay / Cyber Days"): "cyber-cl-pe-2026",
    ("11", "El Buen Fin"): "buen-fin-mx-2026",
    ("11", "Black Friday"): "bf-2026",
    ("11", "Cyber Monday"): "bf-2026 · la ventana llega hasta el lunes",
    ("12", "Navidad"): "navidad-2026",
}

CICLO = [
    ("1. Atracción", "Contenido orgánico constante (Reels, TikTok, blog SEO)",
     "Todo el año, sin descuento", "Tráfico nuevo que aún no compra"),
    ("2. Captación", "Formulario de leads en los cursos sin checkout y en exit-intent",
     "Todo el año", "Lista propia: el activo que no depende del algoritmo"),
    ("3. Nutrición", "Email y WhatsApp con contenido útil del oficio que le interesa",
     "Entre campañas", "Mantener la relación viva hasta la siguiente fecha"),
    ("4. Conversión", "Campaña con countdown, cupón real y urgencia verdadera",
     "Solo en las fechas del calendario", "La venta se concentra aquí"),
    ("5. Retargeting", "Público de quien vio el curso y no compró, con el cupón activo",
     "Durante y 72 h después de cada campaña", "Recupera al que dudó"),
    ("6. Reactivación", "A quien ya compró: cursos complementarios del mismo oficio",
     "45–60 días tras la compra", "El cliente que ya pagó es el más barato de convertir"),
]

COLUMNS = [
    ("mes", 6), ("fecha", 18), ("evento", 30), ("paises", 20), ("relevancia", 12),
    ("descuento", 12), ("cupon", 12), ("en_la_web", 40), ("contenido_organico", 62),
    ("contenido_pago", 62), ("papel_en_el_ciclo", 62),
]

CUPON = {0: "—", 25: "010775", 50: "031016"}
MESES = {"01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril", "05": "Mayo", "06": "Junio",
         "07": "Julio", "08": "Agosto", "09": "Septiembre", "10": "Octubre", "11": "Noviembre",
         "12": "Diciembre"}


def filas() -> list[dict]:
    out = []
    for mes, fecha, evento, paises, rel, desc, org, pago, ciclo in FECHAS:
        out.append({
            "mes": mes, "fecha": fecha, "evento": evento, "paises": paises,
            "relevancia": "★" * rel, "descuento": f"{desc}%" if desc else "sin descuento",
            "cupon": CUPON[desc],
            "en_la_web": IMPLANTADO.get((mes, evento)) or ("—" if not desc else "por dar de alta"),
            "contenido_organico": org,
            "contenido_pago": pago, "papel_en_el_ciclo": ciclo,
        })
    return out


def excel(datos: list[dict]) -> pathlib.Path:
    wb = Workbook()
    wb.remove(wb.active)
    cab = Font(bold=True, color="FFFFFF")
    relleno = PatternFill("solid", fgColor="1F2937")
    COLOR = {"50%": PatternFill("solid", fgColor="FFC7CE"),
             "25%": PatternFill("solid", fgColor="FFF2CC"),
             "sin descuento": PatternFill("solid", fgColor="E7E6E6")}

    def hoja(nombre: str, rows: list[dict]) -> None:
        ws = wb.create_sheet(nombre[:31])
        ws.append([c for c, _ in COLUMNS])
        for c in ws[1]:
            c.font, c.fill = cab, relleno
            c.alignment = Alignment(vertical="center")
        for f in rows:
            ws.append([f[c] for c, _ in COLUMNS])
            pinta = COLOR.get(f["descuento"])
            if pinta:
                for c in ws[ws.max_row]:
                    c.fill = pinta
            for c in ws[ws.max_row]:
                c.alignment = Alignment(vertical="top", wrap_text=True)
        for i, (_, ancho) in enumerate(COLUMNS, start=1):
            ws.column_dimensions[get_column_letter(i)].width = ancho
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

    hoja("CALENDARIO", datos)
    for pais in ("CO", "MX", "ES", "AR", "CL", "PE", "EC", "US"):
        sel = [f for f in datos if pais in f["paises"] or "TODOS" in f["paises"]]
        hoja(pais, sel)
    hoja("SOLO 50%", [f for f in datos if f["descuento"] == "50%"])

    ws = wb.create_sheet("CICLO")
    ws.append(["etapa", "qué se hace", "cuándo", "para qué"])
    for c in ws[1]:
        c.font, c.fill = cab, relleno
    for fila in CICLO:
        ws.append(list(fila))
        for c in ws[ws.max_row]:
            c.alignment = Alignment(vertical="top", wrap_text=True)
    for i, ancho in enumerate([18, 62, 34, 54], start=1):
        ws.column_dimensions[get_column_letter(i)].width = ancho
    ws.freeze_panes = "A2"

    destino = ROOT / "docs/data/calendario-marketing.xlsx"
    wb.save(destino)
    return destino


def pdf(datos: list[dict]) -> pathlib.Path:
    destino = ROOT / "docs/CALENDARIO_MARKETING.pdf"
    doc = SimpleDocTemplate(
        str(destino), pagesize=landscape(A4),
        leftMargin=12 * mm, rightMargin=12 * mm, topMargin=12 * mm, bottomMargin=12 * mm,
        title="Calendario comercial de sably.co",
    )
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=20, spaceAfter=4)
    sub = ParagraphStyle("sub", parent=ss["Normal"], fontSize=9.5, textColor=colors.HexColor("#555"), spaceAfter=10)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=13, spaceBefore=10, spaceAfter=5)
    celda = ParagraphStyle("celda", parent=ss["Normal"], fontSize=7.1, leading=8.6, alignment=TA_LEFT)
    cabe = ParagraphStyle("cabe", parent=celda, fontSize=7.4, textColor=colors.white)

    hist: list = [Paragraph("Calendario comercial de sably.co", h1)]
    hist.append(Paragraph(
        "Fechas por país con su relevancia, el descuento sugerido y el contenido que las acompaña. "
        "El 50 % (cupón 031016) se reserva a los picos del año; el 25 % (010775) cubre las ventanas "
        "intermedias. Entre campañas no hay descuento: el hueco es intencionado — si el 50 % "
        "estuviera siempre disponible dejaría de ser un motivo para comprar hoy.<br/>"
        "La columna <b>¿Está en la web?</b> separa la estrategia de lo que el sitio hace hoy: el ✓ marca "
        "una campaña ya dada de alta en <font face='Courier'>src/lib/promo.ts</font>; el resto está por "
        "montar, y donde el porcentaje del código no coincide con el sugerido aquí, se dice.", sub))

    anchos = [22 * mm, 40 * mm, 26 * mm, 16 * mm, 20 * mm, 38 * mm, 60 * mm, 60 * mm]
    encabezado = ["Cuándo", "Evento", "Países", "Fuerza", "Descuento",
                  "¿Está en la web?", "Contenido orgánico", "Contenido de pago"]

    for mes in sorted({f["mes"] for f in datos}):
        delMes = [f for f in datos if f["mes"] == mes]
        hist.append(Paragraph(MESES[mes], h2))
        tabla = [[Paragraph(f"<b>{h}</b>", cabe) for h in encabezado]]
        for f in delMes:
            web = f["en_la_web"]
            marca = '<font color="#137333">✓ </font>' if web not in ('—', 'por dar de alta') else ''
            tabla.append([
                Paragraph(f["fecha"], celda),
                Paragraph(f"<b>{f['evento']}</b>", celda),
                Paragraph(f["paises"], celda),
                Paragraph(f["relevancia"], celda),
                Paragraph(f"{f['descuento']}<br/><font size=6>{f['cupon']}</font>", celda),
                Paragraph(f"{marca}<font size=6.4>{web}</font>", celda),
                Paragraph(f["contenido_organico"], celda),
                Paragraph(f["contenido_pago"], celda),
            ])
        t = Table(tabla, colWidths=anchos, repeatRows=1)
        estilo = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2937")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D0D0D0")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
        for i, f in enumerate(delMes, start=1):
            if f["descuento"] == "50%":
                estilo.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#FDE7E9")))
            elif f["descuento"] == "25%":
                estilo.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#FFF7E0")))
        t.setStyle(TableStyle(estilo))
        hist.append(t)

    hist.append(PageBreak())
    hist.append(Paragraph("El ciclo: cómo se encadena todo", h1))
    hist.append(Paragraph(
        "Las campañas del calendario solo funcionan si hay público al que anunciarlas. Este es el "
        "circuito: se capta todo el año y se cobra en las fechas fuertes.", sub))
    tabla = [[Paragraph(f"<b>{h}</b>", cabe) for h in ("Etapa", "Qué se hace", "Cuándo", "Para qué")]]
    for etapa, que, cuando, para in CICLO:
        tabla.append([Paragraph(f"<b>{etapa}</b>", celda), Paragraph(que, celda),
                      Paragraph(cuando, celda), Paragraph(para, celda)])
    t = Table(tabla, colWidths=[32 * mm, 90 * mm, 55 * mm, 88 * mm], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2937")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D0D0D0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    hist.append(t)
    hist.append(Spacer(1, 8 * mm))
    hist.append(Paragraph(
        "<b>Automatizarlo.</b> Hoy cada campaña exige un despliegue, porque el calendario vive en "
        "<font face='Courier'>src/lib/promo.ts</font>. Cuando pase al backend de Laravel bastará con "
        "dar de alta la fecha en el panel: el frontend ya consume la misma estructura "
        "(cupón, porcentaje, ventana, países, llave de URL) y <font face='Courier'>resolvePromo()</font> "
        "seguiría funcionando igual leyendo de una API.", ss["Normal"]))

    doc.build(hist)
    return destino


def main() -> None:
    datos = filas()
    x = excel(datos)
    p = pdf(datos)
    print(f"{x.relative_to(ROOT)}")
    print(f"{p.relative_to(ROOT)}")
    print(f"  {len(datos)} fechas · {len({f['mes'] for f in datos})} meses")
    print(f"  con 50%: {sum(1 for f in datos if f['descuento'] == '50%')}"
          f" · con 25%: {sum(1 for f in datos if f['descuento'] == '25%')}"
          f" · sin descuento: {sum(1 for f in datos if f['descuento'] == 'sin descuento')}")


if __name__ == "__main__":
    main()
