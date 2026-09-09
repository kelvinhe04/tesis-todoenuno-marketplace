# Plan de trabajo — Informe Final de Trabajo de Graduación (Teórico-Práctico)

**Estudiante:** Kelvin He Wu
**Asesor:** José Javier Chirú Figueroa
**Carrera:** Licenciatura en Desarrollo y Gestión de Software (FISC – UTP)
**Fuente de verdad:** `anteproyecto/Anteproyecto_tesis_Kelvin He Wu.docx` (APROBADO). Este plan no reinventa el alcance ni el Plan de Contenido — los hereda de ahí. Los subtítulos de capítulo pueden ajustarse levemente durante la redacción si tiene sentido, pero se mantienen salvo razón de peso.
**Meta de extensión:** **75+ páginas de contenido** (Cap. I–V + cierre), sin contar preliminares (portada, dedicatoria, agradecimiento, índices, introducción, resumen).

---

## 0. Reglas de flujo (no negociables)

1. **App e informe en paralelo.** No se espera a tener la app 100% terminada para empezar a escribir — cada capítulo avanza en cuanto su fase de la app tiene evidencia real que documentar.
2. **Visto bueno obligatorio antes de redactar con evidencia de la app.** Antes de meter cualquier captura de pantalla o descripción del comportamiento de la app al informe, el usuario la revisa (corriendo o en capturas) y aprueba. Esto aplica sobre todo a Cap. III.6 (diseño de interfaz), Cap. IV.5 (desarrollo de interfaz web) y Cap. V (pruebas y resultados).
3. **El reglamento manda sobre los 3 ejemplos subidos** (`docs/ejemplos-informe-final/`). Los ejemplos son solo inspiración de qué tan a fondo tratar un tema o cómo presentar resultados — no de formato ni de estructura de capítulos.
4. **Alcance fijado en el anteproyecto aprobado, no se expande sin decisión explícita:**
   - Servicios: Usuarios/Autenticación, Catálogo, Carrito, Órdenes, Pagos, Notificaciones + API Gateway.
   - Pruebas: **solo la arquitectura de microservicios** (rendimiento y escalabilidad bajo distintos niveles de carga) — **no** se construye una versión monolítica paralela para comparar (a diferencia del ejemplo de Alfonso B., que sí lo hace; decisión explícita del usuario: seguir el anteproyecto tal cual).
   - **Fuera de alcance** (dicho explícitamente en el anteproyecto, Sección 1.3): pasarela de pago en producción real (queda en modo *sandbox*), gestión logística de envíos, despliegue en nube para uso comercial. No agregar estas cosas "de más" al prototipo.

---

## 1. Estructura del informe (heredada del anteproyecto aprobado, Sección 3)

| Capítulo | Contenido | Depende de (fase app) | Se puede redactar ya? |
|---|---|---|---|
| **I. Generalidades de la Investigación** | Situación actual, propuesta y mejora, definición y alcance, metodología, técnicas de investigación, objetivo general y específicos | — (ya está en el anteproyecto aprobado) | ✅ Sí, ya |
| **II. Marco Teórico** | Comercio electrónico, plataformas marketplace, arquitectura de software, arquitectura de microservicios, API Gateway, comunicación REST, comunicación asíncrona por eventos, contenedores y orquestación, tecnologías del stack | — (es investigación bibliográfica) | ✅ Sí, ya |
| **III. Diseño de la Solución** | Requerimientos (func./no func.), arquitectura propuesta, diseño de microservicios, diseño de BD, diseño de comunicación entre servicios, diseño de interfaz de usuario | Fase 2 (Diseño de Arquitectura) | 🟡 Diagramas y mockups sí; necesita aprobación antes de cerrar 3.6 |
| **IV. Desarrollo e Implementación** | Tecnologías utilizadas, implementación de microservicios, implementación del API Gateway, implementación de comunicación entre servicios, desarrollo de interfaz web, despliegue del prototipo | Fases 3, 4, 5 | 🔴 Necesita la app construida y **aprobada** |
| **V. Pruebas y Resultados** | Escenarios de prueba, pruebas funcionales, pruebas de rendimiento, pruebas de escalabilidad, análisis de resultados, discusión de resultados | Fase 6 | 🔴 Necesita la app corriendo y **aprobada** |
| **Cierre** | Conclusiones, Recomendaciones, Referencias y Bibliografía, Anexos | Todo lo anterior | 🔴 Al final |

