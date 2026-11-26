# Feed de cursos de Sably en OpenAI Ads (anuncios de ChatGPT)

26-nov-2026 (UTC). Cuenta `adacct_6b077b01c208819780ad747f8eac2255` (Sably, COP, America/Bogota, solo Colombia).
Fuentes: https://developers.openai.com/ads/llms-full.txt (secciones *Product Feeds*, *Delta Feeds API*, *Ads*,
*Campaigns*, *Targeting*) y https://developers.openai.com/commerce/specs/file-upload/products (esquema), leídas hoy.

## 0 · Estado

| Pieza | Estado |
|---|---|
| Feed en la cuenta | **Creado por API**: `fd_ae6b407a30a6de2eb2801f524f57f89f`, «Sably cursos CO», países `["CO"]` |
| Acceso SFTP | **Activo** con clave SSH RSA 4096: `sftp://oaiproductfeedprod3.sftpe983a7c6a510468b83b9017e4ee094e8@sftp-prod3.commerce.openai.com:443/` |
| Primera subida | `sably-cursos-co.csv`, 112 cursos, 26-nov 01:00 UTC → ver §6 |
| Regeneración automática | Workflow `.github/workflows/feed-openai-ads.yml`, dos veces al día (00:20 y 12:20 de Bogotá). **Empieza a correr cuando el PR llegue a `main`** (GitHub solo programa workflows de la rama por defecto) |
| Secretos del repo | Cargados: `OPENAI_FEED_SFTP_KEY`, `OPENAI_ADS_API_KEY` (secretos), `OPENAI_FEED_SFTP_URI`, `OPENAI_FEED_ID` (variables) |
| Campañas de feed | **No creadas** (lo decide la sesión de campañas; §7 tiene la receta) |

## 1 · Cómo funciona el sistema de feeds de OpenAI Ads

- **Qué es.** Un catálogo por cuenta. Una campaña `mode: "product_feed"` se liga a un feed; cada grupo elige productos
  con filtros (`product_set`) y lleva **un solo** anuncio `product_ad_template`, que rellena título, cuerpo, precio,
  imagen y URL de destino con el producto que se muestra. La campaña no puede cambiar de feed, modo ni objetivo después.
- **Formato.** CSV (o JSONL) UTF-8, una fila por artículo, en la raíz del SFTP (sin carpetas). Campos obligatorios:
  `item_id`, `title`, `description`, `url`, `brand`, `seller_name`, `image_url`, `availability`, `price` y, de
  mercado, `target_countries` y `store_country`. Para anuncios, `is_ads_eligible=true` (si falta, el artículo no se
  procesa para Ads). Precio en unidades mayores con código ISO: `374860 COP`; `sale_price` opcional, estrictamente menor.
  `ads_metadata` (JSON) admite etiquetas `custom_label_N` para filtrar grupos.
- **Cómo se carga.** Se crea el feed por API (`POST /v1/feeds`), se abre el SFTP (`POST /v1/feeds/{id}/sftp_access`,
  contraseña o clave pública) y se sube el archivo. **OpenAI no lee una URL nuestra**: la opción de URL alojada existe
  (`hosted_url_configured` en el listado) pero para esta cuenta responde `403 product_feed_hosted_url_api_disabled`.
  Tampoco hay subida por API: es SFTP o nada. El SFTP es Azure (`AzureSSH_1.0.0`) y **rechaza claves ed25519**: RSA o ECDSA.
- **Frecuencia.** La que pongamos: cada subida completa se procesa de forma asíncrona (`scanning → processing →
  completed / completed_with_errors / failed`, en `GET /v1/feeds/uploads`). Precio, título y disponibilidad se pueden
  cambiar al instante con el Delta API (`PATCH /v1/feeds/{id}/products`), que no añade productos.
- **Reemplazo completo.** `PATCH /v1/feeds/{id}/settings {"is_full_refresh": true}` haría que lo que falte en una subida
  se borre en un día. **Para esta cuenta da `403 Full feed replacement is not enabled`.** Por eso el script marca
  agotados (`out_of_stock`, Delta API) los cursos que ya no salen del sitio.
- **Revisión.** Cada producto pasa revisión de políticas (`GET /v1/feeds/{id}/products?is_approved=false&include_rejection_reasons=true`).
  Un producto subido no sirve hasta estar aprobado, disponible y dentro del filtro de un grupo activo.
- **Beta / habilitación.** La guía pide «Product feed API access for the account» y avisa de que Delta y URL alojada
  se habilitan por cuenta. Lo comprobado en Sably: crear feed, SFTP, listar subidas y `items/query` **funcionan**;
  reemplazo completo y URL alojada **no**. Las campañas de feed con oCPC están en *open beta*; con clics y puja fija, no.
  Las campañas de feed solo segmentan por país.
- **Mercados.** El esquema dice que el formato compartido hoy representa US, CA y MX y que las subidas estándar usan
  US «salvo que OpenAI confirme otros mercados». El feed se creó con `["CO"]` sin error y la cuenta solo sirve en
  Colombia; el resultado de la subida (§6) es la prueba de si CO se acepta.
