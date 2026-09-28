# Prompt para la sesión de QA integral

> Copie el bloque siguiente como primer mensaje de la próxima sesión.

---

Actúa como **líder de QA** del sistema InventarioTI (`C:\Lombardi\codigo`). Antes de nada lee `CONTINUAR.md`, `inventarioTI-backend/DEPLOYMENT.md`, `inventarioTI-backend/docs/RBAC_MATRIX.md` y `herramientas-qa/README.md`. Respóndeme siempre en español.

**Regla de oro: todo se prueba sobre el stack de PRODUCCIÓN**, el compose oficial `inventarioTI-backend/deploy/docker-compose.yml` (Caddy TLS → nginx → gunicorn ×4 → PostgreSQL 16 + réplica, Redis, MinIO), nunca con `uvicorn` ni SQLite.
- Levántalo con `python herramientas-qa/levantar_revision.py` (proyecto `inv_ui`, https://localhost:8443, inventario real de `codigo/dataset`, `sa` / `Ui-Passw0rd-Revision!`; `sa` deberá enrolar MFA).
- Si cambias código, reconstruye el stack antes de volver a probar.
- No toques el stack `lombardi` (puertos 80/443) salvo que yo lo pida.
- Comprueba en el log del backend que aparezca `rls.db_layer_active`.

## Fase 1 — Pruebas en paralelo con subagentes

Lanza **subagentes en paralelo**, uno por área. Cada uno prueba contra el stack de producción, por API (httpx) y en navegador (Playwright), y entrega un informe con: caso, pasos, resultado esperado, resultado obtenido, evidencia (captura, respuesta HTTP o log) y severidad (bloqueante / alta / media / baja).

1. **CRUD completo.** Catálogos (marcas, modelos, tipos, estados), ubicaciones (país → área), organización (departamentos, cargos, personas), activos y especificaciones, software y licencias (incluidas las claves individuales), consumibles, proveedores y órdenes de compra. Para cada uno: crear, leer, editar, desactivar o borrar; validaciones de campos; duplicados; borrar lo que está en uso; paginación y filtros.
2. **Lógica de negocio.** Máquina de estados del activo; asignación, devolución, transferencia y préstamo; offboarding (incluido el parcial por alcance); mantenimiento (abrir, detalles, cerrar, costo); recepción de órdenes (activos por lote con series, consumibles, licencias con claves); stock mínimo y alertas; garantías; concurrencia (dos usuarios sobre el mismo activo).
3. **Roles y alcance por sede (RLS).** Matriz completa con SUPER_ADMIN, ADMIN_SEGURIDAD, ADMIN_TI, TECNICO, AUDITOR y CONSULTA, con alcance global, de una sede y de varias. Ninguna fila fuera del alcance debe aparecer en listados, detalle, búsquedas, exportes, reportes, tablero ni autocompletado. Escritura fuera del alcance → 403. Verifica también la capa de base de datos (`current_user` = `inventario_rls` en las peticiones).
4. **Seguridad e identidades.** Login, MFA (TOTP y correo, anti-replay), contraseña temporal, historial y lista de bloqueo de contraseñas, bloqueo por intentos, sesiones (lista, cierre individual y global, dispositivo nuevo), refresh y reuso, inactividad, cabeceras, CORS, rate limit, auditoría de cada acción administrativa.
5. **Reportería y documentos.** Actas Word y PDF (individual y por lote), hoja de descargo, etiquetas QR, todos los CSV (activos, movimientos, consumibles, proveedores, órdenes, auditoría) en ES, EN e IT, con el formato de fecha ISO y el alcance aplicado. Abre cada archivo y valida el contenido, no solo el código HTTP.
6. **Adjuntos y MinIO.** Subir PDF, imágenes y facturas a activos y órdenes desde la **interfaz**; descargarlos; confirmar el objeto en el bucket (`herramientas-qa/adjuntos_check.py` como base); límites de tamaño y tipo; borrar; persistencia tras reiniciar los contenedores.
7. **Correo y Active Directory.** Cola de correos con MailHog (plantillas en tono formal), reintentos, notificaciones por evento; sincronización AD simulada.
8. **Interfaz y experiencia (UX).** Recorrer las 20+ rutas en escritorio, tablet y móvil, en los 3 idiomas. Evaluar contra este estándar:
   - **Diálogo, no monólogo:** el sistema confirma cada paso (qué se hizo, qué sigue), informa el progreso y explica los errores en lenguaje claro y formal (usted / Lei / inglés formal).
   - **Formularios claros y atractivos:** secciones con título, solo los campos necesarios, ayudas breves bajo el campo, validación en vivo y valores por defecto sensatos.
   - **Autocompletado relacional** en todos los formularios donde aplique, siempre con su motivo visible («Sugerido: …») y con la opción de restablecerlo.
   - **Consistencia:** `PageHeader`, barra de filtros, `DataTableShell`, `SectionCard`, `EmptyState`, confirmaciones con `useConfirm`, sin textos técnicos ni restos de diseño antiguo.

   Entregar un inventario de pantallas con capturas, puntuación por criterio y propuestas concretas de rediseño.

## Fase 2 — Consolidar y corregir

1. Consolida los informes en `herramientas-qa/INFORME_QA.md`: resumen ejecutivo, matriz de cobertura (módulo × tipo de prueba), defectos por severidad con evidencia, y los hallazgos de UX con propuesta.
2. **Espera mi aprobación** antes de corregir.
3. Luego corrige por prioridad, con un test de regresión por defecto (pytest y/o Playwright). Reconstruye el stack de producción y vuelve a ejecutar todo.
4. Deja los scripts de prueba en `herramientas-qa/`, reutilizables.

## Criterios de salida

- Cero defectos bloqueantes o altos abiertos.
- Backend: `python herramientas-qa/pruebas_backend.py` en verde (solo PostgreSQL 16, el motor de producción; no se usa SQLite en ninguna prueba).
- Frontend: `tsc -b`, `eslint src`, `npm run build` y `verify.py` limpios.
- Flujos E2E en verde contra producción.
- `CONTINUAR.md` actualizado.
