# Matriz de control de acceso por rol (RBAC)

> Generado y verificado el 2026-06-05. Fuente de verdad: `app/api/deps.py`
> (`RoleChecker`) y las dependencias declaradas en cada router de
> `app/api/v1/endpoints/`. El router base aplica `Depends(get_current_user)`
> a todos los módulos de negocio (`org`, `geo`, `cat`, `core`, `trazabilidad`,
> `soft`, `mantenimiento`, `consumibles`, `adjuntos`, `compras`, `stats`,
> `export`); `login` y `gov` tienen reglas propias.

## Roles

> Actualizado el 2026-10-02 (rol JEFE_TI y aprobaciones); antes, 2026-09-25 (rol AUDITOR y alcance por sede). Fuente de verdad:
> `app/core/roles.py` y `app/api/deps.py`.

| Rol | Atajos que lo incluyen | Capacidad | Alcance de datos |
|---|---|---|---|
| `SUPER_ADMIN` | todos | Total: configuración, cualquier cuenta, alcance global | Siempre global |
| `ADMIN_SEGURIDAD` | `require_iam`, `require_audit_reader` | Identidades y accesos, bitácora. **Sin inventario** | Siempre global |
| `JEFE_TI` | `require_admin`, `require_operativo`, `require_export`, `require_aprobador` | Lo mismo que ADMIN_TI y, además, **aprueba bajas y sobrantes** solicitados por otra persona; verifica la integridad del kardex | Sus sedes o global |
| `ADMIN_TI` | `require_admin`, `require_operativo`, `require_export` | Inventario completo, catálogos, personas, compras | Sus sedes o global |
| `TECNICO` | `require_operativo` | Operación de campo: activos, asignaciones, mantenimientos | Sus sedes o global |
| `AUDITOR` | `require_business`, `require_audit_reader`, `require_export` | **Solo lectura** del inventario, bitácora y exportaciones | Sus sedes o global |
| `CONSULTA` | `require_business` | **Solo lectura** | Sus sedes o global |

Atajos (`app/api/deps.py`):
- `require_super_admin = ["SUPER_ADMIN"]`
- `require_iam = ["SUPER_ADMIN", "ADMIN_SEGURIDAD"]`
- `require_business = ["SUPER_ADMIN", "JEFE_TI", "ADMIN_TI", "TECNICO", "AUDITOR", "CONSULTA"]` (routers de inventario)
- `require_admin = ["SUPER_ADMIN", "JEFE_TI", "ADMIN_TI"]`
- `require_operativo = ["SUPER_ADMIN", "JEFE_TI", "ADMIN_TI", "TECNICO"]`
- `require_aprobador = ["SUPER_ADMIN", "JEFE_TI"]` (aprobar o rechazar; nunca lo propio)
- `require_audit_reader = ["SUPER_ADMIN", "ADMIN_SEGURIDAD", "AUDITOR"]`
- `require_export = ["SUPER_ADMIN", "JEFE_TI", "ADMIN_TI", "AUDITOR"]`

Reglas de gobierno (`app/core/roles.py`): nadie administra su propia cuenta;
`ADMIN_SEGURIDAD` no gestiona ni otorga `SUPER_ADMIN`/`ADMIN_SEGURIDAD`; **solo un
`SUPER_ADMIN` otorga el alcance global**; una cuenta de inventario debe tener al menos
una sede o alcance global.

## Separación de funciones (aprobaciones)

| Operación | Solicita | Aprueba | Regla |
|---|---|---|---|
| Baja de activo (`POST /core/activos/{id}/baja` → 202) | `require_admin` | `require_aprobador` (`POST /aprobaciones/{id}/aprobar`) | Otra persona; el equipo queda congelado mientras está pendiente |
| Sobrante en una recepción de compra | `require_admin` | `require_aprobador` | Otra persona; el inventario no cambia hasta aprobarse |
| Anular una solicitud pendiente | quien la pidió | — | — |
| Verificar el kardex (`GET /inventario/kardex/verificar`) | `SUPER_ADMIN`, `JEFE_TI`, `AUDITOR` | — | Solo lectura |

`DELETE /core/activos/{id}` ya no da de baja (409 `USE_DECOMMISSION_REQUEST`).
La base también impide que el aprobador sea el solicitante (`ck_aprobacion_otra_persona`).

## Alcance de datos por sede (RLS)

El rol decide **qué operaciones** puede hacer una cuenta; el alcance decide **sobre
qué filas**. Se aplica en dos capas (ver `app/core/data_scope.py` y `app/db/rls.py`):

