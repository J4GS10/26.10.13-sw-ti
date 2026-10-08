# InventarioTI — Estado actual y guía para continuar

> Actualizado: 2026-10-02 (sesión 13). Documento de traspaso entre sesiones de trabajo.
> **Sesión 12:** se ejecutaron las fases 0 a 6 de `INFORME_EJECUTIVO_Y_PLAN.md` (kardex, recepción controlada, componentes, bajas, licencias, toma de inventario, bandeja «Requiere su atención»). Estado y pendientes en su §8.
> **Sesión 13:** control interno profesional (rol JEFE_TI con aprobación de bajas y sobrantes, costo promedio ponderado, kardex completo y verificable con sello encadenado). Detalle en `INFORME_EJECUTIVO_Y_PLAN.md` §9. Cuenta de revisión del Jefe de TI: `python herramientas-qa/crear_jefe_ti.py` (credenciales en `herramientas-qa/salidas/credenciales_jefe.json`).
> **Sesión 14 (2026-10-07/08):** base formal reiniciada y cargada solo con el Excel «Inventario GT»; fases 1–3 de productividad (entrega de puesto, Ctrl+K, fichas con URL, importación Excel, calidad de datos). **Siguiente trabajo aprobado: `PLAN_CONTROL_LICENCIAS_CATALOGOS.md`** (licencias con activación variable, catálogos estandarizados, control del usuario). Cambios aún sin commit.
> El historial detallado de cada sesión está en `PROGRESS.md`, y el despliegue en `inventarioTI-backend/DEPLOYMENT.md`.

---

## 1. Qué es y cómo está armado

Sistema de gestión de activos de TI para Lombardi.

| Capa | Tecnología | Carpeta |
|---|---|---|
| Frontend | React 19 + TypeScript + MUI + react-i18next (ES/EN/IT) | `inventarioTI-frontend/` (monorepo `J4GS10/Inventario-TI`) |
| Backend | FastAPI async + SQLAlchemy 2.0 (serie 2.0.x fijada) + Alembic | `inventarioTI-backend/` (monorepo `J4GS10/Inventario-TI`) |
| Datos | PostgreSQL 16 (primaria + réplica), Redis, MinIO (adjuntos) | `inventarioTI-backend/deploy/` |
| Borde | Caddy (TLS) → nginx (SPA + proxy) → gunicorn ×4 | `deploy/Caddyfile`, `frontend/nginx.conf` |
| QA | Scripts Playwright/httpx y verificador de traducciones | `herramientas-qa/` (ver su README) |
| Datos reales de prueba | Inventarios HTML de equipos | `dataset/` |

Arquitectura del backend: `endpoints → services → repositories → models`, con `@transactional` y hooks post-commit. Hay una tarea periódica por proceso para la cola de correos, la purga de seguridad y la sincronización con AD.

---

## 2. Estado por área (todo validado)

| Área | Estado |
|---|---|
| **Tests backend** | **395/395 en PostgreSQL 16** con RLS real. La suite solo corre contra PostgreSQL: `python herramientas-qa/pruebas_backend.py` |
| **Build frontend** | `tsc -b`, `eslint src` y `npm run build` limpios; `verify.py`: 3 idiomas con claves idénticas y sin huérfanas |
| **Diseño/UI** | Un solo patrón: `PageHeader` + barra de filtros (`CollapsibleToolbar`) + `DataTableShell` + `SectionCard`. Sidebar con rail, menú de cuenta y AppBar móvil. Sin desbordes en 20 rutas × 3 tamaños × 3 idiomas |
| **Colores** | El tema respeta el fondo configurado (claro u oscuro) y cumple WCAG AA en todas las paletas. Manrope autoalojada. Configuración con vista previa real y aplicación sin recargar |
| **Textos** | ES/EN/IT profesionales, plurales i18next, estados y tipos de catálogo traducidos (`src/utils/catalogLabels.ts`) |
| **Reportes** | Actas Word/PDF, CSV y etiquetas traducidos (`app/services/report_i18n.py`) |
| **Sesiones** | Refresh con rotación atómica y detección de reuso, inactividad del lado del servidor, sesión absoluta de 12 h, cookie de sesión, cierre de sesión en todos los dispositivos, coordinación entre pestañas |
| **Identidades (IAM)** | Rol `ADMIN_SEGURIDAD` (sin inventario), jerarquía de roles, contraseña temporal con cambio obligatorio, MFA obligatorio por rol (sesión restringida hasta enrolar), anti-replay TOTP, bloqueo también por el segundo factor. Panel "Usuarios y accesos" y "Seguridad de la cuenta" |
| **Correo** | Cola persistente (outbox) con reintentos y cortacircuitos. Cuenta de servicio configurable desde la UI (SMTP o Microsoft Graph). ⏸ **Pausado por decisión del usuario** hasta que infraestructura entregue la cuenta |
| **Active Directory** | Sincronización de personas y jefes, grupos AD como destinatarios. Solo probado con un AD simulado |
| **Formularios** | Autocompletado relacional (ver §3) |
| **Infraestructura** | nginx re-resuelve el backend (sin 502 tras redeploy), Caddy permite la cámara, el compose pasa todas las variables, migraciones lineales hasta `f3a4b5c6d7e8` (aprobaciones del Jefe de TI, costo promedio ponderado y kardex verificable) |
| **Moneda** | Cada costo guarda su moneda (GTQ, USD, CHF) sin convertir: activos (`ACT_Moneda`), mantenimientos (`MAN_Moneda`) y órdenes. Los activos recibidos toman la moneda de la orden; el tablero da un total por moneda. `app/core/currency.py`, `src/utils/currency.ts`, `MoneyField` |
| **Git** | Todo versionado en la rama `feature/sesiones-4-10` de ambos repos (backend → `backendTEST`, frontend → `inventarioTI-frontend`). Falta abrir el PR y fusionar a `main` |

