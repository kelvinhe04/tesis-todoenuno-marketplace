# BORRADOR — Capítulo V. Pruebas y resultados

> Borrador para revisión del autor. **No está en el .docx.** Los números salen de `app/loadtests/resultados/` y `app/tests/` (fecha de las mediciones: 2026-11-07). Entre corchetes van cosas por decidir o completar.

## 5.1. Escenarios de prueba

Las pruebas se ejecutaron sobre un único equipo de desarrollo (Windows 11, Docker Desktop, con 32 hilos lógicos y 15.4 GiB de memoria disponibles para los contenedores). En ese mismo equipo corrían los seis microservicios, el API Gateway (KrakenD 2.6), PostgreSQL 16, MongoDB 7, Redis 7, RabbitMQ 3.13 y las herramientas de medición. Esta configuración es adecuada para comparar el comportamiento relativo de la arquitectura, pero no representa un entorno de producción (véase la sección 5.6).

Se definieron cuatro grupos de pruebas, cada uno asociado a los requerimientos de la sección 3.1.2:

| Grupo | Herramienta | Requerimientos que evalúa |
|---|---|---|
| Funcionales y de seguridad | Batería `qa_api.py` (Python, solo biblioteca estándar) a través del API Gateway | RF-01 a RF-21, RNF-04 |
| Rendimiento bajo carga | k6 (perfiles ligera, media y alta) | RNF-01 |
| Escalabilidad | k6 (prueba de estrés) con 1, 2 y 3 instancias del servicio de catálogo | RNF-03 |
| Resiliencia y consistencia | Script `pruebas_rnf.py` | RNF-02, RNF-06 |

La observabilidad se montó con Prometheus 2.54 (recolección cada 5 segundos) y Grafana 11.2 (tablero «TodoEnUno – Salud del sistema»). El API Gateway exporta sus métricas con el exportador Prometheus de KrakenD, que como punto único de entrada permite medir solicitudes por segundo, latencia (p50, p95, p99) y códigos de respuesta por endpoint sin modificar el código de los microservicios; RabbitMQ aporta las suyas mediante su plugin de Prometheus. El consumo de CPU y memoria de cada contenedor se registró con `docker stats`, porque cAdvisor, en Docker Desktop para Windows, solo expone el total del equipo y no cada contenedor.

**Escenario de carga.** Cada usuario virtual consulta el listado del catálogo, abre el detalle de un producto al azar y, en el 20 % de las iteraciones, inicia sesión; entre solicitudes espera un segundo, como lo haría una persona. Son operaciones de solo lectura más el inicio de sesión: no crean órdenes, pagos ni publicaciones. Los perfiles son: **ligera** (10 usuarios simultáneos), **media** (50) y **alta** (200, con rampa de subida y bajada). Los umbrales de aceptación fueron un p95 menor a 800 ms y menos del 1 % de solicitudes fallidas.

## 5.2. Pruebas funcionales

La batería `qa_api.py` ejercita la aplicación completa a través del API Gateway, igual que lo haría la interfaz web. Ejecuta 334 comprobaciones agrupadas en autenticación y sesiones (registro, JWT manipulado, revocación de tokens, límite de intentos), verificación de correo, catálogo y sus validaciones, carrito, reservas de citas (incluida la carrera entre dos compradores), órdenes y pagos (descuento y devolución de stock, tarjeta rechazada, tres pagos simultáneos de la misma orden con un solo cobro, última unidad disputada por dos compradores), entrega por vendedor, reseñas y notificaciones.

**Resultado: 332 de 334 comprobaciones correctas.** Las dos restantes son informativas y no son defectos inesperados: los endpoints `POST /ordenes/demo` y `GET /notificaciones/demo/log` responden sin autenticación porque se dejaron abiertos deliberadamente como evidencia del mecanismo de eventos (sección 4.4); en un despliegue real deberían cerrarse. La batería crea cuentas y publicaciones propias y las elimina al terminar, sin tocar los datos reales.

## 5.3. Pruebas de rendimiento

**Prueba de humo.** Con un usuario, los seis servicios respondieron correctamente a través del gateway (6 de 6 comprobaciones; p95 de 6 ms).

**Primera medición (antes de optimizar).** Los tres perfiles incumplieron los umbrales:

