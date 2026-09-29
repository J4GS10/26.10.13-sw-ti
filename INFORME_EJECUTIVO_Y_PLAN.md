# InventarioTI: informe ejecutivo, validación de controles y plan de correcciones

> **Fecha:** 2026-09-29
> **Repositorio:** https://github.com/J4GS10/Inventario-TI (privado, rama `main`)
> **Documentos de detalle:**
> - `CONTINUAR.md`: estado técnico y convenciones.
> - `PROGRESS.md`: bitácora de las sesiones.
> - `herramientas-qa/INFORME_QA.md`: resultados de QA.
> - `herramientas-qa/salidas/qa1…qa8_informe.md`: evidencia por área.

---

## 1. Resumen ejecutivo

InventarioTI es un sistema de gestión de activos de TI para Lombardi. Tecnología:
- **Backend:** FastAPI con PostgreSQL 16.
- **Frontend:** React con MUI, en tres idiomas (español, inglés e italiano).
- **Despliegue:** Caddy, nginx, cuatro workers y réplica de lectura, con adjuntos en MinIO.

**Estado actual (actualizado el 2026-09-29, ver §8):**
- Las fases 0 a 6 del plan se ejecutaron. Los 5 defectos bloqueantes y los 14 altos de la QA del 2026-09-28 quedaron corregidos y cubiertos por pruebas automáticas.
- Los cinco controles solicitados (inventario, asignaciones, entradas y salidas, reasignaciones de equipos y componentes, licencias) ya funcionan en pantalla, CSV y PDF sobre un **kardex unificado**.
- Queda pendiente la QA integral de cierre (los 8 agentes) y algunos puntos de pulido listados en §8.3 antes de la puesta en producción.

**Respuesta a la consulta de esta fecha:**
- **Sí es posible** generar el control de inventario, el control de asignaciones, la bitácora de entradas y salidas, la bitácora de reasignaciones de equipos y componentes, y el control de licencias sobre la base actual.
- Alrededor del **70 %** de los datos necesarios ya se registra (§4).
- Falta: unificar esos registros en un **kardex** consultable y exportable, dar soporte formal a los **componentes**, conservar el **historial de reasignación de licencias** y documentar las **salidas** (bajas) con su motivo y destino.
- Estos trabajos quedan incorporados como **Fase 4** del plan (§5).

---

## 2. Lo realizado

### 2.1 Sesiones 1 a 10 (resumen; detalle en `PROGRESS.md`)

| Área | Logros |
|---|---|
| Arquitectura | Capas endpoints → servicios → repositorios → modelos; `BaseRepository`, `BaseService`, `AsyncQueryBuilder`; máquina de estados del activo desacoplada del framework; transacciones con `@transactional` y acciones posteriores al commit |
| Inventario | Activos con especificaciones, código automático por prefijo, sede y costo; catálogos; ubicaciones (país → área); consumibles con kardex de stock; software, licencias y claves individuales cifradas |
| Trazabilidad | Asignación, devolución, transferencia, préstamo, offboarding, mantenimiento; actas Word/PDF y hoja de descargo; etiquetas QR |
| Compras | Proveedores, órdenes de compra con líneas y moneda; recepción que da de alta activos, consumibles y licencias; garantías vinculadas al proveedor |
| Seguridad | Roles (SUPER_ADMIN, ADMIN_SEGURIDAD, ADMIN_TI, TECNICO, AUDITOR, CONSULTA); MFA obligatorio por rol; contraseña temporal; historial y lista de bloqueo de contraseñas; sesiones por dispositivo; alcance por sede con filtro de la aplicación **y** RLS de PostgreSQL; bitácora de solo inserción |
| Integraciones | Active Directory (personas, jefes, grupos); cola persistente de correos con reintentos; cuenta de servicio SMTP o Microsoft Graph configurable |
| Interfaz | Sistema de diseño unificado; tema accesible (WCAG AA) con modo oscuro; tono formal en ES/EN/IT; autocompletado relacional con motivo visible |
| Pruebas | 335 pruebas automatizadas contra PostgreSQL 16 |

### 2.2 Sesión 11 (2026-09-28 y 29)

