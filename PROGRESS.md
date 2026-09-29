# InventarioTI — Bitácora de Desarrollo

> Última actualización: 2026-09-28 (sesión 11)
> Stack: FastAPI + Python async · React 19 + TypeScript · PostgreSQL 16 · Redis · Docker

---

## 1. Contexto del Sistema

Sistema de administración de activos TI para Lombardi. Arquitectura en 4 capas:

```
[React/TypeScript SPA]
        ↕  REST/JSON
[FastAPI — Endpoints]  →  [Services]  →  [Repositories]  →  [SQLAlchemy Models / PostgreSQL]
```

Módulos funcionales: Activos · Personas · Movimientos · Mantenimiento · Compras · Software · Consumibles · Ubicaciones · Catálogos · Auditoría · Configuración · Scanner · Exportación · Labels · SSO · 2FA

---

## 2. Lo que se Consideró y Trabajó

### 2.1 Sesión 1 — Validación y Refactorización Core

**Problemas identificados:**

| # | Problema | Archivo |
|---|---|---|
| 1 | `AssetStateMachine` importaba `HTTPException` de FastAPI (dominio dependía del framework) | `services/state_machine.py` |
| 2 | `CoreRepository.list_especificaciones()` retornaba `list[dict]` sin tipo | `repositories/core.py` |
| 3 | `CoreService.delete_activo()` mezclaba lógica de negocio + notificaciones (violación SRP) | `services/core.py` |
| 4 | `AssetsPage` cargaba 200 activos hardcoded y filtraba en cliente | `features/assets/AssetsPage.tsx` |
| 5 | `ActivoDetailResponse: pass` — schema de detalle vacío | `schemas/core.py` |
| 6 | `estadoColor()` comparaba strings en español hardcodeados | `AssetsPage.tsx` |
| 7 | Falta índice parcial en `INV_MOVIMIENTO(ACT_Activo) WHERE fecha_devolucion IS NULL` | DB |
| 8 | `Base.id: Any` — campo nunca usado en ningún modelo | `db/base.py` |

**Cambios implementados:**

- `app/core/errors.py` — jerarquía de excepciones: `DomainError` → `InvalidStateTransitionError`
- `app/services/state_machine.py` — desacoplado de FastAPI, eleva `InvalidStateTransitionError`
- `app/services/traceability.py` — captura `InvalidStateTransitionError` → traduce a `HTTPException 400`
- `app/services/notification.py` — **NUEVO**: `NotificationService.schedule_baja()` extrae responsabilidad
- `app/services/core.py` — `delete_activo()` delega a `NotificationService`
- `app/repositories/core.py` — `list_especificaciones()` retorna `list[EspecificacionDetalle]`
- `app/schemas/core.py` — `ActivoDetailResponse` con schemas anidados: `ModeloAnidado`, `MarcaAnidada`, `EstadoAnidado`, `TipoActivoAnidado`
- `app/db/base.py` — eliminado `id: Any` muerto
- `app/alembic/versions/2026-09-23_performance_indexes.py` — índice parcial `ix_movimiento_activo_abierto`
- `features/assets/AssetsPage.tsx` — paginación server-side via `POST /core/activos/search`; `estadoColor()` por ID numérico
- `features/catalogs/catalogService.ts` — agregado `getModelosFlat()`
- `tests/test_state_transitions.py` — fix `_u()` en `test_list_especificaciones_returns_typed_objects` → 12/12 tests

---

### 2.2 Sesión 2 — OOP, Design System y i18n

#### Backend — Patrón Repository/Service base

| Archivo | Descripción |
|---|---|
| `app/repositories/base.py` | `BaseRepository[M]` genérico: `get_by_pk`, `list_paginated`, `create`, `update_by_pk`, `delete_by_pk`, `exists`; Template Method: `_pk_column()`, `_apply_eager_loads()` |
| `app/repositories/query_builder.py` | `AsyncQueryBuilder` — Builder fluent: `.filter()`, `.ilike()`, `.order_by()`, `.paginate()`, `.build()` |
| `app/services/base.py` | `BaseService[R]` — inyección de repo tipado, helpers: `_not_found()`, `_conflict()`, `_bad_request()`, `get_or_404()` |

