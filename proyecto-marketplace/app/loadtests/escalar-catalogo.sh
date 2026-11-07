#!/usr/bin/env bash
# Prueba de escalabilidad (RNF-03): repite la misma carga de estres con 1, 2 y 3 instancias del servicio de catalogo.
# Uso (desde proyecto-marketplace/app):  RONDA=ronda2 bash loadtests/escalar-catalogo.sh   (al final deja el catalogo en 1 instancia)
set -u
cd "$(dirname "$0")/.."
OUT=loadtests/resultados/escalabilidad/${RONDA:-ronda1}
mkdir -p "$OUT"
C="docker compose -f docker-compose.yml -f docker-compose.escala.yml"
for N in 1 2 3; do
  echo "=== $N instancia(s) ==="
  $C up -d --scale catalogo=$N catalogo >/dev/null 2>&1
  docker compose restart gateway >/dev/null 2>&1   # el gateway vuelve a resolver las IPs del servicio
  sleep 15
  for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null localhost:8080/api/catalogo; done
  ( while true; do
      docker stats --no-stream --format "{{.Name}},{{.CPUPerc}}" | grep -E "catalogo|gateway" | sed "s/^/$(date +%H:%M:%S),$N,/" >> "$OUT/docker-stats.csv"
      sleep 5
    done ) &
  SAMPLER=$!
  MSYS_NO_PATHCONV=1 docker run --rm -i -v "$PWD/loadtests:/scripts" grafana/k6 run \
    --summary-export=/scripts/resultados/escalabilidad/${RONDA:-ronda1}/estres-$N-instancias.json \
    -e BASE_URL=http://host.docker.internal:8080 -e VUS=100 -e DURACION=45s /scripts/estres.js > "$OUT/estres-$N-instancias.txt" 2>&1
  kill $SAMPLER 2>/dev/null
  sleep 10
done
$C up -d --scale catalogo=1 catalogo >/dev/null 2>&1
docker compose restart gateway >/dev/null 2>&1
echo "=== TERMINADO ==="
