# Integraciones administradas desde EmDash

En **Sably · integraciones** se configuran tres secciones sin reconstruir la plantilla:

- **Medición:** desactivada, Google Tag Manager o instalación directa de GA4/Meta. Al usar GTM, solo se instala el contenedor; GA4 y Meta se configuran dentro de ese contenedor. Los IDs de GA4 y Meta identifican además las conversiones del servidor.
- **Compras:** HOTTOK autentica el webhook `https://sably.co/api/hotmart-webhook`. Las compras confirmadas se envían a GA4/Meta cuando se habilita esa opción y cada integración tiene ID y clave. El interruptor de medición del navegador no controla las compras del servidor.
- **Correo:** clave API de Brevo, remitente verificado (contacto@sably.co), nombre del remitente y correo del equipo que recibe las solicitudes. Utiliza el plugin sandbox de Brevo y el sistema de correo nativo de EmDash. No admite contraseñas SMTP porque este transporte utiliza la API de Brevo.

Cada sección tiene su botón de guardar. Los secretos se introducen como contraseña y se conservan si no se modifican. «Eliminar» prepara su retirada para el siguiente guardado. «Configurada» acredita almacenamiento, no conexión con el proveedor. Guardar no envía mensajes ni conversiones de prueba.

Los campos `secret` usan el cifrado nativo de EmDash y su clave por entorno. Las rutas exigen `plugins:manage` y pasan por la protección CSRF de EmDash. La API de configuración solo devuelve indicadores de presencia; nunca devuelve las claves. El webhook lee las claves dentro del servidor. El sitio público recibe únicamente IDs validados.

Desarrollo bloquea scripts de medición, conversiones y correos operativos aunque se guarden IDs o claves allí. No copiar configuración de integraciones entre entornos: el sincronizador editorial solo permite opciones `site:*` enumeradas, y no exporta claves, plugins, usuarios o sesiones.

La plantilla incluye los hooks nativos `EmDashHead`, `EmDashBodyStart` y `EmDashBodyEnd`. El plugin aporta las etiquetas, de modo que una plantilla futura puede conservar la integración usando los mismos hooks. Los antiguos `PUBLIC_GTM_ID`, `PUBLIC_GA4_ID` y `PUBLIC_META_PIXEL_ID` ya no controlan las etiquetas de esta plantilla.

Referencias: [claves API de Brevo](https://developers.brevo.com/docs/api-key-authentication), [correo transaccional](https://developers.brevo.com/docs/send-a-transactional-email), [Measurement Protocol de GA4](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events).
