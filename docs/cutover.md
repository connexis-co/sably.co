# Paso inicial de Sably a EmDash en producción

Este procedimiento prepara y verifica el corte de `sably.co`. No ejecuta el cambio de dominio ni acredita que ya se haya realizado. El destino es `sably-emdash-production`, con los recursos de `config/wrangler.production.jsonc`; desarrollo conserva su Worker, CMS, operaciones, medios y sesiones independientes.

La configuración revisada mantiene `routes: []`, `workers_dev: false`, `preview_urls: false`, `SABLY_CMS_READY=false` y `SABLY_PRODUCTION_ACTIVATED=false`. El sitio productivo anterior sigue siendo la referencia hasta ejecutar y verificar el corte. Las evidencias de desarrollo están en [validación](EMDASH_DEV_VERIFICATION.md), [paridad de rutas](parity-audit.md) y [rastreo HTTP](dev-route-audit.md); esos resultados no sustituyen la validación del candidato productivo.

## Tres controles diferentes

| Control | Ubicación | Qué autoriza |
| --- | --- | --- |
| `SABLY_CMS_READY=true` | Variables runtime del Worker productivo y configuración revisada | Declara que el CMS productivo está preparado como fuente editorial. No cambia DNS, no promueve una versión y no demuestra por sí solo que la carga se verificó. |
| `SABLY_PRODUCTION_ACTIVATED=true` | Variables runtime del Worker productivo y configuración revisada | Permite integraciones operativas productivas, junto con CMS listo, host permitido y bases separadas. No concede permisos de administrador. |
| `SABLY_PRODUCTION_ACTIVATED=true` | Variable del entorno GitHub `production` | Habilita la opción explícita `publish` del workflow de promoción. No configura el runtime del Worker y no reemplaza los dos controles anteriores. |

El backend exige además `SABLY_ENVIRONMENT=production`, host `sably.co` o `www.sably.co` y `SABLY_DB` diferente de `DB`. Un candidato sin activar o en un hostname alternativo no permite las operaciones productivas. Mantener los tres controles cerrados mientras se prepara el corte.

## 1. Elegir y conservar el candidato

1. Elegir un SHA completo de `main` con **CI Pipeline** exitoso para ese mismo SHA. Confirmar que incorpora el candidato validado en desarrollo y las correcciones de su auditoría; no promover por nombre de rama solamente.
2. Guardar los informes de pruebas, comprobaciones HTTP, revisión editorial/visual y recorridos de formularios, promociones, checkout, reseñas y administración. Verificar específicamente las correcciones detectadas por el rastreo antes de considerarlo cerrado.
3. Registrar la versión actualmente activa de Pages/Worker, sus dominios y rutas, configuración pública, recursos operativos, fecha y responsables del corte. La inspección de producción actual identificó un despliegue manual de Pages, sin conector Git (`source=null`); no asumir que un push a Git restaura ese sitio. Conservar un mecanismo comprobado para devolver el dominio al sistema anterior.
4. Respaldar el CMS y la base operativa productivos, el backend anterior y sus medios antes de cualquier transferencia. Conservar hashes, recuentos y ubicación privada de los respaldos; no incluir datos de clientes ni secretos en Git o en informes públicos.

Los workflows con `workflow_dispatch` aparecen y se pueden disparar cuando su definición está en la rama predeterminada del repositorio. La copia editorial hace checkout de `develop`, pero su definición también debe llegar primero a `main` si ésta es la rama predeterminada. Un workflow presente solamente en `develop` no debe interpretarse como ya disponible en la interfaz de Actions.

El plan actual del repositorio privado no permite los revisores obligatorios solicitados a GitHub. La aprobación del propietario para el corte se registra explícitamente; no se presenta la promoción como una aprobación automática de dos personas. Véase [CI/CD](CI_CD.md).

## 2. Preparar sin desviar tráfico

1. Comprobar cuenta, nombres e IDs contra `config/wrangler.production.jsonc`. `DB`, `SABLY_DB`, `MEDIA` y `SESSION` no deben apuntar a los recursos de desarrollo ni reutilizar sus sesiones.
2. Sólo si el Worker productivo aún no existe, reservarlo con el bootstrap revisado:

   ```sh
   node scripts/bootstrap-production.mjs --execute
   ```

   Requiere la credencial de Cloudflare en el entorno del proceso. El script inspecciona el inventario y rechaza reemplazar un Worker existente. Publica únicamente una respuesta 503, sin bindings, cron, rutas, URL `workers.dev` ni previews. Si ya existe, verificar su estado; no borrar el Worker para repetir el bootstrap.

3. Revisar y aplicar el esquema operativo al destino correcto:

   ```sh
   node scripts/apply-operational-schema.mjs --target production --dry-run
   node scripts/apply-operational-schema.mjs --target production --execute
   ```

   El primer comando presenta el plan. El segundo aplica migraciones e inicialización controlada a `SABLY_DB`; no importa el contenido CMS ni clientes históricos. Conservar su resultado y el ledger. Véase [esquema operativo](operational-schema.md).

