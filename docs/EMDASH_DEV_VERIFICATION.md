# Validación de desarrollo EmDash

Entorno: `https://dev.sably.co`. La primera prueba con un curso fue ampliada a la migración editorial completa. Este documento distingue los datos verificados de la configuración del siguiente despliegue.

## Contenido verificado remotamente

- 964 entradas publicadas: cursos, variantes, países, ciudades, categorías, creadores, testimonios, blog, homologaciones y páginas.
- 22.813 campos y 1.676 relaciones nativas comparados con la importación; segunda pasada sin cambios en IDs, fechas o versiones.
- 289 archivos locales incorporados como 287 medios únicos tras deduplicación y diez secciones reutilizables para el inicio. Una imagen externa de Hotmart devuelve 403 y conserva su referencia de origen. Los campos de archivo se mantienen fuera de la edición principal.
- Bases D1, bucket R2 y sesiones de desarrollo independientes de producción. No se copiaron clientes, ventas, leads ni credenciales productivas.

La implementación pública consulta EmDash por petición, conserva los paths del sitio y no ejecuta MDX proveniente del CMS. Las variantes se encuentran por relaciones nativas, aunque el editor cambie su slug. Las páginas nuevas usan un path local validado, fuera de los namespaces de países y de la aplicación. Las vistas están separadas en la plantilla `sably-classic`.

## Acceso y operaciones

El acceso anónimo a documentos, panel y assets de desarrollo devuelve 401. Las respuestas de staging incluyen `noindex, nofollow, noarchive` y `private, no-store`; `robots.txt` bloquea rastreo. Basic usa el usuario `sably`, con clave fuera de Git, y las herramientas pueden usar `X-Sably-Preview-Token`. Esta puerta no sustituye la passkey del administrador de EmDash.

El backend operativo usa `SABLY_DB`. Precios, promociones, reseñas y comentarios publicados se consultan desde esa base. Las integraciones productivas con efectos externos siguen sujetas al entorno y sus secretos. El endpoint temporal de migración y su secreto ya fueron retirados; su URL responde 404; no forma parte del flujo permanente de despliegue.

## Pruebas reproducibles

```sh
npm run content:check
npm run test:migration
npm run check
npm run check:functions
npm run build:dev
node scripts/emdash-smoke.mjs
```

Las pruebas importan el contenido completo en SQLite temporal, comparan campos y referencias, prueban publicación/404, variantes editadas, rutas nuevas, settings por petición, el puente operativo y las puertas de entorno. La sincronización usa SQLite y un transporte R2 falso para verificar sustitución editorial, backup de borradores, SEO, menús, widgets y los tres assets globales con IDs locales e integridad binaria.

El smoke es de lectura y utiliza `SABLY_DEV_PASSWORD` del entorno o `.dev.vars`, sin imprimir la credencial. El despliegue permanente es `npm run deploy:development`; exige un build de desarrollo con manifiesto SHA y sin archivos locales de entorno. `deploy:dev` es un alias compatible. El comando anterior de Pages está cerrado.

## Promoción

Producción conserva su sitio actual hasta el corte aprobado. La configuración EmDash productiva utiliza recursos propios y permanece sin rutas públicas. La subida de una versión candidata no asigna tráfico. El bootstrap inicial crea únicamente un Worker inerte y sin rutas, para que Cloudflare acepte versiones posteriores.

Las reglas reales de GitHub, los comandos, el bloqueo de activación y la sincronización editorial manual se describen en [CI/CD](./CI_CD.md). El ID de versión desplegada y el SHA quedan en los artefactos de release; no se confunden con la versión del primer piloto. Antes del corte aún corresponde registrar y verificar la passkey del administrador productivo y la paridad visual, SEO, checkout y operaciones del candidato aprobado.

## Verificaciones HTTP y comerciales

La versión `58ca1169-3ce1-4685-8e83-a2d7f303798b` pasó 28 comprobaciones HTTP de lectura, incluidas imágenes nativas, botón WhatsApp, formularios, URLs, puertas de acceso, APIs privadas (401) y retirada del importador (404). La comparación de slugs conserva las 964 URL del sitemap de producción. El rastreo exhaustivo y las correcciones de metadatos se documentan en `dev-route-audit.md`.

Se verificaron los destinos de compra del catálogo migrado: 104 checkouts conservan una referencia de afiliado, ninguno perdió su ref conocido y 17 cursos siguen sin enlace. Dos referencias no estaban en el baseline histórico: el test comprueba su presencia, no la titularidad de esa afiliación.

El cierre correctivo desplegado en `df0f1413-607b-429a-8a6f-2f916586d125` pasó 18/18 comprobaciones de portadas y artículos, con metadatos únicos y completos; también robots por entorno. Véase [recheck](dev-route-recheck.md). El conjunto local posterior incorpora 130 pruebas aprobadas, Astro sin errores y Functions sin errores. La primera PR (#121) pasó CI remoto en GitHub (run 37093570285).
