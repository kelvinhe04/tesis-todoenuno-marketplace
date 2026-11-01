# Historial de sesiones de trabajo

Registro cronológico (lo más reciente arriba) de lo que se hizo con Claude Code en este proyecto, para no perder contexto entre sesiones. El resumen vivo (estado, decisiones, trampas) está en `CLAUDE.md` en la raíz del repo; aquí va el detalle.

**Cómo se usa:** al cerrar una sesión, agregar una entrada nueva justo debajo de esta sección con: fecha, qué se hizo, decisiones nuevas, cambios que viven solo en la base de datos (no en git) y pendientes.

---

## 2026-11-01 — Commit/push y contexto
- Se commiteó y subió todo lo de la jornada anterior (8 commits, hasta `26f8e0c`, rama `master`). El CI de GitHub corre desde ese push; el job del frontend sale en rojo por el error de tipos previo en `lib/api.ts` (~l.219).
- Contraseña de prueba puesta (solo en Postgres, como hash; **no está en el repo**) a las 4 cuentas `*-seed@example.com` (ProFix, TecnoPanamá, Bella Studio, Taller Barro Fino) para que el usuario inicie sesión como esos vendedores.
- `CLAUDE.md` ampliado: cómo arrancar (todo se apaga al cerrar Claude Code), cuentas de prueba y cómo resetear contraseñas, JWT de 1 día y cierre de sesión al vencer, servicios con `disponibilidad` obligatoria, ubicación con Google Maps/Nominatim, checkout y trampas de Playwright/Git Bash. Estos cambios en `CLAUDE.md` y este historial quedan **sin commit**.

## 2026-10-31 — Pulido de checkout, carrito y calendario de citas (sin commit)
- **Cambios que viven solo en Mongo/archivos (no en git)**: (1) foto 3 de "Clases particulares de inglés" reemplazada por una de Pexels (pizarra de gramática, 1600×1067; también en `public/seed/ingles/3.jpg|txt`); respaldo previo `backups/2026-10-31_1546`. (2) A los 6 servicios que no tenían horarios se les puso `disponibilidad` por defecto: Reparacion de laptops (L-S 9-18, 60 min), Instalacion de software (L-V 9-17, 60), Clases de guitarra a domicilio (L-V 14-19, 60), Limpieza profunda de hogar (L-S 8-16, 120), Diseño de logotipo (L-V 10-16, 60), Asesoría contable (L-V 9-17, 60); ahora los 15 servicios tienen horarios y devuelven slots. El vendedor puede editarlos desde su panel.
- **Otros cambios de código de la jornada**: sesión vencida (JWT dura 1 día) ahora cierra sesión y lleva a /login, y el panel del vendedor muestra error en vez de ceros; calendario de citas empieza en domingo (Dom..Sáb); scrollbar redondeado verde global; ubicación del local con "Usar mi ubicación actual", búsqueda por dirección (Nominatim) y enlace de Google Maps (`BuscadorUbicacion.tsx`, `lib/ubicacion.ts`), y enlace "Abrir en Google Maps" para el comprador.
- **Causa del "El carrito está vacío" al pagar**: la tarjeta tenía 11 dígitos y pagos exige 13-19; como el checkout crea la orden (y vacía el carrito) *antes* de cobrar, quedó una orden `pendiente` sin pago (`fc8ec959...`, claudehewu@gmail.com, $18) y el carrito vacío. Ahora `Checkout.tsx` valida teléfono (7-8 dígitos), tarjeta, vencimiento (MM/AA) y CVV **antes** de crear la orden, y formatea mientras se escribe (tarjeta 4-4-4-4, vencimiento `MM/AA`, teléfono `0000-0000`, CVV solo números). **Hueco abierto**: si el pago falla por otro motivo tras crear la orden, sigue quedando orden pendiente + carrito vacío (falta reintentar pago desde "Mis órdenes"); documentarlo como hueco o arreglarlo.
- **Indicador de pasos del checkout**: pasó de 4 a 3 (Carrito → Envío y pago → Confirmación), porque envío y pago son un solo formulario.
- **Fechas en día/mes/año**: helper `formatFecha` en `lib/estado.ts`, aplicado en carrito, checkout, órdenes del vendedor y mensaje "Horario retenido" (también se quitó el doble punto "a. m..").
- **Carrito**: foto y nombre llevan al detalle (`/productos/:id`; subrayado solo al pasar sobre el título) y se quitó el enlace "Seguir comprando".
- **Calendario de citas**: nuevo `components/SelectorFecha.tsx` (+ `.module.css`) reemplaza el `<input type="date">` en el detalle de servicios: días sin atención en gris y deshabilitados, texto "Atiende: Lunes: 9:00 a. m. – 5:00 p. m." y arranque en el primer día con atención. Verificado con Playwright (servicio solo-lunes). Además `aFechaISO` usa hora local (antes UTC desfasaba el día de noche). Pendiente: no oculta horarios ya pasados del día de hoy.
- **Decisiones**: pagos/validaciones solo en frontend (el backend ya validaba la tarjeta). No hay cambios que vivan solo en Mongo. Las pruebas de k6 y el CI de la sesión anterior siguen igual. El servidor de Vite se cayó una vez por poca memoria del sistema (no es bug de la app).
- **Pendiente**: commit de todo lo de la app (foto de Google, checkout, carrito, calendario) sin hacer ni push; error de tipos previo en `src/lib/api.ts` (~l.211) que rompe `npm run build`/CI; la orden pendiente `fc8ec959` sigue en Postgres (preguntar antes de borrar); el usuario sigue revisando imágenes y funcionamiento antes de k6 en serio, Prometheus/Grafana e informe.

