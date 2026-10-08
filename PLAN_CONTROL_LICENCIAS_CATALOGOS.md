# Plan: control del usuario, licencias y catálogos estandarizados

> Creado: 2026-10-08. Documento de traspaso para continuar en una sesión nueva.
> Estado: **aprobado por el usuario para implementarse completo**. Nada de este plan está implementado todavía.
> Leer antes: `CONTINUAR.md` (arquitectura y convenciones) y la §0 de este documento (estado al cierre de la sesión anterior).

---

## 0. Estado al cierre de la sesión anterior (2026-10-07/08)

### 0.1 Entorno
- **Solo existe el entorno formal**: proyecto docker `lombardi`, https://localhost (80/443), levantado con el compose vigente `inventarioTI-backend/deploy/docker-compose.yml` y `deploy/.env` (generado desde `C:\Lombardi\.env`). Ya **no** se usa `C:\Lombardi\docker-compose.yml`.
- El usuario **no quiere entorno de revisión** (`inv_ui` se eliminó). Para probar en navegador se usó un stack desechable `inv_qa` (puerto 8443, `herramientas-qa/revision.env`) que se borra al terminar (`docker compose -p inv_qa --env-file ../../herramientas-qa/revision.env down -v`). No dejar datos de prueba en el formal.
- `inv_pgtest` (puerto 55433) es la base de la suite de pruebas; se mantiene.
- Redeploy del formal: `cd inventarioTI-backend/deploy && docker compose -p lombardi --env-file .env up -d --build migrator backend frontend`.

### 0.2 Datos
- Base formal creada desde cero y cargada **solo** con `C:\Lombardi\Inventario GT.xlsx`: 197 activos, 28 personas, 7 departamentos, 45 movimientos, kardex íntegro (242 eventos al cargar).
- Herramientas: `inventarioTI-backend/scripts/excel_inventario_gt.py` (local, Excel → JSON con incidencias) y `app/importar_inventario_gt.py` (carga inicial en el contenedor; se niega a correr si ya hay activos). Respaldo previo: `C:\Lombardi\backups\lombardi_pre_reset_20261007.*`.
- Correos de personas provisionales `@lombardi-gt.example.com` (aceptado por el usuario por ahora). Nombre de empresa: "Lombardi".
- `sa`: contraseña en `deploy/.env` (`SUPER_ADMIN_PASSWORD`); el MFA lo enrola el usuario (no tocarlo).

### 0.3 Ya implementado y desplegado (sesión anterior, fases 1–3 de productividad)
Backend (`app/services/productividad.py`, `app/services/importacion_activos.py`, `app/api/v1/endpoints/productividad.py`, `app/schemas/productividad.py`, tests en `tests/test_productividad.py`):
- `POST /trazabilidad/entrega-lote` y `/devolucion-lote` (atómicos, error `BATCH_ITEM_FAILED:<código>:<motivo>`).
- `GET /productividad/buscar`, `/kit-sugerido/{persona}`, `/calidad-datos`.
- `GET|POST /productividad/importar/activos/{plantilla|previsualizar|confirmar}` (openpyxl en requirements).

Frontend:
- `context/WorkspaceContext.tsx` + `workspace-context.ts`: paleta `Ctrl+K` (`components/CommandPalette.tsx`), atajos (`components/ShortcutsDialog.tsx`, `atajos.ts`), recientes, favoritos, `useAccionPagina('nuevo')`, entrega/devolución global.
- `features/operations/EntregaPuestoForm|Dialog|Resultado.tsx`, `DevolucionLoteDialog.tsx`; `features/onboarding/OnboardingPage.tsx`; `features/import/ImportAssetsPage.tsx`; `features/dashboard/DataQualityCard.tsx`; `components/SavedViewsMenu.tsx`; `api/cache.ts` (caché de catálogos que se vacía en cada escritura); `api/productividadService.ts`; `utils/personas.ts`.
- Navegación por tareas (`router/navigation.ts`: grupos DAILY, CONTROL, PROCUREMENT, ORGANIZATION, SETTINGS), `navItemFor()`, migas de pan en `PageHeader` (prop `crumb`), fichas con URL (`/activos/:codigo`, `/empleados/:personaId`), filtros en URL, acciones en lote en Activos, escáner en modo lote, baja en lote.

Validación de cierre: suite backend completa en verde, `tsc -b`, `eslint src`, `npm run build`, `verify.py` (3 idiomas, 0 huérfanas), recorrido Playwright 14/14.

