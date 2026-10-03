# Esquema operativo reproducible

El aplicador opera únicamente sobre `SABLY_DB`, nunca sobre `DB` (EmDash). Valida cuenta, Worker, entorno, URL, nombre e identidad de las bases y aislamiento entre desarrollo y producción usando `scripts/environment-config.mjs`. Rechaza que `SABLY_DB` apunte al CMS o que su directorio de migraciones salga de `migrations/`.

Plan local, sin consultar Cloudflare:

```sh
node scripts/apply-operational-schema.mjs --target development
node scripts/apply-operational-schema.mjs --target production --dry-run
```

Aplicación explícita, con las credenciales de Cloudflare ya disponibles en el entorno del despliegue:

```sh
node scripts/apply-operational-schema.mjs --target development --execute
node scripts/apply-operational-schema.mjs --target production --execute
```

Orden de CI: validar destino → aplicar esquema operativo → construir para el mismo destino → pruebas → desplegar/subir versión. Este comando no adjunta dominios, activa tráfico, instala usuarios, importa el CMS ni copia registros privados. Los trabajos de un mismo entorno deben usar una clave de concurrencia en CI para evitar migraciones simultáneas.

1. Registra en `_sably_operations_migrations` si encontró una base nueva o una existente. Conserva esa decisión si un despliegue se interrumpe.
2. Ejecuta `wrangler d1 migrations apply SABLY_DB` con el archivo de configuración del destino. Wrangler conserva su propio historial `d1_migrations` para el esquema legacy. Un esquema legacy aplicado manualmente sin ese historial requiere reconciliación explícita; el script no inventa su historial ni ignora errores de migración.
3. Inspecciona tablas, índices y columnas de `promocion`. Aplica solo las instrucciones faltantes de `src/plugins/sably-operations/migration.sql`. Esto admite el esquema del plugin ya aplicado manualmente en desarrollo.
4. Las semillas de calendario y datos públicos solo contienen `INSERT OR IGNORE`; las filas existentes conservan su estado, incluso reseñas rechazadas. La semilla de ajustes públicos se aplica una sola vez exclusivamente cuando el aplicador encontró una base nueva. En una base existente se registra como adoptada sin ejecutar sus `UPDATE` ni su actualización de promoción.
5. Registra el SHA-256 de cada semilla. Los despliegues posteriores no la repiten. Cambiar una semilla ya registrada genera un error y exige una migración nueva y versionada; esto evita reemplazar ajustes editoriales con una captura posterior.

El baseline público contiene promociones, precios/valoraciones agregadas y reseñas ya públicas del sitio. No incorpora leads, correos, teléfonos de clientes, consentimientos ni compras privadas. Los valores iniciales de las migraciones legacy y la captura pública deben revisarse antes de abrir ventas en cada destino.

Pruebas locales:

```sh
node --test scripts/apply-operational-schema.test.mjs
```

Se verifica una base nueva, la adopción de desarrollo previamente inicializado, dos ejecuciones consecutivas, conservación de ajustes y moderación, rechazo de destinos erróneos, integridad de semillas y que el plan local no invoque Wrangler. No se ha ejecutado este aplicador contra una base remota durante su implementación.
