# Plan de trabajo — Anteproyecto de Trabajo de Graduación (Teórico-Práctico)

**Estudiante:** Kelvin He Wu
**Asesor:** José Javier Chirú Figueroa
**Carrera:** Licenciatura en Desarrollo y Gestión de Software (FISC – UTP)
**Modalidad:** Trabajo **Teórico-Práctico**
**Título (portada, TODO EN MAYÚSCULA):** *PLATAFORMA MARKETPLACE PARA LA COMERCIALIZACIÓN DE PRODUCTOS Y SERVICIOS BASADA EN ARQUITECTURA DE MICROSERVICIOS*
**Año:** 2026

---

## 0. Decisiones confirmadas por el usuario

- ✅ **Portada:** se deja igual que el Keller (asesor **Chirú**, integrante Kelvin He Wu, carrera, año 2026). Solo cambia el **título del proyecto** (mayúsculas) y la **modalidad → TEÓRICO PRÁCTICO**.
- ✅ **Plan de Contenido:** se sigue el **Anexo 2** del reglamento (modelo Teórico-Práctico), adaptado al tema.
- ✅ **Frontend:** **NO se usa Next.js** (ralentiza). Se usa **React + Vite (SPA)**.
- ✅ **Sección 8 (Herramientas):** mismo **formato del Keller** (mismo hardware = misma laptop) y **sin justificar el stack** — solo lista.
- ✅ **Bibliografía:** **APA**, **mínimo 25** referencias, priorizando **libros**; reutilizar las relevantes del Keller.
- ✅ **Eliminar** la sección "9. Programa de Práctica Profesional" (y su entrada del índice).
- 🔶 **Backend (framework):** tentativo **NestJS / Node.js** (sin justificar en el doc por ahora). Se puede cambiar sin afectar el anteproyecto.
- 🔶 **Docker:** recomendado pero **no obligatorio** por el reglamento (ver sección 7.1).

---

## 1. Objetivo de este documento

Construir el **Anteproyecto** cumpliendo el *Reglamento de Trabajos de Graduación FISC (2018)*, reutilizando **el formato exacto** de `Anteproyecto de Trabajo de Graduación Kelller.docx` (portada, índice automático, numeración centrada, saltos de sección y páginas en blanco ya configuradas) y **adaptando el contenido** al tema, con referencia de contenido en `Anteproyecto de Graduacion ejemplo chiru.docx`.

> El stack y su análisis viven en este `plan.md`, **no dentro del anteproyecto**. En la sección 8 del doc solo irá la **lista** de herramientas (estilo Keller, sin justificación).

---

## 2. Concepto del proyecto — ¿cómo funciona el marketplace y para qué los microservicios?

### 2.1. Qué tipo de marketplace es
Es un **marketplace multi-vendedor transaccional** de **productos y servicios**. Se parece a **MercadoLibre / Amazon** (para productos) combinado con **Fiverr / Airbnb** (para servicios): muchos vendedores publican en una sola plataforma, y los compradores buscan, agregan al carrito, **pagan dentro de la plataforma**, y reciben confirmación.

> **No** es como **Facebook Marketplace**. Facebook Marketplace es un **tablón de clasificados C2C**: publicas, alguien te contacta y la transacción/pago ocurre por fuera (en persona/WhatsApp). No hay carrito, ni pagos integrados, ni gestión de órdenes. El nuestro **sí** es transaccional (carrito → checkout → pago → orden → notificación).

**Productos vs. servicios:** los **productos** son bienes (con stock, precio, envío); los **servicios** son ofertas sin stock (una reparación, una clase, un diseño) que pueden requerir agenda/reserva. El catálogo maneja ambos tipos.

### 2.2. Actores
- **Comprador:** busca, compra, paga, reseña.
- **Vendedor/Proveedor:** publica y gestiona sus productos o servicios y recibe órdenes.
- **Administrador:** modera y gestiona la plataforma.