## 2026-10-30 (tarde) — Foto de Google, k6 y CI
- **Foto de perfil de Google** (sin commit aún): columna nueva `fotoUrl` en `usuarios` (TypeORM `synchronize`, ya creada en Postgres), se guarda en cada login con Google (`auth.service.ts`) y viaja en `aPublico`. Frontend: componente `Avatar.tsx` usado en el header y en `/perfil`; si no hay foto, icono genérico. Un usuario que ya existía solo la recibe al volver a entrar con Google. No se muestra el avatar del vendedor en el detalle de producto (decisión: no exponer fotos de otros).
- **Roles con Google**: el rol se elige solo al crear la cuenta (modal en Login, pestaña en Registro). No hay cambio de rol posterior y el usuario decidió **dejarlo así**; coincide con RF-01 (el anteproyecto no dice nada de cambiarlo ni de Google). Login con Google y foto = extras para la nota de alcance ampliado del informe.
- **k6**: `app/loadtests/` con `humo.js` (probado, 6/6 OK), `carga.js` (perfiles ligera/media/alta; solo lecturas + login opcional; validado de sintaxis, **no ejecutado**) y README. El listado de catálogo es paginado (`{ items, total, ... }`).
- **CI**: `.github/workflows/ci.yml` (build de los 6 servicios, lint y build del frontend, `docker compose build`). Sin probar en GitHub (requiere push).
- **Pendiente/avisos**: `npm run build` del frontend ya falla antes de estos cambios (`src/lib/api.ts` ~l.210, `FiltrosCatalogo` vs `Record<string, unknown>`) y pondrá el CI en rojo hasta corregirlo. Solo `auth` tiene `package-lock.json`. Prometheus/Grafana no se tocó (requiere cambiar la app). Informe sin cambios (visto bueno + .docx abierto en Word). El usuario revisa imágenes y funcionamiento antes de seguir; después correr k6 en serio. No hay cambios que vivan solo en Mongo.

