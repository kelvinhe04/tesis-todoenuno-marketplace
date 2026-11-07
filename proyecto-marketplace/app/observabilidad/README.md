# Observabilidad (Prometheus + Grafana)

Se levanta junto con el resto (`docker compose up -d`).

| Servicio | URL | Qué es |
|---|---|---|
| Grafana | http://localhost:3030 (usuario/clave locales: `GRAFANA_USER` / `GRAFANA_PASSWORD`, por defecto `admin`/`admin`) | Tablero "TodoEnUno - Salud del sistema" ya cargado |
| Prometheus | http://localhost:9090 | Recoge métricas cada 5 s |

**Fuentes de métricas**
- **Gateway (KrakenD)**: telemetría OpenCensus con exportador Prometheus (puerto 9091, definido en `gateway/krakend.json`). Da solicitudes/s, latencia (p50/p95/p99), códigos HTTP por endpoint y latencia hacia cada microservicio. Como todo el tráfico pasa por el gateway, cubre a los 6 servicios sin tocar su código.
- **RabbitMQ**: plugin `rabbitmq_prometheus` (puerto 15692, solo dentro de la red de Docker).
- **cAdvisor**: CPU y memoria. Limitación: en Docker Desktop (Windows/WSL2) solo expone el total del equipo, no cada contenedor; el consumo por servicio se registra con `docker stats` durante las pruebas de carga (`loadtests/correr-todo.sh`).

Si cambias `krakend.json`: `docker compose restart gateway`. El tablero se regenera con `python observabilidad/generar-dashboard.py`.
Pendiente (no incluido): métricas internas de cada microservicio, Postgres y Mongo (exporters).
