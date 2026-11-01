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
