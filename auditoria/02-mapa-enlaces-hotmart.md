# Mapa de enlaces y acortadores Hotmart — Cursos de belleza (Seminarios Online)

> Documento de trabajo para mapear **todas las opciones de venta por producto** y
> estandarizar los acortadores `hotm.art`. Se completará con los enlaces base
> `go.hotmart.com/<HOTLINK>` cuando haya acceso a la API/panel de Hotmart desde
> el entorno (ver `auditoria/00-bloqueo-de-red.md`).

## Convención de nombres

Slug del producto: nombre identificable, en minúsculas, **sin espacios, sin acentos ni ñ**
(`ñ` → `n`), palabras separadas por guiones.

| Tipo de página | Sufijo del acortador | Enlace base (patrón Hotmart) | Uso |
|---|---|---|---|
| Página de ventas del curso | `-curso-venta-SO` | `go.hotmart.com/<HOTLINK>` | Uso provisional: página de ventas de Seminarios Online |
| Página de producto (marketplace) | `-curso-producto` | `go.hotmart.com/<HOTLINK>?dp=1` | Ficha de producto Hotmart |
| Checkout limpio (crashing / pago directo) | `-curso-crashing` | `go.hotmart.com/<HOTLINK>?ap=<código>` | Tráfico caliente → pago directo sin distracciones |
| Checkout creado por Seminarios.Online® | `-curso-checkout-SO` | `go.hotmart.com/<HOTLINK>?ap=<código>` | Checkout con branding SO |

**Regla de comisión**: todo enlace publicado debe ser el **hotlink de afiliado**
(`go.hotmart.com/<HOTLINK>` propio del afiliado, con `?ap=` cuando aplique). Nunca
publicar la URL "limpia" del productor: se pierde la atribución de la comisión.

## Productos actuales en la web

### 1. Maquillaje Social
| Página | Acortador | Enlace base | Estado |
|---|---|---|---|
| Ventas curso (provisional) | `https://hotm.art/maquillaje-social-curso-venta-SO` | _pendiente confirmar hotlink_ | ✅ creado (según registro del propietario) |
| Crashing pago directo | `https://hotm.art/maquillaje-social-curso-crashing` | _pendiente confirmar hotlink + ?ap_ | ✅ creado |
| Página de producto | `https://hotm.art/maquillaje-social-curso-producto` | `…?dp=1` | ⬜ por crear |
| Checkout SO | `https://hotm.art/maquillaje-social-curso-checkout-SO` | `…?ap=` | ⬜ por crear |

### 2. Aprende Barbería y Monta tu Negocio
| Página | Acortador | Enlace base | Estado |
|---|---|---|---|
| Ventas curso (provisional) | `https://hotm.art/barberia-negocio-curso-venta-SO` | _pendiente_ | ✅ creado |
| Crashing pago directo | `https://hotm.art/barberia-negocio-curso-crashing` | _pendiente_ | ✅ creado |
| Página de producto | `https://hotm.art/barberia-negocio-curso-producto` | `…?dp=1` | ⬜ por crear |
| Checkout SO | `https://hotm.art/barberia-negocio-curso-checkout-SO` | `…?ap=` | ⬜ por crear |

### 3. Especialista en uñas
| Página | Acortador | Enlace base | Estado |
|---|---|---|---|
| Ventas curso (provisional) | `https://hotm.art/especialista-en-unas-curso-venta-SO` | _pendiente_ | ✅ creado |
| Crashing pago directo | `https://hotm.art/especialista-en-unas-curso-crashing` | _pendiente_ | ✅ creado |
| Página de producto | `https://hotm.art/especialista-en-unas-curso-producto` | `…?dp=1` | ⬜ por crear |
| Checkout SO | `https://hotm.art/especialista-en-unas-curso-checkout-SO` | `…?ap=` | ⬜ por crear |

### 4. Masajista Master desde Cero
| Página | Acortador | Enlace base | Estado |
|---|---|---|---|
| Ventas curso (provisional) | `https://hotm.art/masajista-master-cero-curso-venta-SO` | _pendiente_ | ✅ creado |
| Crashing pago directo | `https://hotm.art/masajista-master-cero-curso-crashing` | _pendiente_ | ✅ creado |
| Página de producto | `https://hotm.art/masajista-master-cero-curso-producto` | `…?dp=1` | ⬜ por crear |
| Checkout SO | `https://hotm.art/masajista-master-cero-curso-checkout-SO` | `…?ap=` | ⬜ por crear |

### Referencia observada (panel Hotmart)
Producto con hotlink `Y76953276W` (capturas del 2026-08-05):
- Ventas: `https://go.hotmart.com/Y76953276W`
- Producto: `https://go.hotmart.com/Y76953276W?dp=1`
- Checkout limpio (crashing): `https://go.hotmart.com/Y76953276W?ap=e8ab`
- Checkout Seminarios.Online: `https://go.hotmart.com/Y76953276W?ap=16ea`

_Pendiente: confirmar a cuál de los 4 productos corresponde `Y76953276W` y
completar los hotlinks de los demás desde el panel/API._

## Inventario real de acortadores en uso (GA4, 20 meses)

La auditoría del 2026-08-05 encontró **111 URLs Hotmart únicas con clics** en 63
páginas del sitio — el sitio ya monetiza muchos más cursos que los 4 de arriba.
Lista completa en `datos/hotmart_links_unique_ga4.json`; mapa página→enlaces en
`datos/page_to_hotmart_map_compact.json`. Los ~60 slugs `-curso-venta-SO` en uso
siguen la convención (top por clics):