### 0.4 Pendiente de la sesión anterior
- **Sin commit**: todos los cambios están sin confirmar en `codigo/` (rama `main`). Primer paso de la nueva sesión: crear rama `feature/productividad-licencias` y hacer commit de lo existente antes de empezar (preguntar al usuario si quiere el commit).

---

## 1. Decisiones que hay que pedir al usuario al empezar

1. **Visibilidad de credenciales de cuentas** (correo + clave): ¿se pueden mostrar en el sistema (botón «Mostrar» auditado) o solo guardar sin mostrarse nunca? *Recomendación:* mostrar con auditoría `LICENSE_SECRET_VIEWED`, solo para JEFE_TI / ADMIN_TI / SUPER_ADMIN, oculto otra vez a los 30 s.
2. **Licencias reales en uso** (Microsoft 365, Autodesk, antivirus, CSI/ETABS-SAP2000, Windows OEM…), para sembrar los catálogos con datos reales y no con ejemplos. Si no responde, sembrar solo los catálogos genéricos (§3.1) sin licencias.
3. ¿Fusionar duplicados borra el registro absorbido o lo deja inactivo? *Recomendación:* inactivo con referencia `*_Fusionado_En` (trazabilidad).

---

## 2. Principios comunes (aplican a todo el plan)

- **Catálogo estándar** = tabla con: id, nombre (único sin distinguir mayúsculas/espacios, registrar en `app/db/unicidad.py`), descripción opcional, `*_Codigo` interno estable cuando la lógica depende de él, `*_Orden` (int), `*_Activo` (bool, se desactiva en vez de borrar), `created_at`.
- **Nunca** depender del nombre visible en la lógica: usar el código interno (p. ej. `PERSONA`, `EQUIPO`). Los nombres se traducen en la UI con `catalogLabels.ts` cuando son de sistema, y se muestran tal cual cuando los crea el usuario.
- Migraciones **lineales** (cabeza actual: `f3a4b5c6d7e8`), con datos iniciales y **conversión de los datos existentes** (texto libre → id de catálogo), probadas subiendo y bajando contra PostgreSQL real.
- Escrituras auditadas (`gov_repo.create_audit_log`), alcance por sede intacto (RLS), endpoints protegidos por rol (lectura: business; escritura de catálogos: `require_admin`).
- Kardex: los eventos nuevos de licencias deben ir en `EVENTOS_LICENCIA` (`app/models/kardex.py`) y en el CHECK `ck_kardex_tipo` (migración).
- UI: componentes de `src/components/ui`, textos en ES/EN/IT (usted / Lei / inglés sin contracciones), `herramientas-qa/i18n_set.py` para escribir los JSON, `verify.py` en verde.
- Cada bloque termina con: tests backend nuevos + suite completa, `tsc -b`, `eslint src`, `npm run build`, `verify.py`, recorrido Playwright en `inv_qa` desechable, redeploy del formal.

---

## 3. Bloque A — Licencias con activación variable

### 3.1 Modelo de datos (migración `A1`)
Tres catálogos nuevos y cambios en `INV_LICENCIA` / `INV_LICENCIA_CLAVE` (`app/models/software.py`):

| Tabla | Campos clave | Semilla |
|---|---|---|
| `INV_MODELO_COMERCIAL` (MCO) | nombre, código, orden, activo | Perpetua, Suscripción, OEM, Volumen, SaaS, Prueba, Gratuita/Open source |
| `INV_METODO_ACTIVACION` (MAC) | nombre, código, **campos requeridos**: `MAC_Pide_Usuario`, `MAC_Pide_Secreto`, `MAC_Pide_Serial`, `MAC_Pide_Clave`, `MAC_Pide_Servidor`, `MAC_Pide_Archivo`, `MAC_Pide_Dispositivo`; etiquetas opcionales para cada campo (p. ej. «Correo» en vez de «Usuario») | Serial · Product key · Serial + key · Cuenta (correo + clave) · Servidor de licencias (host:puerto) · Archivo de licencia · Llave USB (dongle) · Token / API key · Sin credencial |
| `INV_FORMA_CONTEO` (FCO) | nombre, código (`EQUIPO`, `PERSONA`, `CONCURRENTE`, `SITIO`) | Por equipo, Por persona (usuario nominal), Concurrente, Por sitio / ilimitada |