**Aplicado a los 11 repositorios existentes:**
`catalogs` · `consumable` · `core` · `organization` · `procurement` · `software` · `traceability` · `maintenance` · `location` · `attachment` · `governance`

**Aplicado a los 10 servicios existentes:**
`catalogs` · `core` · `organization` · `procurement` · `software` · `consumable` · `maintenance` · `traceability` · `location` · `stats`

#### Frontend — Design System

| Componente | Archivo | Descripción |
|---|---|---|
| `PageHeader` | `src/components/ui/PageHeader.tsx` | Título + subtítulo + badge + actions + hint |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | Ícono + mensaje + CTA opcional; prop `compact` para tablas |
| `StatusChip` | `src/components/ui/StatusChip.tsx` | Chip semántico con `StatusVariant`; resuelve color por nombre de estado |
| `SectionCard` | `src/components/ui/SectionCard.tsx` | Card con header + divider para agrupar secciones de formulario |
| `DataTableShell` | `src/components/ui/DataTableShell.tsx` | Tabla completa: skeleton loading, paginación server-side, empty state, toolbar |
| Barrel export | `src/components/ui/index.ts` | Re-exporta todos los componentes |

**Tema dinámico WCAG:**
- Defaults: `#f5f3ef` bg · `#4a7c9e` primary · `#5a8e7a` secondary
- `PALETTE_PRESETS` exportado (5 presets: Neutro Cálido, Pizarra, Lavanda, Terracota, Medianoche)
- Contraste derivado matemáticamente — cualquier fondo (claro u oscuro) preserva legibilidad

**i18n — 3 idiomas completos (~500 claves cada uno):**

| Idioma | Estado | Módulos cubiertos |
|---|---|---|
| ES | Completo | app · menu · auth · dashboard · assets · attachments · users · catalogs · maintenance · operations · procurement · software · consumables · persons · departments · locations · scanner · twofa · config · audit |
| EN | Completo | Misma estructura |
| IT | Completo (real) | Misma estructura — era copia del español, corregido con italiano real |

**Aplicado a las 19 páginas:**
`AssetsPage` · `UsersPage` · `BrandsPage` · `ModelsPage` · `AssetTypesPage` · `ConsumablesPage` · `DepartmentsPage` · `PersonsPage` · `MaintenancePage` · `MovementsPage` · `ProvidersPage` · `PurchaseOrdersPage` · `WarrantiesPage` · `SoftwarePage` · `AuditPage` · `LocationsPage` · `ConfigPage` · `ScannerPage` · `DashboardPage`

#### Resultado de Validación

```
Backend:   178 / 183 tests  ✓  (5 fallos pre-existentes, no relacionados)
Frontend:  npm run build     ✓  sin errores TypeScript
```

### 2.3 Sesión 3 — Fixes de tests + adopción del Design System

- `app/core/email.py` — definido `_admin_recipients()` (parsea `NOTIFY_ADMIN_EMAILS` CSV) → 4 tests de notificaciones OK
- `app/services/traceability.py` — el snapshot `OFFBOARDING` no incluía el conteo; ahora guarda `activos_devueltos`, `activos_ids`, `licencias_liberadas`
- `DataTableShell` aplicado a 12 páginas: Audit · Brands · Models · AssetTypes · Consumables · Maintenance · Persons · Providers · PurchaseOrders · Warranties · Software (tabla principal) · Users.
  Quedan manuales: `AssetsPage` y `MovementsPage` (checkbox "seleccionar todo" en el header). Departments/Locations/Scanner/Dashboard/Config no tienen tablas.
- `SectionCard` aplicado a los 25 diálogos/flujos de §3.2 (claves nuevas `*.sections.*` en es/en/it.json)
- `ConfigPage` — selector de paleta (radio cards accesibles con swatches + mini preview) sobre `PALETTE_PRESETS`; rellena los campos de color existentes, persiste con "Guardar"

**Validación:** Backend 183/183 ✓ · `npm run build` ✓

