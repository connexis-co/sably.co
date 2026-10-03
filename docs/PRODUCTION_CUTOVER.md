# Activación inicial de EmDash

La configuración de producción declara el dominio principal y los recursos independientes ya preparados. El código solo recibe tráfico después de promover manualmente un SHA de `main` con CI exitoso. El sitio anterior de Pages se conserva para recuperación.

## Datos preparados

- 90 migraciones oficiales de EmDash 1.1 y esquema nativo: diez colecciones, ocho bloques y siete relaciones.
- 964 entradas publicadas: 121 cursos, 726 variantes, 10 artículos y el resto de páginas, categorías, países, ciudades, creadores, testimonios y homologaciones.
- 287 medios copiados y verificados por SHA-256; referencias nativas remapeadas al bucket productivo. Ninguna URL de medio depende del acceso protegido de desarrollo.
- Menús, secciones, widgets, ajustes públicos y SEO individual conservados. El importador nativo se ejecutó sobre una copia del destino y se aplicó su SQL por lotes; la lectura posterior coincide, exceptuando las fechas de inserción de revisiones generadas por SQLite. Integridad de claves foráneas comprobada.
- Datos operativos históricos copiados exclusivamente a la nueva base productiva: solicitudes con sus consentimientos, comentarios y moderación, votos, calificaciones y eventos de Hotmart. Las promociones y widgets usan la configuración editada en desarrollo. El catálogo operativo está reconciliado con los IDs publicados del CMS.

Los respaldos privados y los registros de integridad están en `.emdash/cutover/`, excluidos de Git. No se copian usuarios, passkeys, sesiones ni tokens administrativos.

## Primer acceso y claves

`/_emdash/admin/setup` y `/_emdash/api/setup/*` requieren la clave de alta inicial mientras no exista ningún usuario. Fallan cerrados si falta la clave o la base. Las páginas públicas, medios y comentarios no pasan por esa puerta. El propietario debe registrar su passkey con `connexis.co@gmail.com` mediante el asistente nativo. Después, puede completar **Sably · integraciones**.

Los IDs públicos de GTM y GA4 se conservan. Brevo usa `contacto@sably.co` como remitente y destinatario de solicitudes. Las claves privadas de Brevo, HOTTOK, GA4 y Meta se introducen en el panel: el antiguo almacenamiento de secretos de Cloudflare no permite recuperarlas. Hasta configurarlas, el webhook rechaza compras con 503 y las solicitudes se guardan sin notificación de correo. Activar conversiones del servidor requiere su interruptor además de los IDs y claves.

## Verificación y recuperación

Tras promover: comprobar HTTP de inicio, cursos, blog, Contacto/Nosotros, imágenes nativas, robots, canonical, Open Graph, sitemap y puerta inicial del administrador; comprobar que desarrollo mantiene 401/noindex. Las comprobaciones no envían correos ni conversiones reales. Revisar el delta de operaciones generado mientras se preparaba el corte antes de cerrar la migración.

El proyecto Pages anterior es `sably`, dominio de origen `sably.pages.dev`, despliegue anterior `943d042e-ff98-4673-bf6b-5f5347a8ca7d`. El respaldo de DNS guarda el CNAME anterior. Para recuperar el origen anterior, retirar únicamente el custom domain `sably.co` del nuevo Worker y restaurar el CNAME proxied hacia `sably.pages.dev`. No restaurar una base antigua sobre la nueva si ya recibió solicitudes: primero conciliar el delta. Las promociones posteriores normalmente revierten solo la versión de Worker, conservando las bases.

## Corte ejecutado el 3 de octubre de 2026

La promoción del SHA `04ebf1536ee2523bd5453f81cfe5c533e268d673` encontró el dominio administrado por Pages (Cloudflare 100117). Se retiró exclusivamente esa vinculación y su CNAME, con respaldo y restauración automática preparada, y se registró `sably.co` en `sably-emdash-production`. No se modificaron MX, TXT, www ni desarrollo. Si se recupera Pages, además del CNAME hay que volver a añadir `sably.co` como custom domain de ese proyecto.

La repetición del workflow [37110960735](https://github.com/connexis-co/sably.co/actions/runs/37110960735) terminó correctamente. Se verificaron públicamente cursos, nuevas guías, imágenes, Contacto/Nosotros y el asistente de alta (401 sin clave, 200 con la clave autorizada). Producción carga GTM y desarrollo permanece protegido, sin medición. La comparación del origen operativo antes y después del corte encontró cero solicitudes, consentimientos, comentarios o eventos nuevos pendientes de copiar.

Tras la revisión editorial hay 120 cursos, 718 variantes y 13 artículos publicados: una ficha duplicada y sus ocho variantes se conservaron como borradores y se añadieron tres guías. Véase [SEO_EDITORIAL_2026-10-03.md](SEO_EDITORIAL_2026-10-03.md).
