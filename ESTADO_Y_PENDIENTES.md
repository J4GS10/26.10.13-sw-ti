# InventarioTI: estado actual y pendientes

> Corte: **2026-10-02** (sesión 13) · Repositorio: `J4GS10/Inventario-TI`, rama `main`, commit `53f490f`.
> Este documento consolida el avance y **todo lo que falta**, por prioridad. Reemplaza las listas de pendientes anteriores (`CONTINUAR.md` §4 y `PROGRESS.md` §3, que quedan como histórico).
> Detalle técnico: `INFORME_EJECUTIVO_Y_PLAN.md` §8 (fases) y §9 (control interno).

---

## 1. Resumen

El sistema ya cubre los cinco controles solicitados: inventario, asignaciones, bitácora de entradas y salidas, reasignaciones de equipos y componentes, y licencias. Funcionan en pantalla, CSV y PDF sobre un **kardex unificado, completo y verificable**, con **aprobación del Jefe de TI** para bajas y sobrantes y **costo promedio ponderado** en consumibles.

**No está listo para producción todavía.** Faltan:
- la QA visual y la QA integral de cierre;
- la prueba con usuarios reales;
- la infraestructura definitiva (correo, Active Directory, certificados e imagen de MinIO);
- la depuración de los datos de prueba.

| Indicador | Valor |
|---|---|
| Pruebas del backend (PostgreSQL 16, RLS real) | **395/395** |
| Frontend | `tsc`, `eslint` y `build` sin errores; 3 idiomas con las mismas claves (verify.py) |
| QA de API sobre el stack de producción (`qa9_fases.py`) | **33/33** |
| Verificador RBAC (`scripts/check_rbac.py`) | 0 endpoints de escritura sin control de rol |
| Migraciones | lineales hasta `f3a4b5c6d7e8`, probadas en limpio y sobre los datos reales |
| Kardex de la base de revisión | 362 eventos sellados; cadena íntegra |

---

## 2. Lo realizado

### 2.1 Base y seguridad (fases 0 a 2)
- Monorepo formal y CI en GitHub Actions: backend contra PostgreSQL 16, cabeza única de Alembic; frontend con `tsc`, `eslint`, `build` y traducciones.
- Respaldos programados de PostgreSQL y MinIO, con scripts de restauración.
- MinIO con versionado, retención, cifrado SSE y usuario de servicio propio.
- Máquina de estados de activos y órdenes: el estado solo cambia por operaciones válidas.
- Script de diagnóstico de datos `python -m app.diagnostico_inventario` (con la opción `--corregir`).
- Seguridad:
  - límites del rol de seguridad;
  - permisos de base de datos sobre las cuentas;
  - MFA de un solo uso;
  - validación del contenido de los adjuntos;
  - unicidad sin distinguir mayúsculas ni espacios;
  - límite de peticiones por usuario.

### 2.2 Operación y trazabilidad (fases 3 a 6)
- **Compras:** recepción parcial con pendiente por línea, precio real con tolerancia de ±2 % y justificación, conformidad de fletes y servicios, cierre con faltante, cada entrega con su documento.
- **Kardex unificado** (`/trazabilidad`): entradas y salidas, reasignaciones, custodia a una fecha, hoja de vida en PDF, CSV.
- **Ficha del activo como centro de acciones:** asignar, devolver, transferir, mantenimiento, componentes, baja y hoja de vida.
- **Componentes** con historial; **licencias** con costo, moneda, historial y motivo de retiro.
- **Toma de inventario físico** con QR y conciliación (`/inventario/tomas`).
- **El sistema propone el siguiente paso** tras cada acción, y el tablero tiene la bandeja **«Requiere su atención»**.
- Traducción de todos los códigos de error, hora de Guatemala, bitácora de auditoría legible.

### 2.3 Control interno profesional (sesión 13)
- **Rol JEFE_TI**:
  - las bajas y los sobrantes de compras quedan **pendientes** hasta que **otra persona** los aprueba;
  - el equipo queda congelado mientras tanto;
  - el kardex registra quién solicitó y quién aprobó;
  - pantalla `/aprobaciones`.
- **Costo promedio ponderado** en consumibles (una moneda de valoración por consumible) y valor del saldo en cada evento. Los equipos y las licencias mantienen su costo individual de compra.
- **Bitácora completa:** saldo inicial, traslado de bodega y baja de licencias.
- **Kardex verificable:** secuencia sin huecos, hash SHA-256 encadenado y bloqueo del vaciado de la tabla. Se verifica con el botón **«Verificar integridad»** de Trazabilidad.
- **Entorno de revisión:** cuenta `jefe.ti` (credenciales en `herramientas-qa/salidas/credenciales_jefe.json`, no versionado).