| Perfil | Usuarios | Solicitudes/s | p95 | Errores |
|---|---|---|---|---|
| Ligera | 10 | 4.9 | 1.73 s | 0 % |
| Media | 50 | 8.5 | 13.5 s | 0.34 % |
| Alta | 200 | 10.5 | 41.9 s | 6.9 % |

Con apenas diez usuarios simultáneos ya no se cumplía el RNF-01 (consultas del catálogo en menos de 500 ms). El tablero de Grafana y el consumo de CPU mostraron que el límite no estaba en el procesamiento (el gateway no superó el 5 % de CPU y el servicio de catálogo el 80 %), sino en el volumen de datos: el listado del catálogo pesaba cerca de **9.7 MB por respuesta** y el detalle de una publicación 1 MB, porque cada publicación incluía todas sus fotografías codificadas en base64.

**Optimización aplicada.** Las respuestas del catálogo dejaron de incluir las imágenes y pasaron a incluir una URL por fotografía. Un endpoint nuevo (`GET /catalogo/:id/imagen/:n`) sirve la foto original o una miniatura redimensionada al ancho solicitado, la conserva en memoria y devuelve cabeceras `ETag` y `Cache-Control` para que el navegador no la vuelva a pedir. Las imágenes siguen almacenadas sin cambios en MongoDB, y cada pantalla de la interfaz solicita el tamaño que necesita. Con ello el listado pasó de 9.7 MB a 13 KB, el detalle de 1 MB a 1.4 KB, y una miniatura típica pesa 8 KB frente a 394 KB de la imagen original.

**Segunda medición (después de optimizar).** Con la misma prueba:

| Perfil | Usuarios | Solicitudes/s | p95 | Errores |
|---|---|---|---|---|
| Ligera | 10 | 7.6 | 43 ms | 0 % |
| Media | 50 | 41.0 | 43 ms | 0 % |
| Alta | 200 | 145.5 | 45 ms | 0 % |

Con 200 usuarios simultáneos el sistema atendió 37 299 solicitudes sin ningún error, con un p95 de 45 ms, cumpliendo los umbrales en los tres perfiles. [Figura 5.x: tablero de Grafana durante la carga, antes y después — `resultados/antes/grafana-corrida-antes.png` y `resultados/despues/grafana-corrida-despues.png`.]

**Carrito (RNF-01).** Como el escenario de k6 cubre el catálogo, el tiempo de respuesta del carrito se midió aparte con 200 consultas consecutivas a `GET /carrito` con un artículo: media de 12.7 ms, p95 de 30.3 ms y máximo de 33 ms, muy por debajo de los 500 ms exigidos.

## 5.4. Pruebas de escalabilidad

Para evaluar el RNF-03 se repitió una prueba de **estrés sin pausas** entre solicitudes (100 usuarios durante 45 segundos, consultando listado y detalle), de modo que el sistema trabajara cerca de su límite, con 1, 2 y 3 instancias del servicio de catálogo. En cada cambio se reinició el gateway para que resolviera nuevamente las direcciones del servicio. La prueba se ejecutó tres veces por configuración: las dos primeras rondas con otros programas abiertos en el equipo y la tercera con todo lo demás cerrado, para comprobar la influencia de los procesos de fondo.

| Instancias de catálogo | Ronda 1 | Ronda 2 | Ronda 3 (equipo sin otros programas) | Errores (ronda 3) |
|---|---|---|---|---|
| 1 | 460 | 399 | **470** | 2.76 % |
| 2 | 753 | 623 | **737** (+57 %) | 0.05 % |
| 3 | 642 | 758 | **937** (+99 %) | 0.04 % |

*(solicitudes por segundo)*

En las condiciones más controladas (ronda 3), cada instancia adicional del catálogo, sin modificar ningún otro servicio ni el código, aumentó el rendimiento: con dos instancias cerca de un 57 % y con tres casi el doble, y los errores que aparecían con una sola instancia prácticamente desaparecieron. El reparto de las solicitudes entre instancias funcionó, pues en todas las configuraciones todas las instancias mostraron un consumo de CPU elevado. En las dos primeras rondas, realizadas con otros procesos activos en el equipo, la mejora de la tercera instancia no se manifestó (642 y 758 solicitudes por segundo): los procesos de fondo restan capacidad a una máquina que ya aloja al sistema, a las bases de datos y al generador de carga, y afectan sobre todo a las configuraciones más exigentes. Esto confirma el RNF-03 para el servicio evaluado y deja abierta la evaluación de los demás servicios. La variación entre rondas de una misma configuración llegó al 15-25 %, por lo que las cifras deben interpretarse como un orden de magnitud y no como valores exactos.