- `INV_TIPO_LICENCIA` actual: se conserva como **modelo comercial** (renombrar en UI) o se migra a `INV_MODELO_COMERCIAL` (decidir en la sesión; recomendado migrar y dejar `TLI_*` como alias de lectura una versión).
- `INV_LICENCIA`: agregar `MCO_Modelo_Comercial`, `MAC_Metodo_Activacion`, `FCO_Forma_Conteo`, `LIC_Proveedor` (FK proveedor, opcional), `LIC_Fecha_Inicio`, `LIC_Renovacion_Automatica` (bool), `LIC_Notas`.
- `INV_LICENCIA_CLAVE` pasa a ser **credencial / cupo** (un registro por serial, key o cuenta): agregar `LCL_Usuario` (texto, p. ej. correo), `LCL_Secreto_Enc` (cifrado Fernet con `encrypt_field`), `LCL_Serial`, `LCL_Servidor`, `LCL_Archivo` (FK adjunto, opcional), `LCL_Dispositivo`, `LCL_Vence` (fecha propia de la cuenta), `LCL_Ultimo_Cambio_Secreto`. Mantener `LCL_Clave_Activacion` (cifrado) y `LCL_Clave_Hash` (unicidad sin revelar). `LCL_Estado`: DISPONIBLE · ASIGNADA · SUSPENDIDA · BAJA.
- Migración de datos: licencias existentes → método «Product key» si tienen clave, «Sin credencial» si no; forma de conteo «Por equipo».
- Eventos kardex nuevos: `LICENCIA_CREDENCIAL_ALTA`, `LICENCIA_SECRETO_CAMBIADO`, `LICENCIA_SECRETO_VISTO` (este último también en auditoría).

### 3.2 Backend
- CRUD de los 3 catálogos (`app/api/v1/endpoints/catalogs.py` o un router nuevo `/licencias/catalogos`).
- Validación por método: al crear/editar una credencial, exigir exactamente los campos que pide `MAC_*` (error `LICENSE_FIELD_REQUIRED:<campo>`); rechazar campos que el método no usa.
- Asignación según forma de conteo (`app/services/software.py`):
  - `EQUIPO` → `Instalacion` con `ACT_Activo` (como hoy).
  - `PERSONA` → `Instalacion` con `PER_Persona` y la credencial asignada (`LCL_Licencia_Clave`).
  - `CONCURRENTE` / `SITIO` → sin asignación individual; se registra uso opcional y no descuenta cupos (SITIO) o descuenta hasta el máximo de concurrentes.
- `POST /soft/credenciales/{id}/revelar` (rol admin, auditado, rate limit 10/min) devuelve el secreto descifrado; nunca incluirlo en listados ni exportaciones.
- `POST /soft/credenciales/{id}/rotar` (nuevo secreto, guarda fecha, evento kardex).
- Integraciones:
  - **Entrega de puesto**: paso opcional «Licencias» que asigna cupos por persona (p. ej. cuenta de Microsoft 365) en la misma transacción (`ProductividadService.entrega_lote` → parámetro `licencias: [LIC_Licencia]`).
  - **Offboarding** (`traceability.offboarding_persona`): liberar cupos por persona y crear pendiente «Cambiar clave de la cuenta X» en la bandeja de atención.
  - **Bandeja de atención**: `LICENCIA_POR_VENCER` ya existe; agregar `CUENTA_SIN_ROTAR` (> N días configurable) y `CUPOS_AGOTADOS`.
- Tests: validación por método, cifrado (el secreto no aparece en la respuesta de listado ni en CSV), revelar audita, asignación por persona/equipo, offboarding libera cupos, migración de datos.

### 3.3 Frontend (`features/software/`)
- `LicenseDialog`: selector de **forma de activación** que muestra dinámicamente los campos definidos por el catálogo (usuario/correo, clave con campo oculto y generador, serial, servidor, archivo, dispositivo); selector de modelo comercial y forma de conteo.
- Panel de **credenciales / cupos** por licencia: tabla con estado, asignado a (persona o equipo), vence, «Mostrar» (oculta a los 30 s, aviso de que queda registrado), «Copiar», «Rotar», carga masiva por pegado (una línea por cuenta: `correo;clave` o `serial;key`) con vista previa.
- Ficha de persona y de activo: sección «Licencias y cuentas» con acciones asignar/liberar.
- Paso «Licencias» en `EntregaPuestoForm` y en el asistente de alta de empleado.
- Catálogos de licencias editables desde el Centro de catálogos (§4.3).

