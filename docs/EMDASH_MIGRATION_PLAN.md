> Documento histórico: plan y diagnóstico del piloto inicial. El estado vigente, recuentos y comprobaciones están en [EMDASH_DEV_VERIFICATION.md](EMDASH_DEV_VERIFICATION.md), [migration-content.md](migration-content.md) y [CI_CD.md](CI_CD.md). Las listas de pendientes de este plan no describen el estado actual.

# Migración de Sably a EmDash

Estado de trabajo: 2 de octubre de 2026. Este documento registra la implementación inicial y las condiciones para continuar. El despliegue de desarrollo y el piloto ya fueron comprobados por HTTP. No autoriza el cambio de producción.

Evidencia del hito completado: [validación de desarrollo](EMDASH_DEV_VERIFICATION.md). La administración todavía requiere que el propietario registre su passkey.

## Objetivo y límites actuales

Adaptar el frontend Astro y el backend provisional de Cloudflare a una operación editorial con EmDash, probar el conjunto en desarrollo y, después de verificar la paridad, trasladarlo a `sably.co`.

El entorno configurado en esta implementación es `https://dev.sably.co`; el ejemplo inicial `dev.sably.com` pertenece a otro dominio. El Worker de desarrollo y sus bindings se definen en `wrangler.jsonc`. La producción permanece intacta: no se cambia su ruta, no se sustituye su aplicación y no se copian clientes, leads o ventas reales al entorno de pruebas.

EmDash administra contenido; las funciones comerciales y operativas existentes necesitan adaptación explícita. Tener instalado el CMS y poder mostrar una ficha no equivale a haber migrado el backend completo.

## Fuentes y trazabilidad

- La base del clon completo `emdash-dev` es `origin/main`, commit `0f7679a`.
- La referencia observada del despliegue productivo es `759a40d`, marcada como `dirty`. Esto indica que el artefacto desplegado puede incluir cambios que no se reconstruyen con ese commit por sí solo.
- Por tanto, **no está garantizada la equivalencia entre el clon y la producción actual**. Antes del corte hay que recuperar o reconstruir el manifiesto del despliegue real, contrastar sus páginas y reconciliar las diferencias.
- La carpeta original del proyecto estaba incompleta: faltaban `.git/HEAD`, archivos de configuración, componentes y funciones. Se conserva como evidencia y no se usa como una copia reproducible de producción.
- El grafo existente es histórico. Sus referencias ayudan a localizar funcionalidades, pero no prueban que un archivo o una función siga presente o desplegado.

Inventario de la fuente completa del clon al preparar este plan:

| Área | Fuente disponible | Tratamiento inicial |
| --- | --- | --- |
| Cursos | 121 archivos MDX | Colección EmDash `courses` |
| Variantes por país | 726 JSON | Colección `course_locales`, conservando curso y país |
| Blog | 10 artículos MDX | Colección `blog` |
| Testimonios | 40 registros JSON | Permanecen en Astro; migración editorial pendiente |
| Geografía y categorías | Definiciones TypeScript | Conservar rutas y jerarquía; modelado editorial posterior |
| Homologaciones, creadores y páginas institucionales | Rutas y datos Astro | Mantener y someter a comparación de paridad |
| Promociones, widgets y precios | D1 y JSON de respaldo | Backend aislado y valores iniciales por revisar |
| Leads, consentimiento, comentarios, votos, moderación y ventas | Funciones y migraciones legacy | Puente parcial sobre una D1 independiente |
| Imágenes y videos | Assets locales y referencias CDN/R2 | Inventariar dependencias; no asumir que ya están en el bucket nuevo |

## Arquitectura de desarrollo preparada

La configuración incorpora Astro 7, `@astrojs/cloudflare` 14.3.3 y EmDash 1.1.0 con salida de servidor. El frontend conserva la estructura de rutas existente mientras se incorpora la lectura del CMS de manera progresiva.

| Recurso | Nombre o binding | Propósito |
| --- | --- | --- |
| Worker | `sably-emdash-dev` | Aplicación de desarrollo |
| D1 del CMS | `DB` / `sably-emdash-dev` | Contenido, administración y tablas de EmDash |
| D1 operativa | `SABLY_DB` / `sably-pulso-dev` | Tablas y funciones legacy de prueba |
| R2 | `MEDIA` / `sably-emdash-dev-media` | Medios gestionados por EmDash |
| Dominio configurado | `dev.sably.co` | Validación de la migración |

Los identificadores concretos de D1 y la cuenta están en `wrangler.jsonc`, que es la fuente de verdad para el despliegue de desarrollo. No reutilizar bindings productivos ni convertir ese archivo en una configuración productiva mediante reemplazos generales.

