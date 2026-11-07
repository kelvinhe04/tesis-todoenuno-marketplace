"""Genera grafana/dashboards/todoenuno.json (tablero 'TodoEnUno - Salud del sistema').
Se versiona el JSON ya generado; este script solo sirve para regenerarlo: python observabilidad/generar-dashboard.py"""
import json, pathlib

DS = {"type": "prometheus", "uid": "prometheus"}
R = "[$__rate_interval]"
panels = []
_id = 0

def panel(tipo, titulo, exprs, x, y, w, h, unit=None, **extra):
    global _id
    _id += 1
    p = {
        "id": _id, "type": tipo, "title": titulo, "datasource": DS,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "targets": [{"datasource": DS, "refId": chr(65 + i), "expr": e, "legendFormat": l} for i, (e, l) in enumerate(exprs)],
        "fieldConfig": {"defaults": {"unit": unit} if unit else {}, "overrides": []},
        "options": {},
    }
    p.update(extra)
    panels.append(p)

lat = "krakend_opencensus_io_http_server_latency_bucket"
req = "krakend_opencensus_io_http_server_request_count"
st = "krakend_opencensus_io_http_server_response_count_by_status_code"
bk = "krakend_opencensus_io_http_client_roundtrip_latency_bucket"

# fila 1: indicadores
panel("stat", "Solicitudes por segundo (gateway)", [(f"sum(rate({req}{R}))", "req/s")], 0, 0, 6, 4, "reqps")
panel("stat", "Latencia p95 (gateway)", [(f"histogram_quantile(0.95, sum by (le) (rate({lat}{R})))", "p95")], 6, 0, 6, 4, "ms")
panel("stat", "Errores 5xx", [(f'sum(rate({st}{{http_status=~"5.."}}{R})) / sum(rate({st}{R}))', "5xx")], 12, 0, 6, 4, "percentunit")
panel("stat", "Conexiones a RabbitMQ", [("rabbitmq_connections", "conexiones")], 18, 0, 6, 4)
# fila 2: trafico y latencia
panel("timeseries", "Solicitudes por segundo por endpoint", [(f"sum by (http_path) (rate({req}{R}))", "{{http_path}}")], 0, 4, 12, 8, "reqps")
panel("timeseries", "Latencia p95 por endpoint", [(f"histogram_quantile(0.95, sum by (le, http_path) (rate({lat}{R})))", "{{http_path}}")], 12, 4, 12, 8, "ms")
# fila 3: percentiles globales y codigos
panel("timeseries", "Latencia del gateway (p50 / p95 / p99)", [
    (f"histogram_quantile(0.50, sum by (le) (rate({lat}{R})))", "p50"),
    (f"histogram_quantile(0.95, sum by (le) (rate({lat}{R})))", "p95"),
    (f"histogram_quantile(0.99, sum by (le) (rate({lat}{R})))", "p99")], 0, 12, 12, 8, "ms")
panel("timeseries", "Respuestas por código HTTP", [(f"sum by (http_status) (rate({st}{R}))", "{{http_status}}")], 12, 12, 12, 8, "reqps")
# fila 4: microservicios, equipo y mensajeria
panel("timeseries", "Latencia p95 hacia cada microservicio", [(f"histogram_quantile(0.95, sum by (le, http_client_path) (rate({bk}{R})))", "{{http_client_path}}")], 0, 20, 12, 8, "ms")
panel("timeseries", "CPU y memoria del equipo (Docker)", [
    ('sum(rate(container_cpu_usage_seconds_total{id="/"}[1m]))', "CPU (núcleos)"),
    ('container_memory_working_set_bytes{id="/"} / 1024 / 1024 / 1024', "Memoria (GB)")], 12, 20, 12, 8)
panel("timeseries", "RabbitMQ: mensajes publicados / entregados por segundo", [
    ("sum(rate(rabbitmq_channel_messages_published_total[1m]))", "publicados"),
    ("sum(rate(rabbitmq_channel_messages_delivered_total[1m]))", "entregados"),
    ("sum(rabbitmq_queue_messages_ready)", "en cola (listos)")], 0, 28, 24, 8)

dash = {
    "uid": "todoenuno-salud", "title": "TodoEnUno - Salud del sistema", "schemaVersion": 39, "version": 1,
    "refresh": "5s", "time": {"from": "now-15m", "to": "now"}, "timezone": "browser",
    "tags": ["todoenuno"], "panels": panels,
}
out = pathlib.Path(__file__).parent / "grafana" / "dashboards" / "todoenuno.json"
out.write_text(json.dumps(dash, indent=2, ensure_ascii=False), encoding="utf-8")
print("ok", out)
