# Informe de QA integral: InventarioTI

> **Fecha:** 2026-09-28
> **Entorno:** stack de producción `inv_ui` (https://localhost:8443): Caddy TLS → nginx → gunicorn ×4 → PostgreSQL 16 + réplica, Redis y MinIO. Usa el inventario real (142 activos), la migración `c0d1e2f3a4b5` y el RLS activo (`rls.db_layer_active`).
> **Método:** 8 agentes en paralelo, uno por área, que probaron por API (httpx) y por navegador (Playwright). Cada agente creó sus propios datos, con prefijo `QA<N>-`.
> **Informes por área:** `salidas/qa1_informe.md` … `salidas/qa8_informe.md`, con evidencias en `salidas/qa<N>/` y scripts reutilizables `qa<N>_*.py`.

---

## 1. Resumen ejecutivo

**El sistema es sólido en seguridad de datos. Falla en las reglas de negocio y en la experiencia de uso.**

**Lo que está bien:**
- El **alcance por sede no tiene fugas**. Se hicieron más de 1.900 comprobaciones con las 12 combinaciones de rol × alcance, sobre listados, detalle, búsquedas, CSV, actas, etiquetas, tablero, sugerencias y bitácora. Toda escritura fuera del alcance se rechaza, tanto en la aplicación como en PostgreSQL.
- **Sesiones y cuentas:** la sesión restringida bloquea 238 de 238 operaciones, y funcionan la rotación y la detección de reuso del refresh, la política y el historial de contraseñas, las cabeceras de seguridad y las defensas contra inyección SQL/CSV. La bitácora no guarda secretos.
- **Concurrencia:** no se pudo duplicar una asignación, una recepción o una salida de stock con peticiones simultáneas.
- **Documentos:** los CSV salen correctos (BOM, ISO, moneda, sin fórmulas activas) y las actas y los QR están bien.
- **Adjuntos:** se guardan y descargan íntegros (SHA-256) y sobreviven a un reinicio.
- **Diseño:** el diseño visual es consistente, sin desbordes en 180 capturas, y el tono formal se respeta en los 3 idiomas.

**Lo que hay que corregir antes de producción:**
1. **Las compras pueden corromper el inventario.** Una orden recibida se puede reabrir y recibir otra vez; en la prueba entraron 5 laptops cuando se pidieron 3. También se puede marcar como recibida sin recibir nada. Además, la recepción no controla faltantes, sobrantes ni diferencias de precio.
2. **El estado de un activo se edita a mano sin reglas.** Se puede pasar de Baja a Asignado, o dejar un equipo Disponible con custodio. Esto descuadra el tablero: hoy hay 65 custodias abiertas frente a 56 activos en estado Asignado.
3. **Flujos rotos en la interfaz:**
   - La asignación solo ve los primeros 50 activos, así que los equipos nuevos no se pueden asignar.
   - No existe una devolución individual.
   - El detalle de activo por id responde con error 500.
4. **Active Directory no funciona contra un AD real:** lee 0 usuarios. Si alguien corrige ese error sin añadir protección, la primera sincronización con un filtro mal configurado desactivaría a todas las personas vinculadas.
5. **El sistema es un monólogo.** Cada acción termina en un mensaje breve y nada propone el paso siguiente ni avisa de problemas. Los datos reales ya tienen situaciones que nadie ve:
   - 4 activos «Asignado» sin custodio;
   - 8 activos «Disponible» con custodio;
   - 3 personas inactivas que aún tienen equipos;
   - 5 consumibles bajo el mínimo;
   - 120 de 142 activos sin fecha de garantía.

**Criterios de salida (`PROMPT_QA.md`): NO se cumplen.** Hay 5 defectos bloqueantes y 14 altos abiertos.

---

## 2. Resultados por área

| # | Área | Casos | OK | Bloq. | Alta | Media | Baja/Obs. |
|---|---|---|---|---|---|---|---|
| 1 | CRUD completo | 204 | 137 | 0 | 6 | 23 | 38 |
| 2 | Lógica de negocio | 92 | 51 | 5 | 14 | 8 | 14 |
| 3 | Roles y alcance (RLS) | ~1.960 comprobaciones | 99 % | 0 | 2 | 2 | 6 |
| 4 | Seguridad e identidades | 123 | 100 | 0 | 2 | 3 | 2 + 15 obs. |
| 5 | Reportes y documentos | 126 | 105 | 0 | 0 | 5 | 2 + 5 obs. |
| 6 | Adjuntos y MinIO | 69 | 55 | 0 | 1 | 4 | 5 |
| 7 | Correo y Active Directory | 41 (2 no ejecutados por B5) | 20 | 1 | 2 | 5 | 6 + 3 obs. |
| 8 | Interfaz y experiencia | 20 rutas × 3 tamaños × 3 idiomas + 25 diálogos | — | 1 | 3 | 9 | 10 |

Muchos defectos se repiten entre áreas. Por ejemplo, el error 500 del detalle de activo lo reportaron QA1, QA2, QA3 y QA4. La lista de la §4 está consolidada y sin duplicados.

## 3. Matriz de cobertura (módulo × tipo de prueba)

| Módulo | CRUD / API | Reglas de negocio | Alcance y roles | Seguridad | Documentos | UI / UX | Concurrencia |
|---|---|---|---|---|---|---|---|
| Catálogos | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |
| Ubicaciones | ✅ | ✅ | ✅ | — | — | ✅ | — |
| Organización / personas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Activos y especificaciones | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Movimientos / offboarding | ✅ | ✅ | ✅ | — | ✅ | ✅ (parcial, por B4) | ✅ |
| Mantenimiento | ✅ | ✅ | ✅ | — | — | ✅ | ✅ |
| Software y licencias | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |
| Consumibles y stock | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Compras y recepción | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Adjuntos | ✅ | — | ✅ | ✅ | — | ✅ | — |
| Usuarios / IAM / sesiones | ✅ | — | ✅ | ✅ | — | ✅ | ✅ |
| Bitácora | — | — | ✅ | ✅ | ✅ | ✅ | — |
| Correo / AD | ✅ | ✅ | — | ✅ | ✅ (plantillas) | ✅ | — |
| Tablero | — | ✅ | ✅ | — | — | ✅ | — |

**No evaluado:**
- Sincronización con AD de punta a punta: la bloquea B5.
- Transferencia desde la UI: la bloquea B4.
- Tablet en los diálogos.
- Roles TÉCNICO y AUDITOR en la revisión de UX.

---

## 4. Defectos consolidados

Formato de cada entrada: **ID · qué pasa** (áreas que lo detectaron) → causa → corrección. El detalle y la evidencia están en el informe de cada área.

### Bloqueantes

- **B1 · Una orden RECIBIDA se reabre y se recibe dos veces; el stock y los activos se duplican** (QA1, QA2).
  - Causa: `services/procurement.py:151-159`. `cambiar_estado` acepta cualquier transición, y la recepción no descuenta lo ya recibido.
  - Corrección: definir una máquina de estados para la orden (RECIBIDA y CANCELADA son estados finales) y validar cada recepción contra lo pendiente acumulado.
- **B2 · Una orden queda RECIBIDA sin recibir nada**: por `PATCH /estado`, por `POST /recibir {}` o desde la UI con todas las líneas en «Ignorar» (QA2, QA8).
  - Corrección: prohibir RECIBIDA por PATCH, responder 400 `EMPTY_RECEIPT` y pedir confirmación en la UI.
- **B3 · El estado del activo se cambia con un `PATCH` sin validar la máquina de estados ni la custodia** (QA2).
  - Causa: `services/core.py:122-125`.
  - Corrección: el estado solo cambia por movimientos, mantenimiento o baja. Hay que quitar `EOP_Estado_Operativo` de `ActivoUpdate` o validarlo con `AssetStateMachine`.
- **B4 · El diálogo de asignación solo carga 50 activos**: los nuevos no se pueden asignar (QA8).
  - Causa: `movementService.ts:60` llama a `GET /core/activos` sin `limit`.
  - Corrección: buscar en el servidor mientras se escribe.
- **B5 · Active Directory real devuelve 0 usuarios y 0 grupos** (QA7).
  - Causa: `integrations/active_directory.py:99-103`. `_first()` exige `dict` y ldap3 entrega `CaseInsensitiveDict`.
  - Corrección: usar `collections.abc.Mapping` y añadir una prueba de integración con Samba AD.

### Altos

- **A1 · `GET /core/activos/{id}` responde 500 a todos** (QA1, QA2, QA3, QA4).
  - Causa: `services/core.py:168` usa `get_or_404` sin carga previa de relaciones.
  - Corrección: usar `repo.get_by_id` y añadir un test.
- **A2 · Al editar un activo se pierden la fecha de compra y la de garantía, aunque la UI dice «actualizado»** (QA1, QA2).
  - Causa: `ActivoUpdate` no declara esos campos (`schemas/core.py:95`).
- **A3 · `/movimientos` con tipo Devolución, Baja, Ingreso o personalizado deja custodias abiertas** (QA2).
  - Causa: `traceability.py:253-291`.
  - Corrección: aceptar solo Asignación, Préstamo y Transferencia.
- **A4 · Se asigna o transfiere a personas inactivas u offboardeadas** (QA2).
  - Corrección: responder 400 `PERSON_INACTIVE`.
- **A5 · Mantenimiento sin reglas de estado** (QA2): un activo con ticket abierto se devuelve y se reasigna; abrir un ticket no valida la transición; cerrarlo «resucita» activos dados de baja; la baja no revisa tickets abiertos.
  - Causa: `maintenance.py:127-132` y `:271-279`, y `traceability.py:554-571`.
- **A6 · Dos cierres simultáneos del mismo ticket responden los dos 200** (QA2).
  - Corrección: `UPDATE … WHERE MAN_Fecha_Cierre IS NULL` comprobando `rowcount`.
- **A7 · La recepción de compras no controla diferencias** (QA2, QA8):
  - la recepción parcial deja la orden RECIBIDA sin registrar el faltante y no permite completarla después;
  - un precio distinto se acepta sin aviso;
  - una línea puede sumar stock a otro consumible;
  - se puede cancelar una orden ya recibida;
  - la UI exige todas las series, así que no se puede registrar una entrega parcial.

  Ver la propuesta en la §5.
- **A8 · No hay devolución individual en la UI**, aunque el backend tiene `POST /trazabilidad/devolucion` (QA8).
- **A9 · Se aceptan duplicados que solo cambian mayúsculas o espacios**: correo de persona (rompe AD y avisos), serie, marca, consumible, y modelo repetido en la misma marca (QA1).
- **A10 · ADMIN_SEGURIDAD ve el inventario de todas las sedes** por `/org/departamentos/{id}/detalle` y `/org/personas/{id}/contexto` (QA3, QA4).
  - Causa: el router `/org` no exige `require_business`.
- **A11 · El anti-replay de TOTP tiene una condición de carrera**: 4 verificaciones simultáneas con el mismo código abren 4 sesiones (QA4).
  - Causa: `twofactor.py:152-160`.
  - Corrección: un `UPDATE` condicional y atómico.
- **A12 · Los adjuntos no se validan por contenido y se sirven con el MIME que envía el cliente** (QA4, QA6). Se aceptan un `.exe` renombrado a `.pdf` y un HTML o SVG con script guardado como imagen.
  - Corrección: verificar los magic bytes y derivar el MIME en el servidor.
- **A13 · El código 2FA por correo queda en claro en los logs**, porque va en el asunto y el asunto se registra (QA7).
  - Causa: `email.py:367,554,579,659`.
- **A14 · Una sincronización AD que devuelve 0 usuarios (o muy pocos) desactivaría a todas las personas vinculadas sin avisar** (QA7).
  - Causa: `directory_sync.py:209-213`.
  - Corrección: abortar o pedir confirmación si hay 0 resultados o si las bajas superan un umbral.

### Medios

| ID | Defecto | Áreas |
|---|---|---|
| M1 | Unos 50 códigos de error sin traducir: el usuario solo ve «No se pudo guardar» u «Ocurrió un error inesperado» (borrados con dependencias, `*_NOT_FOUND`, licencias en uso, AD…) | QA1, QA7, QA8 |
| M2 | Los duplicados que frena la base de datos muestran el mensaje genérico de integridad; se aceptan nombres formados solo por espacios | QA1 |
| M3 | Errores 500 por cotas que faltan (`ACT_Costo` al editar, `OCL_Precio_Unitario`, `ARE_Tipo_Acceso`); con 3 decimales la API guarda el valor y aun así responde 500 | QA1 |
| M4 | Borrar un tipo de conexión en uso lo borra de todas formas (FK `SET NULL`) | QA1 |
| M5 | Un activo se queda sin sede si se edita con el campo vacío, y deja de verse para las cuentas por sede | QA1 |
| M6 | El límite de peticiones es por IP y, detrás del proxy, toda la oficina comparte la misma: la pantalla de Activos quedó vacía sin explicación | QA1, QA4, QA6 |
| M7 | ADMIN_SEGURIDAD puede convertir en ADMIN_TI una cuenta que ya tenía alcance global, y esta lo conserva | QA3 |
| M8 | El rol restringido `inventario_rls` puede modificar `INV_USUARIO` e `INV_USUARIO_SEDE`: una inyección SQL podría darse alcance global | QA3 |
| M9 | Reusar un TOTP válido cuenta para el bloqueo, y el contador no se reinicia cuando expira el bloqueo: un solo fallo vuelve a bloquear (fue lo que bloqueó a `sa` durante esta QA) | QA4, QA8 |
| M10 | El paso de verificación 2FA de un inicio de sesión se puede completar dos veces y sigue sirviendo tras cambiar la contraseña | QA4 |
| M11 | Una cuenta bloqueada responde distinto (429) que una inexistente (400), lo que permite saber si un usuario existe | QA4 |
| M12 | **Zona horaria:** horas en UTC sin indicarlo en CSV y actas; el acta sale con el día siguiente pasadas las 18:00; en órdenes, «hoy» es mañana; las horas de AD aparecen con 6 horas de adelanto | QA5, QA7, QA8 |
| M13 | **Bitácora:** acciones sin traducir en el CSV, UUID y nombres de tabla en pantalla, y la exportación ignora los filtros | QA5, QA8 |
| M14 | **Actas:** el acta regenerada lleva la fecha de hoy y no la de la entrega; se genera una hoja de descargo de un equipo que sigue asignado | QA5 |
| M15 | **Adjuntos (UI y almacenamiento):** con más de 20 MB solo sale «error inesperado»; los botones Subir y Eliminar se ven sin tener permiso; MinIO no tiene versionado, cifrado ni respaldo, y el backend usa las credenciales root | QA6 |
| M16 | **Correo:** los correos retenidos no salen al reanudar; los eventos «solo admins» no llegan a nadie y la ayuda describe mal quién recibe la copia; los apellidos con partículas («De la Cruz») se parten mal; los errores de AD se muestran en lenguaje técnico | QA7 |
| M17 | **Formularios:** la validación nativa sale en inglés; hay mensajes que nombran otro campo; el login dice «Credenciales incorrectas» también cuando la cuenta está bloqueada | QA8 |
| M18 | **Móvil:** las tablas de Activos y Movimientos esconden columnas; la orden de compra no se puede leer | QA8 |
| M19 | Los tipos de mantenimiento no se traducen; la salida de stock no avisa cuando se baja del mínimo | QA8 |
| M20 | **Tablero:** «asignados» cuenta custodias y «stock» incluye Baja y Reparación; las garantías se cortan en 50; los KPIs de licencias son globales para todas las cuentas | QA2, QA3 |
| M21 | **Otras reglas de estado:** el alta acepta cualquier estado; la baja no valida la transición; el offboarding manda a bodega equipos que están en reparación; el cierre de un ticket acepta una fecha futura | QA2 |

### Bajos y observaciones (resumen)
- **Formatos y validaciones:** formatos libres (prefijo, ISO, teléfono); ciclo de jefatura A↔B; orden sin líneas o a un proveedor inactivo; fechas muy futuras; NIT repetido (QA1).
- **Seguridad:** OTP por correo guardado con SHA-256 sin sal; el login no envía `Cache-Control: no-store` (QA4).
- **Descargas y documentos:** los nombres de archivo descargados desde la UI no siguen el idioma; un lote de actas con movimientos repetidos duplica filas (QA5).
- **Adjuntos:** el nombre original no se sanea (`../`, se trunca y pierde la extensión); falta `accept` en el selector; al borrar no hay aviso de éxito (QA6).
- **Correo:** asuntos sin tildes; la parte de texto plano está vacía; costos y fechas sin formato; queda un tuteo («si sincronizas ahora») (QA7).
- **Interfaz:** las confirmaciones no nombran el elemento; títulos inconsistentes («Nuevo»/«Crear»/«Registrar»); colores fijos en el tablero; faltan pantallas para estados, tipos de especificación, tipos de conexión y cargos (QA1, QA8).
- **Herramienta de QA:** `shots.py` usa la clave de idioma `i18nextLng`, pero la aplicación usa `app_language`, así que sus capturas «EN/IT» salen en español.

---

## 5. Hallazgo funcional: control de la recepción de compras de TI

**Hoy:**

| Pregunta | Respuesta |
|---|---|
| ¿Compara lo recibido con lo pedido? | Solo dentro de una misma petición. |
| ¿Registra el faltante de una entrega parcial? | No. |
| ¿Permite completar una entrega parcial después? | No. |
| ¿Impide recibir dos veces? | No: basta reabrir la orden. |
| ¿Avisa si cambia el precio? | No. |
| ¿Comprueba que se recibe el artículo de la línea? | No. |

**Propuesta (QA2 §2, QA8 P1):**
1. **Estados de la orden:** BORRADOR → PARCIAL → RECIBIDA / CERRADA_CON_FALTANTE / CANCELADA. Solo `/recibir` lleva a PARCIAL o RECIBIDA, y los estados finales no se reabren.
2. **Recepciones como documentos:** `INV_RECEPCION` guarda fecha, usuario, guía o factura; `INV_RECEPCION_LINEA` guarda cantidad y precio real. Por cada línea, `pendiente = pedido − Σ recibido`, y una orden puede recibirse en varias entregas sin superar nunca lo pedido.
3. **Diferencias que piden una decisión, con motivo y registro en la bitácora:**
   - **Faltante:** la orden queda PARCIAL o se cierra con faltante, y se avisa a quien aprueba.
   - **Sobrante:** se rechaza, o se acepta con permiso y motivo.
   - **Precio fuera de tolerancia:** se exige justificación; la tolerancia es configurable (por ejemplo ±2 %).
   - **Artículo distinto al de la línea:** se rechaza, salvo sustitución explícita.
4. **UI:** tabla «pedido / recibido / pendiente / diferencia de precio», el diálogo precargado con lo pendiente, y un resumen al confirmar que dice qué se creó y qué falta, con acciones para imprimir etiquetas y asignar.
5. **Tablero:** órdenes con faltante y diferencias de precio por moneda.

## 6. Hallazgos de experiencia: de monólogo a diálogo (QA8 §c)

- **Después de cada acción, el siguiente paso lógico:**

  | Acción | Siguiente paso propuesto |
  |---|---|
  | Crear un activo | Asignar, imprimir la etiqueta o registrar otro igual |
  | Asignar | Descargar el acta, o asignar otro activo a la misma persona |
  | Offboarding | Descargar la hoja de descargo |
  | Recibir una orden | Ver el resumen, imprimir las etiquetas y asignar |
  | Salida de stock bajo el mínimo | Crear una orden de compra con el último proveedor |

- **Detalle del activo como centro de acciones:** mostrar custodio, días en custodia, garantía restante y tickets abiertos, con la acción principal según el estado (Disponible → Asignar; Asignado → Devolver).
- **Avisar antes de actuar:** «Esta persona ya tiene una laptop, ¿es un reemplazo?» y «El equipo está en garantía, el servicio puede estar cubierto».
- **Bandeja «Requiere su atención» en el tablero:** garantías, incoherencias de estado, personas inactivas con equipos, stock bajo el mínimo, tickets abiertos por mucho tiempo y datos incompletos. Cada punto enlaza a la lista filtrada, con una acción para corregir.
- **Automatizaciones:**
  - búsqueda global (Ctrl+K);
  - acciones en lote;
  - «Deshacer» durante 10 segundos;
  - escáner que propone la acción según el estado del activo;
  - alta en ráfaga (varios activos iguales, cambiando solo la serie).

---

## 7. Plan de corrección propuesto (requiere su aprobación)

| Ola | Contenido | Resultado |
|---|---|---|
| **1. Integridad** | B1–B5, A1–A6, A14, M5, M21 | El inventario ya no se puede corromper y AD funciona de forma segura |
| **2. Seguridad** | A10–A13, M7–M11, A9 (duplicados) | Se cierran las brechas de IAM, MFA, adjuntos y logs |
| **3. Compras y flujos** | A7 (§5), A8, B4 en su versión completa (búsqueda en el servidor), M6 | La recepción controla faltantes, sobrantes y precios; hay devolución individual; la asignación es usable |
| **4. Diálogo** | §6: siguiente paso, bandeja «Requiere su atención», avisos proactivos, M17 | El sistema guía al usuario y avisa de los problemas |
| **5. Pulido** | M1–M4, M12–M20 y bajos | Traducciones, fechas locales, móvil, bitácora y actas |

Cada defecto corregido llevará un test de regresión (pytest contra PostgreSQL y/o Playwright). Al cerrar cada ola se reconstruirá el stack de producción y se volverán a ejecutar los scripts `qa<N>_*.py`.

## 8. Incidencias del entorno durante la QA
- La cuenta `sa` se bloqueó entre las 18:22 y las 18:37 UTC. Varios agentes enviaban el mismo código TOTP a la vez, y la primera versión de `qa_login.py` reintentaba. Ya está corregido: los inicios de sesión se turnan entre procesos y nunca se reintentan. De ahí salieron los hallazgos M9 y A11.
- Los agentes se detuvieron dos veces por el límite de uso y se reanudaron sin perder trabajo.
- QA6 reinició una vez `inv_ui-backend-1` e `inv_ui-minio-1` para la prueba de persistencia, con aviso previo a los demás agentes.
- Los datos de prueba `QA1-` … `QA8-` siguen en el stack `inv_ui`, que es solo de revisión. Para volver a partir de cero: `docker compose -p inv_ui --env-file herramientas-qa/revision.env down -v` y luego `python herramientas-qa/levantar_revision.py`.
- Algunos archivos de `salidas/` guardan claves y secretos TOTP de las cuentas de prueba (`credenciales_qa.json`, `qa4/cuentas.json`…). `salidas/` está excluida de git.
