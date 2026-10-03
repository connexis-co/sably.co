# Revisión de la tienda EmDash para Sably

Consulta: 3 de octubre de 2026 UTC (2 de octubre en Colombia). Host examinado: EmDash **1.1.0**, Astro **7.3.5** y Cloudflare Workers. Se recorrieron los **37 paquetes** del [registro oficial](https://plugins.emdashcms.com/) y se descargaron/verificaron **25 artefactos relevantes** para SEO, formularios, correo, analítica y operación editorial. Las fichas pertenecen a distintos autores; aparecer en este registro no convierte un plugin comunitario en código mantenido por EmDash.

El usuario confirmó que ya utiliza **Brevo**. La decisión para esta migración es integrar **Sably · Brevo**, un transporte sandbox propio con la API HTTPS oficial y ajustes cifrados nativos, conservar el SEO nativo adaptado a Sably y mantener los contactos privados en **Operaciones / SABLY_DB**. No instalar dos transportes ni dos bandejas de contactos para cubrir el mismo flujo. No hay cifras verificadas de instalaciones, descargas, satisfacción o popularidad en la evidencia consultada: la selección depende del código, los permisos y la adaptación al sitio.

## Alcance y evidencia reproducible

- [Inventario técnico](./plugin-marketplace-review.json): ID, versión, fecha del perfil, rango declarado, capacidades, hosts, almacenamiento, campos secretos y SHA-256 de los 25 paquetes. La fecha de actualización del perfil **no demuestra** mantenimiento continuo ni equivale necesariamente a la fecha de publicación de cada versión.
- Todos los artefactos revisados superaron comprobación de multihash del registro y los validadores de bundle/manifiesto del EmDash instalado. Ningún rango declarado rechazó este host; cuando no existe rango, eso **no acredita compatibilidad**. La validación estructural tampoco descubre todas las dependencias ausentes ni sustituye una prueba real de Workers.
- Se revisó código descargado sin ejecutarlo durante la selección. La alternativa Resend se probó inicialmente con HTTP simulado y el cifrado real del SDK; después se sustituyó por el conector Brevo para usar el proveedor existente. No se enviaron mensajes ni se añadieron claves de proveedores.
- Los originales de investigación están en `.emdash/registry/marketplace-review/`, ignorados por Git. El conector activo está en [src/plugins/sably-brevo](../src/plugins/sably-brevo/README.md). Su empaquetado no depende de `.emdash` ni de descargar código durante CI.

La [documentación del registro](https://docs.emdashcms.com/plugins/registry/) y de [instalación](https://docs.emdashcms.com/plugins/installing/) distingue plugins aislados de plugins nativos. Los paquetes de las tablas son candidatos de sandbox; ninguno de esos paquetes queda activo: el proyecto registra su transporte propio Sably · Brevo. Para Cloudflare, el aislamiento usa Worker Loader (`LOADER`) y `PluginBridge`; requiere disponibilidad del plan compatible. No se compró ni se cambió un plan. [Despliegue Cloudflare](https://docs.emdashcms.com/deployment/cloudflare/).

## Correo, formularios y contactos

“Sin rango” significa que el artefacto no declara versión mínima de EmDash. Permisos resumidos; el JSON adjunto conserva sus nombres exactos.

| Paquete enlazado al registro | Versión · actualización del perfil (UTC) · mínimo | Permisos / almacenamiento | Evaluación para Sably |
|---|---|---|---|
| [Resend · msale.com](https://plugins.emdashcms.com/plugins/@msale.com/resend) | 0.1.1 · 29 sep · sin rango | Transporte exclusivo; red solo `api.resend.com`; clave en `settingsSchema` de tipo `secret` | **Alternativa compatible**, no instalada porque Sably ya utiliza Brevo. Conserva `cc` y `replyTo`. Pequeño adaptador de la API HTTPS, compatible estructuralmente y probado localmente. |
| [EmDash SMTP · masonjames.com](https://plugins.emdashcms.com/plugins/@masonjames.com/emdash-smtp) | 0.4.1 · 30 sep · ≥1.0.1 | Transporte exclusivo; numerosos hosts de proveedores; historial privado | **No instalar esta versión**. Secretos en KV propio sin esquema nativo de secretos; normalización descarta `cc` y el `replyTo` del mensaje. SMTP TCP/sendmail requieren la distribución nativa Node, no este sandbox de Workers. |
| [Forward Email · numoteq.com](https://plugins.emdashcms.com/plugins/@numoteq.com/forward-email) | 0.1.1 · 14 ago · sin rango | Transporte exclusivo; `api.forwardemail.net`; configuración KV | Sin ventaja aquí. Token fuera del cifrado de settings nativo; payload no conserva `cc`/`replyTo`. |
| [Cloudflare Email Sending · cfreear](https://plugins.emdashcms.com/plugins/@cfreear.bsky.social/emdash-cf-email-sending) | 0.1.2 · 26 jun · sin rango | Transporte + eventos; REST `api.cloudflare.com`; configuración KV | Token en KV propio y pérdida de campos por mensaje. Si se elige Cloudflare en el futuro, preferir el transporte nativo oficial del adaptador, no añadir este junto a Resend. |
| [Forms · netdollar.dev](https://plugins.emdashcms.com/plugins/@netdollar.dev/forms) | 0.1.0 · 29 sep · sin rango | `email:send`; tablas privadas `forms`, `entries`, `tickets`; sin red externa | **Mejor alternativa para nuevos formularios configurables**. No instalar ahora sin puente al directorio actual de contactos: crea otra bandeja, no un CRM compartido. |
| [Contact Forms · masonjames.com](https://plugins.emdashcms.com/plugins/@masonjames.com/contact-forms) | 0.2.0 · 30 sep · ≥1.0.1 | `email:send`; tablas privadas `forms`, `submissions` | Opción más sencilla de formulario/bandeja/CSV. Duplica los formularios y registros actuales; no es una mejora necesaria para esta migración. |
| [Freeform · solspace.com](https://plugins.emdashcms.com/plugins/@solspace.com/freeform) | 0.1.3 · 3 jul · sin rango | Correo y red sin lista cerrada de hosts; formularios, envíos, plantillas y webhooks privados | Amplio constructor con paquete Astro adicional. Documentación de configuración antigua y dependencias del bundle merecen prueba de runtime antes de adoptarlo; alcance y permisos mayores de lo necesario. |
| [Contact Form · harsh-pranshtech](https://plugins.emdashcms.com/plugins/@harsh-pranshtech.bsky.social/contact-form) | 1.0.0 · 1 jul · sin rango | Sin capacidades externas; tabla privada `submissions` | **Artefacto incompleto**: `backend.js` importa `./sandbox-JYcA2EvQ.mjs`, ausente del tar. No instalar esta versión aunque valide su manifiesto. |
| [Bulletin · meekmedia](https://plugins.emdashcms.com/plugins/@meekmedia.bsky.social/bulletin) | 0.1.1 · 29 sep · ≥0.42.0 | Lectura de contenido, correo, Turnstile; suscriptores/campañas/entregas privados | Útil si se decide crear un boletín: confirmación y baja de suscripción. No reemplaza contactos comerciales; requiere consentimiento específico y configurar `blog` en lugar de `posts`. Envío automático desactivado por defecto. |
| [Comment Notify · La Symphonie](https://plugins.emdashcms.com/plugins/@lasymphonieagency.com/comment-notify) | 0.1.0 · 29 sep · sin rango | Lectura de contenido/usuarios y envío de correo | Escucha comentarios nativos de EmDash; las reseñas Sably viven en SABLY_DB y no disparan ese evento. No aportaría notificaciones reales sin un puente. |

### Correo elegido: Sably · Brevo

El [conector propio](../src/plugins/sably-brevo/README.md) utiliza `POST https://api.brevo.com/v3/smtp/email` con cabecera `api-key`, conforme a la [documentación primaria de Brevo](https://developers.brevo.com/reference/send-transac-email). No depende del SMTP multiproveedor revisado ni de sockets TCP. Su descriptor sandbox declara únicamente `network:request` y `hooks.email-transport:register`, con red limitada a `api.brevo.com`.

Configurar en los ajustes de **Sably · Brevo**:

1. `fromEmail`: **contacto@sably.co**, indicado por el propietario; debe estar verificado en Brevo.
2. `fromName`: **Sably**.
3. `apiKey`: clave API transaccional guardada mediante el campo nativo **secret**, cifrado con `EMDASH_ENCRYPTION_KEY`. La clave no está en Git ni se pidió por chat.
4. En **Ajustes → Correo**, seleccionar `sably-brevo`; en **Sably · operaciones**, usar `notificationEmail=contacto@sably.co` para los avisos al equipo.

El transporte conserva el destinatario, CC explícito y Reply-To de EmDash. No añade copias, suscripciones a listas ni contactos de marketing. Los fallos no exponen respuestas del proveedor, direcciones ni claves, y los envíos no se reintentan automáticamente. Las solicitudes de desarrollo no invocan el proveedor; guardan datos de prueba. Una prueba de entrega real requiere una clave válida y un destinatario controlado.

Pruebas: `node --import tsx --test tests/brevo-plugin.test.ts`, **7/7**: empaquetado sandbox, proveedor exclusivo, cifrado AES-GCM nativo, aislamiento por plugin/campo, payload Brevo, escape de HTML, rechazo sin configuración o destinatario válido, errores y ausencia de reintentos. HTTP es simulado: estas pruebas no acreditan la verificación del remitente ni entregabilidad. [Correo EmDash](https://docs.emdashcms.com/guides/email/), [secretos nativos](https://docs.emdashcms.com/deployment/secrets/).

Resend 0.1.1 queda como alternativa analizada, sin registro activo ni copia vendorizada en la entrega final. Si en el futuro cambia el proveedor, el pipeline nativo permite sustituir el transporte sin reescribir los formularios.

### Contactos privados: límites y alternativa útil

No se encontró un CRM dedicado, un sincronizador de contactos Brevo ni un directorio único de contactos entre los 37 paquetes. **SMTP 0.4.1 incluye la API transaccional de Brevo**, pero no registra contactos/listas en Brevo. No confundir transporte de correo con CRM.

Los plugins de formularios examinados guardan envíos en almacenamiento privado del plugin, dentro de la base CMS `DB`; no exigen publicarlos como colecciones. Eso es preferible a convertir correos y consentimientos en contenido público, pero **no comparten** automáticamente la base operativa `SABLY_DB` ni deduplican por correo entre formularios y leads históricos. Sably mantiene su consulta/exportación privada, autenticada por roles, y la asociación de consentimiento/curso/país en Operaciones. No se copiaron contactos de producción para esta investigación.

Si se necesitan encuestas o formularios nuevos administrables, **Forms 0.1.0** ofrece varios pasos, condiciones, consentimiento, apertura/cierre programado, versión de los campos junto al envío, bandeja, notas y CSV. Tiene ticket de un solo uso, honeypot y espera mínima; su propio README exige protección adicional contra abuso en producción. Su frontend se integra mediante `@netdollar/emdash-forms` o API; usar el ID real instalado. Antes de adoptarlo: conectar cada envío válido a SABLY_DB de forma idempotente, guardar la versión de consentimiento, definir retención/borrado y no activar respuestas automáticas en desarrollo. No crea por sí solo ese puente. [Forms: ficha y fuentes](https://plugins.emdashcms.com/plugins/@netdollar.dev/forms).

Contact Forms es suficiente para formularios simples y aporta límites de frecuencia/retención configurables, pero no tiene el constructor multipaso de Forms ni convierte sus entradas en contactos unificados. En ambos casos la autorización debe probarse con cuentas de roles reales antes de mostrar datos privados. [Contact Forms](https://plugins.emdashcms.com/plugins/@masonjames.com/contact-forms).

## SEO y operación editorial

| Paquete enlazado | Versión · perfil · mínimo | Acceso relevante | Decisión |
|---|---|---|---|
| [SEO Suite · nookeshk](https://plugins.emdashcms.com/plugins/@nookeshk.bsky.social/seo-suite) | 0.2.0 · 29 sep · sin rango | Lectura/escritura de contenido, edición de borradores, políticas, taxonomías, medios y redirecciones | No añadir: genera WebSite y Article genéricos que duplican el SEO nativo o describen cursos como artículos; paneles orientados a `posts/pages`. Mantener `sably-seo`. |
| [Preflight · jammaru.com](https://plugins.emdashcms.com/plugins/@jammaru.com/preflight) | 0.1.1 · 30 sep · ≥0.39.0 | Lectura de contenido/revisiones/esquema/taxonomías/autorías/medios y políticas; sin red/escritura editorial | **Mejor candidato futuro a control editorial**, configurado por colección. Empieza en Observe; no instalar con reglas genéricas hasta acordar requisitos de cursos, variantes y entidades. |
| [SEO Guard · squatchpresscms](https://plugins.emdashcms.com/plugins/@squatchpresscms.bsky.social/seo-guard) | 0.1.0 · 1 oct · sin rango | Lectura + política | Configurable por colección/campos; defecto `posts` y bloqueo. Solapa diagnóstico actual y no resuelve herencia local de Sably. |
| [SEO Guard · eclipsedigi](https://plugins.emdashcms.com/plugins/@eclipsedigi.bsky.social/seo-guard) | 0.1.0 · 29 sep · sin rango | Lectura + política | Otro publicador, funciones parecidas; no asumir identidad por el nombre. Misma cautela de reglas/herencia. |
| [Publish Check · emdashplugins](https://plugins.emdashcms.com/plugins/@emdashplugins.bsky.social/publish-check) | 0.3.0 · 29 sep · ≥1.0.1 | Solo políticas de contenido | Ligero, pero reglas globales sobre título/descripción/body y bloqueo por defecto causan falsos rechazos en ciudades y variantes. No activar sin adaptar. |
| [Preflight · meekmedia](https://plugins.emdashcms.com/plugins/@meekmedia.bsky.social/preflight) | 0.1.0 · 29 sep · ≥1.0.0 | Lectura, borrador y política | Reglas de posts, mínimo de palabras y paneles `posts/pages`; menos adecuado que jammaru para el esquema Sably. |
| [Crosslink · meekmedia](https://plugins.emdashcms.com/plugins/@meekmedia.bsky.social/crosslink) | 0.1.0 · 29 sep · ≥1.0.0 | Lectura de contenido/esquema/borrador; sin red | Sugerencias de enlaces útiles, pero paneles fijos `posts/pages` necesitan adaptación. “Huérfanos” considera enlaces en contenido, no todo el menú/plantilla. Posponer. |
| [Link Guardian · meekmedia](https://plugins.emdashcms.com/plugins/@meekmedia.bsky.social/link-guardian) | 0.1.0 · 29 sep · ≥1.0.0 | Lectura, escritura de redirecciones y red sin hosts cerrados | Revisión periódica de enlaces. El control de acceso de dev produciría falsos fallos HTTP; tampoco sustituye las redirecciones heredadas. Mejor evaluar después del corte, con alcance explícito. |

El [análisis previo de SEO Suite](./seo-plugin-decision.md) documenta los conflictos del artefacto. El SEO de Sably ya cubre metadatos nativos, canonical, sitemap, robots por entorno y datos estructurados Course/Article sin duplicación. El módulo `sably-seo` analiza sus nueve colecciones y la herencia de variantes; instalar otro generador no mejora automáticamente esa cobertura.

## Otros candidatos

| Paquete enlazado | Versión · perfil · mínimo | Permisos / utilidad | Decisión |
|---|---|---|---|
| [Analytics · eisbachcode.de](https://plugins.emdashcms.com/plugins/@eisbachcode.de/analytics) | 0.2.2 · 29 sep · ≥0.39.0 | Lectura de contenido/esquema y `api.cloudflare.com`; token nativo secreto | Útil después del corte si se desea analítica dentro del CMS. Necesita Web Analytics real, sitio y token de solo lectura. No usar el modo demo como tráfico real. |
| [Umami Analytics · shane](https://plugins.emdashcms.com/plugins/@shane.bsky.shas.am/emdash-umami-analytics) | 0.1.2 · 1 oct · ≥1.0.1 | Lectura/esquema y red libre para servidor Umami; clave secreta | Alternativa si ya se elige Umami. No introducir otro servicio de medición sin necesidad. |
| [Simple History · masonjames.com](https://plugins.emdashcms.com/plugins/@masonjames.com/simple-history) | 0.2.0 · 30 sep · ≥1.0.1 | Solo lectura de contenido; historial privado | Candidato de bajo alcance para historial de guardados/borrados. No equivale a auditoría completa de publicación, acceso, contactos y secretos. |
| [Audit Log · plugins.emdashcms.com](https://plugins.emdashcms.com/plugins/@plugins.emdashcms.com/audit-log) | 0.2.2 · 22 sep · sin rango | Lectura/escritura de contenido y lectura de medios | Solicita más autoridad que Simple History. No instalar solo por su nombre o publicador. |
| [Image Optimizer · verco.app](https://plugins.emdashcms.com/plugins/@verco.app/image-optimizer) | 0.1.0 · 2 oct · sin rango | Solo lectura de medios | Informa tamaños/ahorro estimado; **no transforma las imágenes**. Diagnóstico opcional, no optimización aplicada. |
| [AI Alt Text · La Symphonie](https://plugins.emdashcms.com/plugins/@lasymphonieagency.com/ai-alt-text) | 0.2.0 · 30 sep · sin rango | Escritura editorial/metadata de medios y API Anthropic; clave secreta | Requiere proveedor y revisión editorial; las imágenes protegidas de dev no son descargables por el servicio. Posponer, sin claves ni consumo automático. |
| [Webhook Notifier · plugins.emdashcms.com](https://plugins.emdashcms.com/plugins/@plugins.emdashcms.com/webhook-notifier) | 0.2.2 · 28 sep · sin rango | Lectura de contenido/medios y red sin hosts cerrados | Útil para integraciones definidas; no hay destino ni flujo necesario en esta migración. No configurar envíos externos. |

Se revisaron también las fichas de los doce paquetes restantes (IDs/versiones en `otherProfiles` del JSON), sin descargar sus bundles: Comment Spam Protection 1.0.0 trata comentarios nativos, mientras Sably conserva reseñas operativas propias; Auto Unpublish Posts 1.0.0 no sustituye la vigencia del calendario de promociones; Eventual 0.10.0 y Propcore 0.1.0 atienden eventos e inventario inmobiliario. Image Generator 0.1.0, LinguaDash 0.1.0 y AI Search 0.5.0 añaden flujos de IA que no resuelven los contactos ni el transporte. Discord Notifier 0.1.0, AT Protocol 0.2.2 y EmDash to Buffer 1.1.1 implican publicación/notificación en servicios externos aún no solicitados. Dynamic QR 0.2.0 no es prioridad del sitio y Marketplace Test 0.2.1 es una fixture de pruebas, no una funcionalidad de negocio. [Catálogo consultado](https://plugins.emdashcms.com/).

La revisión puede repetirse ante una nueva necesidad o versión; no se habilitan actualizaciones automáticas de código externo en esta decisión.

## Estado de entrega

Sably · Brevo queda integrado en el código; falta verificar carga del sandbox desplegado y configurar la clave privada. La verificación del remitente y la entrega real se registrarán por separado. No se instalaron Resend, SMTP 0.4.1 ni otros constructores de formularios. No se enviaron correos ni se copiaron credenciales productivas durante esta revisión.
