# TodoEnUno — Trabajo de graduación (contexto para Claude)

Este archivo se carga solo al abrir Claude Code en esta carpeta. Es el **punto de entrada de contexto**: léelo entero antes de trabajar. El detalle cronológico está en `proyecto-marketplace/docs/historial-sesiones.md`.

## Qué es el proyecto
- Trabajo de Graduación **Teórico-Práctico** de **Kelvin He Wu** (UTP, FISC, Lic. en Desarrollo y Gestión de Software), asesor José Javier Chirú Figueroa, año 2026. Anteproyecto **aprobado**.
- Tema: *Plataforma Marketplace para la comercialización de productos y servicios basada en arquitectura de microservicios.* Nombre comercial de la app: **TodoEnUno**.
- Son **dos entregables en paralelo**: la app (`proyecto-marketplace/app/`) y el informe final (`proyecto-marketplace/informe-final/*.docx`).
- Repo público: `github.com/kelvinhe04/tesis-todoenuno-marketplace` (rama `master`). La raíz de git es esta carpeta.

## Estructura
```
CLAUDE.md                          <- este archivo
proyecto-marketplace/
  docs/                            reglamento FISC 2018, plan-anteproyecto.md, plan-informe-final.md, historial-sesiones.md
  anteproyecto/                    Anteproyecto_tesis_Kelvin He Wu.docx (el aprobado)
  informe-final/                   Informe Final - ... .docx (borrador en curso; secciones pendientes marcadas [PENDIENTE])
  backups/                         respaldos de datos (NO en git; ver "Datos y dónde viven")
  app/
    docker-compose.yml  .env(.example)
    scripts/                       backup-datos.sh, restaurar-datos.sh
    gateway/krakend.json           rutas del API Gateway
    services/{auth,catalogo,carrito,ordenes,pagos,notificaciones}   NestJS, cada uno con su Dockerfile
    frontend/                      React 19 + Vite + TypeScript + CSS Modules (corre FUERA de Docker)
```

## Cómo levantar la app
```bash
cd proyecto-marketplace/app
cp .env.example .env            # solo la primera vez; poner valores locales (el .env NO se sube)
docker compose up -d            # postgres, mongo, redis, rabbitmq, 6 microservicios, gateway
cd frontend && npm run dev      # http://localhost:5173
```
- Gateway (único punto de entrada del frontend): `http://localhost:8080/api/<servicio>/...`. Puertos directos: auth 3011, catalogo 3002, carrito 3003, ordenes 3004, pagos 3005, notificaciones 3006; postgres 5432, mongo 27019, redis 6379, rabbitmq 5672 (UI 15672).
- Cambié código de un servicio -> `docker compose up -d --build <servicio>`. Cambié `gateway/krakend.json` -> `docker compose restart gateway` (el archivo está montado como volumen pero KrakenD solo lo lee al arrancar). El frontend recarga solo (HMR).
- Cada ruta nueva de un servicio necesita su entrada (método + endpoint) en `krakend.json`; si no, el gateway responde 404.

## Datos y dónde viven
- **Postgres**: usuarios (auth), órdenes, pagos, notificaciones. **MongoDB** (`catalogo`): colecciones `productos`, `reservas`, `resenas`. **Redis**: carrito.
- ⚠️ **Las imágenes del catálogo NO se guardan como archivos dentro de la carpeta del proyecto.** Viven **dentro de Mongo, como data-URIs base64** (`productos.imagenes[]`), y Mongo vive en un **volumen Docker** (`marketplace_mongodata`; Postgres en `marketplace_pgdata`), fuera de git y fuera de esta carpeta. `docker compose down -v` o reinstalar Docker los borra. Hoy hay 34 productos/servicios con 118 imágenes en Mongo.
- Solo una parte tiene copia en archivos: `app/frontend/public/seed/<carpeta>/N.jpg|N.txt` (el `.txt` es el data-URI) para los productos sembrados. Las publicaciones creadas desde la UI (p. ej. "Diseño de logotipo", "Instalacion de software", "Reparacion de laptops", "Limpieza profunda de hogar") **no tienen carpeta seed**: su única copia es la de Mongo. Para editar el catálogo se usa `mongosh` dentro del contenedor (`docker compose exec mongo mongosh catalogo`).
- **Respaldo** (hacerlo antes de operaciones riesgosas y de vez en cuando): `cd proyecto-marketplace/app && bash scripts/backup-datos.sh` -> crea `proyecto-marketplace/backups/AAAA-MM-DD_HHMM/` con `mongo-catalogo.archive.gz` (catálogo + reservas + reseñas + **todas las imágenes**) y `postgres.sql.gz` (usuarios, órdenes, pagos, notificaciones). **`backups/` está en `.gitignore`: no se sube a GitHub**; si quieres que sobreviva a un fallo de este PC hay que copiarla a otro lado (USB/nube). Restaurar: `bash scripts/restaurar-datos.sh ../backups/<carpeta>` (pide escribir SI; reemplaza los datos actuales). El primer respaldo (2026-10-30_1439) se verificó restaurándolo en bases temporales: conteos idénticos.
- Endpoints **internos** servicio-a-servicio, NO expuestos en el gateway (a propósito): `GET /auth/internal/email/:id` y `GET /ordenes/internal/:id`.

