# Sably · EmDash

Catálogo de cursos con Astro 7, EmDash 1.1 y Cloudflare Workers. EmDash administra el contenido publicado y los módulos de Sably; la plantilla `sably-classic` conserva el diseño actual.

## Entornos permanentes

| Entorno | Dominio | Flujo |
| --- | --- | --- |
| Desarrollo | https://dev.sably.co | PR → `develop` → CI → despliegue automático |
| Producción | https://sably.co | PR → `main` → CI → promoción manual de un SHA verificado |

Cada entorno tiene sus propias bases CMS/operaciones, medios R2 y sesiones. El Worker productivo nuevo comienza sin rutas y desactivado; el sitio anterior sigue sirviendo producción hasta ejecutar el corte documentado. Publicar código no vuelve a importar contenido.

## Trabajo local

Usar Node 22.23.1, indicado en `.nvmrc`, y credenciales locales ignoradas por Git.

```sh
npm ci
npm run dev
npm run content:check
npm run test:migration
npm run check
npm run check:functions
npm run build:dev
```

`npm run build` también construye desarrollo y elimina secretos del artefacto. `npm run deploy:development` verifica el Worker y sus recursos antes de desplegar. El antiguo script de Pages está cerrado para evitar publicar un artefacto incompatible.

## Organización

- `src/lib/emdash-content.ts`: lectura editorial publicada y relaciones nativas.
- `src/themes/`: contrato y selección de la plantilla; páginas, bloques y componentes.
- `src/plugins/`: WhatsApp, operaciones y auditoría SEO integrados con EmDash.
- `src/pages/`: rutas estables y páginas nuevas definidas en el CMS.
- `scripts/sync-content.mjs`: copia editorial de producción a desarrollo con respaldo.
- `config/`, `wrangler.jsonc`, `.github/workflows/`: recursos, construcción y despliegues aislados.
- `src/content/`, `scripts/migration-source/`: archivo de procedencia y validación de la migración; las páginas públicas leen EmDash.

## Documentación

[Guía editorial](docs/SABLY_EDITORIAL_GUIDE.md) · [CI/CD y sincronización](docs/CI_CD.md) · [Verificación](docs/EMDASH_DEV_VERIFICATION.md) · [Contenido migrado](docs/migration-content.md) · [Contribución](CONTRIBUTING.md)