**Pendientes detectados:**
- ~~`DataTableShell` sin i18n / sin checkbox en header~~ → resuelto: `label: ReactNode`, `padding`, `rowsPerPageOptions`, claves `common.table.*`; Assets y Movements migrados (14/14 páginas con tabla)
- `tsconfig.app.json` (no usado por el build) arroja ~178 errores TS1484 (`import type`) + 2 vars sin usar en `AssetsPage.tsx`
- Claves i18n faltantes: `assets.specs.sections.*`; namespace `workflows` ausente en en.json/it.json

### 2.4 Sesión 4 — Active Directory + reglas de notificación

- `DataTableShell`: i18n de paginación, `label: ReactNode` + `padding` (checkbox en header), `rowsPerPageOptions` → Assets y Movements migrados
- **AD (LDAP, ldap3)** — `app/integrations/active_directory.py` (`DirectoryClient` abstracto + `LdapDirectoryClient`; grupos anidados vía `LDAP_MATCHING_RULE_IN_CHAIN`; caché de miembros con fallback al último valor)
- **Sincronización** — `app/services/directory_sync.py`: alta/vinculación por objectGUID o email, departamento/cargo automáticos, jefe (`manager` → `PER_Jefe`), desactivación solo sin activos (si tiene activos → pendiente + email `ad_sync_pendientes`), dry-run, auditoría `AD_SYNC`, loop periódico con lock Redis
- **Reglas por gestión** — `INV_REGLA_NOTIFICACION` + `app/services/notification_rules.py`: afectado / jefe / admins (+ grupo `AD_ADMIN_GROUP`) / grupos AD / correos extra; defaults = comportamiento previo; eventos de seguridad (contraseña, 2FA) no configurables. `send_notification(..., affected=)` resuelve en background con fallback al comportamiento previo
- API `/api/v1/directorio/*` (estado, probar, sincronizar, grupos, notificaciones/reglas, vista-previa)
- Migración `c4d5e6f7a8b9` — columnas AD en `INV_PERSONA`, tabla de reglas, **y merge de los 2 heads de Alembic** que existían
- Frontend: página *Directorio y notificaciones* (`/config/directorio`), chip AD y jefe en Personas
- Docs: DEPLOYMENT.md §4.1, `.env.example`

**Validación:** Backend 198/198 ✓ (15 tests nuevos en `test_active_directory.py`) · `npm run build` ✓

**Pendiente:** confirmar servidor de correo (Exchange on-prem vs M365) y datos del AD con infraestructura; probar contra un DC real; Oracle: el baseline usa `create_all` (instalaciones nuevas OK), instalaciones Oracle existentes necesitarían migración propia.

### 2.5 Sesión 5 — Auditoría de seguridad, sesiones, colas, transacciones e infraestructura

**Bugs corregidos (verificados con tests que los reproducían):**
- **Logout no revocaba nada**: el SPA limpiaba el token antes de que axios lo leyera → request sin Authorization → 401 → refresh cookie seguía válida. Además `/logout` exigía access vigente (el cierre por inactividad llega con el access vencido). Ahora `/logout` revoca por cookie y acepta access vencido (firma verificada); el SPA pasa el token explícito.
- Refresh concurrente → 500 (PK duplicada). Ahora rotación atómica (`revoke_jti_once` con SAVEPOINT).
- Sin detección de robo: reuso de refresh rotado (> `REFRESH_REUSE_GRACE_SECONDS`) → revoca todas las sesiones + auditoría `REFRESH_TOKEN_REUSE`.
- `iat` en segundos: re-login en el mismo segundo tras "cerrar todas las sesiones" quedaba revocado → claim `iat_ms`.
- **nginx fijaba la IP del backend al arrancar** → 502 total tras cada redeploy del backend. `server backend:8000 resolve` + resolver de Docker (nginx 1.27.5).
- **Caddy `camera=()`** sobrescribía el header de nginx → el escáner QR no funcionaría en producción.
- **Compose de producción no pasaba ninguna variable `AD_*`** (ni las nuevas de sesión/cola) al backend.
- Purga de tokens/idempotencia/OTP "vía cron" inexistente → ahora tarea periódica con lock Redis.
- 2 índices de `SYS_TOKEN_REVOCADO` nunca migrados.

