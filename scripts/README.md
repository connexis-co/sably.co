# Scripts de auditoría y validación

Scripts listos para ejecutar **en cuanto el entorno tenga salida de red** hacia
`academiadebelleza.edu.co` y `*.hotmart.com` (o desde cualquier máquina con
acceso a internet). Ver `auditoria/00-bloqueo-de-red.md`.

## Preparación

```bash
pip install requests beautifulsoup4 python-dotenv
cp scripts/hotmart/.env.example scripts/hotmart/.env
# completar credenciales en scripts/hotmart/.env (NUNCA commitear el .env)
```

## Hotmart (`scripts/hotmart/`)

| Comando | Qué hace |
|---|---|
| `python3 hotmart_api.py token` | Prueba la autenticación OAuth (client credentials) |
| `python3 hotmart_api.py ventas` | Historial de ventas → ¿están llegando comisiones? desde cuándo no |
| `python3 hotmart_api.py resumen` | Resumen y comisiones por producto |
| `python3 hotmart_api.py shortener` | Sondea si existe endpoint de acortadores (no documentado) |
| `python3 validar_enlaces.py` | Valida cada enlace de `mapa_enlaces.json`: redirecciones, checkout vivo y **código de afiliado presente** |

## WordPress (`scripts/wordpress/`)

| Comando | Qué hace |
|---|---|
| `python3 wp_audit.py publico` | Inventario completo (wp-json + crawl): formularios, enlaces Hotmart por página, errores visibles, mixed content |
| `python3 wp_audit.py admin` | Con login: plugins y estado, actualizaciones pendientes, salud del sitio, usuarios |
| `python3 wp_audit.py custom-fields` | Busca custom fields (ACF/postmeta) con enlaces Hotmart usados para redirigir tras el envío de formularios |

## Google (`scripts/google/`)

Consultas a Search Console / GA4 / GTM con la cuenta de servicio
`agents-analytics-reader@connexis-co.iam.gserviceaccount.com` (estas APIs sí
están permitidas desde el entorno). Los datos crudos de la auditoría del
2026-08-05 quedaron en `auditoria/datos/`.