---

## 3. Autocompletado relacional de formularios (sesión 9)

Endpoints de sugerencias (`app/services/suggestions.py`, tests en `tests/test_suggestions.py`):

- `GET /org/personas/{id}/contexto`: departamento, cargo, jefe, área habitual (última asignación o la del departamento), activos en custodia, usuario existente, usuario y rol sugeridos. Nunca sugiere un rol privilegiado.
- `GET /org/departamentos/{id}/contexto`: cargo, jefe y área probables.
- `GET /core/activos/{id}/contexto`: custodio y área actuales, tipo de movimiento lógico (asignación o transferencia).
- `GET /cat/modelos/{id}/contexto`: marca del modelo y el tipo con que suele registrarse.
- Personas: nuevo campo `PER_Jefe` en alta y edición (una persona no puede ser su propio jefe).

Regla de UX: se prellena solo si el campo está vacío o conserva una sugerencia intacta. Nunca se pisa lo que el usuario escribió. Siempre se muestra "Sugerido: <motivo>" y la opción de restablecer.

**Frontend (hecho y verificado en navegador, 4/4 en `herramientas-qa/autofill_check.py`):**

| Formulario | Qué se completa o sugiere |
|---|---|
| Nueva asignación | Persona → área (último destino o la del departamento), línea "Depto · Cargo · Jefe" y activos que ya tiene. Activo → tipo de movimiento (transferencia si está en custodia), hostname y custodio actual |
| Nuevo usuario | Persona → usuario (del correo, sin colisiones) y rol (habitual del cargo o departamento, nunca privilegiado). Bloquea si la persona ya tiene usuario |
| Persona | Departamento → cargo y **jefe inmediato** (campo nuevo) |
| Activo | Se elige el **modelo** directamente → marca y tipo; se muestra el código automático (prefijo) |
| Mantenimiento | Activo → solicitante = custodio actual |
| Orden de compra / recepción | Proveedor → moneda de su última orden; costo por activo = precio unitario de la línea |

Piezas reutilizables: `src/hooks/useSuggestion.ts`, `src/hooks/useEntityContext.ts`, `src/components/ui/SuggestionHint.tsx`, `src/api/suggestionService.ts`, `src/utils/suggestionReasons.ts`.

Detalles pendientes vistos en la validación: ~~el campo Costo del activo muestra "$"~~ (resuelto en la sesión 11 con moneda por registro) y el título del diálogo de activo dice "Crear o editar activo" (debe ser "Nuevo activo" o "Editar activo").

---

## 3b. Módulo de seguridad y alcance por sede (sesión 10)

**Alcance de datos (RLS) por sede**, configurable por cuenta: global, una sede o varias. SUPER_ADMIN y ADMIN_SEGURIDAD siempre globales; solo un SUPER_ADMIN otorga el global; una cuenta de inventario sin sedes no ve datos (el alta exige sedes o global).
- Sede propia en `INV_ACTIVO`, `INV_PERSONA`, `INV_ORDEN_COMPRA`, `INV_CONSUMIBLE`; el resto hereda de su activo u orden. La sede del activo sigue al área de su último movimiento.
- **Capa 1 (aplicación):** `app/core/data_scope.py` — `with_loader_criteria` automático en toda consulta ORM (también UPDATE/DELETE y relaciones). Validaciones de escritura: `require_sede`, `require_owned`; `elevated()` para comprobaciones del sistema (unicidad global de código/serie/correo, completitud del offboarding).
- **Capa 2 (PostgreSQL):** `app/db/rls.py` — rol `inventario_rls` (sin privilegios) vía `SET LOCAL ROLE` + `app.usuario`; políticas por tabla; la bitácora es de solo inserción para peticiones. Funciona aunque la app conecte como superusuario. Verificación al arrancar (`rls.db_layer_active`); reinstalación: `python -m app.db.install_rls`.
- Migración `b9c0d1e2f3a4`: sin cortes (usuarios de inventario existentes → global; sedes deducidas de la última asignación; con una sola sede, todo a ella).
- **Rol `AUDITOR`:** lectura del inventario de su alcance + bitácora filtrada + exportaciones. La UI oculta las acciones de escritura según el rol (`usePermissions`).
- **Autocompletado respetando el alcance:** solo se sugieren áreas/sedes del alcance; sede prellenada (única sede, área del departamento o sede de la persona); alcance sugerido al crear usuario = sede de la persona (nunca global); los datos de cuenta en el contexto de persona solo los ve IAM.