**Mejoras:**
- Sesiones: inactividad aplicada por servidor (`SESSION_IDLE_TIMEOUT_MINUTES`), duración absoluta (`SESSION_ABSOLUTE_MAX_HOURS`, claim `auth_time`), cookie de sesión, `POST /login/logout-all` + botón, refresh serializado entre pestañas (Web Locks), logout propagado entre pestañas y pestañas nuevas que heredan sesión (BroadcastChannel), `RATE_LIMIT_REFRESH` configurable.
- **Cola persistente de correos** `SYS_EMAIL_OUTBOX` (SKIP LOCKED, lease, backoff hasta ~10 h, FALLIDO + reintento manual, `/gov/email-outbox`, métrica `inv_email_outbox`). Secretos (reset, 2FA) fuera de la cola.
- `app/services/scheduled_jobs.py`: worker de cola + tareas periódicas con lock.
- nginx: `server_tokens off`, `X-Forwarded-Proto` real, timeout 300 s para sync AD. SPA: recarga automática si faltan chunks tras un deploy.
- Migración `d5e6f7a8b9c0`.

**Validación:** Backend 218/218 ✓ · build ✓ · **E2E 36/36** contra el stack de producción en Docker (Caddy TLS → nginx → gunicorn×4 → Postgres+réplica/Redis/MinIO/MailHog), incluido redeploy del backend con cambio de IP y correo sobreviviendo a caída de SMTP + reinicio.

**Riesgos abiertos:** `docker-compose.yml` de la raíz publica el backend en :8000 sin proxy (X-Real-IP falsificable) → usar solo `deploy/`; rate limits por IP asumen que los usuarios no salen por un NAT/proxy compartido; imágenes `minio:latest`/`mailhog:latest` sin versión fija.

### 2.6 Sesión 6 — Cuenta de servicio genérica (correo + AD) configurable desde la UI

- Modos `DESACTIVADO | CORREO | CORREO_AD` en `SYS_INTEGRACION_CORREO` (migración `e6f7a8b9c0d1`); la UI prevalece sobre `SMTP_*`/`AD_*`. Misma cuenta para enviar y para el bind LDAP (o cuenta de AD aparte).
- Proveedores: **SMTP** (Exchange local / Gmail; relay sin clave permitido) y **Microsoft Graph** (app registration + `Mail.Send`), porque la auth básica SMTP de M365 está retirada.
- Secretos cifrados con Fernet, nunca devueltos ni auditados; "omitir = conservar, vacío = borrar".
- `app/services/integration_config.py` (config efectiva con caché 30 s + write-through), `integration_service.py`, endpoints `/directorio/integracion` (+ `probar-correo`, `probar-ad`, `desbloquear`). Cambios en caliente: worker de cola y sync AD leen la config en cada ciclo.
- **Cortacircuitos de autenticación** (Redis + local): tras credenciales rechazadas pausa 15 min SMTP/AD para no bloquear la cuenta de servicio; la cola no gasta intentos.
- **Bug encontrado**: `EmailStr` rechaza `.local` (dominio típico de AD) → nuevo `CorporateEmail` en cuenta de servicio, reglas y **personas** (proveedores siguen con `EmailStr`).
- Frontend: sección "Cuenta de servicio y correo" (presets M365 Graph/SMTP, Exchange, Google), pruebas con valores sin guardar, avisos de cifrado/pausa.

**Validación:** Backend 239/239 ✓ · build ✓ · E2E en stack Docker sin SMTP en entorno: configuración vía API, clave cifrada en Postgres, envío autenticado, entrega por la cola con hot-reload, AD inaccesible controlado.

### 2.7 Sesión 7 — Revisión integral de la interfaz (diseño, responsive, colores, textos)

Validación visual con Playwright (22 rutas × escritorio/tablet/móvil) sobre stack Docker con el dataset real.

