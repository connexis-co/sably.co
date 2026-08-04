# sably.co

Plataforma de cursos online de belleza (estilo Platzi) que revende cursos de Hotmart e incluye
la membresía **Black University®** (antes Seminarios.Online®) como beneficio de cada compra.

## Stack

- **Astro 7** (sitio estático) + **Tailwind CSS 4**
- Despliegue en **Cloudflare Workers** (static assets) con Wrangler
- Futuro: backend **Laravel 13 + Filament + Octane (PHP 8.5)** en Hetzner (Connexis).
  El front seguirá en Cloudflare edge; la capa `src/data/*` está pensada para
  reemplazarse por llamadas a ese API sin tocar las páginas.

## Comandos

```bash
npm install       # instalar dependencias
npm run dev       # desarrollo en localhost:4321
npm run build     # build de producción en ./dist
npm run preview   # previsualizar el build
```

## Editar el catálogo

Todo el contenido vive en `src/data/`:

- `src/data/courses.ts` — cursos, precios, temarios y **enlaces de compra**.
  ⚠️ En cada curso, pega tu enlace de afiliado de Hotmart en el campo `hotmartUrl`
  (ej. `https://pay.hotmart.com/XXXXXXXX?off=yyyy`). Mientras esté vacío, el botón
  "Inscribirme" dirige a `/contacto`.
- `src/data/site.ts` — marca, correo de contacto, textos de Black University.

## Despliegue en Cloudflare

### Automático (GitHub Actions)

Cada push a `main` (o a la rama de desarrollo) ejecuta `.github/workflows/deploy.yml`.
Requiere configurar **una sola vez** el secreto del repositorio:

1. GitHub → Settings → Secrets and variables → Actions → *New repository secret*
2. Nombre: `CLOUDFLARE_API_TOKEN` — Valor: un token de API de Cloudflare con permisos
   *Workers Scripts: Edit* (y la zona `sably.co` para el dominio propio).

### Manual (desde tu máquina)

```bash
npm run build
CLOUDFLARE_API_TOKEN=<tu-token> npx wrangler deploy
```

El `wrangler.jsonc` adjunta automáticamente los dominios `sably.co` y `www.sably.co`
(la zona debe existir en la cuenta de Cloudflare). Si ese paso fallara, elimina el bloque
`routes` y vuelve a desplegar; el sitio quedará en `sably-co.<subdominio>.workers.dev`.

## Páginas

- `/` — inicio · `/cursos` — catálogo con filtros · `/cursos/[slug]` — detalle de curso
- `/black-university` — beneficio incluido · `/nosotros` · `/contacto`
- Legales (requeridas para la revisión de Meta): `/legal/terminos`, `/legal/privacidad`,
  `/legal/reembolsos`, `/legal/cookies`
- SEO: `sitemap.xml`, `robots.txt`, Open Graph (`/og.png`), JSON-LD (Organization, Course)