---

## 3. Lo que falta, por prioridad

### 🔴 A. Imprescindible antes de producción

| # | Pendiente | Por qué | Cómo se cierra |
|---|---|---|---|
| A1 | **QA visual de las pantallas nuevas**: Trazabilidad, Tomas de inventario, Aprobaciones, Recepción de compras, ficha del activo, bandeja del tablero, consumibles y licencias | La QA de las sesiones 12 y 13 fue por API; la interfaz no se ha recorrido con Playwright | Ampliar `herramientas-qa` (qa8 y shots) a estas rutas, en 3 idiomas y en escritorio, tableta y móvil |
| A2 | **QA integral de cierre** con los 8 agentes de `PROMPT_QA.md` | Es el criterio de salida acordado | Ejecutar qa1 a qa8 completos y actualizar `herramientas-qa/INFORME_QA.md` |
| A3 | **Prueba con usuarios reales (UAT)** del flujo completo: compra, recepción, asignación, devolución, baja con aprobación y toma de inventario | Validar que el flujo se ajusta a la operación diaria de Lombardi | Sesión guiada con el Jefe de TI y un técnico, con lista de verificación |
| A4 | **Aviso por correo al Jefe de TI** cuando hay una solicitud pendiente, y al solicitante cuando se resuelve | Hoy el aviso solo aparece en la bandeja y en la pantalla Aprobaciones | Plantillas y regla de notificación (depende de B1 para salir realmente) |
| A5 | **Depurar los datos de prueba**: registros QA1 a QA9 (órdenes, consumibles, proveedores, personas y cuentas qa*) | No deben llegar a producción | Arrancar producción con importación limpia del `dataset/`, o script de limpieza revisado |
| A6 | **Revisar y aprobar la corrección de incoherencias heredadas** (`python -m app.diagnostico_inventario`): 2 bajas con custodia abierta, historiales antiguos y 3 índices de unicidad pendientes por duplicados | El kardex debe partir de datos sanos | Revisar el reporte con el área usuaria y ejecutar `--corregir` |
| A7 | **Confirmar que el CI de GitHub pasa** con los cambios de las sesiones 12 y 13 | No se pudo verificar desde aquí (sin `gh`) | Revisar la pestaña *Actions* del repositorio |

### 🟠 B. Dependen de infraestructura o de una decisión de Lombardi

| # | Pendiente | Qué se necesita |
|---|---|---|
| B1 | **Correo** (pausado) | Cuenta de servicio y plataforma: Exchange, Microsoft 365 (Graph) o Google |
| B2 | **Active Directory real** | LDAPS, certificado de la CA interna, OU y grupo de administradores; revisar la primera simulación |
| B3 | **Certificado TLS y dominio de producción** | Hoy Caddy usa una CA local en revisión |
| B4 | **Imagen de MinIO** | Está fijada por digest local porque Docker Hub dejó de publicarla. Elegir la fuente definitiva (por ejemplo `cgr.dev/chainguard/minio`) o un registro interno (ver `DEPLOYMENT.md` §8.2) |
| B5 | **Protección de la rama `main`** | Requiere GitHub Pro o un repositorio de organización |
| B6 | **Cuentas reales y roles** | Quién será JEFE_TI (y su suplente), ADMIN_SEGURIDAD, ADMIN_TI y técnicos; asignar sedes a cada cuenta (hoy todas tienen alcance global por compatibilidad) |
| B7 | **Prueba de restauración** de respaldos en el servidor de producción | Ventana de mantenimiento y almacenamiento externo para las copias |
| B8 | Términos en italiano («bene/beni», «reparto») | Decisión de redacción (sigue abierta) |

### 🟡 C. Mejoras funcionales recomendadas

