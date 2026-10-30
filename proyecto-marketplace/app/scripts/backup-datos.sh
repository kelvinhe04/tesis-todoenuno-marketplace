#!/usr/bin/env bash
# Respaldo de los datos de la app (los contenedores deben estar levantados).
#
# Guarda en proyecto-marketplace/backups/<fecha>/ :
#   mongo-catalogo.archive.gz  -> catalogo completo: productos, RESERVAS, RESENAS y las
#                                 IMAGENES (que viven como base64 dentro de Mongo, NO como
#                                 archivos de la carpeta del proyecto)
#   postgres.sql.gz            -> usuarios, ordenes, pagos y notificaciones
#
# La carpeta backups/ esta en .gitignore: NO se sube a GitHub (pesa decenas de MB).
# Para que el respaldo sobreviva a un fallo de este equipo, copiala a otro lugar
# (USB, nube, otro disco).
#
# Uso:  bash scripts/backup-datos.sh        (desde proyecto-marketplace/app)
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash en Windows reescribe rutas tipo /tmp

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "No encuentro app/.env (copialo de .env.example)"; exit 1; }
set -a; . ./.env; set +a

DESTINO="../backups/$(date +%Y-%m-%d_%H%M)"
mkdir -p "$DESTINO"

echo "-> Mongo (catalogo, con imagenes)..."
docker compose exec -T mongo mongodump --quiet --db catalogo --archive --gzip > "$DESTINO/mongo-catalogo.archive.gz"

echo "-> Postgres ($POSTGRES_DB)..."
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" --clean --if-exists "$POSTGRES_DB" | gzip > "$DESTINO/postgres.sql.gz"

echo
echo "Respaldo listo en: $(cd "$DESTINO" && pwd)"
ls -lh "$DESTINO"