**Eliminado:** "Guía operativa" y "Flujo guiado" (páginas, menú, botones; rutas viejas → Movimientos), hero/mensajes de ayuda, ~20 alertas informativas (ayuda → texto bajo el campo; vacíos → `EmptyState`), 16 `window.confirm` (→ `useConfirm()` del sistema).

**Estructura unificada:** Sidebar nuevo (rail colapsable en escritorio, drawer + AppBar en móvil, menú de cuenta con idioma/2FA/contraseña/cerrar sesión) · sin espacio muerto superior · `PageHeader` con acciones que hacen wrap · barra de filtros estándar (búsqueda siempre visible, filtros plegables en móvil) · `ExportMenuButton` (reemplaza selector de idioma + botón) · `DataTableShell` sin doble borde, filas compactas y scroll horizontal en móvil, acciones en una fila, vacío fuera de la tabla. Patrón aplicado a las 16 páginas de listado.

**Colores:** el tema mezclaba el fondo 92 % hacia crema y forzaba modo claro (la configuración no tenía efecto) → ahora respeta el fondo, soporta modo oscuro y garantiza WCAG AA (texto secundario ≥4.5:1 sobre todas las superficies, marca y estados ≥4.5:1). 3 paletas por defecto distintas unificadas en "Neutro Cálido" (migración `f7a8b9c0d1e2` para instalaciones con la paleta oscura heredada). Vista previa real en Configuración; el tema se aplica sin recargar. Colores fijos en componentes → tokens del tema.

**Fuentes:** Google Fonts bloqueado por la CSP (nunca cargaba) → Manrope autoalojada (`@fontsource-variable/manrope`), una sola familia.

**Configuración/marca:** `/gov/config` a 300/min y caché local de la última config válida (los 429 hacían saltar colores/marca a los defaults).

**Reportes:** actas Word/PDF, CSV y etiquetas revisados en es/en/it (`app/services/report_i18n.py`, `tests/test_report_translations.py`); etiquetas aceptan `lang`.

**Textos:** revisión completa es/en/it (tildes, plurales i18next, textos fijos en componentes, claves huérfanas) y 7 cadenas con **corrupción de codificación** ("Clasificaci?n", "Garant?a", "nell?interfaccia").

### 2.8 Sesión 8 — Identidades y accesos (IAM), MFA obligatorio y validación de flujos

**Rol `ADMIN_SEGURIDAD`** (`app/core/roles.py`): gestiona cuentas, roles operativos, contraseñas, MFA, bloqueos, sesiones y lee la auditoría; **sin acceso al inventario** (guardia en los routers: `require_business`). `ADMIN_TI` deja de administrar usuarios. Nadie aplica acciones administrativas a su propia cuenta; los roles protegidos (SUPER_ADMIN, ADMIN_SEGURIDAD) solo los gestiona/otorga un SUPER_ADMIN. Migración `a8b9c0d1e2f3`.

**Brechas corregidas:**
- **El MFA "obligatorio" no se aplicaba**: un SUPER_ADMIN sin MFA entraba solo con contraseña → sesión restringida (`mfa_enroll`) hasta enrolar.
- **Los administradores fijaban contraseñas definitivas ajenas** → contraseña temporal (se muestra una vez) con cambio obligatorio (`pwd_change`), desbloqueo y cierre de sesiones.
- **TOTP reutilizable** dentro de su ventana → anti-replay (`USU_2FA_Ultimo_Paso`).
- **Fuerza bruta del segundo factor**: los códigos fallidos no contaban para el bloqueo y la contraseña correcta reiniciaba el contador → ahora cuentan y el contador solo se reinicia al completar el login.
- Restricciones de sesión recalculadas en cada login/refresh (`app/services/session_policy.py`); `get_current_user` rechaza sesiones restringidas salvo autoservicio (`CurrentUserSelfService`).

**Endpoints:** `/org/usuarios/{id}/password/reset | 2fa/reset | unlock | sessions/revoke`, `/org/usuarios/seguridad/resumen`; auditoría legible por ADMIN_SEGURIDAD.