### 3.4 Criterios de aceptación
- Se puede registrar: Microsoft 365 (Suscripción · Cuenta correo+clave · Por persona, 10 cuentas), Windows (OEM · Product key · Por equipo), un software de ingeniería (Perpetua · Servidor de licencias · Concurrente, 3 usos), un antivirus (Volumen · Serial + key · Por equipo).
- El usuario crea un método nuevo (p. ej. «Código de suscripción + PIN») y el formulario lo pide sin cambiar código.
- Al dar de baja a una persona, sus cuentas quedan disponibles y aparece el pendiente de cambio de clave.

---

## 4. Bloque B — Catálogos para estandarizar

### 4.1 Campos a convertir (migración `B1`, con conversión de datos existentes)

| Campo actual | Nuevo catálogo | Semilla / conversión |
|---|---|---|
| `INV_MOVIMIENTO.MOV_Motivo` (texto) | `INV_MOTIVO_MOVIMIENTO` (código, aplica_a: ASIGNACION/DEVOLUCION/TRANSFERENCIA/PRESTAMO) + `MOV_Motivo_Detalle` texto | Ingreso de personal, Renovación, Reemplazo por falla, Visita presencial, Préstamo temporal, Cambio de puesto, Renuncia, Fin de préstamo, Reasignación, Otro. Convertir: «Renovacion*»→Renovación, «Asignacion»→Ingreso de personal, «Visita Presencial»→Visita presencial, resto → Otro + detalle |
| Motivos de devolución fijos en `DevolucionDialog.tsx` / `DevolucionLoteDialog.tsx` | mismo catálogo (aplica_a DEVOLUCION) | renuncia, cambio_equipo, fin_prestamo, falla, reasignacion, otro (conservar códigos) |
| `MOTIVOS_BAJA` / `DESTINOS_BAJA` (constantes en `app/schemas/core.py` y `src/types/kardex.ts`) | `INV_MOTIVO_BAJA`, `INV_DESTINO_BAJA` (con código fijo; el patrón regex del schema pasa a validar contra el catálogo activo) | los 7 + 7 actuales con sus códigos |
| `INV_SOFTWARE.SOF_Fabricante` (texto) | FK a `INV_MARCA` (`MAR_Marca`), conservar texto una versión | crear marcas faltantes al migrar |
| `INV_CONSUMIBLE.CON_Categoria` / `CON_Unidad` (texto) | `INV_CATEGORIA_CONSUMIBLE`, `INV_UNIDAD_MEDIDA` (compartida) | unidad, caja, paquete, rollo, litro, ml, metro, kg, g; categorías: Limpieza, Cables, Tintas y tóner, Baterías, Herramienta, Otro |
| `INV_TIPO_ESPECIFICACION.TES_Unidad_Medida` (texto) | FK a `INV_UNIDAD_MEDIDA` | GB, TB, MHz, GHz, pulgadas, W, mAh, núcleos |
| Especificaciones libres | `INV_ESPECIFICACION_TIPO_ACTIVO` (qué especificaciones pide cada tipo, obligatoria sí/no, valores permitidos opcionales) | Laptop/Desktop: RAM, Almacenamiento, Procesador, Sistema operativo; Monitor: Tamaño pantalla; UPS: Potencia |
| `INV_AREA.ARE_Tipo_Acceso` (texto) | `INV_TIPO_AREA` (código BODEGA, OFICINA, REMOTO, SERVICIO_TECNICO, OTRO) | Bodega IT→BODEGA, Home office→REMOTO, Servicio técnico→SERVICIO_TECNICO, resto→OFICINA. La devolución sugiere/limita a áreas BODEGA |
| `INV_MANTENIMIENTO.MAN_Descripcion_Falla` / `DMA_Accion_Realizada` | `INV_TIPO_FALLA`, `INV_ACCION_MANTENIMIENTO` + detalle texto | Fallas: No enciende, Pantalla, Batería, Disco, Teclado/touchpad, Red, Software/SO, Daño físico, Otro. Acciones: Limpieza, Cambio de pieza, Reinstalación SO, Actualización, Garantía, Otro |
| `INV_ADJUNTO.ADJ_Categoria` (lista fija) | unificar con `INV_TIPO_EVIDENCIA` | conservar códigos actuales |
| `INV_KARDEX.KDX_Documento_Tipo` y referencias de factura/ticket | `INV_TIPO_DOCUMENTO` (FACTURA, TICKET, ACTA, ORDEN_COMPRA, RECEPCION, OTRO) | solo catálogo; el kardex sigue guardando el código (es de solo inserción) |
| Kit sugerido (hoy se deduce) | `INV_KIT_ESTANDAR` (por cargo o departamento) + `INV_KIT_ESTANDAR_ITEM` (tipo de activo, cantidad, licencia opcional) | vacío; el usuario lo arma. `kit-sugerido` usa el kit estándar si existe y la deducción actual como respaldo |

