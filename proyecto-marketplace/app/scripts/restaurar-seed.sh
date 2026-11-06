#!/usr/bin/env bash
# Restaura un respaldo hecho con backup-seed.sh. Devuelve los productos/servicios de la seed
# (y sus cuentas vendedoras) al estado del respaldo: si los editaste o borraste, vuelven como
# estaban. Tambien restaura las resenas de ejemplo (si el respaldo las trae). NO toca nada mas.
# Los contenedores deben estar levantados.
#
# Uso:  bash scripts/restaurar-seed.sh ../backups/seed/2026-11-01_1200
set -euo pipefail
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")/.."
ORIGEN="${1:-}"
[ -n "$ORIGEN" ] && [ -f "$ORIGEN/seed-productos.jsonl.gz" ] || { echo "Uso: bash scripts/restaurar-seed.sh <carpeta-del-respaldo-seed>"; exit 1; }
[ -f .env ] || { echo "No encuentro app/.env"; exit 1; }
# Carga .env sin ejecutarlo como shell (valores con espacios, p. ej. SMTP_PASS, rompian el 'source')
while IFS='=' read -r _k _v; do case "$_k" in ''|'#'*) ;; *) export "$_k=${_v%$'\r'}" ;; esac; done < ./.env

cat "$ORIGEN/LEEME.txt" 2>/dev/null || true
echo
echo "Esto SOBRESCRIBIRA los productos/servicios de la seed y sus cuentas con lo del respaldo."
read -r -p "Escribe SI para continuar: " r
[ "$r" = "SI" ] || { echo "Cancelado."; exit 1; }

if [ -f "$ORIGEN/seed-usuarios.sql" ]; then
  echo "-> Cuentas de la seed (Postgres)..."
  docker compose exec -T postgres psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$ORIGEN/seed-usuarios.sql"
else
  echo "-> (sin seed-usuarios.sql: se omiten las cuentas; deben existir ya en Postgres)"
fi

echo "-> Productos y servicios de la seed (Mongo)..."
gunzip -c "$ORIGEN/seed-productos.jsonl.gz" | docker compose exec -T mongo mongoimport --quiet --db catalogo --collection productos --mode upsert

if [ -f "$ORIGEN/seed-resenas.jsonl.gz" ]; then
  echo "-> Resenas de ejemplo (Mongo)..."
  gunzip -c "$ORIGEN/seed-resenas.jsonl.gz" | docker compose exec -T mongo mongoimport --quiet --db catalogo --collection resenas --mode upsert
fi

echo "Listo."