- **Cursos (productos digitales).** No hay campo ni política que los excluya en la guía de Ads; `is_digital` existe pero
  «requiere configuración» y no se envía. El destino es la ficha propia (`url`), no Hotmart: OpenAI solo exige que sea
  pública y HTTPS. El pago sigue en Hotmart desde la ficha; `is_eligible_checkout=false` (sin checkout en ChatGPT).
- **Seguimiento.** Los parámetros de la campaña, grupo o anuncio (`landing_page_configuration.query_string_template`)
  **pisan** a los del feed con la misma clave (orden «Feed < Cuenta < Campaña < Grupo < Anuncio»). Si la campaña de feed
  pone su propio `utm_campaign`, reemplaza `co_feed`; `promo=ads50` no se toca porque ninguna capa lo define.

## 2 · Qué contiene el feed

Generado por `scripts/feed-openai-ads.mjs` desde lo que la ficha pública sirve (no desde el catálogo interno; memoria
«verificar la página, no el catálogo»):

| Campo | De dónde sale |
|---|---|
| lista de cursos | `https://sably.co/search-index.json` (120) |
| `item_id` | `co-<slug>` (estable) |
| `title` | `name` del JSON-LD `Course`; si pasa de 50 caracteres y tiene «:», lo previo a «:» (límite del título del anuncio) |
| `description` | meta description de la ficha sin sus frases de pago/llamada a la acción (PSE, Nequi, «Inscríbete hoy»); si la meta viene recortada con «…», la `description` del JSON-LD |
| `price` / `sale_price` | panel de compra `data-purchase-panel`: `data-base-amount` y, si `data-cupon="aplicado"`, `data-reduced-amount`, en COP |
| `url` | `https://sably.co/co/<slug>/?` + `promo=ads50&` **solo si** `body[data-proveedor="masterclasses"]` + `utm_source=chatgpt_ads&utm_medium=cpc&utm_campaign=co_feed` |
| `image_url` | `og:image` (portada a tamaño completo; se comprueba que responde como imagen) |
| `product_category` | `Cursos online > <categoría>` (`about` del JSON-LD) |
| `brand`, `seller_name` | `Sably` (nunca el creador) |
| `ads_metadata` | `custom_label_0`: `con_cupon` / `sin_cupon`; `custom_label_1`: categoría en slug |

**Fuera** (8 el 26-nov): fichas sin panel de compra (`data-estado="cerrado"`: adiestramiento canino, trajes de baño,
yoga, lencería, parrilla, patronaje, resina epóxica, tatuaje). También quedaría fuera un curso sin precio en COP, sin
botón de pago a un host de Hotmart permitido (`allowedHotmartUrl`), no disponible o con portada rota.

**Vocabulario** (lo aplica y lo valida el script): fuera cualquier frase con «afiliado», «catálogo» o el nombre del
creador; una fila que aún los contenga no se publica. **«Certificado» se deja tal como lo dice la ficha**: decisión de
JP del 26-nov-2026 («debe quedar como certificado»). La primera versión del script lo cambiaba a «constancia»; se quitó
y el feed se resubió a las 01:42 UTC.

El 26-nov: 112 cursos, 106 del creador con cupón (con `promo=ads50` y precio de oferta al 50 %) y 6 sin cupón (barista,
drenaje linfático, marketing digital, peluquería, pollo broaster y soldadura, a precio de lista).

## 3 · Automatización

- `.github/workflows/feed-openai-ads.yml`: a las 05:20 y 17:20 UTC (y a mano con *Run workflow*) corre las pruebas,
  genera el CSV, lo sube por SFTP con el mismo nombre (lo reemplaza) y marca agotados los cursos que ya no están.
  Guarda el CSV como artefacto 14 días.
- **Freno:** con menos de 60 cursos no sube nada (un fallo del sitio no publica un feed a medias) y el job falla, lo que
  avisa por correo de GitHub.
- La clave privada SFTP vive en `~/.config/connexis/openai-ads-feed-sftp` (Mac de JP) y en el secreto
  `OPENAI_FEED_SFTP_KEY`. La pública está registrada en el feed.

A mano, desde el repo:

```bash
OPENAI_FEED_SFTP_URI="sftp://oaiproductfeedprod3.sftpe983a7c6a510468b83b9017e4ee094e8@sftp-prod3.commerce.openai.com:443/" OPENAI_FEED_SFTP_KEY_FILE=~/.config/connexis/openai-ads-feed-sftp OPENAI_FEED_ID=fd_ae6b407a30a6de2eb2801f524f57f89f OPENAI_ADS_API_KEY="$(cat ~/.config/connexis/openai-ads-apikey)" node scripts/feed-openai-ads.mjs --out=/tmp/sably-cursos-co.csv --upload
```

Sin `--upload` solo genera el CSV y lista lo que queda fuera.

## 4 · Mantenimiento

