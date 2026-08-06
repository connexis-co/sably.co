#!/usr/bin/env bash
# Sincroniza los assets estáticos (imágenes, video) a Cloudflare R2 → cdn.sably.co
#
# Buenas prácticas aplicadas:
# - Cache-Control inmutable de 1 año: los archivos son content-addressed por nombre;
#   si cambia una imagen, cambia su slug o se le agrega sufijo de versión.
# - Content-Type explícito por extensión (R2 no lo infiere en uploads por API).
# - Idempotente: sube solo lo que falta o cambió (compara ETag md5).
#
# Uso:  ./scripts/sync-r2.sh [--force]
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env
set +a

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-6e36c2fb07c21f30ed3c0d6e824884bc}"
BUCKET="sably-assets"
API="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects"
FORCE="${1:-}"

content_type() {
  case "$1" in
    *.jpg|*.jpeg) echo "image/jpeg" ;;
    *.png)        echo "image/png" ;;
    *.webp)       echo "image/webp" ;;
    *.avif)       echo "image/avif" ;;
    *.svg)        echo "image/svg+xml" ;;
    *.mp4)        echo "video/mp4" ;;
    *.webm)       echo "video/webm" ;;
    *)            echo "application/octet-stream" ;;
  esac
}

uploaded=0
skipped=0

# Sube todo lo que está bajo public/covers/, public/heroes/ y public/media/ (si existen)
while IFS= read -r file; do
  key="${file#public/}"
  ct=$(content_type "$file")

  if [ "$FORCE" != "--force" ]; then
    # --head (no "-X HEAD"): con -X curl espera un cuerpo que nunca llega y las
    # cabeceras salen vacías, así que el ETag quedaba en blanco unas veces y
    # otras no. Se exige además un 200 explícito: si el objeto no está en R2,
    # nunca se puede omitir.
    headers=$(curl -s -D - -o /dev/null --head "${API}/${key}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" 2>/dev/null || true)
    status=$(printf '%s' "$headers" | awk 'NR==1{print $2}')
    remote_etag=$(printf '%s' "$headers" | grep -i '^etag:' | tr -d '"\r' | awk '{print $2}')
    local_md5=$(md5 -q "$file" 2>/dev/null || md5sum "$file" | awk '{print $1}')
    if [ "$status" = "200" ] && [ -n "$remote_etag" ] && [ "$remote_etag" = "$local_md5" ]; then
      skipped=$((skipped + 1))
      continue
    fi
  fi

  curl -s -o /dev/null -X PUT "${API}/${key}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: ${ct}" \
    -H "Cache-Control: public, max-age=31536000, immutable" \
    --data-binary "@${file}"
  uploaded=$((uploaded + 1))
  printf '\r  subidos: %s · omitidos: %s' "$uploaded" "$skipped"
done < <(find public/covers public/heroes public/media -type f \( -name '*.jpg' -o -name '*.png' -o -name '*.webp' -o -name '*.avif' -o -name '*.mp4' -o -name '*.webm' \) 2>/dev/null)

echo ""
echo "✓ R2 sincronizado — subidos: ${uploaded} · sin cambios: ${skipped}"
echo "  CDN: https://cdn.sably.co/covers/…"