## 2026-10-30 — Contexto persistente, hook y respaldos
- Se creó `CLAUDE.md` (raíz del repo) y este historial. No existía ningún archivo de contexto del proyecto; solo había memoria automática de Claude (`~/.claude/projects/.../memory/`) que llegaba hasta el anteproyecto (se agregó `project-app-contexto.md` como puntero).
- **Hook `Stop`** (`.claude/settings.json` + `.claude/hooks/recordar-historial.py`): si desde la última edición de este historial hubo 8+ usos de herramientas, pide una sola vez anotar la entrada. Probado con la transcripción real (silencioso sin trabajo nuevo, bloquea con trabajo pendiente, no entra en bucle).
- **Respaldos de datos**: `app/scripts/backup-datos.sh` y `restaurar-datos.sh`. Guardan en `proyecto-marketplace/backups/` (en `.gitignore`) el catálogo de Mongo con **todas las imágenes** y el Postgres. Verificado restaurando en bases temporales (34 productos, 118 imágenes, 20 reservas, 2 reseñas, 42 usuarios, 15 órdenes, 11 pagos, 21 notificaciones: idénticos). Primer respaldo: `backups/2026-10-30_1439` (13 MB).
- **Aclaración clave documentada**: las imágenes del catálogo **no se guardan como archivos en la carpeta del proyecto**; viven como base64 dentro de Mongo (volumen Docker). Solo los productos sembrados tienen copia en `frontend/public/seed/`.
- Decisión: los archivos de contexto, el hook y los scripts **sí se versionan** (el usuario pidió "hacer todo"); `backups/` nunca.

## 2026-09-30 — RF faltantes, imágenes del catálogo y limpieza
**Contexto:** diagnóstico "qué falta en informe y app" comparando anteproyecto, informe y código. Resultado en `CLAUDE.md` -> "Estado y pendientes".

**Código (commits en `master`)**
- `44a0959` Se quitó `.playwright-mcp/` del repo (353 archivos de capturas/logs de pruebas) y se agregó al `.gitignore`.
- `7caa685` Zoom de imagen en el detalle de producto (overlay, flechas y teclado ←/→/Esc, cambio de imagen al pasar el mouse por las miniaturas) y padding blanco de 12 px en las fotos de **productos**; las fotos de **servicios** (`object-fit: cover`) van sin padding.
- `882fa05` **RF-04**: `PATCH /auth/me` (nombre y/o contraseña; exige la actual) + formulario en `/perfil`. **RF-20/RF-21**: al confirmarse el pago, correo y notificación in-app al comprador **y a cada vendedor** de la orden (tipo nuevo `nueva_orden_vendedor`). Correo con Nodemailer + Ethereal (sandbox). Endpoints internos `/auth/internal/email/:id` y `/ordenes/internal/:id`. Variables `AUTH_URL` y `ORDENES_URL` agregadas a `notificaciones` en el compose. Probado de punta a punta (registro -> editar perfil -> cambiar contraseña -> compra -> pago -> correos).
- `ee229d8`, `82824f1`, `a21dc51` Imágenes de seed: reparación de computadoras, asesoría contable, bolso de cuero (4 ángulos de la misma bolsa, mismo color) y vajilla (platos).

**Cambios que viven SOLO en Mongo (no están en git)**
- Imágenes nuevas (Pexels) en: Reparación de computadoras a domicilio, Asesoría contable para pequeños negocios, Bolso de cuero artesanal, Set de vajilla, Diseño de logotipo, Limpieza profunda de hogar, Instalación de software, Reparación de laptops. Audífonos Sony: galería 100 % negra (antes mezclaba negro, azul y blanco; fotos oficiales del WH-CH520).
- Se **eliminaron** las versiones antiguas (3-sep) de "Manicure y pedicure profesional" y "Corte y peinado a domicilio" (mismo vendedor, sin reservas/reseñas/órdenes asociadas). Quedan "Manicure y pedicure spa", "Corte y peinado a domicilio" ($18) y "Corte de cabello con mapa" (se dejó: es un servicio distinto, en local con mapa).
- **Nombres con modelo** (+ descripciones corregidas donde contradecían las fotos):