- **Ver si una subida entró:** `GET /v1/feeds/uploads` (estado, filas aceptadas/rechazadas, diagnósticos).
- **Ver productos y revisión:** `POST /v1/feeds/fd_ae6b407a30a6de2eb2801f524f57f89f/items/query {"filters":[],"limit":500}`
  y `GET /v1/feeds/fd_…/products?is_approved=false&include_rejection_reasons=true`.
- **Cambio de promoción:** no hay que tocar nada; el precio sale de la ficha en cada pasada. Ojo al 1-ene-2027: si la
  promoción del sitio baja al 25 % (cupón `010775`) y `ads50` sigue al 50 %, la ficha sin parámetro pintará el 25 % y el
  feed también; revisar ese día que el precio del feed coincida con lo que ve quien entra con `?promo=ads50`.
- **Nuevo curso:** basta con publicarlo en el CMS; aparece en `search-index.json` y entra en la siguiente pasada.
- **Rotar la clave SFTP:** generar RSA (`ssh-keygen -t rsa -b 4096 -m PEM`), `POST /v1/feeds/{id}/sftp_access` con la
  pública (reemplaza la anterior) y actualizar el secreto `OPENAI_FEED_SFTP_KEY`.
- **Si OpenAI habilita el reemplazo completo:** `PATCH /v1/feeds/fd_…/settings {"is_full_refresh": true}`; el marcado
  de agotados puede quedarse (no estorba).

## 5 · Pendiente para JP

1. Fusionar el PR en `develop` y llevarlo a `main` con la siguiente tanda: hasta entonces la regeneración no corre sola
   (la primera subida ya está hecha a mano).
2. (Opcional) Pedir a OpenAI, desde Ads Manager o al equipo de cuenta, «full feed replacement» y «hosted URL» para el
   feed. Con URL alojada se podría servir el feed desde sably.co en vez de subirlo.

## 6 · Resultado de la primera subida

`sftp_8a843f3ea5884ce5850d41c929345ae3`, subida 26-nov 01:00:30 UTC, **`completed` a las 01:08:00**:
**112 filas aceptadas, 112 aptas para anuncios, 0 rechazadas, sin diagnósticos.** Colombia y COP se aceptan.

Justo después, `items/query` y `products/query` devolvían 0 productos (la indexación va por detrás del procesamiento)
y la consulta de revisión respondió `403 product_feed_approval_status_api_disabled`: **esta cuenta no puede ver por
API si cada curso quedó aprobado**; eso se mira en Ads Manager (Feeds) o en el `serving_issues` del anuncio cuando
exista la campaña.

Permisos de la cuenta comprobados el 26-nov:

| Función | Estado |
|---|---|
| Crear feed, SFTP, historial de subidas, `items/query`, `products/query` | Funciona |
| Reemplazo completo (`is_full_refresh`) | 403 «not enabled» |
| URL alojada | 403 `product_feed_hosted_url_api_disabled` |
| Estado de revisión por producto | 403 `product_feed_approval_status_api_disabled` |
| Delta API (`PATCH /feeds/{id}/products`) | No da 403 (acceso no bloqueado), pero el 26-nov respondía `503 Product updates are temporarily unavailable` mientras el feed tenía 0 productos indexados |

**Indexación pendiente.** A las 01:35 UTC, 35 min después de `completed`, `items/query`, `products/query` y el
`product_count` del feed seguían en 0. Puede ser solo demora o que la indexación de productos aún no cubra Colombia (el
esquema dice que el formato compartido hoy representa US, CA y MX). **Qué mirar:** `GET /v1/feeds?include[]=product_count`
(`product_count` y `ready_count`) o Ads Manager › Feeds. Si a las 24 h sigue en 0 con la subida `completed`, es el
mercado: pedir a OpenAI (Ads Manager › ayuda, o el equipo de cuenta) que habilite el feed de productos para CO en la
cuenta `adacct_6b077b01c208819780ad747f8eac2255`, feed `fd_ae6b407a30a6de2eb2801f524f57f89f`. Hasta que haya productos,
no se puede crear una campaña de feed útil. Si la retirada de cursos falla, el job lo deja como aviso (`::warning::`)
y no se da por fallido: la subida ya está hecha.

## 7 · Cuando se decida la campaña de feed (no creada)

- Campaña: `mode: "product_feed"`, `product_feed_id: "fd_ae6b407a30a6de2eb2801f524f57f89f"`, `bidding_type: "clicks"`,
  país `CO`, creada en `paused`.
- Grupo: puja fija en COP (micros) y `product_set.filters` con `ads_metadata.custom_label_0 in ["con_cupon"]` para quedarse
  con los cursos al 50 %, o `item_id in [...]` para los de `../campanas/CURSOS-PARA-CAMPANAS.md`. Probar antes con
  `POST /v1/feeds/fd_…/products/query`.
- Anuncio: `{"type":"product_ad_template","title":"{{product.title}}","body":"{{product.body}}","price":"{{product.price}}"}`.
  El título del anuncio admite 50 caracteres y el cuerpo 100; dos títulos del feed tienen 51 y 77 descripciones
  pasan de 100: comprobar en la vista previa cómo los corta OpenAI.
- Si la campaña define `utm_campaign`, pisa `co_feed`.
