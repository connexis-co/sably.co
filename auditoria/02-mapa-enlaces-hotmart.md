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

## Cursos de belleza candidatos a añadir

_Se completa con el resultado de la investigación del catálogo de Seminarios
Online (ver `01-auditoria-seo-funcional.md`, sección "Cursos faltantes")._

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
