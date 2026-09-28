# Inventario-TI

Sistema de gestión de activos de TI para Lombardi.

| Carpeta | Contenido |
|---|---|
| `inventarioTI-backend/` | API FastAPI + SQLAlchemy + Alembic (PostgreSQL 16). Despliegue: `inventarioTI-backend/DEPLOYMENT.md` |
| `inventarioTI-frontend/` | SPA React 19 + TypeScript + MUI, i18n ES/EN/IT |
| `herramientas-qa/` | Pruebas de backend, flujos E2E (Playwright/httpx) y verificador de traducciones |

- Estado actual y pendientes: [`CONTINUAR.md`](CONTINUAR.md)
- Bitácora por sesión: [`PROGRESS.md`](PROGRESS.md)

## Pruebas rápidas

```bash
python herramientas-qa/pruebas_backend.py          # backend contra PostgreSQL 16
cd inventarioTI-frontend && npx tsc -b && npx eslint src && npm run build
python ../herramientas-qa/verify.py                 # traducciones (desde el frontend)
```

`dataset/` (inventario real) y `herramientas-qa/revision.env` no se versionan.