| # | Mejora | Valor |
|---|---|---|
| C1 | **Extender las aprobaciones** a ajustes de inventario de consumibles por encima de un umbral, cierre de órdenes con faltante y cancelación de órdenes | Completa la separación de funciones en todas las salidas de inventario |
| C2 | **Seguimiento de faltantes de la toma de inventario**: estado «No localizado», investigación y, si no aparece, baja por pérdida con aprobación | Hoy el faltante queda registrado, pero sin un flujo de resolución |
| C3 | **Anclaje automático del sello del kardex**: reporte mensual con el último hash, enviado por correo o archivado fuera del sistema | Prueba de no manipulación sin depender de que alguien lo anote |
| C4 | **Reporte de existencias valorizadas** de consumibles, al costo promedio, por sede y moneda | Cierre contable mensual |
| C5 | **Depreciación de activos** (método y vida útil por tipo), solo si Finanzas lo requiere en este sistema | Valor en libros; hoy se guarda solo el costo histórico |
| C6 | **Pantallas de catálogo faltantes**: estados operativos, tipos de especificación, tipos de conexión y cargos | Hoy solo se administran por base de datos o API |
| C7 | **Búsqueda global (Ctrl+K)**, **acciones en lote** (asignar o imprimir etiquetas de varios) y **«deshacer»** en acciones rápidas | Productividad diaria |
| C8 | **Avisos previos**: la persona ya tiene un equipo del mismo tipo; el equipo sigue en garantía antes de una baja o reparación | Evita errores operativos |
| C9 | **Vista en tarjetas para móvil** en todas las tablas | Uso en bodega con el teléfono |
| C10 | **Totales en una sola moneda** con un tipo de cambio de referencia (opcional) | Hoy los totales se muestran por moneda (GTQ, USD, CHF), sin convertir |

### 🟢 D. Calidad técnica y operación

| # | Mejora |
|---|---|
| D1 | Integrar los flujos de Playwright de `herramientas-qa/` en el CI |
| D2 | Paginación en el servidor para Personas, Usuarios y Movimientos (hoy filtran en el navegador; conviene antes de llegar a miles de registros) |
| D3 | Revisar los límites de peticiones por IP restantes (una oficina detrás de un único NAT comparte IP) |
| D4 | Deuda técnica sin impacto funcional: extender `AsyncQueryBuilder` a 5 repositorios, `BaseService` en los servicios de soporte y pruebas unitarias propias |
| D5 | Oracle (alternativo): sin migraciones incrementales, sin CI y sin la capa RLS de base de datos; fuera de alcance mientras producción sea PostgreSQL |
| D6 | Entorno de desarrollo en Windows: Docker Desktop pierde a veces el reenvío de puertos tras suspender el equipo; se resuelve reiniciando el contenedor afectado (Caddy o `inv_pgtest`) |
| D7 | Borrar el archivo temporal `C:\tmp_c.txt` (quedó de un conteo de pruebas; su eliminación requiere confirmación manual) |

---

## 4. Ruta sugerida para salir a producción

1. **A7 → A1 → A2**: CI en verde, QA visual y QA integral. Corregir lo que aparezca.
2. **B6 + A3**: definir las cuentas reales y hacer la prueba con usuarios.
3. **A6 + A5**: sanear datos y preparar la carga limpia.
4. **B1, B2, B3, B4, B7**: infraestructura definitiva y prueba de restauración.
5. **A4**: avisos por correo de aprobaciones (requiere B1).
6. Despliegue con el runbook de `inventarioTI-backend/DEPLOYMENT.md`. Anotar el primer sello del kardex.
7. Después de salir: mejoras C1 a C10 y D1 a D4, según prioridad del área.

---

## 5. Cómo retomar el trabajo

- **Stack de revisión:** `python herramientas-qa/levantar_revision.py` → https://localhost:8443 (`sa` y `jefe.ti`; credenciales en `herramientas-qa/salidas/`, no versionado). No tocar el stack `lombardi` (puertos 80 y 443).
- **Pruebas del backend:** `python herramientas-qa/pruebas_backend.py` (siempre contra PostgreSQL, nunca SQLite).
- **Frontend:** `npx tsc -b && npx eslint src && npm run build` y `python ../herramientas-qa/verify.py` desde `inventarioTI-frontend/`.
- **QA de API de las fases nuevas:** `python herramientas-qa/crear_jefe_ti.py` (una vez) y `python herramientas-qa/qa9_fases.py`.
- **Traducciones nuevas:** `python herramientas-qa/i18n_set.py spec.json` con `{"es": {...}, "en": {...}, "it": {...}}`.
- **Convenciones:**
  - tono formal (usted, Lei, inglés sin contracciones);
  - textos siempre con `t()` en los 3 idiomas;
  - migraciones lineales probadas en PostgreSQL real;
  - `dataset/`, `herramientas-qa/revision.env` y `herramientas-qa/salidas/` no se versionan.