### 2.3. Los microservicios (cada uno = una capacidad de negocio)
1. **Usuarios / Auth** — registro, login, roles (comprador/vendedor/admin), emite JWT.
2. **Catálogo** — publicación y búsqueda de productos y servicios (categorías, atributos, precios, stock).
3. **Carrito** — carrito de compra (rápido, en Redis).
4. **Órdenes** — crea y gestiona pedidos y sus estados (pendiente → pagado → enviado/completado).
5. **Pagos** — procesa el pago (Stripe/PayPal en modo *sandbox*).
6. **Notificaciones** — correos/alertas (orden creada, pago confirmado); reacciona a eventos.
- *(Opcionales según tiempo)* Reseñas/Calificaciones, Vendedores, Búsqueda avanzada.

Todos se exponen detrás de un **API Gateway** (punto único de entrada: el frontend solo habla con el gateway, que enruta, valida el token y aplica límites de tasa).

### 2.4. Cómo se comunican
- **Síncrona (REST):** consultas directas (ver catálogo, crear orden).
- **Asíncrona (RabbitMQ, eventos):** desacople. Al crear una orden se emite el evento `OrdenCreada`; **Pagos** y **Notificaciones** reaccionan sin acoplarse directamente.

### 2.5. Flujo de ejemplo (end-to-end)
1. El comprador inicia sesión → **Auth** emite un JWT.
2. Busca productos/servicios → **Catálogo** responde.
3. Agrega al carrito → **Carrito** (Redis).
4. Hace checkout → **Órdenes** crea la orden y emite `OrdenCreada`.
5. **Pagos** cobra (Stripe sandbox) y emite `PagoConfirmado`.
6. **Notificaciones** envía el correo de confirmación; **Órdenes** pasa el estado a "pagado".

### 2.6. Para qué sirven los microservicios aquí (justificación del tema)
- **Escalabilidad selectiva:** escalar solo el servicio saturado (ej. Catálogo en una promoción) sin escalar toda la app.
- **Despliegue independiente:** actualizar Pagos sin tumbar el Catálogo.
- **Aislamiento de fallos (resiliencia):** si Notificaciones cae, el resto sigue vendiendo.
- **Persistencia poliglota:** cada servicio con su BD ideal (PostgreSQL para órdenes/pagos por ACID; MongoDB para catálogo por flexibilidad; Redis para carrito por velocidad).
- **Desarrollo por dominios:** límites claros (Domain-Driven Design).

Estas propiedades son precisamente lo que el trabajo teórico-práctico **medirá y validará** con pruebas de carga y métricas.

---

## 3. Qué exige el reglamento (checklist)

**Formato (Art. 22):** Arial 12 · interlineado 1.5 · márgenes 1" · numeración inferior **centrada** · papel carta. *(Ya viene resuelto en el Keller.)*

**Estructura (Art. 23):** a) Portada · b) Registro Oficial · c) Introducción · d) Índice numerado · e) Objetivos · f) Plan de Contenido (Anexo 2, Teórico-Práctico) · g) Bibliografía (APA, ≥25 aquí) · h) Cronograma (Gantt Mes/Semana) · i) Créditos oficiales (placeholder) · j) Constancia de matrícula (placeholder) · k) Herramientas SW/HW · ~~l) Programa de práctica profesional~~ (no aplica).

---

## 4. Mapa del documento Keller a intervenir (por sección)

1. **Portada** → título nuevo (mayúsculas), modalidad *TEÓRICO PRÁCTICO*, resto igual.
2. **Índice (TOC)** → se regenera solo desde los títulos (F9 al abrir en Word).
3. **1. Introducción** → 1.1 Situación actual · 1.2 Propuesta y mejora · 1.3 Definición y alcance · 1.4 Metodología · 1.5 Técnica de investigación.
4. **2. Objetivos** → general + específicos.
5. **3. Plan de Contenido** → estructura Anexo 2 Teórico-Práctico (sección 5).
6. **4. Bibliografía** → ≥25 APA, priorizando libros.
7. **5. Cronograma** (página apaisada) → nuevo Gantt Mes/Semana.
8. **6. Créditos Oficiales** → página en blanco (placeholder).
9. **7. Constancia de Matrícula** → página en blanco (placeholder).
10. **8. Herramientas SW/HW** → hardware igual al Keller (misma laptop) + lista del stack, sin justificación.
11. **9. Programa de Práctica Profesional** → **ELIMINAR** (título + índice).

