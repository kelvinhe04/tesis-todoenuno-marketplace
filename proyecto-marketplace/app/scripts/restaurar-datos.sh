#!/usr/bin/env bash
# Restaura un respaldo hecho con backup-datos.sh. REEMPLAZA los datos actuales
# (Mongo catalogo y Postgres). Los contenedores deben estar levantados.
#
# Uso:  bash scripts/restaurar-datos.sh ../backups/2026-10-30_1500
set -euo pipefail
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")/.."
ORIGEN="${1:-}"
[ -n "$ORIGEN" ] && [ -d "$ORIGEN" ] || { echo "Uso: bash scripts/restaurar-datos.sh <carpeta-del-respaldo>"; exit 1; }
[ -f .env ] || { echo "No encuentro app/.env"; exit 1; }
# Carga .env sin ejecutarlo como shell (valores con espacios, p. ej. SMTP_PASS, rompian el 'source')
while IFS='=' read -r _k _v; do case "$_k" in ''|'#'*) ;; *) export "$_k=${_v%$'\r'}" ;; esac; done < ./.env

echo "Esto REEMPLAZARA el catalogo (Mongo) y la base $POSTGRES_DB (Postgres) con: $ORIGEN"
read -r -p "Escribe SI para continuar: " r
[ "$r" = "SI" ] || { echo "Cancelado."; exit 1; }

if [ -f "$ORIGEN/mongo-catalogo.archive.gz" ]; then
  echo "-> Restaurando Mongo..."
  docker compose exec -T mongo mongorestore --quiet --drop --archive --gzip < "$ORIGEN/mongo-catalogo.archive.gz"
fi
if [ -f "$ORIGEN/postgres.sql.gz" ]; then
  echo "-> Restaurando Postgres..."
  gunzip -c "$ORIGEN/postgres.sql.gz" | docker compose exec -T postgres psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"
fi
echo "Listo. Si cambiaste datos de servicios en memoria (carrito/Redis), reinicia: docker compose restart"
