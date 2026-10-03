# Desarrollo y producción permanentes

El código se valida en `develop` y se promueve desde un SHA de `main` que haya pasado CI. El contenido se administra en EmDash y no se vuelve a sembrar al desplegar código.

| Entorno | Sitio | Worker | Recursos |
| --- | --- | --- | --- |
| Desarrollo | `https://dev.sably.co` | `sably-emdash-dev` | D1 CMS, D1 operativo, R2 y sesiones propios, definidos en `wrangler.jsonc` |
| Producción | `https://sably.co` | `sably-emdash-production` | Recursos diferentes, definidos en `config/wrangler.production.jsonc` |

Cloudflare exige que el Worker exista antes de aceptar `versions upload`. `scripts/bootstrap-production.mjs --execute` crea una sola vez un Worker inerte que responde 503, sin bindings, cron, rutas, previews ni URL pública. Verifica primero el inventario y rechaza reemplazar un Worker existente. Su configuración está en `config/wrangler.bootstrap-production.jsonc`. Esta operación prepara el nombre; no conecta `sably.co`.

La configuración productiva comienza sin rutas ni URL `workers.dev`. `SABLY_CMS_READY=false` identifica que el CMS productivo aún no es la fuente activa. Subir versiones no cambia el sitio existente. La primera asignación de dominio, la carga del contenido productivo y el alta del administrador son una operación de corte separada, que requiere la aprobación final del propietario.

## Flujo de código

1. Un PR hacia `develop` o `main` valida la semilla histórica, ejecuta pruebas de migración, repositorio público, operaciones y seguridad, revisa tipos y construye el artefacto de desarrollo.
2. Un push a `develop` que pase esos mismos controles despliega el artefacto probado en `dev.sably.co`, mediante el entorno GitHub `development`.
3. Un push a `main` valida el código; no activa producción.
4. El workflow **Promote tested EmDash version** recibe el SHA completo. Comprueba que pertenece a `main` y tiene una ejecución exitosa de `ci.yml` para ese SHA exacto. Después utiliza el entorno GitHub `production`. En el plan actual del repositorio privado, GitHub rechaza revisores obligatorios con HTTP 422; no hay una aprobación adicional impuesta por la plataforma.
5. Su comportamiento predeterminado es `wrangler versions upload`. Guarda `sably-release.json` con el Worker, SHA y versión, sin asignar tráfico.
6. Después del corte inicial aprobado, el propietario puede definir `SABLY_PRODUCTION_ACTIVATED=true` en el entorno protegido `production`. Solo entonces la opción explícita y manual `publish` permite `versions deploy <version>@100%` y después `triggers deploy` para aplicar las rutas y el cron revisados. El registro de release distingue código activado y triggers aplicados incluso si el segundo paso falla. El script también exige que la configuración revisada ya declare `sably.co`.

Antes de cada despliegue o subida de candidato se ejecuta `apply-operational-schema.mjs` para aplicar migraciones revisadas a `SABLY_DB`. Adopta las columnas ya migradas manualmente en desarrollo, registra un ledger y sólo inserta semillas operativas una vez; nunca importa contenido CMS. Véase [esquema operativo](./operational-schema.md).

Los workflows anteriores de Cloudflare Pages se sustituyeron y `scripts/deploy-pages.sh` devuelve un error sin leer credenciales ni publicar. `deploy:dev` es un alias del mismo despliegue de desarrollo que exige manifiesto SHA y artefacto limpio. El refresco operativo de Hotmart no hace commits ni provoca reconstrucciones: su workflow manual escribe los datos operativos mediante el endpoint autorizado, cuando producción está activada.