La puerta del Worker exige `SABLY_DEV_PASSWORD`. Sin configuración devuelve 503; sin credencial válida, 401. Admite Basic Auth con usuario `sably` y, para herramientas, `X-Sably-Preview-Token`. La cabecera de preview permite conservar `Authorization: Bearer …` para las APIs que ya lo requieren. Esta puerta se suma a la autenticación propia de EmDash; no la reemplaza.

Las respuestas de desarrollo incluyen `X-Robots-Tag: noindex, nofollow, noarchive` y caché privada deshabilitada. Se debe verificar esto también en errores, redirecciones, assets, dominio personalizado y acceso directo por `workers.dev`.

## Contenido y piloto

`scripts/emdash-content.mjs` genera y valida semillas sin abrir bases de datos ni conectarse a la red. Mantiene slugs y añade el archivo de origen, sus metadatos originales y SHA-256. Conserva el cuerpo MDX como texto en `source_body`; la migración no ejecuta MDX procedente del CMS.

La semilla inicial `emdash.seed.json` contiene:

- Un curso: `curso-de-barberia`.
- Sus ocho variantes de país.
- Un artículo: `como-emprender-con-un-oficio-en-2026`.

El script también admite `--profile full` y `--profile schema`. La validación cubre el formato oficial de EmDash, campos, tipos, valores y relaciones de variantes. Generar una semilla no significa importarla: la aplicación remota, el recuento en D1 y la lectura editorial tienen que verificarse por separado.

`SABLY_CMS_READY` permanece inicialmente en `false`. No activarlo hasta comprobar que el esquema está instalado, la semilla piloto está aplicada y las rutas que lo consultan disponen de un fallback probado. La importación completa de 121 cursos, 726 variantes y 10 artículos sigue pendiente; también lo están testimonios, taxonomías y otros contenidos que todavía residen en código.

Antes de importar el lote completo, comprobar la política real de conflicto de la herramienta: un segundo import no debe duplicar registros ni sobrescribir silenciosamente ediciones hechas en EmDash. Conservar la semilla y el manifiesto de origen de cada importación.

## Backend disponible y pendiente

`src/pages/api/[...path].ts` conecta mediante un registro explícito los handlers de Pages Functions con Astro SSR. `src/lib/legacy-backend.ts` pasa exclusivamente `SABLY_DB` a los handlers; `DB` queda reservado para EmDash. Exige `SABLY_ENVIRONMENT=development` y rechaza los hosts productivos.

Rutas adaptadas: configuración de widgets, promociones, precios de D1, pulso, comentarios, votos, valoración de visitantes, leads, snapshot, siembra de subjects y consulta de ventas. Se conservan los métodos y la autenticación de cada contrato original. Los secretos del puente, si se configuran, son `SABLY_TURNSTILE_SECRET`, `SABLY_SNAPSHOT_TOKEN` y `SABLY_IP_SALT`.

Los leads de prueba se guardan con su consentimiento en la base independiente. El puente no entrega credenciales SMTP a los handlers y responde expresamente que no se envían correos.

Estas integraciones devuelven 503 sin ejecutar acciones externas:

- `/api/hotmart-webhook`.
- `/api/v1/abandonos-notify`.
- `/api/v1/precios/refresca`.

El panel administrativo legacy, sus acciones de contenido/despliegue y la gestión operativa de moderación no están migrados al nuevo panel. No confundir la administración editorial de EmDash con una interfaz ya disponible para leads, ventas, promociones o moderación.

Aplicar las migraciones en la D1 nueva solo crea el esquema y sus datos iniciales. **No copia la configuración vigente de producción.** Revisar las filas iniciales de promociones y widgets, precios vacíos, subjects y fallback del frontend antes de usar una prueba como evidencia de paridad. Un endpoint que responde 200 con valores por defecto no demuestra que se comporte igual que producción.

## Fases y criterios de salida

### 1. Base reproducible y aislamiento

1. Registrar commit fuente, versiones, configuración de desarrollo y artefacto generado.
2. Reconciliar `0f7679a` con el despliegue productivo `759a40d dirty`; obtener diferencias verificables de rutas, contenido, comportamiento y configuración.
3. Verificar que las dos D1 y R2 pertenecen exclusivamente a desarrollo y que no contienen datos de clientes copiados de producción.
4. Aplicar y comprobar migraciones separadas de EmDash y del backend legacy.
5. Comprobar credenciales de acceso, noindex, ausencia de efectos externos y ninguna ruta de producción modificada.

Salida: desarrollo accesible de forma protegida y evidencia registrada del despliegue y bindings. La existencia de archivos locales no satisface esta salida.

### 2. Recorrido editorial piloto

