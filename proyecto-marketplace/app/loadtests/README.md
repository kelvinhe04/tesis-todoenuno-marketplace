# Pruebas de carga (k6)

Scripts para validar el rendimiento del sistema a través del API Gateway (Objetivo específico 5 del anteproyecto).

| Script | Qué hace |
|---|---|
| `humo.js` | 1 usuario verifica `/health` de los 6 servicios |
| `carga.js` | Rampa de usuarios virtuales: listado del catálogo, detalle de producto y (opcional) login |

Solo hacen lecturas y logins: **no crean órdenes, pagos ni publicaciones**, así que no ensucian los datos.

## Ejecutar (sin instalar k6, con Docker)

Con la app arriba (`docker compose up -d`), desde `proyecto-marketplace/app`:

```bash
# Humo
docker run --rm -i -v "$PWD/loadtests:/scripts" grafana/k6 run -e BASE_URL=http://host.docker.internal:8080 /scripts/humo.js

# Carga (perfil ligera | media | alta). EMAIL/PASSWORD son opcionales (cuenta de prueba existente).
docker run --rm -i -v "$PWD/loadtests:/scripts" grafana/k6 run \
  -e BASE_URL=http://host.docker.internal:8080 -e PERFIL=media \
  -e EMAIL=usuario@ejemplo.com -e PASSWORD=la-clave /scripts/carga.js
```

En Git Bash de Windows anteponer `MSYS_NO_PATHCONV=1` al comando.

Umbrales (fallan la prueba si no se cumplen): menos de 1 % de errores y p95 < 800 ms.
No poner credenciales reales en el repo: se pasan por `-e` en la línea de comandos.

## Correr los 3 perfiles y guardar resultados

```bash
EMAIL=cuenta@ejemplo.com PASSWORD=la-clave bash loadtests/correr-todo.sh
```
Guarda en `loadtests/resultados/`: resumen k6 (`carga-<perfil>.json` y `.txt`) y CPU/memoria por servicio (`docker-stats-<perfil>.csv`). Mientras corre se puede ver en Grafana (http://localhost:3030).

### Resultados (2026-11-07, PC local con Docker Desktop; gateway + 6 servicios + bases en el mismo equipo)

Se corrió dos veces: **antes** y **después** de optimizar el catálogo (carpetas `resultados/antes` y `resultados/despues`, con el resumen k6, el consumo por servicio de `docker stats` y una captura del tablero de Grafana). Escenario: cada usuario virtual consulta el listado del catálogo, abre un detalle y, el 20 % de las veces, inicia sesión.

| Perfil | Usuarios | req/s antes -> después | p95 antes -> después | Errores antes -> después |
|---|---|---|---|---|
| ligera | 10 | 4.9 -> 7.6 | 1.73 s -> 43 ms | 0 % -> 0 % |
| media | 50 | 8.5 -> 41.0 | 13.5 s -> 43 ms | 0.34 % -> 0 % |
| alta | 200 | 10.5 -> 145.5 | 41.9 s -> 45 ms | 6.9 % -> 0 % |

Umbrales (p95 < 800 ms y < 1 % de errores): **antes fallaban los 3 perfiles; después pasan los 3** (con 200 usuarios simultáneos, 37 299 solicitudes sin un solo error).

**Causa del problema original:** el listado del catálogo pesaba ~9.7 MB por respuesta y el detalle ~1 MB, porque cada publicación mandaba todas sus fotos en base64. El límite era el volumen de datos, no el CPU (gateway < 5 %, catalogo < 80 %).

**Optimización:** las respuestas del catálogo ya no incluyen las fotos: mandan una URL por foto (`/api/catalogo/:id/imagen/:n`). Ese endpoint sirve la foto original o una miniatura (`?w=480`, redimensionada con `sharp` y guardada en memoria), con `ETag` y `Cache-Control` para que el navegador no la vuelva a pedir. Listado: 9.7 MB -> 13 KB; detalle: 1 MB -> 1.4 KB; miniatura típica: 8 KB frente a 394 KB del original. Las fotos siguen guardadas igual en Mongo.

Límites de la prueba: solo lecturas y login (no compras), una sola instancia de cada servicio, y el generador de carga corre en el mismo equipo que el sistema.

## Escalabilidad del catálogo (RNF-03)

`bash loadtests/escalar-catalogo.sh` (usa `docker-compose.escala.yml` para poder tener varias instancias) repite una prueba de **estrés sin pausas** (`estres.js`, 100 usuarios, 45 s, listado + detalle) con 1, 2 y 3 instancias del servicio de catálogo y reinicia el gateway en cada cambio. Dos rondas (`resultados/escalabilidad/ronda1|ronda2`):

| Instancias de catálogo | req/s (ronda 1 / ronda 2 / promedio) | Errores (promedio) |
|---|---|---|
| 1 | 460 / 399 / **429** | ~3.2 % |
| 2 | 753 / 623 / **688** (+60 %) | 0.03 % |
| 3 | 642 / 758 / **700** (+63 %) | ~0.2 % |

Pasar de 1 a 2 instancias mejora claramente el rendimiento y casi elimina los errores; la tercera no aporta una mejora apreciable porque el límite se traslada a otros componentes (gateway, MongoDB y el propio generador de carga, que corre en el mismo equipo). El gateway reparte las solicitudes entre instancias por DNS de Docker (las 3 instancias mostraron CPU alta).

## Pruebas de requerimientos no funcionales

`python tests/api/pruebas_rnf.py` (con `SMTP_HOST` vacío en `.env`): crea cuentas y una publicación temporales y las borra al terminar. Resultados del 2026-11-07:

| Prueba | Resultado |
|---|---|
| RNF-01, `GET /carrito` (200 consultas) | media 12.7 ms, p95 30.3 ms, máx 33 ms (< 500 ms) |
| RNF-06, pago aprobado -> orden "pagada" (10 compras) | media 65 ms, máx 98 ms |
| RNF-06, pago aprobado -> notificación al comprador (10 compras) | media 39 ms, máx 71 ms |
| RNF-02, con el servicio de Notificaciones apagado | el pago se aprueba, la orden queda "pagada" y el vendedor la ve; al encender Notificaciones, el aviso llega en ~1.2 s (RabbitMQ conserva el mensaje en la cola) |