---

## 5. Plan de Contenido propuesto (Anexo 2 — Teórico-Práctico)

**Preliminares:** Dedicatoria · Agradecimiento · Índice General · Índice de Tablas y Figuras · Introducción · Resumen (Abstract)

**CAPÍTULO I – ANTECEDENTES DEL PROYECTO**
- 1.1. Planteamiento de la problemática (comercialización fragmentada / límites del monolito)
- 1.2. Objetivos (general y específicos)
- 1.3. Marco teórico y estado del arte
  - 1.3.1. Comercio electrónico y modelos de marketplace (productos vs. servicios)
  - 1.3.2. Arquitectura monolítica vs. microservicios
  - 1.3.3. Patrones de microservicios (API Gateway, Database-per-Service, Event-Driven, Saga)
  - 1.3.4. Contenerización y comunicación entre servicios (REST / mensajería)
- 1.4. Estructura del trabajo

**CAPÍTULO II – CONCEPCIÓN DEL PROYECTO**
- 2.1. Metodología de desarrollo (ágil – Scrum)
- 2.2. Análisis de requisitos (funcionales y no funcionales)
- 2.3. Descomposición del dominio en microservicios (DDD / bounded contexts)
- 2.4. Definición de la arquitectura objetivo

**CAPÍTULO III – DISEÑO DEL PROYECTO**
- 3.1. Arquitectura de microservicios (diagrama de componentes)
- 3.2. Diseño de los microservicios (Usuarios/Auth, Catálogo, Carrito, Órdenes, Pagos, Notificaciones)
- 3.3. Diseño de datos (database-per-service)
- 3.4. API Gateway y contratos de API
- 3.5. Comunicación asíncrona y eventos
- 3.6. Diseño de la interfaz de usuario (frontend)

**CAPÍTULO IV – DESARROLLO DEL PROYECTO**
- 4.1. Configuración del entorno y contenedores
- 4.2. Implementación de los microservicios backend
- 4.3. API Gateway, autenticación y autorización (JWT/OAuth2)
- 4.4. Mensajería y arquitectura orientada a eventos
- 4.5. Frontend (React + Vite) e integración
- 4.6. Integración de pasarela de pagos (sandbox)
- 4.7. Control de versiones e integración continua

**CAPÍTULO V – PRUEBAS Y VALIDACIÓN**
- 5.1. Estrategia de pruebas (unitarias, integración, contrato)
- 5.2. Pruebas de rendimiento y escalabilidad (k6)
- 5.3. Observabilidad y métricas (Prometheus / Grafana)
- 5.4. Análisis e interpretación de resultados

**Cierre:** Conclusiones · Recomendaciones · Referencias y Bibliografía · Anexos (opcional)

> **Nota (indicación del asesor, para el INFORME FINAL):** desarrollar el/los **patrones de diseño de microservicios** usados. Ya está previsto en el Plan de Contenido (Cap. I – 1.3.3 y Cap. III). Patrones a cubrir: **API Gateway**, **Database per Service**, **Event-Driven/mensajería**, **Saga** (transacciones distribuidas Órdenes↔Pagos), **Circuit Breaker** (resiliencia); opcionales: CQRS, Service Discovery.

> **Nota (desarrollo):** setup híbrido recomendado → infra (BD, RabbitMQ) y servicios estables en **Docker**; **frontend (React+Vite) y el servicio en desarrollo corren FUERA de Docker** con `npm run dev` para tener **hot reload**. En Windows, si se quiere el front dentro de Docker, activar polling (`usePolling`/`CHOKIDAR_USEPOLLING`).

