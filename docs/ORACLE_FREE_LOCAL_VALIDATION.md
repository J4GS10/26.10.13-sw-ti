# Validación local de Oracle Free — MVP Lombardi

## Objetivo

Validar la versión Oracle del sistema sin Oracle Cloud, sin licencias pagadas y sin
servicios externos. La base Oracle se ejecuta localmente en Docker y se mantiene
separada de PostgreSQL.

## Recursos y costos

Requisitos comprobados en la máquina actual:

- Docker 29.3.1.
- Docker Compose v5.1.0.
- Aproximadamente 40 GB de RAM.
- Aproximadamente 113 GB libres en disco C:.

No se utiliza Oracle Cloud ni un servicio administrado. El único consumo es local:
RAM, disco y descarga de la imagen de Oracle Database Free.

## Ruta de archivos

| Elemento | Ruta |
|---|---|
| Configuración Oracle | `.env.oracle.example` |
| Configuración PostgreSQL | `.env.example` |
| Backend | `codigo/inventarioTI-backend` |
| Modelos SQLAlchemy | `codigo/inventarioTI-backend/app/models` |
| Migraciones PostgreSQL | `codigo/inventarioTI-backend/app/alembic` |
| Migración Oracle | `codigo/inventarioTI-backend/app/alembic_oracle` |
| Migrador | `codigo/inventarioTI-backend/migrator.sh` |
| Configuración de conexión | `codigo/inventarioTI-backend/app/core/config.py` |
| Sesiones SQLAlchemy | `codigo/inventarioTI-backend/app/db/session.py` |
| Pruebas backend | `codigo/inventarioTI-backend/tests` |

## 1. Preparar el perfil Oracle

No sobrescribir el `.env` de PostgreSQL si se desea conservar ese perfil. Crear una
copia de trabajo Oracle:

```powershell
Copy-Item .env.oracle.example .env.oracle.local
```

Editar `.env.oracle.local` y completar, como mínimo:

```env
DB_ENGINE=oracle
ORACLE_HOST=oracle
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=FREEPDB1
ORACLE_USER=INVENTARIO
ORACLE_PASSWORD=una_clave_local_de_prueba
```

El contenedor Oracle Free debe crear el servicio `FREEPDB1` y el usuario/esquema
`INVENTARIO`. Las credenciales son exclusivamente locales y deben cambiarse si se
reutiliza el entorno.

## 2. Levantar Oracle Free local

La imagen de Oracle Database Free puede tardar varios minutos en inicializarse.
Después de crear el contenedor, esperar hasta que el healthcheck indique que la base
está lista. No iniciar migraciones mientras Oracle siga en estado `starting`.

Ejemplo de variables locales para el contenedor:

```powershell
$env:ORACLE_PASSWORD = "una_clave_local_de_prueba"
$env:ORACLE_DATABASE = "FREE"
$env:ORACLE_PDB = "FREEPDB1"
```

La imagen concreta debe ser una imagen Oracle Database Free legalmente disponible
para uso local. El proyecto no depende de Oracle Cloud ni de una cuenta pagada.

## 3. Construir el backend Oracle

```powershell
docker compose build backend
```

`requirements.txt` ya incluye `oracledb`. El backend utiliza SQLAlchemy async con
la URI:

```text
oracle+oracledb://USUARIO:CLAVE@HOST:1521/?service_name=FREEPDB1
```

## 4. Aplicar la migración Oracle

El migrador selecciona automáticamente la rama Oracle cuando `DB_ENGINE=oracle`:

```bash
if [[ "${DB_ENGINE:-postgres}" == "oracle" ]]; then
  alembic -n oracle upgrade head
else
  alembic upgrade head
fi
```

La migración Oracle vigente es:

```text
app/alembic_oracle/versions/2026-07-31_oracle_21c_baseline.py
```

Esa migración crea el esquema desde los modelos y reemplaza los índices parciales
de PostgreSQL por índices Oracle basados en expresiones `CASE`.

## 5. Validación técnica mínima

Antes de probar la interfaz, validar:

```powershell
docker compose ps
docker compose logs backend
docker compose logs oracle
```

Confirmar en los logs:

- conexión exitosa con `FREEPDB1`;
- `alembic -n oracle upgrade head` finalizado;
- bootstrap y catálogos cargados;
- backend en estado `healthy`.

En Oracle validar al menos:

- existencia de `INV_USUARIO`, `INV_ACTIVO`, `INV_MOVIMIENTO` y `INV_AUDITORIA_SISTEMA`;
- existencia de `SYS_SESION` y tablas de 2FA;
- índice único de movimiento abierto;
- índice único de mantenimiento abierto;
- trigger append-only de auditoría;
- constraints de JSON.

## 6. Validación funcional del MVP

Ejecutar en este orden:

1. Healthcheck del backend.
2. Login con usuario administrador.
3. Activación y verificación de TOTP.
4. Refresh de sesión y cookie persistente de 30 días.
5. Creación de marca, modelo y activo.
6. Asignación del activo.
7. Intento de segunda asignación abierta al mismo activo: debe rechazarla.
8. Devolución y comprobación de estado `En Bodega`.
9. Apertura y cierre de mantenimiento.
10. Baja lógica.
11. Revisión de auditoría.
12. Cierre individual y cierre total de sesiones.

El mismo conjunto debe ejecutarse contra PostgreSQL para comprobar que las dos
versiones mantienen el mismo comportamiento de negocio.

## 7. Pruebas automatizadas

Pruebas unitarias rápidas:

```powershell
Set-Location codigo/inventarioTI-backend
python -m pytest tests/ -q
```

Pruebas contra Oracle real:

```powershell
docker compose exec backend python -m pytest tests/ -q
```

La primera ejecución debe registrar por separado cualquier prueba que dependa de
SQLite o de sintaxis PostgreSQL. Esas pruebas no se consideran evidencia Oracle
hasta que hayan sido ejecutadas contra el servicio Oracle.

## 8. Criterio de aceptación Oracle

Oracle se considera listo para el MVP únicamente si se cumplen todos estos puntos:

- migración completa sin errores;
- bootstrap idempotente;
- login, MFA y refresh funcionando;
- CRUD principal funcionando;
- invariantes de asignación y mantenimiento funcionando;
- auditoría append-only funcionando;
- rollback transaccional verificado;
- suite backend ejecutada contra Oracle;
- sin modificar ni depender de la base PostgreSQL.

## 9. Volver a PostgreSQL

Detener el perfil Oracle, restaurar el `.env` PostgreSQL y ejecutar:

```powershell
docker compose up -d --build
```

Los volúmenes y esquemas de ambos motores deben mantenerse separados. Nunca se debe
aplicar `alembic upgrade head` de PostgreSQL sobre Oracle ni `alembic -n oracle`
sobre PostgreSQL.