El refrescador obtiene los cursos publicados y sus URLs desde `GET /api/v1/catalogo`, autenticado con `SNAPSHOT_TOKEN` (el mismo valor que `SABLY_SNAPSHOT_TOKEN` en el Worker). En desarrollo también necesita `SABLY_DEV_PASSWORD` para la puerta del staging. Ya no lee MDX. Sólo sigue HTTPS de `go.hotmart.com`, `pay.hotmart.com`, `hotm.art` y `hotm.io`, comprobando cada redirección; la consulta de reseñas también admite el marketplace oficial `hotmart.com`/`www.hotmart.com`. El POST de captura comprueba de nuevo publicación y URL de origen; si cambiaron devuelve 409 para repetir la captura. Los hooks nativos mantienen los subjects de cursos/artículos y retiran capturas cuando cambia el producto o se despublica, conservando comentarios, votos e historial. El GET privado también concilia importaciones que no dispararon hooks; ejecutarlo una vez tras la migración inicial y antes de comenzar ediciones establece la identidad de origen de las capturas existentes.

## Comandos locales

```sh
npm run build:dev
npm run deploy:development
npm run build:production
npm run upload:production
```

`--dry-run` en `scripts/deploy-environment.mjs` valida y empaqueta sin enviar una versión. Los scripts verifican el entorno, dominio, cuenta, recursos aislados y el manifiesto del build. El build elimina archivos `.dev.vars`/`.env` de `dist` antes de generar artefactos; el despliegue rechaza cualquier resto. Producción exige además un árbol Git limpio y un SHA completo; los builds locales de desarrollo registran si incluyen cambios sin commit. Rechazan un artefacto de otro entorno o una configuración cambiada después del build. `npm run build` sigue usando desarrollo por defecto.

El selector `SABLY_TARGET=development|production` determina `site`, `siteUrl` de EmDash y `configPath` del adaptador. Un valor desconocido falla; no existe un fallback hacia producción.

## Configuración de GitHub

El repositorio es `connexis-co/sably.co`. Ya están configurados los entornos `development` y `production`, sus restricciones a `develop`/`main` y los secretos `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` de cada entorno. El control operativo vigente es:

- Entorno `development`, limitado a `develop`, con `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
- Entorno `production` limitado a `main` (restricción de rama configurada), con sus secretos de Cloudflare. `SABLY_PRODUCTION_ACTIVATED` debe permanecer ausente o `false` hasta el corte aprobado. La configuración de revisores obligatorios fue rechazada por GitHub para este plan privado (HTTP 422); la promoción depende de dispatch manual, SHA verificado y la variable de activación. No se presenta como aprobación de dos personas. Si se habilita un plan compatible, añadir revisores obligatorios y prevención de autoaprobación.
- La promoción verifica `CI Pipeline` exitoso para el SHA exacto de `main`. La protección de la rama con PR/checks obligatorios debe configurarse cuando el plan del repositorio permita esos controles; no se presupone activa.
- `SNAPSHOT_TOKEN` en producción para el refresco operativo manual, si se habilita ese workflow. El proceso rechaza su ausencia.
- Los secretos runtime se configuran por Worker. Desarrollo usa `SABLY_DEV_PASSWORD`; producción no comparte contraseña de staging ni sesiones. Los secretos transitorios de importación deben retirarse al terminar.

No se guardan secretos en YAML, JSON, artefactos ni manifiestos. El código del Worker decide la puerta de acceso mediante `SABLY_ENVIRONMENT`: desarrollo permanece protegido incluso si recibe otro hostname; producción conserva las directivas editoriales de SEO y no añade el bloqueo de indexación de staging.

## Contenido y sincronización

Desarrollo usa una copia independiente del contenido editorial publicado de producción. No comparte la base activa. Durante la fase en que producción todavía es el sitio Astro anterior, la sincronización debe rechazar `SABLY_CMS_READY=false`; la importación inicial de desarrollo usa el archivo de migración revisado.

El workflow **Copy published production content to development** se lanza desde la rama `develop`, con el entorno GitHub `development`. Por defecto sólo exporta y muestra el plan; la opción explícita `execute=true` aplica la copia. No se invoca desde un despliegue. Comparte el bloqueo de concurrencia con los deploys de desarrollo: no pueden correr al mismo tiempo.

```sh
node --import tsx scripts/sync-content.mjs --dry-run
node --import tsx scripts/sync-content.mjs --execute
```

Requiere `CLOUDFLARE_API_TOKEN` autorizado para leer el D1 CMS y R2 productivos y escribir en el D1 CMS y R2 de desarrollo. Verifica que ambos recursos son distintos, que producción está lista y que coinciden colecciones, campos, relaciones y versiones de bloques. La lista de tablas permitidas impide escribir producción o consultar usuarios, passkeys, sesiones, leads, ventas y configuración privada de plugins.

La copia incluye las diez colecciones editoriales publicadas, sus relaciones, SEO individual, secciones reutilizables, menús con referencias, áreas/widgets y los ajustes públicos `title`, `tagline`, `postsPerPage`, `dateFormat`, `timezone`, `social` y SEO textual. Los medios de campos y bloques se convierten a URLs públicas de producción. `logo`, `favicon` y `seo.defaultOgImage` se descargan desde R2 productivo, se verifican por SHA-256 y se copian a objetos nuevos `sync-public/<sha256>.<extensión>` del bucket de desarrollo. Se crean o reutilizan filas nativas de `MediaRepository` y se enlazan sus IDs de desarrollo. Una segunda lectura de R2 comprueba los bytes copiados. Los tres assets admiten imágenes de hasta 10 MiB; un tipo no soportado, una referencia rota o un archivo cambiado interrumpen la copia. No se eliminan objetos ni se sobrescriben las claves de medios anteriores usados por borradores. Tampoco copia el dominio del entorno, autenticación, configuración privada, comentarios, operaciones ni revisiones históricas de producción.

Antes de escribir, guarda `.emdash/sync/<fecha>/development-before.json` con el contenido editorial público, SEO, secciones/menús/widgets/settings y los borradores actuales de desarrollo, sin IDs de autores ni campos de archivo `source_*`. Conserva por separado las selecciones pendientes de relaciones (`stagedReferences`) y su base publicada (`referenceBaselines`), ambas por colección/slug; una relación editada en borrador no se sustituye por la relación publicada. También respalda los objetos de logo/favicon/imagen social anteriores en `media/<sha256>.bin`, junto con IDs y claves R2 en el snapshot y un registro `media-transfers.json`. Relee el backup para comprobar su SHA-256 y repite ambas lecturas antes de comenzar para detectar cambios durante la exportación. Los artefactos privados de GitHub conservan backup, snapshot fuente y reporte durante 30 días.

La aplicación usa el importador y repositorios nativos de EmDash, conserva identidades existentes, sustituye los borradores de entradas presentes en producción y despublica las entradas extra de desarrollo sin eliminarlas. Secciones/menús/áreas que sólo existan en desarrollo se retiran después del backup. Comprueba la igualdad de todo el snapshot público al terminar, usando hashes binarios para comparar imágenes cuyos IDs y claves difieren entre entornos. Logo, pie y metadatos leen settings con una caché limitada a la petición, por lo que una edición o sincronización se refleja sin esperar al reciclado del Worker. D1 no permite una transacción para la sincronización completa: si falla una consulta o alguien edita durante la copia, el reporte no declara éxito y conserva el backup y el último lote iniciado. Ejecutar sin cambios editoriales concurrentes y revisar ese reporte antes de reintentar; no hay rollback automático que pueda pisar cambios nuevos.

## Recuperación

Una promoción posterior al corte puede volver a una versión previamente verificada de Cloudflare mediante una operación manual del entorno `production`, tras comprobar la versión y su SHA. Ese cambio solo afecta al código: las bases de datos y el contenido no se revierten automáticamente.

Conservar los registros `sably-release.json` de las promociones y los backups editoriales de las sincronizaciones. Una restauración de contenido debe usar su backup y comprobar el esquema; no importar un dump de producción con tablas de autenticación u operaciones.

Las versiones no modifican por sí mismas rutas ni cron. La separación usada en estos scripts sigue la [referencia de Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/workers/#triggers-deploy); el modo de subida de candidato nunca ejecuta `triggers deploy`.