## 5.5. Análisis de resultados

| Requerimiento | Verificación | Resultado |
|---|---|---|
| RNF-01 Rendimiento (< 500 ms) | k6 (catálogo) y 200 consultas al carrito | **Cumple** tras la optimización; antes **no cumplía** |
| RNF-02 Disponibilidad | Servicio de Notificaciones apagado durante una compra completa | **Cumple**: el pago se aprueba, la orden queda pagada y el vendedor la ve; al reiniciar Notificaciones el aviso llega en ≈ 1.2 s, porque RabbitMQ conserva el mensaje en la cola |
| RNF-03 Escalabilidad | Catálogo con 1, 2 y 3 instancias | **Cumple** (en la ronda con el equipo limpio: +57 % con 2 instancias y +99 % con 3); evaluado solo en el servicio de catálogo |
| RNF-04 Seguridad | `qa_api.py` (JWT manipulado, `alg=none`, revocación, límite de intentos, contraseñas con bcrypt) | **Cumple** |
| RNF-05 Mantenibilidad | Durante las pruebas, el catálogo y Notificaciones se reconstruyeron y reiniciaron con `docker compose up -d --build <servicio>` sin afectar a los demás | **Cumple** |
| RNF-06 Consistencia eventual | 10 compras: tiempo desde el envío del pago hasta que la orden figura como pagada y hasta que se genera la notificación | **Cumple**: media de 65 ms (máx. 98 ms) y 39 ms (máx. 71 ms) |
| RNF-07 Usabilidad (≤ 4 pantallas) | Revisión del flujo | **Cumple** por inspección: catálogo, carrito, checkout y confirmación [no medido con usuarios] |
| RNF-08 Portabilidad | Todo el sistema, incluida la observabilidad, se levanta con `docker compose up -d` | **Cumple** |

El hallazgo más importante es que **el primer cuello de botella no estaba donde la arquitectura suele sospecharse**: no fue el procesamiento ni la comunicación entre servicios, sino el tamaño de las respuestas. La instrumentación (Prometheus, Grafana y las métricas por contenedor) permitió descartar las hipótesis de CPU y encontrar la causa, y la corrección fue local al servicio de catálogo, sin tocar el resto de la arquitectura, lo que ilustra la ventaja de aislamiento de los microservicios.

## 5.6. Discusión de resultados

Los resultados deben leerse con las siguientes limitaciones, que acotan lo que se puede afirmar:

- **Un solo equipo.** El generador de carga, el sistema y las bases de datos comparten la misma máquina, por lo que las cifras absolutas (solicitudes por segundo) no son extrapolables a un entorno de producción; son útiles para comparar configuraciones entre sí.
- **Carga de lectura.** El escenario de k6 consulta el catálogo e inicia sesión; no incluye compras. El flujo de compra se validó funcionalmente (sección 5.2) y en tiempos de propagación de eventos (RNF-06), pero no bajo carga concurrente masiva.
- **Una instancia por servicio**, salvo el catálogo en la prueba de escalabilidad. No se evaluó el escalamiento de los demás servicios ni el de las bases de datos.
- **Pagos y correo en modo de prueba** (sandbox), por el alcance definido en el anteproyecto, por lo que los tiempos de pago no incluyen la latencia de una pasarela real.
- **Tres mediciones por configuración** en la prueba de escalabilidad; la diferencia entre rondas (por ejemplo 460, 399 y 470 solicitudes/s con una instancia) muestra una variación de hasta ≈ 15-25 %, y la ronda con el equipo sin otros programas dio los mejores resultados, de modo que el entorno influye en las cifras.
- **Entrega continua.** El proyecto incorpora integración continua (compilación, análisis estático y construcción de imágenes en cada cambio); el despliegue automático queda como trabajo futuro.

Como trabajo futuro se proponen: pruebas de carga que incluyan el flujo de compra; ejecutar el generador de carga en una máquina distinta; escalar y medir los demás servicios y las bases de datos; sustituir el reparto por DNS por un balanceador con comprobaciones de salud; y cerrar los endpoints de demostración antes de un despliegue real.
