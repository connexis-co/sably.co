#!/usr/bin/env bash
# The EmDash application is a Worker. The former Pages deployment is closed.
set -euo pipefail
printf '%s\n' 'Cloudflare Pages está deshabilitado para esta migración. Usa npm run build:dev y npm run deploy:development. Producción se promueve con el workflow manual del SHA validado.' >&2
exit 1
