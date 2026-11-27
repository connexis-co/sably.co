# WhatsApp contextual de Sably

Plugin nativo EmDash 1.1. El código y la configuración son independientes de la plantilla. La configuración vive en el KV del plugin; su edición se hace en **Sably · WhatsApp** dentro de EmDash y requiere el permiso `settings:manage` (administrador).

El descriptor declara `sably-whatsapp`, `index.ts` como entrada de servidor, `admin.tsx` como entrada de administración y la página `/whatsapp`. La plantilla debe renderizar los fragmentos de página de EmDash para incluir el botón y sus eventos. No requiere incluir el antiguo componente `WhatsAppFloat`.

## Configuración

El formulario permite activar el botón, elegir móvil/escritorio, número internacional, mensaje, etiqueta accesible, lado, separación, color, animación, demora y rutas ocultas. El número vacío mantiene el número del país configurado en el CMS; no lo sustituye por un único contacto global.

### Burbuja flotante (27-nov)

Círculo de 52 px (móvil), 56 px (tableta) y 58 px (escritorio) con dos ondas que se expanden tres veces al aparecer y se detienen al pasar el ratón o enfocarlo; con `prefers-reduced-motion` no hay ondas ni transiciones. De fábrica aparece al bajar 400 px («Aparecer al desplazarse» y «Aparece tras bajar (px)»; si la página es más corta, desde que carga) y se esconde mientras el pie está a la vista para no tapar sus enlaces. En escritorio, el aviso «¿Dudas? Escríbenos» sale una vez por visita a su lado, se va solo a los 8 s y tiene botón de cerrar; vacío, no hay aviso. No aparece en `/ingresar/` ni en `/mi-cuenta/` aunque el panel no los liste.

Apilado: `#sably-whatsapp` es el contenedor fijo y sube con `translate` lo que publiquen las barras fijas en `--fijo-inferior` (compra de la ficha en el celular, narración del blog); el aviso de cookies lo sube aparte con `--sbc-wa` y el botón «Volver arriba» se pone encima de él. Lo guardado antes de estos campos hereda los valores de fábrica. El clic envía el `click_whatsapp` de siempre con `whatsapp_origen: 'flotante'` (y el enlace lleva `data-whatsapp-origen="flotante"`).

Los mensajes admiten `{titulo}`, `{curso}`, `{categoria}`, `{pais}` y `{url}`. El hook entrega a `{url}` el origen y la ruta, sin parámetros de consulta. Los valores se codifican para el enlace de WhatsApp, y los atributos HTML se escapan.

El horario usa una zona IANA como `America/Bogota`, días de semana y horas. Ambas horas vacías significan todo el día en los días seleccionados. En un horario nocturno, por ejemplo lunes de 22:00 a 02:00, las primeras horas del martes pertenecen a la jornada del lunes. Sin días seleccionados, el botón se oculta.

Una regla combina curso, categoría, país, ruta y vigencia; todos sus filtros deben cumplirse. Cada lista vacía admite todos sus valores. Las exclusiones y el horario general siempre se aplican. Si coinciden varias reglas, gana la mayor prioridad; a igual prioridad se usa su ID para mantener un resultado estable. El número o mensaje vacío de una regla hereda la configuración general.

Los cursos, categorías y países se seleccionan con búsqueda y casillas. Las rutas se escriben una por línea, desde `/`, y admiten `*`; no incluyen dominio ni parámetros. Las fechas de reglas indican expresamente que el editor usa la hora local del dispositivo y se almacenan con zona horaria.

### Enlace junto al precio de la ficha (27-nov)

Bajo el botón de compra de la ficha, los dos temas pintan «¿Tienes dudas? Escríbenos por WhatsApp» (`src/components/EnlaceWhatsAppFicha.astro`): enlace de texto con el icono, sin fondo. No tiene ajustes propios: sale de esta misma configuración (`resolvePriceLink` en `model.ts`, leída en `src/lib/whatsapp-ficha.ts`), así que usa el número y la regla que le tocan a la página y desaparece cuando la burbuja no se pinta (apagada, fuera de horario, ruta oculta, sin número); las casillas «móvil» y «escritorio» también le aplican. El mensaje es fijo, «Hola, quiero más información del {curso}», y no usa el del panel. El clic envía `click_whatsapp` con `whatsapp_origen: 'ficha_precio'` y la regla en `whatsapp_rule`, desde el mismo guion de la burbuja.

## Límite operativo y pruebas

Guardar cambia el botón de las siguientes solicitudes de página. No envía mensajes a WhatsApp ni crea automatizaciones de contacto. Los cambios concurrentes en esta configuración KV usan la última escritura; conviene recargar antes de editar una configuración abierta en otra sesión.

Las rutas `config`, `save` y `choices` son privadas, están protegidas por los permisos/CSRF de EmDash y no exponen acciones públicas de escritura. El cuerpo de guardado está limitado a 64 KiB. La validación rechaza colores/protocolos ajenos al formato previsto, fechas inválidas, números incorrectos y etiquetas accesibles vacías. Los patrones se comparan sin construir expresiones regulares con retroceso.

Comprobación: `node --import tsx --test tests/sably-whatsapp.test.ts`. Ocho casos cubren selección, exclusiones, horarios nocturnos, números/fechas/colores, codificación de mensajes, rutas y rechazo de configuración con HTTP 400 antes de escribir.
