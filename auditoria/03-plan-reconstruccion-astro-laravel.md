# Plan de reconstrucción — academiadebelleza.edu.co como vitrina de sably

Objetivo: sustituir el WordPress actual (tema "Beauty Luxe", que desaparece) por
una plataforma propia: **frontend Astro 7** + **backend Laravel 13 con Octane**,
donde academiadebelleza.edu.co es la primera vertical (belleza) de **sably**, la
vitrina de cursos referidos que envía la compra a Hotmart con la comisión de
afiliado intacta.

## 1. Arquitectura propuesta

```
┌─────────────────────────────────────────────────────────────┐
│  Astro 7 (SSG/SSR híbrido)  →  academiadebelleza.edu.co     │
│  · Páginas de curso, ciudad, categoría (SSG, re-build       │
│    programado o on-demand vía webhook del backend)          │
│  · Islands mínimas (formularios, comparador)                │
└──────────────┬──────────────────────────────────────────────┘
               │ API REST/JSON (interna)
┌──────────────▼──────────────────────────────────────────────┐
│  Laravel 13 + Octane (Swoole/FrankenPHP) — backend sably    │
│  · Catálogo de cursos (productos Hotmart + metadatos SEO)   │
│  · Redirector /go/{slug} → hotlink Hotmart con ?ap y UTM    │
│  · Captura de leads (formularios) + redirección a checkout  │
│  · Webhooks Hotmart (compra aprobada/reembolso) con HOTTOK  │
│  · Panel: mapa de enlaces por producto (venta/producto/     │
│    crashing/checkout-SO), métricas de clics y conversión    │
└──────────────┬──────────────────────────────────────────────┘
               │
        MySQL/PostgreSQL + Redis (colas y caché Octane)
```

### Decisiones clave

- **Redirector propio `/go/{slug}`**: cada botón de compra del frontend apunta a
  `academiadebelleza.edu.co/go/<slug>` (o `sably.co/go/<slug>`). El backend
  registra el clic (curso, página, ciudad, fuente) y responde 302 al hotlink
  `go.hotmart.com/<HOTLINK>?ap=<código>&sck=<tracking>`. Así:
  - la comisión queda garantizada en un único punto controlado (no repartida en
    cientos de botones editados a mano en WordPress — la causa raíz de los
    enlaces rotos actuales);
  - cambiar un checkout no exige tocar contenido;
  - el `sck` permite atar cada venta del webhook a la página/campaña de origen.
- **Formularios**: el POST va al backend (lead a BD + CRM/email), la respuesta
  redirige al checkout correspondiente. Nada de custom fields de WordPress con
  URLs pegadas a mano.
- **Webhooks Hotmart**: endpoint `POST /webhooks/hotmart` validando el header
  `X-HOTMART-HOTTOK` contra el hottok de la cuenta. Eventos: PURCHASE_APPROVED,
  PURCHASE_REFUNDED → marca leads como compradores, alimenta métricas reales de
  conversión por página.
- **Octane**: workers persistentes; cuidado con estado estático en singletons.
  Redis para caché de catálogo y rate-limiting del redirector.

## 2. SEO programático (el modelo actual, hecho bien)

La estructura actual del WP (curso × ciudad) se conserva pero generada desde
datos:

- `/cursos/{curso}/` — página canónica del curso (contenido único, temario,
  precio, FAQ con schema.org `Course` + `FAQPage`).
- `/cursos/{curso}/{ciudad}/` — variante por ciudad **solo** para ciudades con
  demanda real (Search Console lo dirá); contenido diferenciado (testimonios,
  datos locales), no plantilla clonada — el thin content clonado por ciudad es
  penalizable y es probable causa parcial de la caída actual.
- `/blog/…` — contenido de apoyo para captación informacional.
- Sitemap XML generado por el backend; `robots.txt` limpio.

### Migración sin perder (más) SEO

1. Congelar el inventario de URLs actual (ya extraído de Search Console →
   `auditoria/datos/`).
2. Tabla de redirecciones 301 vieja→nueva **antes** del switch; nada puede
   responder 404 el día del cambio.
3. Conservar los titles/descriptions que hoy traen clics (datos GSC) donde sigan
   siendo válidos.
4. Verificación en Search Console el mismo día: sitemap nuevo + inspección de
   las 20 URLs top.

## 3. Fases

| Fase | Alcance | Criterio de salida |
|---|---|---|
| 0. Estabilizar el WP actual | Reparar enlaces/formularios rotos hacia Hotmart (scripts en `scripts/`), parchear plugins, restaurar tracking | Compra de prueba completa con comisión atribuida |
| 1. Backend sably (Laravel 13 + Octane) | Catálogo, redirector `/go/`, leads, webhook HOTTOK | Redirector en producción sirviendo los botones del WP actual (primer beneficio sin esperar el rediseño) |
| 2. Frontend Astro 7 | Páginas curso/ciudad/blog desde el catálogo, Core Web Vitals > 90 | Réplica funcional en staging con las 301 listas |
| 3. Switch + expansión | DNS al nuevo stack, redirecciones activas, añadir cursos de belleza faltantes del catálogo SO | Sin 404 en GSC 2 semanas; nuevos cursos indexados |
| 4. sably multi-vertical | Extraer el motor a sably.co, nuevas verticales océano azul | Segunda vertical publicada reutilizando el motor |

> Nota fase 0→1: el redirector `/go/` puede desplegarse **antes** de reconstruir
> nada, apuntando los botones actuales del WordPress a él. Es la reparación más
> rápida del problema de comisiones y da métricas de clics desde el día uno.

## 4. Métricas y analítica

- GA4 (`G-…` del measurement ID vigente — ver auditoría GTM/GA4) instalado en
  Astro vía Partytown o gtag directo; eventos: `view_course`, `click_checkout`
  (con curso/ciudad/tipo de enlace), `lead_form_submit`.
- Conversión real (compra) vía webhook Hotmart → Measurement Protocol a GA4 para
  cerrar el embudo clic→compra.
- Search Console: propiedad de dominio ya verificada con la service account
  `agents-analytics-reader@connexis-co.iam.gserviceaccount.com`.

## 5. Pendientes que dependen del acceso bloqueado

- Confirmar hotlinks reales por producto (panel/API Hotmart) para poblar el
  catálogo y el mapa de `auditoria/02-mapa-enlaces-hotmart.md`.
- Export del contenido WP (páginas, imágenes, custom fields con enlaces) para la
  migración — vía `scripts/wordpress/wp_audit.py` cuando haya red, o desde el
  servidor Hetzner (`wp-cli`: `wp export`, `wp db export`).