**Módulo de seguridad:** sesiones (`SYS_SESION`, claim `sid`, lista y cierre individual en *Seguridad de la cuenta* y *Usuarios y accesos*), aviso por correo de dispositivo nuevo, historial de contraseñas (últimas 5), bloqueo de contraseñas comunes/datos personales/secuencias (lista local, sin llamadas externas), desactivación automática de cuentas inactivas (90 días, nunca el último SUPER_ADMIN), retención de la bitácora (opcional, mínimo 365 días, compatible con su trigger append-only), exportación de la bitácora desde el servidor con registro `AUDIT_EXPORT`. Todo documentado en `DEPLOYMENT.md` §4.4–4.5 y `docs/RBAC_MATRIX.md`.

**Validación:** 335 tests: todos pasan en PostgreSQL 16 con RLS real (incluidos los que apagan la capa de aplicación para probar que la base sola filtra); Migración probada sobre el inventario real (subida y bajada; 0 activos y 0 personas sin sede). Recorrido en navegador sobre el stack de producción: 14/14 (`herramientas-qa/alcance_flow.py`). Frontend: `tsc`, `eslint`, `build` y `verify.py` limpios.

## 4. Pendientes, por prioridad

> **Lista vigente: `ESTADO_Y_PENDIENTES.md`** (corte 2026-10-02). Allí están el avance consolidado, lo imprescindible antes de producción, lo que depende de infraestructura, las mejoras recomendadas y la ruta sugerida para salir a producción. La lista anterior de esta sección quedó resuelta o se trasladó a ese documento.

---

## 5. Cómo trabajar

- **Entorno de revisión:** `python herramientas-qa/levantar_revision.py` levanta https://localhost:8443 con el inventario real (`sa` / `Ui-Passw0rd-Revision!`; `sa` deberá enrolar MFA). No tocar el stack `lombardi` del usuario (puertos 80/443).
- **Backend:** `python herramientas-qa/pruebas_backend.py` (levanta PostgreSQL 16 de pruebas y ejecuta toda la suite; nunca SQLite). Argumentos extra van a pytest, p. ej. `-k alcance`.
- **Frontend:** `npx tsc -b && npx eslint src && npm run build`, y luego `python ../herramientas-qa/verify.py` desde `inventarioTI-frontend/`.
- **Mapa del código (Graphify):** `graphify-out/` en esta carpeta (`graph.html` interactivo, `GRAPH_REPORT.md`). Tras cambios: `graphify update .` (local, sin LLM). Consultas: `graphify query "..."`, `graphify explain "Activo"`, `graphify path "A" "B"`, o `/graphify` en Claude Code.
- **Windows:** los scripts Python necesitan `PYTHONIOENCODING=utf-8`; en Git Bash, `MSYS_NO_PATHCONV=1` para rutas dentro de contenedores; Alembic contra Postgres necesita `WindowsSelectorEventLoopPolicy`.

**Convenciones que ya se respetan (mantenerlas):**
- **Diseño:** componentes de `src/components/ui`, colores solo desde el tema, sin alertas de ayuda (una línea de texto bajo el campo), confirmaciones con `useConfirm()`, exportar con `ExportMenuButton`.
- **Textos:** siempre `t(...)` en los 3 idiomas; escribir los JSON con UTF-8 explícito (hubo corrupción por codificación). Tono formal y amable: **usted** en español, **Lei** en italiano, inglés sin contracciones. Nunca tutear, tampoco en correos ni reportes.
- **Seguridad:** los roles se definen en `app/core/roles.py`; los endpoints nuevos quedan protegidos por defecto (`get_current_user` rechaza sesiones restringidas); las acciones administrativas se auditan sin secretos.
- **Migraciones:** siempre lineales (verificar con `alembic heads`); probarlas contra Postgres real.