### 4.2 Backend
- Un **servicio genérico de catálogos** (`app/services/catalogo_generico.py`) parametrizado por modelo: listar (con inactivos opcional), crear, editar, desactivar/reactivar, reordenar, **fusionar** (`POST /catalogos/{tipo}/{origen}/fusionar/{destino}`: reasigna todas las FKs del origen al destino en una transacción, marca origen inactivo con `*_Fusionado_En`, auditoría `CATALOG_MERGE`). Registrar por tipo las tablas/columnas que lo referencian.
- Los endpoints existentes de marcas, modelos, tipos, estados, etc. siguen funcionando (compatibilidad); el genérico se usa para los nuevos.
- Validaciones de los esquemas que hoy usan regex fijos (baja, devolución) pasan a validar contra el catálogo activo.
- Calidad de datos (`ProductividadService.calidad_datos`): agregar verificaciones `marcas_similares` (nombres que difieren solo en mayúsculas/acentos/1–2 letras, p. ej. Kingstom/Kingston) con propuesta de fusión, y `especificaciones_faltantes` (según `INV_ESPECIFICACION_TIPO_ACTIVO`).

### 4.3 Frontend — Centro de catálogos
- Página única `/config/catalogos` (grupo «Catálogos y sistema»): lista lateral de catálogos agrupados (Activos · Movimientos y bajas · Licencias · Consumibles · Mantenimiento · Ubicaciones · Documentos), tabla editable en línea (nombre, descripción, orden por arrastre, activo), búsqueda, «Fusionar» (elige destino, muestra cuántos registros se moverán, confirma).
- Las páginas actuales de Marcas/Modelos/Tipos quedan como accesos directos o se integran como pestañas.
- Formularios: reemplazar los campos de texto libre por `Autocomplete` del catálogo con opción «Agregar nuevo…» (solo roles admin) y campo «Detalle» cuando el elemento es «Otro».
- Movimientos, devolución, baja, mantenimiento y consumibles usan los catálogos nuevos.

### 4.4 Criterios de aceptación
- Ningún formulario operativo pide texto libre donde hay un catálogo (salvo «detalle»).
- Fusionar «Kingstom» en «Kingston» mueve sus modelos y activos y deja auditoría.
- Los reportes y el kardex agrupan por motivo/falla/acción.

---

## 5. Bloque C — Control del usuario sobre el sistema

1. **Acciones según el estado** (menú «⋯» por fila en Activos, Movimientos, Empleados, Licencias): solo las acciones válidas para el estado y el rol (asignar si está disponible; devolver/transferir si está asignado; cerrar ticket si está en reparación; ver kardex, etiqueta, hoja de vida siempre). Reutilizar una función única `accionesDisponibles(activo, estado, permisos)` en `src/utils/acciones.ts`.
2. **Edición en lote** (Activos): cambiar ubicación (área), costo y moneda, fecha de fin de garantía, proveedor/factura y especificaciones para la selección. Backend `PATCH /core/activos/lote` (transaccional, auditado, evento kardex `CAMBIO_ESTADO`/`ESPECIFICACION` por activo). Resuelve los 197 activos sin costo.
3. **Ficha 360 de la persona** (`/empleados/:id` como página, no diálogo): datos, equipos en custodia, licencias y cuentas, consumibles recibidos, historial (kardex por persona), acciones: entregar puesto, devolver todo, asignar licencia, salida del empleado, generar acta consolidada.
4. **Ficha del activo como página** (`/activos/:codigo`): mismas pestañas del diálogo actual + acciones según estado arriba; el diálogo puede quedar como vista rápida.
5. **Tablas configurables**: columnas visibles, orden y densidad por usuario (localStorage por página; luego opcionalmente en servidor), exportar lo filtrado.
6. **Deshacer**: snackbar con «Deshacer» durante 8 s para acciones reversibles (asignación → devolución automática con motivo «Revertido», edición en lote → restaurar valores). No aplica a bajas aprobadas ni al kardex (se registra el evento inverso).
7. **Ayuda contextual**: recorrido breve la primera vez en cada módulo (3–4 pasos, se puede omitir, se recuerda por usuario) y enlace «¿Cómo se hace?» en cada página.
8. **Notificaciones dentro del sistema** (campana en la barra lateral) mientras el correo siga pausado: vencimientos de licencias y garantías, préstamos vencidos, aprobaciones pendientes, cuentas sin rotar.
9. **Mis pendientes** en el tablero, filtrado por rol (técnico: tickets y entregas; jefe TI: aprobaciones; auditor: alertas de integridad).

