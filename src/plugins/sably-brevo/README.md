# Sably · Brevo

Transporte sandbox propio para EmDash 1.1.0, registrado por configuración. Implementa únicamente `email:deliver` mediante [la API transaccional HTTPS de Brevo](https://developers.brevo.com/reference/send-transac-email). Host permitido: `api.brevo.com`. No sincroniza contactos de marketing ni administra listas.

La clave usa `settingsSchema.apiKey: secret` y el cifrado nativo `EMDASH_ENCRYPTION_KEY`. Configurar `fromEmail=contacto@sably.co` (debe estar verificado en Brevo), `fromName=Sably` y la clave privada desde el CMS. Seleccionar `sably-brevo` en Ajustes → Correo. Las solicitudes usan además el destinatario `notificationEmail` de Sably Operaciones.

Conserva destinatario, CC explícito y Reply-To del mensaje oficial; no añade copias. EmDash no ofrece BCC en su contrato. El HTML derivado de texto se escapa. No registra contenido, correos ni respuestas del proveedor; tampoco reintenta automáticamente un envío cuyo resultado sea incierto. Desarrollo no invoca este transporte desde formularios ni recuperación. No hay clave incluida ni envío real en las pruebas.
