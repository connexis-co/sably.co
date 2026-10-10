# Sably EmDash en Connexis

El sitio se ejecuta con Astro Node y EmDash 1.1 en Docker. Cloudflare conserva el DNS con proxy y el CDN; CloudPanel termina HTTPS y hace proxy al puerto local del contenedor. El stack de Dockge se guarda en `/opt/stacks/sably-emdash`.

## Datos persistentes

El volumen `./data:/app/data` contiene:

- `emdash.db`: CMS, usuarios, credenciales, plugins, contenidos y sus historiales.
- `sably.db`: datos de las integraciones, leads y demás funciones operativas.
- `uploads/`: objetos de R2 conservando exactamente cada clave/ruta original.
- `sessions/`: sesiones de Astro guardadas en disco para sobrevivir a las actualizaciones.

La migración utiliza copias completas de las dos bases D1 y de los objetos R2. Una transferencia editorial `.emdash` no reemplaza este procedimiento: excluye usuarios, credenciales y secretos. Las sesiones anteriores de Cloudflare KV pueden expirar al cambiar de servidor; los usuarios y passkeys siguen en la base y pueden iniciar sesión de nuevo en el mismo dominio.

Mantener los mismos bytes de `EMDASH_ENCRYPTION_KEY` y las demás variables originales en el `.env` privado del stack. En esta migración se normalizó la representación de esa clave al formato canónico aceptado por EmDash, conservando los mismos bytes; esto no rota la clave ni cambia los ajustes cifrados. Sustituir sus bytes sin conservar la clave anterior impide leer los ajustes secretos de plugins. Los secretos no se incorporan a la imagen.

## Crear o reconstruir la imagen

El registro privado del servidor escucha solamente en `127.0.0.1:5051`. Su stack se crea con `deployment/registry.compose.yaml` en `/opt/stacks/sably-registry/compose.yaml` y conserva las imágenes en su propio volumen. No se publica el código ni se necesitan credenciales GHCR. Dockge controla el daemon Docker del host, que puede descargar imágenes desde esa dirección local.

El publicador `scripts/publish-connexis.mjs` exige un árbol Git limpio y envía únicamente los archivos del commit actual por SSH. Para el canal de producción, ese commit debe pertenecer a `origin/main`. Construye la imagen en Linux y publica una etiqueta inmutable y el canal indicado; la recreación del contenedor se hace desde Dockge:

```sh
# Solo mostrar el plan; no subir ni construir nada.
node scripts/publish-connexis.mjs

# Publicar el commit revisado en el canal production.
node scripts/publish-connexis.mjs --publish

# Construir una candidata en otro canal, sin mover production.
node scripts/publish-connexis.mjs --publish --candidate
```

La opción `--candidate` sin `--publish` muestra el plan de la candidata. Ninguna combinación reinicia el sitio; la actualización se ejecuta después desde Dockge. Para una compilación manual dentro del servidor, desde la raíz del proyecto:

```sh
docker build -f deployment/Dockerfile \
  --build-arg SOURCE_REVISION="$(git rev-parse HEAD)" \
  -t 127.0.0.1:5051/sably-emdash:VERSION .
docker push 127.0.0.1:5051/sably-emdash:VERSION
docker tag 127.0.0.1:5051/sably-emdash:VERSION 127.0.0.1:5051/sably-emdash:production
docker push 127.0.0.1:5051/sably-emdash:production
```

El Dockerfile usa Node 24 sobre Debian, instala `workerd` para la plataforma Linux del contenedor y compila el sitio con `SABLY_RUNTIME=node`. Mantiene el runner oficial de plugins: no aplica las cuotas de CPU/subrequests de Workers, pero el sandbox de EmDash conserva su timeout de 30 segundos por invocación. El proceso principal, los plugins nativos y las tareas programadas se ejecutan en Node.

Para compilar localmente sin Docker: `npm run build:node`. Los datos locales se buscan en `./data`; el contenedor fija la ruta `/app/data` durante compilación y ejecución. Para una imagen con otro directorio hay que modificar ambos valores y reconstruirla, porque EmDash y Astro serializan esa configuración al compilar.

## Stack de Dockge

Copiar `deployment/compose.yaml` a `/opt/stacks/sably-emdash/compose.yaml` y preparar `.env` a partir del ejemplo. `SABLY_IMAGE=127.0.0.1:5051/sably-emdash:production` utiliza el registro privado local. Restaurar los datos antes del primer arranque y asignar su propietario al usuario `node` del contenedor (UID/GID 1000):

```sh
cd /opt/stacks/sably-emdash
sudo chown -R 1000:1000 data
docker compose up -d
```

El arranque falla si falta cualquiera de las bases o si no puede escribir en ellas. `ALLOW_EMPTY_DATABASE=true` es solo para una instalación nueva y desechable; no usarlo para la producción migrada.