| Antes | Ahora |
|---|---|
| Audifonos | Audífonos inalámbricos Sony WH-CH520 |
| Audífonos inalámbricos con cancelación de ruido | Audífonos inalámbricos Soundcore Life Q30 con cancelación de ruido |
| Bolso de cuero sintético | Bolso Coach Tabby 26 (el Tabby es cuero genuino, se quitó "sintético") |
| Cargador rapido | Cargador Anker 511 (Nano Pro) USB-C 20W (la descripción decía 65 W) |
| Crema hidratante facial | Loción hidratante facial CeraVe PM (la descripción decía "con protección solar") |
| Lampara escritorio | Lámpara LED de escritorio TaoTronics con puerto USB |
| Mouse gamer inalámbrico RGB | Mouse gamer inalámbrico Logitech G502 LIGHTSPEED RGB |
| Mousepad / Mousepad2 / Mousepad3 | Mousepad RGB Razer Goliathus Extended Chroma / Set ergonómico TeckNet… / Mousepad SteelSeries QcK XXL |
| Reloj de pulsera clásico | Reloj Fossil The Minimalist 44 mm FS5439 |
| Set de brochas de maquillaje profesional | Set de brochas de maquillaje Real Techniques Artist Essentials (5 piezas) |
| Teclado mecanico | Teclado mecánico Redragon K582 SURARA RGB (switches rojos) |
| Zapatillas urbanas | Zapatillas Nike Air Diamond Turf 2 |

**Decisiones / aclaraciones**
- "Sandbox" = entorno que imita al real (mismo flujo/protocolo) sin ningún efecto real. Pagos: simulación local pura. Correo: SMTP real contra Ethereal, sin entrega a bandeja real. Está respaldado por RF-18 y por el alcance del anteproyecto (sección 1.3).
- Mover credenciales a `.env` no contradice la tesis: refuerza RNF-04 (seguridad) y RNF-08 (portabilidad) y es el estándar 12-Factor.
- Criterio de imágenes definido por el usuario: mismo modelo y mismo color, sin repetirse entre publicaciones, buena resolución, y modelo en el nombre.

**Pendiente al cierre** (ver `CLAUDE.md`): k6, Prometheus/Grafana, CI/CD; informe 4.2/4.5/4.6/Cap. V/resumen/conclusiones/anexos; detalles menores de catálogo (Hanes, Razer #2, modelo del Acer y del TaoTronics, "Corte de cabello con mapa" con fotos repetidas).

## 2026-09-06 a 2026-09-08 — Puesta en marcha y subida a GitHub
- Se explicó la arquitectura de arranque: backend en Docker, frontend Vite fuera de Docker (por eso el HMR es instantáneo).
- Carrusel "Vistos recientemente" (`components/VistosRecientemente.tsx` + `.module.css`): una sola fila, flechas en el encabezado, `scroll-snap: mandatory` y ancho de tarjeta calculado (`calc((100% - gaps) / N)`) para que **nunca se corte una tarjeta**; tarjetas de igual altura; ancho/alto de imagen enteros para evitar desalineos de sub-píxel.
- Se descartaron por feo/no deseado: `margin-left` negativo en el badge de tipo y un degradado (fade) en el borde del carrusel.
- Limpieza de Docker del proyecto ajeno "Checkers" (contenedores, red y volúmenes) y de 9 capturas sueltas en la raíz.
- **Subida a GitHub** (`cb855f2`): repo público `tesis-todoenuno-marketplace`. Antes de subir, las credenciales se movieron del `docker-compose.yml` a `app/.env` (ignorado) con `.env.example` versionado; `.gitignore` en la raíz (node_modules, .env, dist, logs).

## Antes de septiembre de 2026 (según las notas de memoria)
- Anteproyecto redactado y **aprobado** (2026-08-27); carpeta reorganizada bajo `proyecto-marketplace/`.
- Informe final: Capítulos I-III escritos (incl. wireframes 3.6.1/3.6.2 y 13 figuras); Cap. IV con 4.1, 4.3 y 4.4 escritos; 4.2, 4.5, 4.6, Cap. V, resumen, conclusiones y anexos marcados `[PENDIENTE]`.
- App construida por fases (ver `plan-anteproyecto.md`, sección 9): infraestructura, 6 microservicios, gateway y frontend de 13 pantallas.