| Tabla | Visible si… | Escritura |
|---|---|---|
| `INV_ACTIVO`, `INV_ORDEN_COMPRA`, `INV_CONSUMIBLE` | su sede está en el alcance | solo en sedes del alcance |
| `INV_PERSONA` | su sede está en el alcance, o está vinculada a un registro visible (custodia, mantenimiento, instalación, consumo), o es la propia | solo personas de sedes del alcance |
| Movimientos, mantenimientos, especificaciones, instalaciones, adjuntos, evidencias, líneas de compra, movimientos de consumibles | su activo / orden / consumible es visible | ídem; una asignación nueva exige un área de una sede del alcance |
| `INV_AUDITORIA_SISTEMA` | evento de una sede del alcance, o acción propia | solo inserción (nunca UPDATE/DELETE desde peticiones) |
| Catálogos, geografía, departamentos, cargos, software y licencias | siempre (vocabulario compartido) | país/estado/municipio/sede solo con alcance global |

## Invariante verificado

**Cero endpoints mutadores (POST/PUT/PATCH/DELETE) sin guard de rol**, fuera del
autoservicio (`/me/password`, `/login/logout`, `/me/2fa/*`, reset de contraseña),
donde la identidad del propio usuario en el JWT es el control de acceso.
Verificación automatizada incluida en `scripts/check_rbac.py` (escanea los
decoradores y falla si algún mutador carece de `require_*`).

> Nota: `POST /core/activos/search` usa POST por llevar cuerpo de filtros, pero
> es de **lectura**; por diseño solo requiere autenticación.

## Matriz por módulo (operaciones de escritura)

| Módulo (prefijo) | Crear/Editar/Borrar catálogos y maestros | Operación de negocio | Borrado/decomiso | Solo SUPER_ADMIN |
|---|---|---|---|---|
| Catálogos (`/cat`) | `require_admin` | — | `require_admin` | — |
| Ubicación (`/geo`) | `require_admin` | — | `require_admin` | — |
| Organización (`/org`) | `require_admin` (deptos, cargos, personas, usuarios) | — | `require_admin` | — |
| Core inventario (`/core`) | `require_operativo` (activos, especificaciones) | `require_operativo` | **`require_admin`** (baja lógica de activo) | — |
| Trazabilidad (`/trazabilidad`) | `require_admin` (tipos) | `require_operativo` (movimiento, devolución, transferencia, actas) | **`require_admin`** (offboarding) | — |
| Software (`/soft`) | `require_admin` (software, licencias, tipos) | `require_operativo` (instalar/desinstalar) | `require_admin` | — |
| Mantenimiento (`/mantenimiento`) | `require_admin` (tipos) | `require_operativo` (registrar, cerrar, detalles) | `require_admin` | — |
| Consumibles (`/consumibles`) | `require_admin` (alta/edición) | `require_operativo` (entrada/salida de stock) | `require_admin` | — |
| Adjuntos (`/adjuntos`) | `require_operativo` (subir a activo) / `require_admin` (subir a orden) | — | `require_admin` | — |
| Compras (`/compras`) | `require_admin` (proveedores, órdenes) | `require_admin` (recibir, cambiar estado, notificar garantías) | `require_admin` | — |
| Exportación (`/export`) | — (solo GET) | `require_admin` (CSVs) | — | **`require_super_admin`** (`auditoria.csv`) |
| Gobierno (`/gov`) | — | — | — | **`require_super_admin`** (config, auditoría, purga) |

## Lecturas accesibles a `CONSULTA` (cualquier autenticado)

Los siguientes GET no exigen `require_*`, por lo que un usuario `CONSULTA`
(solo lectura) puede consultarlos. **Es una decisión de política de negocio**,
no un defecto: define qué información puede ver el rol de solo-consulta.

| Endpoint | Dato expuesto | ¿Restringir a `require_operativo`? |
|---|---|---|
| `GET /org/personas`, `/org/personas/disponibles` | PII (nombres, emails, teléfonos) | Decisión de negocio |
| `GET /compras/proveedores`, `/compras/ordenes` | Datos comerciales (montos, proveedores) | Decisión de negocio |
| `GET /trazabilidad/movimientos`, `/trazabilidad/persona/{id}/asignaciones` | Historial de asignaciones por persona | Decisión de negocio |
| `GET /consumibles/{id}/movimientos` | Historial de stock | Decisión de negocio |
| `GET /adjuntos/{id}/download` | Descarga de adjuntos (facturas, actas) | Decisión de negocio |

> Maestros y catálogos (`/cat/*`, `/geo/*`, departamentos, cargos) son
> vocabularios controlados y se consideran lectura abierta a cualquier
> autenticado por diseño.
