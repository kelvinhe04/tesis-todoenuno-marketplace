# Pruebas de la API (QA)

Batería de pruebas de integración de **TodoEnUno** que ejercita la aplicación completa a través del
**API Gateway** (`http://localhost:8080/api`), igual que lo haría el frontend. No necesita instalar nada
más que Python 3 (usa solo la biblioteca estándar) y los contenedores levantados.

```bash
cd proyecto-marketplace/app
docker compose up -d                       # la app debe estar arriba
python tests/api/qa_api.py                 # en Windows con acentos: PYTHONIOENCODING=utf-8 python tests/api/qa_api.py
```

- Sale con código **0** si todo pasa y **1** si algo falla (útil para CI o para correrlo antes de entregar).
- Tarda ~1 minuto. Imprime cada comprobación como `OK` / `FALLA` y un resumen al final.
- Variables opcionales: `API_BASE` (otro gateway, p. ej. `http://localhost:8080/api`) y `QA_NO_LIMPIAR=1`
  (no borra los datos de prueba al terminar, para inspeccionarlos).

## Qué cubre (≈290 comprobaciones)

| Sección | Ejemplos |
|---|---|
| Salud y gateway | `health` de los 6 servicios; las rutas internas (`/auth/internal/…`, `/ordenes/internal/…`, `/catalogo/internal/…`, `/notificaciones/internal/correo`) **no** están expuestas; ruta desconocida → 404 |
| Autenticación | registro (correo duplicado, también en mayúsculas), login, cuenta solo-Google, inyección SQL, JWT manipulado / `alg=none`, mass assignment del rol, cambio de contraseña |
| Verificación de correo | la cuenta nace sin verificar; sin verificar **no se puede comprar ni activar el modo vendedor** (403); enlace del log de `auth`; el token de verificación no sirve como sesión; reenvío limitado a 1/min |
| Sesiones | `logout` revoca el token en **todos** los servicios; "cerrar sesión en todos los dispositivos"; cambiar la contraseña revoca los tokens anteriores y entrega uno nuevo |
| Límite de intentos | 5 fallos por correo (15 min) → 429, aunque la clave sea correcta y aunque se cambien las mayúsculas del correo; otra cuenta no se bloquea; un acierto reinicia el contador |
| Modo vendedor | activar (idempotente), un comprador no puede publicar |
| Catálogo | validaciones (foto obligatoria, precio, stock entero, categoría, horarios nocturnos/inválidos, servicio con disponibilidad y con dirección+mapa), filtros, paginación (`limite` ≤ 50), ids inválidos → 400, pausar/reactivar, permisos entre vendedores |
| Direcciones y tarjetas | validaciones, predeterminada única, no se guarda el número ni el CVV, aislamiento entre usuarios |
| Carrito | cantidades inválidas, stock acumulado, publicaciones propias/pausadas, reserva ajena |
| Reservas | día pasado, día sin atención, fuera de horario, rejilla (sin solapes), doble reserva y **carrera** entre dos compradores |
| Órdenes y pagos | stock que se descuenta/devuelve, tarjeta `…0002` rechazada, reabrir, **3 pagos simultáneos → solo 1 cobro**, **última unidad con 2 compradores**, accesos cruzados |
| Entrega por vendedor | en una orden con 2 vendedores cada uno ve **solo sus ítems y su total**, cambia **solo su** entrega y el comprador ve el estado por ítem; el vendedor no ve órdenes sin pagar |
| Reseñas | solo con compra pagada, sin duplicar, el listado público **no expone el correo** |
| Notificaciones | creadas por eventos de RabbitMQ, marcar leída / eliminar (propias y ajenas), borrado masivo |
| Superficie expuesta | `POST /ordenes/demo` y `GET /notificaciones/demo/log` (se dejaron abiertos a propósito: evidencia del Cap. IV.4). Aparecen como `FALLA … INFO:` y **no cuentan** para el código de salida |

## Cómo funciona

- Crea cuentas `qa-*@example.com` y publicaciones de prueba (nunca toca las publicaciones ni las cuentas reales).
- Para verificar el correo sigue **el enlace que `auth` escribe en su log** (el correo real va a un buzón
  sandbox de Ethereal y nadie lo lee): `docker compose logs auth`.
- Al terminar **borra todo lo que creó** (Postgres, Mongo y Redis). Si la ejecución se interrumpe, basta
  volver a correrla: la limpieza borra cualquier cuenta `qa-*@example.com` que encuentre.

## Si algo falla

1. Revisa que `docker compose ps` muestre los 11 contenedores arriba (si reiniciaste solo RabbitMQ,
   reinicia también `ordenes pagos notificaciones`).
2. Corre otra vez: los límites de Redis (login, reenvío) se limpian al final de cada ejecución.
3. Las pruebas que dependen del reloj usan la zona `America/Panama` (UTC−5).

## Auditoría de datos del catálogo (script aparte)

`scripts/normalizar-catalogo.sh` revisa y corrige publicaciones creadas **antes** de que existieran las
reglas actuales (categoría acorde al tipo, decimales, servicios sin proveedor u horarios, fotos, etc.).
Por defecto solo audita: `bash scripts/normalizar-catalogo.sh` · para corregir:
`bash scripts/normalizar-catalogo.sh aplicar [carpeta-de-respaldo-para-recuperar-fotos]`.