1. Instalar esquema y semilla piloto; comprobar identificadores y recuentos en EmDash.
2. Verificar ficha del curso por país y ciudad, cuerpo, SEO, FAQs, temario, medios y checkout esperado.
3. Editar un dato de prueba en EmDash, publicarlo y comprobar su efecto sin modificar archivos Astro.
4. Probar borrador, revisión, despublicación y fallback; garantizar que un fallo del CMS no publica contenido incorrecto.
5. Verificar que el artículo piloto puede administrarse y visualizarse; documentar qué campos siguen dependiendo de MDX local.

Salida: recorrido editorial completo y reversible demostrado, con límites del piloto anotados.

### 3. Catálogo completo y medios

1. Generar una semilla `full` aparte de la piloto y comprobar su manifiesto antes de importar.
2. Importar por lotes con recuentos, hashes, referencias, fechas y revisión de colisiones.
3. Resolver campos sin equivalencia editorial y verificar títulos, variantes, proveedores, precios, enlaces de afiliación y relación pilar/satélite.
4. Incorporar los contenidos restantes: testimonios, taxonomías, homologaciones, creadores e institucionales según su modelo acordado.
5. Inventariar imágenes/videos y decidir explícitamente qué se conserva en el CDN actual y qué se importa a R2; probar disponibilidad, dimensiones y permisos.

Salida: ninguna pérdida de contenido o enlace, importación repetible y fuente de verdad definida para cada campo.

### 4. Operación y paridad funcional

1. Definir y adaptar interfaces de moderación, leads, ventas, promociones y widgets dentro de EmDash o como módulos separados.
2. Sembrar subjects y datos sintéticos; probar consentimiento, validación, límites de abuso, moderación y autenticación.
3. Comparar configuración real de promociones/widgets con una exportación revisada y sin datos personales. No reemplazarla por defaults de migración.
4. Diseñar autenticación obligatoria, idempotencia, reintentos y trazabilidad para el webhook Hotmart y las conversiones.
5. Probar correo, recuperación de carritos y atribución únicamente con destinos/control de prueba. No habilitar envíos ni conversiones reales desde desarrollo.
6. Definir sincronización de datos operativos y punto de corte para evitar perder eventos entre aplicaciones.

Salida: operaciones administrativas y comerciales cubiertas, con contratos probados y estrategia de datos aprobada. Los 503 de desarrollo son protecciones deliberadas, no equivalencia funcional con producción.

### 5. Validación previa al corte

1. Comparar todas las rutas de los sitemaps y las rutas históricas relevantes: estado HTTP, redirects, slash final, canonical, hreflang, títulos, descripción y JSON-LD.
2. Verificar páginas representativas de cada país, ciudad, categoría, proveedor, curso, blog y homologación; comprobar móviles, formularios, búsqueda y accesibilidad básica.
3. Comparar rendimiento y disponibilidad del SSR con la producción actual; medir lecturas D1 y comportamiento ante errores del CMS.
4. Ejecutar compilación, comprobaciones TypeScript, pruebas de acceso de desarrollo, pruebas del puente y validación de semillas.
5. Preparar configuración productiva independiente, backup restaurable, versión anterior identificada y ensayo de rollback.

Salida: diferencias explicadas y aceptadas; ningún fallo crítico de compra, formulario, autenticación, datos o indexación; capacidad de restauración demostrada.

### 6. Producción y rollback

El cambio a `sably.co` se prepara como un despliegue separado. El código actual del puente bloquea ese host y el Worker de desarrollo aplica noindex; **cambiar solo el dominio no produce una aplicación apta para producción**.

Antes del corte deben estar completos el catálogo, la paridad funcional/SEO, el modelo de datos operativos, backups, integración comercial, configuración productiva y comprobación de rollback. Registrar la versión desplegable y obtener aprobación del resultado concreto antes de sustituir producción.

Secuencia de corte: respaldar estado vigente, coordinar cambios editoriales y eventos entrantes, aplicar la sincronización final, activar la versión validada y verificar inmediatamente rutas críticas, acceso administrativo, formularios, checkout y webhooks. Mantener la versión anterior disponible y observar errores, conversiones y cobertura de rastreo.

Volver a la versión anterior si fallan flujos críticos, se pierden eventos, aparecen errores de autenticación o hay una regresión grave de rutas/indexación. Restaurar el enrutamiento y artefacto previos; pausar efectos comerciales de la versión nueva y reconciliar eventos acumulados antes de reintentarlo. No revertir una base mediante borrado ni asumir que un rollback de código revierte también los datos.

## Evidencias que deben acompañar cada avance

Guardar fecha, versión, entorno, recuentos de contenido, resultados de pruebas y diferencias pendientes. El cierre de una fase debe apoyarse en comprobaciones del entorno correspondiente: un build exitoso no acredita publicación remota; un piloto funcional no acredita catálogo completo; una respuesta con datos iniciales no acredita paridad con la configuración productiva.