---

## 6. Borradores guía (Introducción y Objetivos)

### Objetivo General
Desarrollar una plataforma de marketplace para la comercialización de productos y servicios basada en una arquitectura de microservicios, que garantice escalabilidad, despliegue independiente y resiliencia de sus componentes.

### Objetivos Específicos
1. Analizar los fundamentos teóricos de las arquitecturas de microservicios y los modelos de marketplace de comercio electrónico.
2. Diseñar la arquitectura del sistema descomponiendo el dominio del marketplace en microservicios independientes con sus propias bases de datos.
3. Implementar los microservicios núcleo (usuarios, catálogo, órdenes, pagos y notificaciones) con un API Gateway como punto único de entrada.
4. Establecer la comunicación síncrona (REST) y asíncrona (eventos) entre los microservicios.
5. Contenerizar los servicios para lograr entornos consistentes y despliegue independiente.
6. Evaluar el rendimiento, la escalabilidad y la resiliencia de la plataforma mediante pruebas de carga y métricas de observabilidad.

---

## 7. Stack tecnológico (solo para nuestro control — no va justificado en el doc)

| Capa | Tecnología | Nota |
|---|---|---|
| Frontend | **React + Vite (SPA, TS)** | Ligero y rápido; sin Next.js |
| Backend microservicios | **NestJS / Node.js** *(tentativo)* | Modular, soporte nativo de microservicios |
| API Gateway | **KrakenD** | Punto único de entrada (config declarativa) |
| Comunicación | **REST + RabbitMQ** | Síncrona + eventos asíncronos |
| Bases de datos | **PostgreSQL · MongoDB · Redis** | database-per-service |
| Contenedores | **Docker + Docker Compose** | Ver 7.1 (recomendado, no obligatorio) |
| Auth / Pagos | **JWT + OAuth2 / Stripe sandbox** | — |
| Pruebas / Métricas | **k6 · Prometheus/Grafana** | Para el Cap. V (k6 en JS, se integra mejor con el stack Node/React que JMeter) |
| Versionado / CI-CD | **Git + GitHub Actions** | — |

### 7.1. ¿Docker es obligatorio?
- **Por reglamento: NO.** No exige Docker.
- **Por el tema: muy recomendado.** La contenerización es prácticamente sinónimo de microservicios modernos: permite despliegue independiente, entornos consistentes y **demostrar el escalado horizontal** (clave para el Cap. V de validación). Sin Docker, cada servicio correría como un proceso Node en un puerto distinto — sigue siendo microservicios, pero se pierde el aislamiento/portabilidad y el argumento de escalabilidad se debilita.
- **Recomendación:** mantener **Docker Compose** (no es complejo y suma mucho al trabajo). Es tu decisión final.

---

## 8. Bibliografía — plan (APA, ≥25, priorizar libros)
Reutilizar del Keller las relevantes: Sommerville, Pressman & Maxim, Silberschatz, Elmasri & Navathe, **Fowler (Patterns of Enterprise Application Architecture)**, **Kleppmann (Designing Data-Intensive Applications)**, Guía Ágil PMI, Chacon & Straub (Pro Git). Añadir de microservicios/tema: **Newman (Building Microservices)**, **Richardson (Microservices Patterns)**, **Evans (Domain-Driven Design)**, **Vernon (Implementing DDD)**, **Hohpe & Woolf (Enterprise Integration Patterns)**, **Richardson & Ruby (RESTful Web Services)**, libros de Docker/Kubernetes, y papers IEEE/arXiv de rendimiento monolítico vs. microservicios. Meta: 25–30.

---

## 9. Cronograma (Gantt) — 6 fases / 24 semanas (= hoja de ruta de la app)

Gantt semanal (Fases | Actividades | Mes 1–6 × Sem 1–24), barras en cascada **sin solaparse** (2 semanas por actividad), bordes negros, color por fase. **Estas fases son también el plan de implementación por sprints de la app** (cuando se desarrolle el prototipo, se construye fase por fase en este orden):