## Decisiones ya tomadas (no volver a discutirlas)
- Frontend = React + Vite (no Next.js). Gateway = KrakenD. Mensajería = RabbitMQ (exchange `eventos`, tipo topic). Persistencia políglota (Postgres/Mongo/Redis).
- **Pagos y correo son sandbox, a propósito** (el anteproyecto excluye pasarelas/proveedores reales, sección 1.3). Pagos: simulador local, tarjeta terminada en `0002` = rechazada. Correo: Nodemailer sobre una cuenta de prueba **Ethereal**; el mensaje se "envía" por SMTP real pero **nunca llega a una bandeja real**: el enlace de vista previa sale en `docker compose logs notificaciones`. No es un bug.
- **Credenciales fuera del código** (12-Factor, factor III): `docker-compose.yml` usa `${VARIABLES}`; los valores reales van en `app/.env` y `app/frontend/.env` (ignorados por git). Solo se versionan los `.env.example`. El repo es **público**: nunca commitear secretos.
- Contraseñas con bcrypt, JWT validado en cada servicio.
- Extras construidos que **no están en el RF-01..RF-21 del informe**: reservas de citas con horarios para servicios y reseñas/calificaciones. Hay que documentarlos (RF-22/RF-23 o nota de alcance ampliado).

## Acuerdos de trabajo con el usuario
- Hablar en **español**, respuestas **cortas y directas**. El usuario es estudiante: cuando pregunta un concepto (sandbox, .env, etc.), explicarlo bien, con ejemplos de su propio proyecto.
- **Informe final**: nunca meter capturas ni texto sobre el funcionamiento de la app sin el **visto bueno explícito** del usuario (ver memoria `feedback-informe-final-workflow`). Lo que se documenta debe reflejar lo que la app realmente hace, incluidos los huecos.
- **No hacer `git push` sin que lo pida.** Confirmar antes de acciones destructivas (borrar contenedores, volúmenes, publicaciones). Nunca `git add -A`: hay un archivo temporal de Word (`~$...docx`) sin versionar.
- Commits en español, estilo descriptivo, con el trailer `Co-Authored-By` que indique el sistema.
- El usuario revisa **con capturas de pantalla** y es muy exigente con lo visual. Antes de decir "listo" en UI: probar en el navegador (Playwright) y revisar la captura.
- Para imágenes de productos: deben ser **del mismo modelo y del mismo color**, corresponder al nombre/descripción, **no repetirse entre publicaciones** y tener buena resolución (>= ~1000 px). Si el producto tiene modelo identificable, **va en el nombre**. Fuentes usadas: Pexels (licencia libre) y, para electrónica, las imágenes de la ficha de Amazon.

## Trampas conocidas
- **Git Bash en Windows reescribe rutas** tipo `/tmp/x` al hacer `docker exec/cp`: anteponer `MSYS_NO_PATHCONV=1`.
- `.docx` no se lee con Read: extraer texto con Python (`zipfile` + quitar etiquetas de `word/document.xml`, cambiando `</w:p>` por salto de línea).
- Playwright: `browser_take_screenshot` con `filename` guarda en la carpeta actual (borrar la captura después); la carpeta `.playwright-mcp/` está ignorada por git.
- Al listar/leer documentos de Mongo **no imprimir los base64** (llenan el contexto): usar `{ imagenes: 0 }` o scripts que escriban a archivo.
- No dejar archivos temporales en la raíz del repo; usar la carpeta scratchpad de la sesión.

## Estado y pendientes (actualizado 2026-10-31)
**Hecho en la app**: 6 microservicios + gateway + frontend completos (13 pantallas del wireframe); RF-04 (editar perfil/contraseña); RF-20/21 (correo + notificación in-app a comprador y vendedor); carrusel "Vistos recientemente"; zoom de imágenes; catálogo con imágenes y nombres revisados.
**Falta en la app** (el anteproyecto lo promete):
1. **Pruebas de carga y escalabilidad con k6**: scripts listos en `app/loadtests/` (`humo.js` probado; `carga.js` sin ejecutar) — falta correrlos y recoger resultados; bloquea el Cap. V y el Objetivo específico 5.
2. **Observabilidad: Prometheus + Grafana** (no hay config).
3. **CI/CD**: `.github/workflows/ci.yml` escrito, sin probar en GitHub; el build del frontend falla por un error de tipos previo en `src/lib/api.ts`.
**Falta en el informe** (`informe-final/*.docx`): 4.2 Implementación de microservicios, 4.5 Interfaz web (con capturas, requiere visto bueno), 4.6 Despliegue, **todo el Cap. V**, Resumen/Abstract (250-500 palabras), Conclusiones, Recomendaciones, Anexos; completar bibliografía de los Cap. IV-V; sumar los extras (reservas, reseñas) a la sección 3.1.1.
**Detalles menores abiertos**: checkout crea la orden (y vacía el carrito) antes de cobrar, así que un fallo de pago deja orden `pendiente` sin reintento (documentar o arreglar); "Corte de cabello con mapa" comparte 2 fotos con "Corte y peinado a domicilio"; camiseta Hanes mezcla un paquete multicolor con fotos azul marino; falta el modelo exacto del mouse Acer y de la lámpara TaoTronics; la descripción del Soundcore Life Q30 dice 30 h (el modelo declara 40 h); 56 de 109 imágenes de seed miden < 700 px (casi todas miniaturas 2-4).

## Al terminar una sesión
Añadir una entrada breve (fecha, qué se hizo, qué quedó pendiente, decisiones nuevas, cambios que viven solo en Mongo) al inicio de la sección de entradas de `proyecto-marketplace/docs/historial-sesiones.md` y, si cambió algo de fondo, actualizar este archivo (sobre todo "Estado y pendientes"). Mantener este archivo corto: lo cronológico va en el historial.

**Hay un hook que lo recuerda** (`.claude/settings.json` -> `.claude/hooks/recordar-historial.py`, evento `Stop`): si desde la última modificación del historial hubo 8 o más usos de herramientas, bloquea el cierre una sola vez y pide anotar la entrada. Al actualizar el historial deja de insistir. Si estorba, se desactiva borrando `.claude/settings.json`.
