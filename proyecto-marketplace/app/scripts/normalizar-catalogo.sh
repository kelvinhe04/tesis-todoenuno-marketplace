#!/usr/bin/env bash
# Audita y corrige el catalogo para que cumpla las reglas actuales (categorias, decimales, servicios con
# proveedor y horarios validos, fotos...). Sirve para publicaciones creadas ANTES de que existieran esas
# reglas o para datos restaurados desde un respaldo viejo.
#
# Uso (los contenedores deben estar levantados; desde la carpeta app/):
#   bash scripts/normalizar-catalogo.sh                  # solo AUDITA: muestra que corregiria
#   bash scripts/normalizar-catalogo.sh aplicar          # CORRIGE
#   bash scripts/normalizar-catalogo.sh aplicar ../backups/2026-11-04_0051   # ademas recupera fotos faltantes de ese respaldo
#
# Antes de "aplicar" conviene un respaldo: bash scripts/backup-datos.sh
set -euo pipefail
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")/.."
MODO="${1:-auditar}"
RESPALDO="${2:-}"
[ "$MODO" = "auditar" ] || [ "$MODO" = "aplicar" ] || { echo "Uso: bash scripts/normalizar-catalogo.sh [auditar|aplicar] [carpeta-de-respaldo-para-fotos]"; exit 1; }
[ -f .env ] || { echo "No encuentro app/.env"; exit 1; }
set -a; . ./.env; set +a

# nombres de los vendedores (Postgres) -> proveedor por defecto de los servicios que no lo tienen
NOMBRES=$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c \
  "select coalesce(json_object_agg(id, nombre), '{}') from usuarios" | tr -d '\r')

BD_FOTOS=null
if [ -n "$RESPALDO" ]; then
  [ -f "$RESPALDO/mongo-catalogo.archive.gz" ] || { echo "No encuentro $RESPALDO/mongo-catalogo.archive.gz"; exit 1; }
  echo "-> Cargando el respaldo en una base temporal para recuperar fotos..."
  docker compose exec -T mongo mongorestore --quiet --drop --archive --gzip \
    --nsFrom='catalogo.*' --nsTo='catalogo_respaldo.*' < "$RESPALDO/mongo-catalogo.archive.gz"
  BD_FOTOS="'catalogo_respaldo'"
fi

echo "-> Modo: $MODO"
{
  echo "const MODO = '$MODO'; const NOMBRES = $NOMBRES; const BD_FOTOS = $BD_FOTOS;"
  cat scripts/normalizar-catalogo.js
} | docker compose exec -T mongo mongosh catalogo --quiet | sed -E 's/^(catalogo> |[|] )*//' | grep -v '^$'

if [ -n "$RESPALDO" ]; then
  docker compose exec -T mongo mongosh --quiet --eval "db.getSiblingDB('catalogo_respaldo').dropDatabase()" >/dev/null
fi