| Fase | Actividades | Semanas |
|---|---|---|
| **Fase 1: Investigación y Análisis** | 1) Investigación de microservicios, patrones y marketplaces · 2) Análisis de requisitos y definición del alcance | Sem 1–4 |
| **Fase 2: Diseño de la Arquitectura** | 1) Descomposición del dominio y diseño de los microservicios · 2) Diseño de bases de datos, API Gateway y eventos | Sem 5–8 |
| **Fase 3: Infraestructura y Comunicación** | 1) Configuración del entorno, contenedores (Docker) y bases de datos · 2) API Gateway, autenticación (JWT) y broker de mensajería (RabbitMQ) | Sem 9–12 |
| **Fase 4: Desarrollo de Microservicios** | 1) Servicios de usuarios/auth, catálogo y carrito · 2) Servicios de órdenes, pagos y notificaciones | Sem 13–16 |
| **Fase 5: Frontend e Integración** | 1) Frontend (React + Vite) e integración con el API Gateway · 2) Integración de pagos (sandbox) y control de versiones (Git/CI) | Sem 17–20 |
| **Fase 6: Pruebas y Documentación** | 1) Pruebas de rendimiento, escalabilidad y observabilidad · 2) Análisis de resultados y redacción del informe final | Sem 21–24 |

> En el anteproyecto va genérico (Mes/Semana, sin fechas reales, Anexo 6). Para la app, el orden de construcción sigue estas 6 fases.

---

## 10. Entregable y método
Nuevo `.docx` generado **clonando `Keller.docx`** y editando el texto con **`python-docx`**, preservando estilos (Arial 12 / 1.5), secciones, numeración centrada, TOC, página apaisada y páginas en blanco. El índice se actualiza en Word con F9.

---

## 11. Fases
1. **[Hecho]** Plan + decisiones.
2. Redactar Introducción y Objetivos definitivos.
3. Cerrar Plan de Contenido.
4. Compilar bibliografía (≥25 APA).
5. Construir el `.docx` sobre la base Keller (portada, contenido, eliminar sección 9, cronograma, herramientas).
6. Actualizar índice y revisar formato vs. reglamento.
7. Entrega para revisión.

---

## 12. Trabajo futuro (post-aprobación) — organización del repositorio
Cuando el anteproyecto sea aprobado, se creará una carpeta/repositorio del proyecto que contendrá todo el contexto para el **informe final** y la **app**. Estructura propuesta:

```
proyecto-marketplace/
├── docs/                 # este plan, textos del reglamento, diagramas, contexto
├── anteproyecto/         # el .docx aprobado
├── informe-final/        # el documento final (75+ págs, reglamento)
└── app/                  # monorepo
    ├── gateway/
    ├── services/         # auth, catalogo, carrito, ordenes, pagos, notificaciones
    ├── frontend/         # React + Vite
    └── docker-compose.yml
```

**Sí es factible** que yo cree esa carpeta, arme el código de la app (microservicios + frontend + Docker), la ejecute/pruebe y redacte el informe final reutilizando este contexto. La memoria del proyecto persiste entre sesiones.

### 12.1. Estrategia Docker (para la fase app)
Compose por entorno (fusión automática de base + override):
- `docker-compose.yml` → base común (servicios, redes, BD, RabbitMQ).
- `docker-compose.override.yml` → **desarrollo con hot reload** (monta el código como volumen + dev server `vite`/`nest start --watch`). Se aplica solo con `docker compose up`.
- `docker-compose.prod.yml` → **arrancar todo** (imagen compilada, sin volúmenes). `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build`.

Cada servicio con **Dockerfile multi-etapa** (`AS development` / `AS production`); el compose elige el `target`. En dev, a menudo el frontend se corre FUERA de Docker (`npm run dev`) y solo backend+infra van en contenedores.