---

## 6. Orden de implementación (paso a paso)

| Paso | Contenido | Entregable verificable |
|---|---|---|
| 0 | Commit de lo existente en rama `feature/productividad-licencias` (pedir confirmación). Pedir decisiones de la §1 | Rama creada |
| 1 | Bloque B §4.2: servicio genérico de catálogos + fusión + tests | Tests de CRUD/fusión en verde |
| 2 | Bloque B §4.1: migración `B1` (motivos, bajas, unidades, categorías de consumible, tipos de área, fallas/acciones, tipos de documento, especificaciones por tipo, kit estándar) con conversión de datos; probar subida/bajada | `alembic heads` = 1, datos del formal convertidos en `inv_qa` |
| 3 | Bloque B §4.3: Centro de catálogos + formularios con Autocomplete de catálogo | Recorrido Playwright |
| 4 | Bloque A §3.1–3.2: migración `A1` de licencias + servicio + revelar/rotar + asignación por forma de conteo + tests | Criterios §3.4 por API |
| 5 | Bloque A §3.3: UI de licencias dinámica, credenciales, carga masiva, integración con entrega de puesto, alta y offboarding | Criterios §3.4 en navegador |
| 6 | Bloque C 1–2: acciones según estado + edición en lote | 197 costos cargables en lote |
| 7 | Bloque C 3–4: fichas 360 de persona y activo como páginas | Recorrido Playwright |
| 8 | Bloque C 5–9: tablas configurables, deshacer, ayuda contextual, notificaciones, mis pendientes | Recorrido Playwright |
| 9 | Calidad de datos ampliada (marcas similares, especificaciones faltantes) y documentación (`CONTINUAR.md`, `ESTADO_Y_PENDIENTES.md`, `docs/RBAC_MATRIX.md`) | Documentos actualizados |
| 10 | Validación final completa + redeploy del formal (aplicar migraciones con respaldo previo `pg_dump`) | Formal actualizado, datos intactos |

**Antes de migrar el formal:** `docker exec lombardi-db-1 pg_dump -U invuser -d inventario --no-owner | gzip > C:\Lombardi\backups\lombardi_pre_<bloque>_<fecha>.sql.gz`, probar la migración primero en `inv_qa` cargado con el JSON del Excel (`app/importar_inventario_gt.py`) y verificar el kardex (`app.db.kardex_integridad.verificar`).

---

## 7. Comandos útiles

```bash
# Suite backend (PostgreSQL real)
python herramientas-qa/pruebas_backend.py            # toda
python herramientas-qa/pruebas_backend.py -k licen   # filtrada

# Frontend
cd inventarioTI-frontend && npx tsc -b && npx eslint src && npm run build && python ../herramientas-qa/verify.py

# Traducciones (spec: {"es": {"a.b": "texto"}, "en": {...}, "it": {...}}; null borra)
python herramientas-qa/i18n_set.py spec.json

# Stack desechable para pruebas de navegador (borrar al terminar)
cd inventarioTI-backend/deploy
docker compose -p inv_qa --env-file ../../herramientas-qa/revision.env up -d --build
docker cp <json del Excel> inv_qa-backend-1:/tmp/inventario_gt.json
docker exec inv_qa-backend-1 python -m app.importar_inventario_gt /tmp/inventario_gt.json
docker compose -p inv_qa --env-file ../../herramientas-qa/revision.env down -v

# Generar el JSON del Excel (local, requiere openpyxl)
python inventarioTI-backend/scripts/excel_inventario_gt.py "C:/Lombardi/Inventario GT.xlsx" salida.json
```

Notas Windows: `PYTHONIOENCODING=utf-8`; en Git Bash `MSYS_NO_PATHCONV=1` para rutas de contenedor; los heredocs de bash con backticks fallan en esta herramienta: escribir scripts de edición a un archivo y ejecutarlos.
