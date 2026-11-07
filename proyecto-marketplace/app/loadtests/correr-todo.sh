#!/usr/bin/env bash
# Corre los 3 perfiles de carga en secuencia y guarda, por cada uno: resumen k6 (JSON y texto) y CPU/memoria por servicio (docker stats).
# Uso (desde proyecto-marketplace/app):  ETIQUETA=despues EMAIL=... PASSWORD=... bash loadtests/correr-todo.sh
set -u
cd "$(dirname "$0")/.."
OUT=loadtests/resultados/${ETIQUETA:-despues}
mkdir -p "$OUT"
for PERFIL in ligera media alta; do
  echo "=== perfil $PERFIL ==="
  ( while true; do
      docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}}" | sed "s/^/$(date +%H:%M:%S),$PERFIL,/" >> "$OUT/docker-stats-$PERFIL.csv"
      sleep 5
    done ) &
  SAMPLER=$!
  MSYS_NO_PATHCONV=1 docker run --rm -i -v "$PWD/loadtests:/scripts" grafana/k6 run \
    --summary-export=/scripts/resultados/${ETIQUETA:-despues}/carga-$PERFIL.json \
    -e BASE_URL=http://host.docker.internal:8080 -e PERFIL=$PERFIL \
    -e EMAIL="${EMAIL:-}" -e PASSWORD="${PASSWORD:-}" /scripts/carga.js > "$OUT/carga-$PERFIL.txt" 2>&1
  kill $SAMPLER 2>/dev/null
  tail -30 "$OUT/carga-$PERFIL.txt"
  sleep 20
done
echo "=== TERMINADO ==="
