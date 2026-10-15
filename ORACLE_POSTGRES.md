# Perfiles de base de datos

La aplicación comparte el mismo backend y frontend, pero tiene dos perfiles de base de datos:

- PostgreSQL: `.env.example`, `docker-compose.yml` y las migraciones de `app/alembic`.
- Oracle: `.env.oracle.example` y el baseline de `app/alembic_oracle`.

La ruta detallada, sin costos externos, está en
[`docs/ORACLE_FREE_LOCAL_VALIDATION.md`](docs/ORACLE_FREE_LOCAL_VALIDATION.md).

## PostgreSQL

```powershell
docker compose up -d --build
```

## Oracle

Oracle debe estar disponible como una instancia 19c, 21c o 23ai con un servicio/PDB accesible.
Copiar `.env.oracle.example` a `.env`, completar las credenciales y levantar solo el backend,
frontend y servicios auxiliares contra esa instancia. El migrador selecciona automáticamente
`app/alembic_oracle` cuando `DB_ENGINE=oracle`.

El baseline Oracle crea el esquema desde los modelos SQLAlchemy y reemplaza índices parciales
de PostgreSQL por índices únicos basados en expresiones `CASE`. La validación final debe hacerse
contra una instancia Oracle real; no se debe declarar Oracle listo únicamente por compilar.

## Diferencias deliberadas

RLS, réplica de lectura, triggers PL/pgSQL y algunas funciones de mantenimiento son capacidades
específicas de PostgreSQL. En Oracle se usa el alcance de datos de la aplicación y el trigger
PL/SQL del baseline. Las reglas de negocio críticas también se validan en services y con índices
equivalentes.