**Frontend:** pantallas obligatorias (cambio de contraseña temporal, enrolamiento MFA con códigos de recuperación), panel "Usuarios y accesos" (KPIs, política, estado MFA/bloqueos, acciones por fila con jerarquía), "Seguridad de la cuenta", navegación por rol.

**Validación:** 296/296 en SQLite **y en PostgreSQL 16** (nuevo modo `TEST_DATABASE_URL` en conftest) · 8 tests IAM + anti-replay · **13/13 flujos en navegador** sobre el stack Docker (primer ingreso de sa con MFA, alta de admin de seguridad, contraseña temporal, ADMIN_SEGURIDAD sin inventario, móvil).

**Impacto al desplegar:** sa y los ADMIN_TI sin MFA deberán enrolarlo en su próximo ingreso; asignar ADMIN_SEGURIDAD a quien gestione cuentas (DEPLOYMENT.md §4.3).

**Deuda técnica aún abierta (sin impacto funcional):** extender `AsyncQueryBuilder` a 5 repos, `BaseService` en servicios de soporte, tests unitarios propios de BaseRepository/QueryBuilder (cubiertos indirectamente), Oracle fuera de CI.

### 2.9 Sesión 9 — Autocompletado relacional de formularios

Endpoints de contexto (`app/services/suggestions.py`): persona, departamento, activo, modelo; campo `PER_Jefe` en personas. Frontend: sugerencias con motivo y "Restablecer" en asignación, usuario, persona, activo, mantenimiento, orden de compra y recepción (nunca se pisa lo que el usuario escribió). Validación: 300/300 backend, build limpio, 4/4 en navegador. Herramientas de QA movidas a `herramientas-qa/`. Estado completo y pendientes: **`CONTINUAR.md`**.

### 2.10 Sesión 10 — Módulo formal de seguridad y alcance por sede (RLS)

Alcance de datos por sede configurable por cuenta (global / una / varias) aplicado en dos capas: filtro ORM automático (`app/core/data_scope.py`) y políticas RLS de PostgreSQL con un rol restringido vía `SET LOCAL ROLE` (`app/db/rls.py`). Rol `AUDITOR` (lectura + bitácora filtrada + exportación). Autocompletado limitado al alcance y sede prellenada. Sesiones con cierre individual, aviso de dispositivo nuevo, historial y lista de bloqueo de contraseñas, cuentas inactivas, retención y exportación de la bitácora. Migración `b9c0d1e2f3a4`. Hallazgo durante la validación en PostgreSQL: las instalaciones de software a una persona (sin activo) necesitaban su propia regla (resuelto con una función `SECURITY DEFINER` para evitar el ciclo entre políticas). Validación: 335 tests en PostgreSQL con RLS real (330 en SQLite + 5 exclusivos de PostgreSQL), migración probada sobre el inventario real y 14/14 verificaciones en navegador. Detalle en **`CONTINUAR.md` §3b**.

### 2.11 Sesión 11 — Git, moneda por registro y Graphify

Todo el trabajo de las sesiones 4–10 subido a la rama `feature/sesiones-4-10` de ambos repos. Moneda por registro (GTQ/USD/CHF, sin conversión) en activos y mantenimientos: migración `c0d1e2f3a4b5` (los activos recibidos toman la moneda de su orden), recepción hereda la moneda de la orden, tablero con totales por moneda, CSV con columna Moneda, `MoneyField` en el frontend. Validación: 341/341 en PostgreSQL 16 (5 tests nuevos en `test_currency.py`), migración subida/bajada/subida en base limpia, `tsc`/`eslint`/`build`/`verify.py` limpios. Graphify instalado (skill `/graphify`) y grafo local del código en `graphify-out/`.

---

### 2.12 Sesión 12 — Fases 0 a 6 del plan (2026-09-29)

