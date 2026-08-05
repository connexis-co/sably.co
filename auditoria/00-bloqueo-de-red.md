# ⚠️ Bloqueo de red del entorno — qué falta por habilitar

Durante la auditoría del 2026-08-05, la política de red del entorno de Claude
Code (Claude Code on the web) **bloqueó** las conexiones salientes a:

| Destino | Uso | Estado |
|---|---|---|
| `academiadebelleza.edu.co` / `www.` | Crawl del sitio, login WordPress, reparar formularios | ❌ bloqueado (403 en CONNECT) |
| `api-sec-vlc.hotmart.com` | OAuth de la API Hotmart | ❌ bloqueado |
| `developers.hotmart.com` | API Hotmart (ventas/comisiones) | ❌ bloqueado |
| `go.hotmart.com`, `hotm.art`, `pay.hotmart.com` | Validar enlaces de venta y afiliación | ❌ bloqueado |
| `46.225.0.139:22` (SSH Hetzner) | Acceso al servidor | ❌ bloqueado (el entorno tampoco tiene la llave SSH privada) |
| `*.googleapis.com` | Search Console, GA4, Tag Manager | ✅ permitido |
| GitHub, npm, PyPI | Repositorio y dependencias | ✅ permitido |

## Cómo habilitarlo

En **claude.ai/code → Settings → Environments →** (el entorno de este repo) →
**Network access**:

1. Opción rápida: cambiar la política a **Full internet access** (acceso total), o
2. Opción restringida: mantener la lista de confianza y **añadir dominios**:
   - `academiadebelleza.edu.co` y `www.academiadebelleza.edu.co`
   - `hotmart.com` con subdominios (`api-sec-vlc.hotmart.com`,
     `developers.hotmart.com`, `go.hotmart.com`, `pay.hotmart.com`, `app-vlc.hotmart.com`)
   - `hotm.art`
   - `seminarios.online` (para contrastar el catálogo)

Después, iniciar una nueva sesión (o continuar esta) y ejecutar los scripts de
`scripts/` — están listos para correr sin cambios.

> Nota: el acceso SSH al servidor Hetzner requiere además que la llave privada
> esté disponible en el entorno (o ejecutar los scripts desde una máquina local
> con la llave). Los túneles SSH salientes pueden no estar soportados por el
> entorno web; alternativa: instalar en el servidor un agente o usar los scripts
> desde local.

## Documentación oficial

https://code.claude.com/docs/en/claude-code-on-the-web (sección *Environments →
Network policy*).