En Dockge, ejecutar **Scan Stacks Folder** si todavía no aparece el stack. El puerto se publica exclusivamente en `127.0.0.1:4323` por defecto. Configurar CloudPanel con el upstream `http://127.0.0.1:4323`, conservando `Host` y `X-Forwarded-Host` con el dominio público y `X-Forwarded-Proto: https`. EmDash confía en `CF-Connecting-IP`; por ello CloudPanel debe aceptar ese encabezado únicamente desde Cloudflare o sobrescribirlo con la dirección validada del visitante. El origen HTTPS debe tener un certificado válido y Cloudflare debe usar **Full (strict)**.

## Actualizar desde Dockge

1. Publicar la nueva imagen del proyecto en el registro.
2. Hacer una copia consistente de ambas bases y de los archivos antes de actualizar.
3. Si se usa una etiqueta inmutable, cambiar `SABLY_IMAGE` en el `.env` del editor de Dockge. Si se mantiene una etiqueta de canal como `production`, publicarla apuntando a la nueva imagen.
4. Pulsar **Update** en Dockge. Ese botón ejecuta `docker compose pull` y después recrea el contenedor. Las bases, sesiones y uploads permanecen en el volumen.
5. Verificar `/health`, una página pública, el acceso al admin, una edición de contenido y una carga de imagen. El health check comprueba tablas esenciales de ambas bases; no sustituye las pruebas funcionales del sandbox y correo.

Conservar etiquetas inmutables para volver a la imagen anterior. Si una actualización cambia el esquema de la base, restaurar también su copia previa con el contenedor detenido; no ejecutar una versión antigua sobre un esquema incompatible.

`compose.build.yaml` es un mecanismo opcional de compilación local desde `./app`. El botón **Update** de Dockge no compila código fuente: para este mecanismo hay que ejecutar los comandos indicados en ese archivo o publicar una imagen en el registro. No se debe presentar un stack con solo `build:` como actualización de un clic.

## Copias y caché

Guardar copias consistentes de ambas bases SQLite (mediante su API de backup o con el contenedor detenido), el directorio de uploads y el `.env` de forma protegida. Copiar solo el `.db` mientras hay escrituras puede omitir datos del archivo WAL. No montar bases ni secretos bajo el document root de CloudPanel.

`deployment/backup.py` usa la API de backup de SQLite y comprueba las bases resultantes. Guarda ambas bases, uploads y `.env`, junto con un manifiesto SHA-256 y su archivo `manifest.sha256`, en `/var/backups/sably-emdash`. Los directorios tienen permisos `0700` y los archivos `0600`; el registro de ejecución no imprime valores del entorno. Un bloqueo impide ejecuciones simultáneas y conserva las 14 copias completas más recientes. La retención solo elimina carpetas con el prefijo, checksum del manifiesto y marcador de propiedad de esta instalación; deja intactos los directorios ajenos y las copias sin validar.

Instalar el script en `/opt/stacks/sably-emdash/backup.py`, propiedad de root, y preparar `/var/log/sably-emdash-backup.log` con permisos `0600`. Ejecutar una copia manual:

```sh
sudo python3 /opt/stacks/sably-emdash/backup.py \
  --stack-dir /opt/stacks/sably-emdash \
  --backup-dir /var/backups/sably-emdash --retention 14
```

Cada base tiene su propia instantánea transaccional. La copia online no es una transacción única que abarque ambas bases y los archivos; para una copia exacta antes de cambiar versión, detener el stack, ejecutar el backup y volver a iniciarlo. Si falla una copia, no se ejecuta la retención ni se conserva una instantánea incompleta. Las sesiones se regeneran al iniciar sesión y no se copian.

El ejemplo `deployment/sably-emdash.cron` se instala como `/etc/cron.d/sably-emdash` y ejecuta la copia cada día a las **03:30 de America/Bogota**. Su línea activa usa **08:30 UTC**, apropiada cuando el daemon cron del servidor trabaja en UTC. También contiene la alternativa `CRON_TZ=America/Bogota` para implementaciones que soporten esa opción. `TZ` por sí solo no cambia el horario del daemon; verificar la zona del servidor e instalar solo una de las dos líneas. Estas copias locales permiten recuperar errores operativos; una copia fuera del servidor se configura por separado para cubrir pérdida del host.

Node mantiene caché de objetos y páginas en memoria con invalidación editorial. El HTML dinámico y las respuestas privadas impiden caché compartida mientras no exista un mecanismo de purga del CDN. Los bundles y archivos públicos estáticos siguen aprovechando Cloudflare. Esto evita que una publicación en EmDash deje contenido antiguo en el CDN.

El entorno de desarrollo de Cloudflare sigue disponible con `npm run build:dev`. El workflow antiguo de producción de Workers y su CLI `scripts/deploy-environment.mjs production` están bloqueados explícitamente, incluso con `--publish`, y no pueden publicar nuevamente los dominios. La sincronización editorial antigua también está bloqueada: leía el D1 retirado, que deja de recibir las ediciones de producción. Restaurar cualquiera de esos flujos requiere revisar expresamente datos, rutas y origen.

Referencias oficiales: [Node.js](https://docs.emdashcms.com/deployment/nodejs/), [sandbox](https://docs.emdashcms.com/deployment/plugin-sandbox/), [sesiones Astro](https://docs.astro.build/en/guides/sessions/), [Docker Compose en Dockge](https://github.com/louislam/dockge).