`masajista-experto` (721) · `cuidado-facial-con-dermapen` (626) ·
`masaje-descontracturante` (558) · `reduccion-corporal` (460) ·
`limpieza-facial-con-aparatologia` (408) · `spa-con-maderoterapia` ·
`colorimetria-para-estilistas` · `limpieza-facial-profunda` ·
`cejas-perfectas-microblading` · `experta-extension-pestanas` ·
`diseno-cejas-con-hilo-y-henna` · `cejas-tresd` · `spa-en-casa` ·
`rejuvenecimiento-facial-holistico` · `unas-press-on-nails` ·
`manicurista-profesional-premium` · `maquillaje-profesional-para-novias` ·
`drenaje-facial-pro` · `diseno-perfilado-de-cejas` · `pestanas-premium` ·
`estilista-a-domicilio` · `maquillaje-pro-redes-sociales` · … (resto en el JSON)

### ⚠️ Enlaces con riesgo de comisión

1. **7 checkouts directos sin referencia de afiliado visible**, usados sobre todo
   en páginas de barbería: `pay.hotmart.com/{H43635981L, D60401162V, J41994495N,
   S63192888Y, C63857704B, W69842801W, O42828007I}?checkoutMode=10`. Un checkout
   sin token de afiliado atribuye la venta al productor → **comisión perdida**.
   Validar cada uno con `scripts/hotmart/validar_enlaces.py` y en el checkout
   real (siglas REF abajo a la derecha). Reemplazar por el hotlink propio.
2. **Enlaces fuera de convención**: `hotm.art/especialista-en-unas-curso` (sin
   sufijo `-venta-SO`), `http://hotm.art/diseno-cejas-con-hilo-y-henna-curso-venta-SO`
   (http sin s).
3. **Campañas muertas**: los `*-curso-crashing?offDiscount=031016` (barbería,
   cejas, limpieza facial, uñas acrílicas) dejaron de recibir clics en 2026 —
   confirmar si las páginas perdieron el CTA o fueron despublicadas.

## Cursos de belleza faltantes (candidatos a añadir)

Catálogo completo del productor MasterClasses.La® en
`datos/seminarios_online_catalogo_belleza.json` (37 cursos de belleza activos).
Cursos activos sin página dedicada ni clics, con acortadores propuestos según la
convención:

| Curso (ID producto) | Acortadores propuestos |
|---|---|
| Maquillaje Permanente (`J44578783I`) | `maquillaje-permanente-curso-venta-SO` / `-crashing` |
| Master en Extensiones de Pestañas (`L79896912J`) | `master-extensiones-pestanas-curso-venta-SO` / `-crashing` |
| Experta en Extensiones de Pestañas (`G75458369D`) | `experta-extensiones-pestanas-curso-venta-SO` / `-crashing` |
| Master en Uñas Acrílicas (`C55918118T`) | `master-unas-acrilicas-curso-venta-SO` / `-crashing` |
| Uñas Acrílicas, Semipermanentes y Tech Gel (`V45366158M`) | `unas-acrilicas-semi-techgel-curso-venta-SO` / `-crashing` |
| Tintes Master (`L50322226B`) | `tintes-master-curso-venta-SO` / `-crashing` |
| Estilista Premium (`O63751953D`) | `estilista-premium-curso-venta-SO` / `-crashing` |
| Experta en Extensiones de Cabello (`G60509134A`) | `experta-extensiones-cabello-curso-venta-SO` / `-crashing` |
| Trenzas y Peinados (`D41737748T`) | `trenzas-y-peinados-curso-venta-SO` / `-crashing` |
| Maquillaje Pro para Redes Sociales (`T61997327V`) | `maquillaje-pro-redes-curso-venta-SO` / `-crashing` |
| Maquillaje Artístico (`Q42346472T`) | `maquillaje-artistico-curso-venta-SO` / `-crashing` |
| Automaquillaje Master (`U59401097I`) | `automaquillaje-master-curso-venta-SO` / `-crashing` |
| Masajista Expert (`I46337891M`) | `masajista-expert-curso-venta-SO` / `-crashing` |
| Emprende como Masajista Terapéutico (`T61450956V`) | `masajista-terapeutico-curso-venta-SO` / `-crashing` |

IDs de los 4 productos priorizados: Maquillaje Social `N41531652U` · Aprende
Barbería y Monta tu Negocio `P63130893D` · Especialista en Uñas `J43302170O` ·
Masajista Master desde Cero `K63104274A`.

## Sobre la creación de acortadores por API

La API pública de Hotmart (`developers.hotmart.com`) **no documenta ningún
endpoint para crear acortadores `hotm.art`** ni para listar/crear hotlinks: sus
módulos públicos son Payments (ventas, comisiones, reembolsos), Products/Offers
(lectura), Club (área de miembros) y Webhooks. El acortador se crea desde la UI
(botón "Acortar link" en la página del hotlink). `scripts/hotmart/hotmart_api.py
shortener` sondea rutas plausibles para dejar constancia empírica.

**Alternativa recomendada (mejor para sably):** acortador propio bajo el dominio
de sably (p. ej. `sably.co/go/maquillaje-social-crashing`) implementado como
redirect 301/302 en el backend Laravel. Ventajas: control total de slugs, métricas
propias por clic (además de las de Hotmart), posibilidad de cambiar el destino sin
reimprimir el enlace, UTM automáticos, y cero dependencia de la UI de Hotmart.
Los `hotm.art` pueden mantenerse para uso en redes/impresos donde convenga la
marca Hotmart.