- **Monorepo formal** `J4GS10/Inventario-TI` (frontend + backend), CI en GitHub Actions, respaldos de PostgreSQL y MinIO con restauración.
- **Integridad (F1) y seguridad (F2):** máquina de estados, reglas de asignación, cierre atómico de tickets, AD protegido, MFA de un solo uso, adjuntos validados por contenido, unicidad sin mayúsculas ni espacios, script `app.diagnostico_inventario`.
- **Compras (F3):** recepción parcial con pendiente por línea, precio real con tolerancia, sobrantes justificados, conformidad de servicios (líneas OTRO), cierre con faltante, entregas con documento y aviso por correo. UI: `ReceiveOrderDialog` (resumen con códigos, etiquetas y pendientes), `OrderDetailDialog` (pedido/recibido/pendiente, entregas, cierre con faltante), tipo por línea en la orden.
- **Trazabilidad (F4):** kardex unificado (migración `e2f3a4b5c6d7`), baja formal, componentes, historial de licencias, costos en moneda de origen en licencias y consumibles, toma de inventario (`/inventario/tomas`), reportes (`/trazabilidad`, hoja de vida PDF, licencias CSV).
- **Diálogo (F5):** ficha del activo como centro de acciones, siguiente paso tras crear/asignar/devolver/recibir, propuesta de orden de compra cuando el stock queda bajo el mínimo, bandeja «Requiere su atención» en el tablero.
- **Pulido (F6):** ≈140 códigos de error traducidos, bitácora legible con exportación filtrada, fechas en hora de Guatemala, textos formales.
- **QA:** `herramientas-qa/qa9_fases.py` contra `inv_ui`; detectó y se corrigió que la API de consumibles no devolvía costo ni moneda (prueba `test_consumible_costo.py`).
- Pendientes: ver `INFORME_EJECUTIVO_Y_PLAN.md` §8.3.

## 3. Pendientes

> **Histórico (sesiones 1–2).** Casi todo lo de esta sección y de la §5 ya se resolvió en sesiones posteriores. Los pendientes vigentes están en **`CONTINUAR.md` §4**.

### 3.1 Bugs pre-existentes (alta prioridad — rompen tests)

| Test | Error | Archivo | Causa |
|---|---|---|---|
| `test_admin_recipients_se_juntan_con_to` | `NameError: _admin_recipients` | `app/core/email.py:463` | Variable privada no definida en scope |
| `test_admin_recipients_sin_admins_solo_to` | Mismo | Mismo | Mismo |
| `test_notificar_garantias_devuelve_conteo` | Mismo | Mismo | Mismo |
| `test_templates_alerta_renderizan` | Mismo | Mismo | Mismo |
| `test_offboarding_registra_audit_event` | `assert None == 1` (`activos_devueltos`) | `test_offboarding.py` | Snapshot de auditoría no guarda el campo |

### 3.2 Frontend — Diálogos/Formularios (24 componentes sin SectionCard)

Los diálogos de creación/edición aún usan `Box` o `Stack` planos para agrupar campos. Aplicar `SectionCard` daría consistencia visual con el resto del sistema:

```
AssetDialog · AssetDetailDialog · BrandDialog · ModelDialog · AssetTypeDialog
ConsumableDialog · StockDialog · ConsumableHistoryDialog
DepartmentDetailDialog · MaintenanceDialog · MaintenanceDetailDialog
AssignmentDialog · ActaDescargoDialog · GuidedAssignmentPage · WorkflowHubPage
OffboardingDialog · PersonDialog · PersonDetailDialog
ProviderDialog · PurchaseOrderDialog · OrderDetailDialog · ReceiveOrderDialog
LicenseDialog · SoftwareDialog · UserDialog
```

### 3.3 Frontend — DataTableShell no aplicado

Las 19 páginas aún usan `TableContainer + Table + TableHead + TableBody` manual. `DataTableShell` fue creado pero no aplicado. Centralizar las tablas en él daría:
- Skeleton loading homogéneo
- Paginación estandarizada
- EmptyState automático sin código repetido

### 3.4 Backend — AsyncQueryBuilder sin extender

Solo `CoreRepository.search_activos()` usa `AsyncQueryBuilder`. Los siguientes repos tienen búsquedas con filtros condicionales dispersos que podrían migrarse:
- `organization.py` — búsqueda de personas/usuarios
- `procurement.py` — búsqueda de órdenes/proveedores
- `software.py` — búsqueda de licencias
- `maintenance.py` — búsqueda de mantenimientos
- `traceability.py` — búsqueda de movimientos

