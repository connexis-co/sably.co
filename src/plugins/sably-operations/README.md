# Sably · operaciones

Plugin nativo de EmDash 1.1 para el entorno aislado de desarrollo. El CMS usa `DB`; este módulo usa exclusivamente `SABLY_DB`, con `SABLY_ENVIRONMENT=development`. No envía correos, no ejecuta webhooks ni activa cobros.

## Instalación

El descriptor en `astro.config.mjs` declara `id: sably-operations`, `version: 1.0.0`, entrada `index.ts`, entrada administrativa `admin.tsx` y la página `/operations`. Las rutas oficiales son `/_emdash/api/plugins/sably-operations/<ruta>`; la página aparece en el menú de EmDash.

Después de las migraciones legacy 0001–0010, aplicar una sola vez `migration.sql` a la base de desarrollo. Después aplicar `calendar-seed.sql`, `public-settings-seed.sql` y `public-data-seed.sql` en ese orden. Los tres últimos contienen únicamente configuración editorial y datos que ya se mostraban públicamente. No trasladan solicitudes, compradores, consentimientos, contactos privados ni sesiones de producción.

`public-data-seed.sql` se regenera localmente con `node src/plugins/sably-operations/seed-public-data.mjs`. Su `INSERT OR IGNORE` conserva una moderación realizada después de la primera importación. Las semillas son para instalación inicial; `public-settings-seed.sql` sí restablece la configuración pública capturada y no debe ejecutarse como tarea periódica.

## Pantallas y permisos

- Resumen y moderación: rol editor o administrador (`comments:moderate`). Comentarios, reseñas ligadas a una compra local y reseñas públicas importadas de Hotmart tienen fuentes separadas. La moderación conserva el autor, texto y calificación originales y registra el usuario autenticado; protege cambios simultáneos mediante el estado esperado.
- Calificaciones: promedios capturados de Hotmart, reseñas locales verificadas, votos anónimos y artículos se presentan por separado. Las muestras de reseñas no se usan para fabricar el promedio global de Hotmart.
- Promociones: administrador (`settings:manage`). Nombre interno, texto del banner, etiqueta, tema, porcentaje con cupón validado, proveedor, inclusión/exclusión de cursos, países, inicio, fin, prioridad y `?promo=<clave>`. El calendario usa UTC−05 (Bogotá). La vista previa permanece dentro del panel y no altera el checkout.
- Solicitudes: administrador. Filtros por país y curso, páginas de 100 registros, evidencia de consentimiento y CSV de la página actual. No se exponen correo, teléfono ni IP en esta pantalla/exportación.
- Widgets: administrador. Arranque y repetición de video, activación/posición/tiempos/rutas ocultas del aviso de prueba social. WhatsApp tiene un plugin independiente.

La autorización real se ejecuta en las rutas de EmDash, con su sesión, rol y protección CSRF `X-EmDash-Request`. El servicio vuelve a verificar el rol y toma el actor de `ctx.user`. Los rechazos usan `PluginRouteError` para devolver el estado HTTP correspondiente.

## Conexión con el sitio

`/api/v1/promo` conserva el contrato anterior y usa el calendario administrado. Banner y precios respetan fecha, país, proveedor, inclusiones, exclusiones y `?promo=`; no reactivan el calendario local cuando una campaña del panel está pausada o vencida. El override público capturado mantiene prioridad sobre las campañas del antiguo calendario.

`public.ts` proporciona lecturas SSR de comentarios aprobados, reseñas moderadas, prueba social y precios/valoraciones. `ResenasCurso`, `Comentarios` y `PruebaSocial` renderizan datos actuales de `SABLY_DB` y escapan texto mediante Astro. Las calificaciones de Hotmart se conservan como evidencia externa; moderar una tarjeta no altera arbitrariamente ese promedio. Los precios/valoraciones pueden compartir `Astro.locals` como alcance de caché: dos consultas por solicitud, sin caché compartida entre visitantes ni datos retenidos hasta otro despliegue.

Los datos de precios, reseñas públicas y ventas agregadas parten de capturas existentes, no de una sincronización en vivo. La captura automática contra Hotmart permanece deshabilitada en desarrollo. La publicación de código y el despliegue no son acciones de esta pantalla.

## Verificación local

`node --import tsx --test tests/sably-operations.test.ts src/lib/legacy-backend.test.ts`

Las pruebas crean SQLite en memoria desde las migraciones reales y verifican permisos, cambios concurrentes, auditoría, cupones, calendario/URL, exclusión de datos de contacto, reacción SSR a la moderación y conservación de la moderación al repetir la semilla pública. Los datos de prueba son sintéticos y no se escriben remotamente.