4. Construir y subir un candidato inactivo mediante **Promote tested EmDash version**, SHA completo y `publish=false`. Conservar `dist/sably-build.json` y `dist/sably-release.json`, que vinculan SHA, entorno y versión de Cloudflare. El workflow aplica el esquema operativo antes de subir. `versions upload` no asigna tráfico.
5. Mantener las rutas vacías durante esta preparación. La subida de versiones no instala por sí sola las rutas, el administrador, los datos iniciales ni los secretos. La configuración final del Worker incluye un cron de EmDash; el bootstrap inerte no lo configura y no debe confundirse con un cron de recuperación comercial.

## 3. Completar datos y administración productivos

La importación usada para desarrollo es deliberadamente exclusiva de `dev.sably.co` y su endpoint temporal ya fue retirado. `scripts/emdash-import.mjs` no es un importador productivo: cambiarle el hostname no es un procedimiento de corte. Antes de activar, preparar y revisar un proceso de carga inicial productiva que use los repositorios/importación nativos de EmDash, valide el destino y conflictos, y deje evidencia por lote. Este paso no está automatizado por el deploy actual.

1. Instalar/verificar el esquema nativo CMS y las diez colecciones, relaciones, campos SEO, bloques, secciones, menús y áreas de widgets. Transferir el contenido editorial aprobado y sus medios con referencias válidas en el R2 productivo. Resolver cualquier edición posterior a la fotografía inicial de migración antes de darla por vigente.
2. Comparar recuentos, slugs, campos, cuerpos, relaciones, estados publicados y hashes de medios contra el manifiesto aprobado. Comprobar publicación, modificación y despublicación sin recompilar. Un seed válido localmente no prueba su aplicación remota.
3. Configurar el administrador desde el flujo nativo de EmDash en un acceso productivo temporal restringido y aprobado, sin exponer el formulario inicial al público. El propietario registra y prueba su passkey con un navegador compatible; no se exige una herramienta de automatización específica. Probar después entrada normal, cierre de sesión y permisos de roles. No copiar usuarios, passkeys, sesiones ni tokens de desarrollo y no crear un acceso alternativo que omita la autenticación.
4. Verificar configuración pública real: promociones y calendario, widgets, WhatsApp, datos de contacto, menús, pie, logotipo, favicon e imagen social. Las semillas de migración son un punto de partida; contrastarlas con los valores productivos vigentes antes de las pruebas.
5. Conciliar el catálogo operativo y sus subjects con los cursos/artículos publicados. Verificar reseñas moderadas, calificaciones, precios, productos de Hotmart y efectos de futuras altas, modificaciones y despublicaciones en el CMS.
6. Planificar la transferencia **sólo hacia producción** de los datos privados históricos necesarios: leads y sus consentimientos, ventas, abandonos, eventos procesados y sus claves de idempotencia. Respaldar primero, definir corte incremental y comparar recuentos; no copiar estos datos a desarrollo ni reutilizar las semillas públicas como si fueran históricos completos. Los comentarios que se muestran públicamente y los consentimientos internos requieren tratamientos separados.
7. Configurar los secretos reales por Worker siguiendo [backend productivo](backend-production.md). Validar la cuenta de correo, remitente, destinatarios, Turnstile, HOTTOK, propiedad GA4, píxel Meta y tokens operativos. No introducir valores en documentación, comandos registrados ni artefactos. Desarrollo continúa sin envíos comerciales.

`SABLY_SNAPSHOT_TOKEN` del runtime y `SNAPSHOT_TOKEN` del entorno GitHub deben coincidir si se habilita el refresco operativo manual. Los secretos de Cloudflare usados por CI no sustituyen los secretos de integraciones del Worker. Cualquier credencial temporal de importación o acceso de preparación debe retirarse al terminar.

## 4. Aprobar y ejecutar el corte

Condiciones de salida: carga productiva verificada, administrador funcional, permisos comprobados, credenciales correctas, configuración operativa vigente, auditoría de rutas/SEO/medios resuelta, última transferencia privada preparada y respaldo/rollback disponibles. Registrar el SHA y la versión exacta que se va a activar, el intervalo del corte y la aceptación del propietario.