### 3.5 Backend — Servicios sin BaseService

Los servicios de soporte no fueron cubiertos:
- `services/documents.py` — generación de PDFs/Word
- `services/export.py` — CSV/Excel export
- `services/labels.py` — impresión de etiquetas QR
- `services/sso.py` — SSO OAuth2
- `services/twofactor.py` — autenticación 2FA
- `services/governance.py` — auditoría/gobernanza
- `services/attachments.py` — manejo de adjuntos

### 3.6 ConfigPage — PALETTE_PRESETS UI

El archivo `PALETTE_PRESETS` fue creado en `theme.ts`. Falta confirmar e implementar la UI en `ConfigPage.tsx` que permita al usuario seleccionar el preset de paleta con preview visual.

### 3.7 Tests — Cobertura de nuevos patrones

Sin tests para:
- `BaseRepository` — operaciones CRUD genéricas
- `BaseService` — `get_or_404`, helpers de error
- `AsyncQueryBuilder` — combinaciones de filtros, paginación
- `NotificationService` — schedule post-commit
- Endpoints que usan los nuevos schemas anidados (`ActivoDetailResponse`)

### 3.8 Dashboard — KPIs con datos reales

`DashboardPage.tsx` — verificar si los KPI cards llaman a `GET /stats/dashboard` con datos reales o usan valores mock.

### 3.9 Oferta pendiente de funcionalidad

| Módulo | Estado |
|---|---|
| Scanner QR/barras | UI creada, integración backend sin verificar |
| Impresión de actas de descargo | `ActaDescargoDialog` existe; `documents.py` genera el PDF |
| Offboarding persona | Flujo presente, test roto — lógica de snapshot de auditoría |
| Oracle dual-support | `alembic_oracle/` existe con baseline; no integrado en CI |
| Modo oscuro | Theme engine soporta fondos oscuros pero no hay toggle en UI |

---

## 4. Arquitectura Actual

```
app/
├── api/v1/endpoints/     ← 15 routers (attachment, catalogs, consumable, core,
│                            export, governance, location, login, maintenance,
│                            organization, procurement, software, stats,
│                            traceability, twofactor)
├── repositories/         ← 11 repos → todos extienden BaseRepository
│   ├── base.py           ← BaseRepository[M] + Template Method
│   └── query_builder.py  ← AsyncQueryBuilder (Builder pattern)
├── services/             ← 20 servicios → los principales extienden BaseService
│   ├── base.py           ← BaseService[R] + get_or_404
│   ├── state_machine.py  ← AssetStateMachine (puro dominio, sin FastAPI)
│   └── notification.py   ← NotificationService (post-commit hooks)
├── models/               ← 9 archivos (core, catalogs, traceability, org, ...)
├── schemas/              ← DTOs Pydantic por módulo
└── core/
    └── errors.py         ← DomainError → InvalidStateTransitionError

src/
├── components/ui/        ← PageHeader · EmptyState · StatusChip · SectionCard · DataTableShell
├── theme/theme.ts        ← WCAG dinámico · PALETTE_PRESETS
├── locales/              ← ES · EN · IT (~500 claves c/u)
└── features/             ← 19 módulos con páginas + diálogos
```

---

## 5. Próximos Pasos Recomendados

**Orden sugerido por impacto/riesgo:**

1. **Fix email.py:463** — un solo bug bloquea 4 tests de notificaciones
2. **Fix offboarding snapshot** — el campo `activos_devueltos` no se persiste en auditoría
3. **Aplicar DataTableShell** a las 19 páginas — elimina ~200 líneas duplicadas
4. **Aplicar SectionCard** a los 24 diálogos — consistencia visual de formularios
5. **ConfigPage — selector de paleta** con `PALETTE_PRESETS`
6. **Tests para BaseRepository/BaseService/AsyncQueryBuilder**
7. **Extender AsyncQueryBuilder** a los 5 repos con búsqueda
8. **Dashboard KPIs reales** — verificar y conectar a `/stats/dashboard`
9. **Modo oscuro toggle** en Sidebar/ConfigPage