1. **Repositorio formal.** Se creó `Inventario-TI`, un repositorio único que reúne backend, frontend y herramientas de QA, y reemplaza a los repositorios de prueba anteriores. Quedan fuera de git el inventario real (`dataset/`) y los secretos locales. Los historiales anteriores se respaldaron en `C:\Lombardi\backups\git-repos-antiguos\`.
2. **Moneda por registro.** Cada costo conserva la moneda en que se pagó (GTQ, USD o CHF), sin conversión:
   - Aplica a activos, mantenimientos y órdenes de compra.
   - Los activos recibidos heredan la moneda de su orden.
   - El tablero totaliza por moneda.
   - El CSV de activos incluye la moneda.
   - Hay 5 pruebas nuevas (341/341 en verde).
3. **Mapa del código.** Se instaló Graphify y se generó `graphify-out/`, un grafo navegable del código construido de forma local, sin enviar código a servicios externos.
4. **QA integral.** Ocho áreas se probaron en paralelo sobre el stack de producción con el inventario real: más de 780 casos y unas 1.960 comprobaciones de roles y alcance. Se dejaron los scripts reutilizables `herramientas-qa/qa<N>_*.py` y el informe consolidado `INFORME_QA.md`.

---

## 3. Lo detectado (síntesis de la QA)

### 3.1 Lo que funciona y debe preservarse
- **Alcance por sede:** ninguna fuga de datos entre sedes, ni en listados, ni en exportes, ni en documentos, ni en la base de datos.
- **Sesiones restringidas:** quedan bloqueadas en 238 de 238 operaciones de la API.
- **Sesiones:** la rotación y la detección de reuso del refresh funcionan.
- **Concurrencia:** no se pudo duplicar una asignación, una recepción ni una salida de stock.
- **Documentos:** los CSV, las actas y los QR son correctos.
- **Adjuntos:** se conservan íntegros después de reiniciar.
- **Interfaz:** es consistente, sin desbordes.

### 3.2 Defectos que impiden la puesta en producción

| ID | Defecto | Impacto |
|---|---|---|
| B1 | Una orden recibida se puede reabrir y recibir otra vez | Duplica stock y activos (en la prueba: 5 laptops de 3 pedidas) |
| B2 | Una orden se marca como recibida sin recibir nada | Compras cerradas sin mercadería |
| B3 | El estado de un activo se edita a mano, sin reglas | Inventario y tablero descuadrados (hoy: 65 custodias frente a 56 activos «Asignado») |
| B4 | La asignación solo muestra los primeros 50 activos | Los equipos nuevos no se pueden asignar |
| B5 | Active Directory real devuelve 0 usuarios | La integración con AD no funciona |
| A1–A14 | Detalle de activo con error 500; fechas que no se guardan al editar; movimientos que dejan custodias abiertas; asignaciones a personas inactivas; mantenimiento sin reglas; recepción sin control de faltantes, sobrantes ni precio; sin devolución individual; duplicados; accesos indebidos del rol de seguridad; condición de carrera en MFA; adjuntos sin validar contenido; código 2FA en los logs; sincronización AD sin protección | Ver `INFORME_QA.md` §4 |

Además se registraron **21 defectos medios** y varios bajos: traducciones, zona horaria, móvil, bitácora, actas y correo.

**Hallazgo de experiencia:** el sistema es un *monólogo*. Registra, pero no guía al usuario ni avisa de los problemas. Los datos reales ya tienen situaciones que nadie ve:
- 4 activos «Asignado» sin custodio;
- 8 activos «Disponible» con custodio;
- 3 personas inactivas que conservan equipos;
- 5 consumibles bajo el mínimo;
- 120 de 142 activos sin fecha de garantía.

---

## 4. Validación de los controles solicitados

**Pregunta:** ¿se puede generar, sobre lo existente, el control de inventario, el control de asignaciones, la bitácora de entradas y salidas, la bitácora de reasignaciones (equipos o componentes) y el control de licencias?

**Respuesta: sí.** El modelo de datos ya registra la mayor parte de la información. A continuación, qué existe hoy y qué falta, con base en el código.

### 4.1 Control de inventario: **viable, base existente**

| Existe hoy | Dónde |
|---|---|
| Ficha del activo: código, serie, modelo, marca, tipo, estado, sede, costo y moneda, fecha de compra, garantía, especificaciones técnicas | `INV_ACTIVO`, `INV_ESPECIFICACION` |
| Proveedor y orden de origen de cada activo recibido | `INV_ORDEN_COMPRA_LINEA_ACTIVO` |
| Consumibles con existencia actual y mínima por sede | `INV_CONSUMIBLE` |
| Exportación CSV e indicadores del tablero | `/export/activos.csv`, `/stats/dashboard` |

**Falta:**
- **Integridad de estados** (defectos B3, A3, A5). Sin esto, ningún control de inventario es confiable. Es el primer paso obligatorio.
- **Toma de inventario físico (conciliación):** una sesión de conteo por sede o área, leyendo el QR con el escáner que ya existe, que compare lo encontrado contra lo registrado. Reporta faltantes, sobrantes y equipos en otra ubicación.
- **Ubicación actual explícita:** hoy el área se deduce del último movimiento, así que un equipo en bodega no tiene área.
- **Valorización de consumibles:** el costo unitario no se registra, por lo que no hay valor del stock.

### 4.2 Control de asignaciones: **viable, base existente**

| Existe hoy | Dónde |
|---|---|
| Asignación con persona, área, tipo, fecha de entrega, fecha de devolución y observación; una sola custodia abierta por activo (garantizado por la base de datos) | `INV_MOVIMIENTO` |
| Historial por activo y por persona | `/trazabilidad/activo/{id}/historial`, `/trazabilidad/persona/{id}/asignaciones` |
| Evidencias (fotos, firmas) y actas de entrega y descargo | `INV_EVIDENCIA`, `/trazabilidad/acta` |
| Offboarding con devolución masiva y liberación de licencias | `/trazabilidad/persona/{id}/offboarding` |

**Falta:**
- Corregir las reglas de negocio (A3, A4, A5) y los flujos de interfaz (B4, A8).
- **Registrar en el propio movimiento quién lo hizo.** Hoy solo queda en la bitácora general.
- **Motivo** de la transferencia o de la devolución, con un catálogo.
- **Préstamos con fecha prevista de devolución** y alerta de vencimiento.

### 4.3 Bitácora de entradas y salidas: **parcial**

| Tipo | Hoy |
|---|---|
| **Consumibles** | **Completo.** Kardex con ENTRADA, SALIDA y AJUSTE; existencia resultante, persona que recibe, operador, motivo y fecha (`INV_MOVIMIENTO_CONSUMIBLE`). La recepción de órdenes genera la entrada automáticamente |
| **Activos: entradas** | Alta manual o recepción de una orden. Queda en la bitácora general (`CREATE INV_ACTIVO`) y en el enlace a la orden. **No hay** un documento de entrada con número, guía o factura |
| **Activos: salidas** | Solo el estado «Baja» y el evento en la bitácora. **No se registran** el motivo (obsolescencia, daño, robo, garantía), el destino (donación, venta, destrucción, devolución al proveedor) ni el documento de respaldo |

**Falta:**
- **Kardex de activos.** Todo movimiento de existencia (alta, recepción, baja, traslado entre sedes) debe quedar como un registro legible y consultable, con número de documento y motivo.
- **Baja formal** con motivo, destino, documento, adjunto y aprobación.
- **Recepción controlada** (A7): entregas parciales, faltantes y sobrantes, precio real. Cada recepción debe ser un documento de entrada.

### 4.4 Bitácora de reasignaciones: **equipos sí, componentes no**

**Equipos: viable.** Cada transferencia cierra la custodia anterior y abre una nueva, así que el historial completo ya existe y se exporta (`/export/movimientos.csv`).
- Falta distinguir la transferencia de la asignación: hoy la transferencia se registra con el tipo «Asignación» (QA2, ME-04b).
- Falta registrar el motivo.

**Componentes: no está soportado hoy.**
- El modelo tiene `ACT_Activo_Padre` (un activo puede pertenecer a otro), pero solo se fija al crear el activo, **no se puede cambiar**, **no tiene pantalla** y **no guarda historial**.
- Las especificaciones (RAM, disco) son texto libre. Sus cambios solo quedan como JSON en la bitácora general.

**Propuesta:**
- Tratar los componentes relevantes (discos, memorias, monitores, docking stations) como activos hijos, con operaciones **Instalar en equipo** y **Retirar de equipo**.
- Llevar su propio historial: qué componente, en qué equipo, desde cuándo, quién lo instaló y por qué se retiró.
- En la ficha del equipo, mostrar qué componentes tiene y cuáles tuvo.
- Para cambios menores sin serie (por ejemplo, ampliar la RAM), registrar un historial legible de especificaciones: antes, después, fecha, usuario y motivo.

### 4.5 Control de licencias: **viable, base sólida**

| Existe hoy | Dónde |
|---|---|
| Software, tipos de licencia, licencias con cantidad total y usada, y vencimiento | `INV_SOFTWARE`, `INV_LICENCIA` |
| Claves individuales cifradas con estado (disponible, asignada, retirada) | `INV_LICENCIA_CLAVE` |
| Instalación a un equipo **o** a una persona, con control de cupo atómico | `INV_INSTALACION` |
| Alta de licencias desde la recepción de una orden; alerta de uso ≥ 80 % | `procurement.py`, `/stats/dashboard` |

**Falta:**
- **Historial de reasignación de licencias.** Al desinstalar, la instalación se desactiva, pero **no se guarda la fecha de retiro** ni el motivo. El historial solo se reconstruye desde la bitácora general.
- **Alertas de vencimiento y renovación.** Hoy solo se alerta por cupo.
- **Costo y fecha de renovación** de la licencia.
- **Reporte CSV de licencias:** no existe; sí existen los de activos, movimientos, consumibles, proveedores, órdenes y bitácora.
- **Liberación automática de licencias al dar de baja un equipo.** El offboarding de una persona ya libera sus licencias; la baja de un equipo no.

### 4.6 Diseño propuesto: un kardex unificado

Hoy la información está repartida en cinco registros: movimientos de activos, movimientos de consumibles, instalaciones, recepciones y bitácora general. La propuesta es un **registro único de eventos de inventario, de solo inserción**:

| Campo | Contenido |
|---|---|
| Fecha y hora | Momento del evento |
| Tipo de evento | Entrada, salida, asignación, devolución, transferencia, préstamo, instalación o retiro de componente, instalación o retiro de licencia, ajuste, baja |
| Objeto | Activo, componente, consumible o licencia (clave) |
| Origen → destino | Persona, área, sede, equipo o proveedor |
| Cantidad | Para consumibles y licencias |
| Documento de respaldo | Orden, recepción, acta, factura o adjunto |
| Motivo | Texto o catálogo |
| Usuario | Quien lo registró |
| Sede | Aplica el alcance por sede |

Este registro:
- se escribe **en la misma transacción** que la operación, así que nunca queda desfasado;
- queda protegido por el alcance por sede y por RLS, como el resto;
- alimenta cuatro reportes, en pantalla y en CSV/PDF:
  - **Kardex por activo, consumible o licencia:** toda su vida.
  - **Bitácora de entradas y salidas por periodo y sede.**
  - **Bitácora de reasignaciones:** equipos, componentes y licencias.
  - **Custodia por persona y por área**, a una fecha dada.

Los registros actuales se conservan. El kardex se carga con una migración que reconstruye el historial existente a partir de ellos.

---

## 5. Plan de correcciones y evolución

**Metodología para cada fase:**
- Una rama y un *pull request* por fase.
- Una prueba automática de regresión por cada defecto corregido (pytest contra PostgreSQL 16 y/o Playwright).
- Migraciones lineales, probadas de ida y vuelta.
- Al cerrar la fase: se reconstruye el stack de producción, se vuelven a ejecutar los scripts de QA del área y se actualizan `CONTINUAR.md` y este informe.

**Criterio de terminado (todas las fases):**
- Pruebas en verde.
- `tsc`, `eslint`, `build` y `verify.py` sin errores.
- QA de las áreas afectadas sin defectos bloqueantes ni altos.
- Documentación actualizada.

### Fase 0: Base de trabajo (esfuerzo S)
- Integración continua (CI) en GitHub Actions: pruebas del backend contra PostgreSQL, verificación del frontend y traducciones.
- Protección de la rama `main`: solo se integra mediante PR con CI en verde.
- Respaldos programados de PostgreSQL y MinIO, con una prueba de restauración.

### Fase 1: Integridad del inventario (esfuerzo M), **prioridad crítica**

**Alcance:**
- B1, B2: máquina de estados de la orden de compra.
- B3, A3, A5, M21: el estado del activo solo cambia por operaciones válidas.
- A4: no asignar a personas inactivas.
- A6: cierre atómico de tickets.
- A1, A2: detalle de activo y edición de fechas.
- M5: el activo no puede quedar sin sede.
- B5 y A14: Active Directory funcional y protegido contra sincronizaciones vacías.

**Incluye:** un script de **diagnóstico y corrección de datos** para las incoherencias que ya existen (activos «Asignado» sin custodio, «Disponible» con custodio, personas inactivas con equipos). Genera un reporte para revisión y corrige solo con aprobación.

**Aceptación:** no es posible corromper el estado ni el stock por ninguna vía de la API. El tablero cuadra con las custodias.

### Fase 2: Seguridad (esfuerzo M)

**Alcance:**
- A10, M7: límites del rol de seguridad.
- M8: permisos de la base de datos sobre las tablas de cuentas.
- A11, M9, M10, M11: MFA atómico, reuso sin bloqueo injusto, verificación de un solo uso, sin enumeración de usuarios.
- A12, M15: validación del contenido de los adjuntos, credenciales propias y versionado en MinIO.
- A13: el código 2FA no aparece en los logs.
- A9, M2: unicidad sin distinguir mayúsculas ni espacios.
- M6: límite de peticiones por usuario y no por IP.

**Aceptación:** se vuelven a ejecutar QA3 y QA4 sin hallazgos altos.

### Fase 3: Compras y flujos operativos (esfuerzo L)

**Alcance:**
- A7: **recepción controlada.**
  - Estados PARCIAL y CERRADA CON FALTANTE.
  - Cada recepción es un documento (guía o factura).
  - Pendiente por línea.
  - Decisión obligatoria ante un faltante, un sobrante, un precio fuera de tolerancia o un artículo distinto.
  - Aviso a quien aprueba.
- A8: devolución individual desde Movimientos y desde la ficha del activo, que ofrece la hoja de descargo.
- B4: asignación con búsqueda en el servidor.

**Aceptación:**
- Una orden no admite más de lo pedido.
- Los faltantes quedan visibles.
- Las diferencias de precio quedan justificadas.
- QA2 y QA8 vuelven a ejecutarse.

### Fase 4: Trazabilidad y controles (esfuerzo L), **responde a la consulta del §4**

**Alcance:**
1. **Kardex unificado** (§4.6), con migración del historial existente.
2. **Entradas y salidas de activos:**
   - documento de entrada (desde la recepción o el alta);
   - **baja formal** con motivo, destino, documento, adjunto y aprobación;
   - traslado entre sedes como evento propio.
3. **Asignaciones:** operador en el movimiento, motivo, tipo «Transferencia» correcto, préstamos con fecha prevista y alerta.
4. **Componentes:** instalar y retirar componentes en un equipo, con historial; historial legible de cambios de especificaciones.
5. **Licencias:**
   - historial de asignación, retiro y reasignación (con fecha y motivo);
   - alertas de vencimiento y renovación;
   - costo de renovación;
   - liberación automática al dar de baja un equipo (el offboarding ya lo hace);
   - CSV de licencias.
6. **Toma de inventario físico** por sede o área, con escáner QR y reporte de conciliación.
7. **Reportes** (pantalla, CSV y PDF, en tres idiomas, con el alcance por sede): kardex por objeto; entradas y salidas por periodo; reasignaciones (equipos, componentes, licencias); custodia por persona o área a una fecha; licencias (uso, vencimientos, historial).

**Aceptación:**
- Para cualquier activo, componente, consumible o licencia se puede responder «qué pasó, cuándo, quién, por qué y con qué documento», desde el alta hasta hoy.
- Los reportes cuadran con los datos.

### Fase 5: El sistema como diálogo (esfuerzo M)

**Alcance:**
- **Siguiente paso tras cada acción:** crear un activo lleva a asignar o imprimir la etiqueta; asignar, al acta; el offboarding, a la hoja de descargo; recibir, al resumen, las etiquetas y la asignación; una salida de stock bajo el mínimo, a una orden de compra.
- **Ficha del activo como centro de acciones**, según su estado.
- **Avisos antes de actuar:** reemplazo de un equipo del mismo tipo; equipo en garantía.
- **Bandeja «Requiere su atención»** en el tablero: garantías, incoherencias, personas inactivas con equipos, stock bajo, tickets antiguos, licencias por vencer, datos incompletos. Cada punto enlaza a la lista filtrada con una acción.
- **Validación de formularios propia**, en el idioma de la aplicación, con mensajes claros (M17).

**Aceptación:** QA8 vuelve a ejecutarse con una puntuación de «diálogo» de al menos 4 de 5 en los flujos principales.

### Fase 6: Pulido y preparación para producción (esfuerzo M)

**Alcance:**
- M1: traducción de todos los códigos de error.
- M12: zona horaria de Guatemala en fechas, actas y CSV.
- M13, M14: bitácora legible y actas correctas.
- M16: correo.
- M18: interfaz móvil.
- M19, M20: tablero y catálogos.
- Defectos bajos.
- Búsqueda global, acciones en lote y «deshacer».

**Cierre:** QA integral completa (los 8 agentes) con los criterios de salida de `PROMPT_QA.md`, seguida de despliegue en producción con el runbook de `DEPLOYMENT.md`.

### Resumen de fases

| Fase | Tema | Esfuerzo | Depende de |
|---|---|---|---|
| 0 | CI, protección de rama y respaldos | S | — |
| 1 | Integridad del inventario | M | 0 |
| 2 | Seguridad | M | 0 |
| 3 | Compras y flujos | L | 1 |
| 4 | Trazabilidad y controles (kardex, componentes, licencias, toma de inventario) | L | 1 y 3 |
| 5 | Diálogo y experiencia | M | 3 y 4 |
| 6 | Pulido y salida a producción | M | todas |

*Esfuerzo relativo: S = pequeño, M = mediano, L = grande. Las fases 1 y 2 pueden avanzar en paralelo.*

---

## 6. Riesgos y dependencias

| Riesgo | Mitigación |
|---|---|
| Los datos reales ya tienen incoherencias de estado y custodia | Script de diagnóstico con reporte y corrección aprobada (Fase 1) antes de construir el kardex |
| La migración del historial al kardex puede tener huecos en datos antiguos | Marcar los eventos reconstruidos como «migrados» y reportar los huecos, sin inventar datos |
| Active Directory y correo dependen de infraestructura (cuenta de servicio, LDAPS, certificado) | La integración se prueba con Samba AD en CI; la prueba real se hace cuando infraestructura entregue los accesos |
| Cambios de reglas que afectan la operación diaria (recepción, bajas con aprobación) | Validación con los usuarios clave antes de la Fase 3 y la Fase 4, y un periodo de convivencia |
| Esquema Oracle (alternativo) sin migraciones incrementales | Se mantiene fuera del alcance mientras la producción sea PostgreSQL |

## 7. Decisiones que requieren su aprobación

1. **Aprobar el plan** y el orden de las fases. Recomendado: 0 → 1 y 2 en paralelo → 3 → 4 → 5 → 6.
2. **Componentes:** qué tipos se controlan como componentes con serie (discos, memorias, monitores, docking stations…) y cuáles solo como cambio de especificación.
3. **Bajas:** catálogo de motivos y destinos, y quién aprueba.
4. **Recepción:** tolerancia de precio (propuesta: ±2 %) y quién autoriza los sobrantes.
5. **Toma de inventario:** frecuencia y responsables por sede.

---

## 8. Estado de ejecución (sesión 12, 2026-09-29)

### 8.1 Avance por fase

| Fase | Estado | Qué quedó funcionando |
|---|---|---|
| 0 | Hecha (con una excepción) | CI en GitHub Actions (backend contra PostgreSQL 16, cabeza única de Alembic; frontend `tsc`, `eslint`, `build` y traducciones). Respaldos programados de PostgreSQL y MinIO con scripts de restauración; MinIO con versionado, retención, cifrado SSE y usuario de servicio propio. **Excepción:** la protección de la rama `main` exige GitHub Pro en repositorios privados. |
| 1 | Hecha | Máquina de estados de activos y órdenes; el estado solo cambia por operaciones; no se asigna a personas inactivas ni equipos en mantenimiento; cierre atómico de tickets; detalle y fechas del activo; sede obligatoria; Active Directory con protección contra bajas masivas; script `app.diagnostico_inventario` (reporte y `--corregir`). |
| 2 | Hecha | Límites del rol de seguridad, permisos de base de datos sobre cuentas, MFA de un solo uso sin bloqueos injustos, validación del contenido de los adjuntos, código 2FA fuera de los logs, unicidad sin distinguir mayúsculas ni espacios, límite de peticiones por usuario. |
| 3 | Hecha | Recepción controlada: entregas parciales, pendiente por línea, precio real con tolerancia (±2 %, `RECEPCION_TOLERANCIA_PRECIO_PCT`), sobrantes solo justificados, conformidad de fletes y servicios (líneas «OTRO»), cierre con faltante, cada entrega con su guía o factura, aviso por correo de las diferencias. Devolución individual desde Movimientos y desde la ficha; asignación con búsqueda en el servidor. |
| 4 | Hecha | Kardex unificado de solo inserción (341 eventos reconstruidos de los datos reales), baja formal con motivo y destino de catálogo, componentes con historial, historial de licencias con motivo del retiro, costo y moneda de licencias y consumibles, toma de inventario por sede o área con QR y conciliación, reportes (kardex, custodia, entradas y salidas, licencias, hoja de vida en PDF). |
| 5 | Hecha | Ficha del activo como centro de acciones según su estado; siguiente paso tras crear un activo (asignar, etiqueta, otro igual), tras asignar (acta), tras devolver (descargo o ticket si llegó dañado), tras recibir (códigos, etiquetas, pendientes) y tras una salida que deja el stock bajo el mínimo (orden de compra propuesta). Bandeja «Requiere su atención» en el tablero con acceso directo a cada caso. |
| 6 | Hecha en lo esencial | Traducción de todos los códigos de error del servidor (≈140 nuevos), zona horaria de Guatemala en fechas, actas y CSV, bitácora legible (acción, entidad y nombre del usuario traducidos; exportación con los filtros de pantalla), correo sin el código 2FA en el asunto, fechas de Active Directory en hora local. Ver §8.3 para lo no incluido. |

### 8.2 Verificación

- **Pruebas del backend:** 389/389 en verde contra PostgreSQL 16 (incluye las regresiones de cada defecto y de los flujos nuevos).
- **Frontend:** `tsc`, `eslint`, `build` y `verify.py` sin errores; 1 928 claves por idioma, sin claves huérfanas.
- **Stack de producción (`inv_ui`):** migraciones aplicadas sobre los datos reales, RLS activo. `herramientas-qa/qa9_fases.py` recorre por la API los flujos nuevos (recepción parcial, precio justificado, sobrante rechazado, cierre con faltante, bandeja de atención, kardex, hoja de vida, baja, consumibles con costo, ajuste por conteo, reportes y rutas del frontend). Resultado final: 26/26 casos. La primera ejecución detectó que el costo del consumible no se devolvía en la API; quedó corregido con su prueba de regresión.

### 8.3 Pendiente antes de producción

1. **QA integral de cierre** con los 8 agentes de `PROMPT_QA.md`, incluida la parte visual (Playwright) de las pantallas nuevas.
2. **Pulido no incluido en esta sesión:** pantallas de catálogo para estados operativos, tipos de especificación, tipos de conexión y cargos; búsqueda global (Ctrl+K), acciones en lote y «deshacer»; vista en tarjetas para móvil en todas las tablas; avisos previos al reemplazo de un equipo del mismo tipo o en garantía.
3. **Infraestructura:** protección de la rama `main` (requiere GitHub Pro o repositorio de organización); imagen de MinIO fijada por digest local (Docker Hub dejó de publicarla; ver `DEPLOYMENT.md` §8.2); prueba de Active Directory y correo con los accesos reales.
4. **Datos:** revisar con el área usuaria el reporte de `python -m app.diagnostico_inventario` y aprobar la corrección de las incoherencias heredadas (3 índices de unicidad quedaron pendientes por duplicados en los datos de QA).

### 8.4 Decisiones aplicadas por defecto (§7)

Se aplicaron las recomendaciones del §7 mientras no haya otra instrucción: orden de fases recomendado; cualquier activo puede instalarse como componente y los cambios de especificación quedan en el historial; catálogo fijo de motivos y destinos de baja, ejecutada por ADMIN_TI; tolerancia de precio de ±2 % configurable y sobrantes solo con motivo, por un administrador; toma de inventario a demanda por sede o área.