1. Pausar las ediciones y transferencias que puedan competir con el corte. Coordinar el último delta de eventos/clientes del backend anterior y su frontera de procesamiento para evitar pérdida o duplicación de webhooks, correos o conversiones.
2. Preparar como cambio revisado las rutas/custom domains, la política de `www` y los valores runtime finales. El script de promoción exige una ruta declarada para `sably.co` y ambos flags runtime en `true`. Cambiar la configuración invalida el manifiesto anterior: reconstruir desde un commit limpio y validar el nuevo SHA en CI.
3. Revisar el estado actual del dominio y cualquier asociación que deba retirarse del sistema anterior, incluyendo el destino de Pages existente. Esa preparación depende de la configuración real de Cloudflare y debe quedar incluida en la ventana aprobada; no conectar el dominio a un Worker inerte ni asumir que una ruta está instalada porque figure en un candidato subido.
4. Una vez autorizado ese primer corte, configurar la variable de GitHub `SABLY_PRODUCTION_ACTIVATED=true` y ejecutar **Promote tested EmDash version** con el SHA validado y `publish=true`. El script sube el candidato, asigna el 100 % con `versions deploy` y después aplica las rutas y cron revisados mediante `triggers deploy`. Las tres operaciones están separadas: `sably-release.json` se guarda tras la subida y distingue `activated` de `triggersApplied`. Si falla el último paso, una versión puede estar activa aunque las rutas o cron no estén aplicados; inspeccionar ese registro y el estado real antes de reintentar o devolver el dominio. Confirmar ambos valores, la versión activa y las rutas. `publish=false` no modifica triggers.
5. Ejecutar comprobaciones productivas: páginas principales, cursos/variantes, categorías, blog, páginas nuevas, medios nativos, redirecciones y query strings, canonical, sitemap, robots e indexación editorial. No deben persistir los encabezados `noindex` ni `private, no-store` impuestos por staging en páginas productivas indexables.
6. Probar un recorrido controlado de formulario, reseña/moderación, promociones por query string, WhatsApp, checkout, webhook autorizado e integraciones necesarias. Los ensayos que envían correo o conversiones se acuerdan y se identifican como pruebas. Verificar que se registren una sola vez y que el destino sea el correcto; no basta un HTTP 200.
7. Revisar errores y latencia, estado de formularios y webhooks, conteos operativos y administración durante la ventana acordada. Mantener el sistema anterior y sus respaldos disponibles hasta cerrar la observación y conciliar los últimos eventos.

## 5. Rollback

Si fallan rutas críticas, contenido/medios, autenticación administrativa, escritura operativa o procesamiento de eventos, detener la promoción y registrar el fallo antes de repetir. No reimportar semillas para intentar corregir un problema de código.

- **Antes de asignar tráfico:** dejar el sitio anterior conectado y conservar el candidato inactivo para corregirlo. Una subida de versión no requiere devolver tráfico.
- **Durante el primer corte:** devolver las rutas/dominio al destino anterior registrado y comprobar HTTP/operaciones. Coordinar los eventos escritos en el nuevo backend durante la ventana; volver el dominio no los mueve a la base anterior ni revierte correos o conversiones ya enviados.
- **Después de consolidar EmDash:** promover manualmente una versión anterior verificada, conservando su SHA y registro de release. Verificar compatibilidad con el esquema ya aplicado. El rollback de Worker cambia código, no D1, R2, contenido ni configuración externa.
- **Si se necesita restaurar datos:** usar el respaldo correcto y un procedimiento revisado por tabla/recurso. Preservar las escrituras nuevas y claves de idempotencia. No ejecutar una restauración global ni importar autenticación desde desarrollo como parte de un rollback de código.

## 6. Operación posterior

El contenido editorial se administra en EmDash. Desplegar código no ejecuta seeds, no sustituye borradores y no sincroniza contenido. Los cambios de código siguen `develop` → validación → `main` → promoción manual del SHA probado.

La copia de producción a desarrollo se ejecuta aparte con **Copy published production content to development** o `scripts/sync-content.mjs`. Primero `--dry-run`; `--execute` reemplaza el contenido editorial de desarrollo tras respaldarlo. Exige producción lista y recursos distintos, excluye autenticación y operaciones privadas, y comparte el bloqueo de concurrencia con el deploy de desarrollo. No ejecutarla dentro de un despliegue ni durante ediciones concurrentes. Una copia interrumpida requiere revisar su backup y reporte: no existe una transacción global ni una restauración automática.

Conservar manifiestos, versiones, aprobaciones, reportes y respaldos en sus ubicaciones privadas, sin valores de credenciales. Actualizar este procedimiento con la fecha y evidencia del corte realmente completado, sin confundir preparación, validación de desarrollo y activación productiva.

### Search Console después de activar EmDash

Consultar [la auditoría de octubre](GSC_AUDIT_2026-10-03.md). No enviar desarrollo a Google. La cuenta de servicio se utiliza desde un archivo privado local indicado en `GOOGLE_APPLICATION_CREDENTIALS`; no subirla al repositorio ni al artefacto del sitio.

`node scripts/search-console-sitemap.mjs` muestra el plan sin enviar nada. Después de activar y verificar producción, `node scripts/search-console-sitemap.mjs --execute` valida los indicadores de activación, ruta de producción, una ficha pública servida por EmDash, canonical, robots y sitemap; solo entonces envía `https://sably.co/sitemap-index.xml` a la propiedad `sc-domain:sably.co`. El comando no solicita indexación individual ni modifica las reglas de Google. Las solicitudes individuales se hacen desde la interfaz de Search Console.
