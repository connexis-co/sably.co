# Estado de los enlaces de Hotmart en sably.co

De los **121 cursos publicados**, **79** llevan a un checkout real con atribución de comisión y **42** todavía no.

Un curso cuenta como vendible cuando su `.mdx` tiene un `hotmartUrl` real (no el placeholder `PENDIENTE`) **y** un `hotmartRef`. El `ref` es lo que acredita la comisión: sin él el checkout funciona igual, pero la venta se le abona al productor.

Los cursos sin enlace no se despublican: su CTA capta el lead y avisa de que las inscripciones están cerradas por ahora.


## Resumen

| Estado | Cursos |
|---|---|
| Vendibles (checkout + ref) | **79** |
| Fuera del cruce: no está en el TSV | 32 |
| No existe en el catálogo de Seminarios Online | 6 |
| Varios candidatos: falta elegir cuál | 3 |
| Acortador sin cerrar (ERROR) | 1 |

Estados que dejó `scripts/hotmart-acortadores.mjs`:

| Estado | Cursos | Significado |
|---|---|---|
| `OK` | 83 | Los dos acortadores creados y verificados con el `ref` correcto |
| `ERROR` | 1 | Falló; el motivo queda en el campo `nota` |

## Fuera del cruce: no está en el TSV (32)

| Curso | Categoría | Detalle |
|---|---|---|
| `curso-de-adiestramiento-canino-en-positivo` | cuidado-animal | — |
| `curso-de-aire-acondicionado` | oficios | — |
| `curso-de-automaquillaje` | belleza-online | — |
| `curso-de-barberia-como-negocio` | emprendimiento | — |
| `curso-de-barberia-infantil` | belleza-online | — |
| `curso-de-barismo-y-cafe-de-especialidad` | gastronomia | — |
| `curso-de-bartending-y-cocteleria-profesional` | hospitalidad | — |
| `curso-de-bouquets-con-globos` | manualidades | — |
| `curso-de-cejas-y-pestanas` | belleza-online | — |
| `curso-de-depilacion` | belleza-online | — |
| `curso-de-electricidad-residencial-certificado` | oficios | — |
| `curso-de-finanzas-para-tu-negocio` | emprendimiento | — |
| `curso-de-flores-con-globos` | manualidades | — |
| `curso-de-globoflexia` | manualidades | — |
| `curso-de-globos-burbuja` | manualidades | — |
| `curso-de-instructor-de-yoga-desde-cero` | bienestar | — |
| `curso-de-jabones-artesanales-para-vender` | manualidades | — |
| `curso-de-lenceria-y-ropa-interior-a-medida` | moda-y-confeccion | — |
| `curso-de-maquillaje-de-fantasia` | belleza-online | — |
| `curso-de-masaje-descontracturante` | bienestar | — |
| `curso-de-masaje-reductor` | bienestar | — |
| `curso-de-masajes-terapeuticos-y-relajantes` | bienestar | — |
| `curso-de-nutricion-practica-para-la-familia` | bienestar | — |
| `curso-de-parrilla-y-asados-como-un-maestro` | gastronomia | — |
| `curso-de-patronaje-profesional-de-ropa` | moda-y-confeccion | — |
| `curso-de-peinados` | belleza-online | — |
| `curso-de-peluqueria` | belleza-online | — |
| `curso-de-peluqueria-canina-profesional` | cuidado-animal | — |
| `curso-de-tortas-decoradas-desde-cero` | panaderia-y-pasteleria | — |
| `curso-de-velas-artesanales-y-aromaticas` | manualidades | — |
| `curso-de-ventas-por-whatsapp-y-redes` | emprendimiento | — |
| `curso-de-wedding-planner-y-eventos` | hospitalidad | — |

## No existe en el catálogo de Seminarios Online (6)

Mauricio Duque no tiene un producto equivalente. Para venderlos hay que buscar otro productor en el mercado de afiliación con comisión superior al 20 %, afiliarse y repetir el proceso.

| Curso | Categoría | Detalle |
|---|---|---|
| `curso-de-confeccion-de-trajes-de-bano` | moda-y-confeccion | NO_EXISTE_EN_CATALOGO: buscar otro productor con comisión > 20% |
| `curso-de-drenaje-linfatico` | bienestar | NO_EXISTE_EN_CATALOGO: buscar otro productor con comisión > 20% |
| `curso-de-pollo-broaster` | gastronomia | NO_EXISTE_EN_CATALOGO: buscar otro productor con comisión > 20% |
| `curso-de-soldadura` | oficios | NO_EXISTE_EN_CATALOGO: buscar otro productor con comisión > 20% |
| `curso-de-tatuaje` | oficios | NO_EXISTE_EN_CATALOGO: buscar otro productor con comisión > 20% |
| `curso-de-unas` | belleza-online | NO_EXISTE_EN_CATALOGO: buscar otro productor con comisión > 20% |

## Varios candidatos: falta elegir cuál (3)

Hay más de un producto que encaja y la elección es comercial, no técnica. Los candidatos están en la tercera columna de `docs/data/afiliacion-seminarios.tsv`; al dejar uno solo, el script los procesa en la siguiente pasada.

| Curso | Categoría | Detalle |
|---|---|---|
| `curso-de-corte-y-confeccion` | moda-y-confeccion | VARIOS_CANDIDATOS: 5973C29604596 Costura Premium / 6577E44213624 El Negocio de la Alta Costura |
| `curso-de-marketing-digital` | emprendimiento | VARIOS_CANDIDATOS: 6271E78671833 Entendiendo el Marketing Digital / 9781M41539314 Marketing Digital para Resta |
| `curso-de-resina-epoxica` | manualidades | VARIOS_CANDIDATOS: 0931C52923971 Cuadros con Resina Epóxica / 2725A48637685 Aprende Mesas con Resina / 0443A76 |

## Acortador sin cerrar (ERROR) (1)

El producto existe y la cuenta está afiliada, pero el acortador no quedó verificado. Se resuelve relanzando el script: reprocesa todo lo que no esté en `OK`.

| Curso | Categoría | Detalle |
|---|---|---|
| `curso-de-barista` | hospitalidad | Afiliacion completada el 2026-08-11 (producto 3451430, comision USD$137,65), pero app.hotmart.com/hotlinks/345 |

## Cómo se retoma

```bash
# Chrome cerrado del todo, luego:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-hotmart"
# inicia sesión en app.hotmart.com y:
node scripts/hotmart-acortadores.mjs     # reprocesa todo lo que no esté en OK
python3 scripts/aplicar-acortadores.py   # vuelca los verificados al catálogo
python3 scripts/build-informe-acortadores.py  # regenera este informe
```
