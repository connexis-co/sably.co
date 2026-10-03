# Auditoría de dependencias del entorno de desarrollo

Comprobación: 3 de octubre de 2026, `npm audit --json` y consulta de versiones al registro oficial npm. No se ejecutó `npm audit fix`, no hubo actualizaciones de dependencias ni cambios del lockfile durante esta revisión.

El resultado tiene ocho alertas de severidad alta, todas derivadas de una sola vulnerabilidad: `http-cache-semantics` 4.2.0, dependencia de Astro 7.3.5 mediante `^4.2.0`. Las otras siete entradas son la propagación por Astro, sus integraciones y EmDash; `github-slugger` 2.0.0 no introduce una vulnerabilidad adicional.

El aviso [GHSA-ch52-4w7c-c8xp / CVE-2026-93748](https://github.com/advisories/GHSA-ch52-4w7c-c8xp), actualizado el 2 de octubre, afecta versiones hasta 4.2.0 y declara que aún no hay versión corregida. El registro npm mantiene 4.2.0 como `latest`. Por ello no existe una actualización compatible publicada que resuelva estas alertas. La sugerencia automática de bajar MDX a 0.19.7 no es compatible con esta aplicación y no se aplicó.

## Alcance observado en Sably

La inspección de `node_modules/astro/dist` encuentra el único uso de `http-cache-semantics` en `assets/build/remote.js`, para calcular la vigencia de imágenes remotas. Ese código construye solicitudes nuevas sin las cookies, autorización ni `Cache-Control` del visitante, calcula `storable()` y `timeToLive()`, y no usa la decisión `satisfiesWithoutRevalidation()` implicada en el problema de `max-stale`.

Además, la configuración de desarrollo usa el servicio de imágenes `passthrough`. El Worker protege todas las respuestas de aplicación con `Cache-Control: private, no-store` y exige acceso al entorno. Las APIs privadas nativas de EmDash también responden sin caché compartida. No se ha identificado en esta configuración una ruta al caso de recuperación de sesiones de otro usuario descrito por el aviso; esto es una evaluación del uso local, no una corrección de la dependencia ni un resultado de auditoría limpio.

## Antes de producción

1. Volver a consultar el aviso y las versiones publicadas. Si aparece una versión corregida compatible con el rango de Astro, actualizarla con lockfile y comprobaciones normales.
2. Revisar de nuevo este alcance si se añade una caché HTTP compartida, un servicio de imágenes distinto o una actualización de Astro que cambie cómo utiliza la dependencia.
3. Mantener sesiones, administración y respuestas personalizadas fuera de cachés públicas. No ejecutar `npm audit fix --force` para ocultar estas entradas.

Producción no se modificó como parte de esta revisión.
