#!/usr/bin/env bash
# Deploy del build estático a Cloudflare Pages (proyecto: sably).
# Lee CLOUDFLARE_API_TOKEN desde .env — el token nunca pasa por argv ni stdout.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env
set +a

export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-6e36c2fb07c21f30ed3c0d6e824884bc}"

if [ ! -d dist ]; then
  echo "dist/ no existe — corre 'npm run build' primero" >&2
  exit 1
fi

npx --yes wrangler@latest pages deploy dist --project-name=sably --branch=main --commit-dirty=true
