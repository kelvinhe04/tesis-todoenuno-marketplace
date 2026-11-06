#!/usr/bin/env bash
# Respaldo SOLO de los datos sembrados (la "seed"): los productos/servicios de las cuentas
# vendedoras de prueba (*-seed@example.com, seed-vendedor-*@example.com) con todas sus
# IMAGENES (base64 dentro de Mongo) y esas cuentas de Postgres. No incluye lo que se cree
# despues desde la web con otras cuentas, ni ordenes, pagos ni reservas. SI incluye las resenas de ejemplo de esos productos.
#
# Guarda en proyecto-marketplace/backups/seed/<fecha>/ :
#   seed-productos.jsonl.gz  -> productos y servicios de la seed (documentos Mongo, con imagenes)
#   seed-resenas.jsonl.gz    -> resenas de ejemplo de esos productos
#   seed-usuarios.sql        -> las cuentas vendedoras de la seed (contrasena como hash bcrypt)
#   LEEME.txt                -> conteos y como restaurar
#
# backups/ esta en .gitignore (NO se sube a GitHub). Copiala a un USB/nube para que
# sobreviva a un fallo del equipo. Restaurar: bash scripts/restaurar-seed.sh <carpeta>
#
# Si una de esas cuentas tiene publicaciones de prueba creadas desde la web que NO son de la seed,
# se excluyen por id:  EXCLUIR_IDS=id1,id2 bash scripts/backup-seed.sh
#
# Uso:  bash scripts/backup-seed.sh        (desde proyecto-marketplace/app, contenedores arriba)
set -euo pipefail
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "No encuentro app/.env (copialo de .env.example)"; exit 1; }
# Carga .env sin ejecutarlo como shell (valores con espacios, p. ej. SMTP_PASS, rompian el 'source')
while IFS='=' read -r _k _v; do case "$_k" in ''|'#'*) ;; *) export "$_k=${_v%$'\r'}" ;; esac; done < ./.env

PSQL=(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At)
FILTRO_SQL="email like '%-seed@example.com' or email like 'seed-vendedor-%@example.com'"

IDS=$("${PSQL[@]}" -c "select string_agg('\"'||id||'\"', ',') from usuarios where $FILTRO_SQL")
[ -n "$IDS" ] || { echo "No encontre cuentas de seed en Postgres."; exit 1; }

# Ids de productos a dejar fuera (opcional), en formato extended JSON de Mongo
EXCLUIR=""
if [ -n "${EXCLUIR_IDS:-}" ]; then
  LISTA=$(echo "$EXCLUIR_IDS" | sed 's/[^,]\+/{"$oid":"&"}/g')
  EXCLUIR=",\"_id\":{\"\$nin\":[$LISTA]}"
fi

DESTINO="../backups/seed/$(date +%Y-%m-%d_%H%M)"
mkdir -p "$DESTINO"

echo "-> Productos y servicios de la seed (Mongo, con imagenes)..."
docker compose exec -T mongo mongoexport --quiet --db catalogo --collection productos \
  --query "{\"vendedorId\":{\"\$in\":[$IDS]}$EXCLUIR}" | gzip > "$DESTINO/seed-productos.jsonl.gz"

echo "-> Resenas de los productos de la seed (Mongo)..."
IDS_PROD=$(gunzip -c "$DESTINO/seed-productos.jsonl.gz" | sed -n 's/^{"_id":{"\$oid":"\([0-9a-f]*\)".*/"\1"/p' | paste -sd, -)
docker compose exec -T mongo mongoexport --quiet --db catalogo --collection resenas   --query "{\"productoId\":{\"\$in\":[$IDS_PROD]}}" | gzip > "$DESTINO/seed-resenas.jsonl.gz"

echo "-> Cuentas vendedoras de la seed (Postgres)..."
"${PSQL[@]}" -c "select format(
  'insert into usuarios (id, nombre, email, \"passwordHash\", rol, \"fotoUrl\", \"creadoEn\") values (%L, %L, %L, %L, %L, %L, %L) on conflict (id) do update set nombre = excluded.nombre, email = excluded.email, \"passwordHash\" = excluded.\"passwordHash\", rol = excluded.rol, \"fotoUrl\" = excluded.\"fotoUrl\";',
  id, nombre, email, \"passwordHash\", rol, \"fotoUrl\", \"creadoEn\") from usuarios where $FILTRO_SQL order by email" > "$DESTINO/seed-usuarios.sql"

N_PROD=$(gunzip -c "$DESTINO/seed-productos.jsonl.gz" | wc -l | tr -d ' ')
N_USR=$(wc -l < "$DESTINO/seed-usuarios.sql" | tr -d ' ')
cat > "$DESTINO/LEEME.txt" <<EOF
Respaldo de la seed - $(date '+%Y-%m-%d %H:%M')
Productos/servicios: $N_PROD
Resenas:             $(gunzip -c "$DESTINO/seed-resenas.jsonl.gz" | wc -l | tr -d ' ')
Cuentas vendedoras:  $N_USR
Restaurar (desde proyecto-marketplace/app):  bash scripts/restaurar-seed.sh $DESTINO
EOF

echo
echo "Respaldo de la seed listo en: $(cd "$DESTINO" && pwd)"
cat "$DESTINO/LEEME.txt"
ls -lh "$DESTINO"
