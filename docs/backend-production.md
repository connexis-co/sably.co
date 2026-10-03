# Activación del backend productivo

El puente `src/lib/legacy-backend.ts` está preparado para ambos entornos. La preparación no activa producción: `config/wrangler.production.jsonc` mantiene las rutas vacías, `SABLY_CMS_READY=false` y `SABLY_PRODUCTION_ACTIVATED=false`.

Desarrollo guarda pruebas únicamente en `SABLY_DB`, separado de `DB` de EmDash. No entrega credenciales de correo, Meta o GA4 a los handlers, aunque alguien las configure por error en ese Worker. Webhook, recuperación de carritos y refresco externo de precios siguen respondiendo 503. Los formularios indican expresamente que no enviaron correo.

Producción sólo admite la API con `SABLY_ENVIRONMENT=production`, ambas variables runtime `SABLY_CMS_READY=true` y `SABLY_PRODUCTION_ACTIVATED=true`, host `sably.co` o `www.sably.co` y un binding `SABLY_DB` distinto de `DB`. Estos valores del Worker son independientes de la variable del entorno GitHub que autoriza publicar una versión. Un candidato sin activar o un hostname alternativo responde 503 antes de consultar D1.

## Contratos y credenciales

Los secretos se configuran en el Worker productivo, nunca en el repositorio ni en los argumentos de comandos. El puente permite sólo los siguientes nombres, y cada integración recibe exclusivamente sus credenciales:

| Binding del Worker | Nombre recibido por el handler | Uso |
| --- | --- | --- |
| `SABLY_TURNSTILE_SECRET` | `TURNSTILE_SECRET` | Verificación de formularios |
| `SABLY_IP_SALT` | `IP_SALT` | Identificadores de abuso sin guardar IP cruda |
| `SABLY_SNAPSHOT_TOKEN` | `SNAPSHOT_TOKEN` | Snapshot, ventas, siembra de subjects, carga de precios y recuperación |
| `SABLY_HOTMART_HOTTOK` | `HOTMART_HOTTOK` | Autenticación del webhook de Hotmart |
| `SABLY_RESEND_API_KEY` | `RESEND_API_KEY` | Avisos al equipo por leads; recuperación si no hay Brevo |
| `SABLY_BREVO_API_KEY` | `BREVO_API_KEY` | Recuperación de carritos |
| `SABLY_NOTIFY_EMAIL`, `SABLY_NOTIFY_FROM` | `NOTIFY_EMAIL`, `NOTIFY_FROM` | Destinatario del equipo y remitente verificado |
| `SABLY_META_CAPI_TOKEN`, `SABLY_META_CAPI_PIXEL_ID`, `SABLY_META_TEST_EVENT_CODE` | Nombres sin prefijo `SABLY_` | Conversión de Hotmart a Meta |
| `SABLY_GA4_API_SECRET`, `SABLY_GA4_MEASUREMENT_ID` | Nombres sin prefijo `SABLY_` | Conversión de Hotmart a GA4 |

`POST /api/hotmart-webhook` exige `SABLY_HOTMART_HOTTOK` configurado. Su ausencia da 503; un encabezado `x-hotmart-hottok` incorrecto da 403. No conserva la apertura permisiva del handler histórico cuando faltaba ese secreto. El GET sólo devuelve estado del servicio. Los errores de proveedores o D1 en la respuesta JSON se reducen a `error`, para no devolver URLs con credenciales o detalles internos.

`GET /api/v1/abandonos-notify?key=...` conserva el contrato autenticado por `SABLY_SNAPSHOT_TOKEN`. Al tratarse de un GET con envío de correo, HEAD devuelve 405 sin ejecutarlo. No hay un nuevo cron de recuperación automática. `POST /api/v1/precios/refresca` conserva el contrato público del navegador: sólo consulta productos registrados en D1 y reutiliza precios capturados hace menos de 30 minutos. No acepta una URL del visitante.

Snapshot, subjects y carga de precios conservan Bearer; ventas y recuperación conservan el parámetro `key` heredado. No se incluyen estos valores en documentación, logs ni manifiestos. El secreto GitHub `SNAPSHOT_TOKEN` para el workflow manual de precios debe coincidir con el binding runtime `SABLY_SNAPSHOT_TOKEN`.

## Prerrequisitos del corte

Antes de activar el dominio y los dos flags runtime, completar el catálogo productivo y su esquema operativo, respaldar ambos sistemas y coordinar la última transferencia de eventos. Los datos de clientes, leads y ventas no se copian desde producción a desarrollo.

Comprobar el HOTTOK de Hotmart, la propiedad GA4 y el píxel Meta correctos, el remitente verificado y los destinatarios. La URL de origen de Meta y el enlace de recuperación apuntan a `https://sably.co/`. Cada reenvío de medición exige tanto su ID explícito como su secreto: no hay propiedades ni píxeles de respaldo de otros proyectos. Con sólo el HOTTOK, el webhook puede guardar el evento sin reenviarlo a medición. Sin credenciales de correo, los leads se guardan y el handler informa que no envió correo.

El panel privado de operaciones usa el mismo helper de activación y separación D1 que la API. Conserva la autenticación y permisos de EmDash: la activación del entorno no sustituye la autorización del administrador/editor.

La validación local cubre aislamiento D1, gates de entorno/host, autenticación ausente/incorrecta, método HEAD sin efectos, mapeo de credenciales, respuesta nativa productiva, eliminación de errores sensibles y propiedades de medición explícitas. Todas las llamadas externas de esas pruebas están interceptadas; no se envían correos, conversiones ni solicitudes reales a Hotmart. Ejecutar con `node --import tsx --test src/lib/legacy-backend.test.ts tests/operational-environment.test.ts tests/sably-operations.test.ts`.