---

## 2. Presupuesto de páginas (para llegar a 75+)

| Capítulo | Páginas estimadas |
|---|---|
| I. Generalidades | 8–10 |
| II. Marco Teórico | 18–20 |
| III. Diseño de la Solución | 16–18 |
| IV. Desarrollo e Implementación | 16–18 |
| V. Pruebas y Resultados | 12–14 |
| Cierre (Conclusiones + Recomendaciones) | 3–4 |
| **Total contenido** | **≈ 73–84** |

La Bibliografía y Anexos no cuentan para la meta pero se agregan igual. Si al llegar a Cap. V el conteo real queda corto, el margen está en Cap. II (marco teórico admite profundizar más subtemas) y en Cap. V (más escenarios de prueba/gráficas), no en rellenar capítulos con paja.

---

## 3. Mapeo fase de la app → capítulo → checkpoint de aprobación

Reutiliza las 6 fases ya definidas en `plan-anteproyecto.md` (Sección 9), que son a la vez el cronograma y el orden real de construcción.

1. **Fase 1 – Investigación y Análisis** → alimenta Cap. I y parte de Cap. II. Sin checkpoint de app (no hay app aún).
2. **Fase 2 – Diseño de Arquitectura** → Cap. III completo (diagramas de arquitectura, diseño de microservicios, ERD/modelo de datos, diseño de comunicación, mockups de interfaz). **Checkpoint:** mostrar diagramas y mockups antes de cerrar la redacción de 3.2–3.6.
3. **Fase 3 – Infraestructura y Comunicación** → Cap. IV.1, 4.3, 4.4 (tecnologías, API Gateway, comunicación entre servicios). **Checkpoint:** demo del gateway enrutando + RabbitMQ moviendo un evento antes de redactar esas secciones.
4. **Fase 4 – Desarrollo de Microservicios** → Cap. IV.2 (implementación de los 6 microservicios). **Checkpoint:** demo de endpoints (Postman/Swagger) por servicio antes de documentarlo.
5. **Fase 5 – Frontend e Integración** → Cap. III.6 (si no se cerró antes) y Cap. IV.5, 4.6 (interfaz web, despliegue). **Checkpoint fuerte:** navegar la app completa en vivo — este es el punto donde más importa tu revisión de UI/UX antes de que cualquier captura entre al documento.
6. **Fase 6 – Pruebas y Documentación** → Cap. V completo + Cierre. **Checkpoint:** revisar tablas/gráficas de resultados de carga antes de redactar el análisis (5.5) y la discusión (5.6).

---

## 4. Alcance de interfaz a construir (Cap. III.6 / IV.5)

Confirmado: **flujo completo comprador + vendedor**, ~10–14 pantallas:

**Comprador:** landing/inicio · registro · login · catálogo con búsqueda/filtros · detalle de producto o servicio · carrito · checkout/pago (sandbox) · historial de órdenes · perfil.

**Vendedor:** panel de publicaciones (listado) · crear/editar producto o servicio · órdenes recibidas.

*(Admin es un actor mencionado en el plan pero no es parte de los objetivos específicos aprobados — se deja como posible extra si sobra tiempo en Fase 5-6, no es núcleo del entregable.)*

---

## 5. Uso de los 3 ejemplos subidos (solo para calibrar, no para copiar formato)

- **Alfonso B.** (124 pág., monolítico vs. microservicios/Docker con carga 250/500/1000 usuarios): el más útil para calibrar **profundidad y formato de tablas/gráficas de Cap. V** (metodología de pruebas, cómo presentar resultados de carga). No replicar la comparación monolítico-vs-microservicios (fuera de nuestro alcance aprobado).
- **Liao & Zheng** (98 pág.) y **Aneth-Sara "Focus Clean"** (101 pág.): referencia de nivel de detalle esperado por capítulo y de cómo documentar pantallas de interfaz con capturas. Estructura de capítulos de ambos difiere de la nuestra (Anexo 2) — no seguir su numeración.

---

## 6. Próximo paso concreto

Con este plan y el de `plan-anteproyecto.md` (fases/cronograma) ya alineados, el siguiente paso es arrancar **Fase 2**: escafoldar `app/` (monorepo: `gateway/`, `services/`, `frontend/`, `docker-compose.yml`) y empezar los diagramas de arquitectura para Cap. III — con checkpoint de aprobación antes de cerrar esa sección.
