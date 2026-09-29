#!/bin/sh
# Restaura los adjuntos desde el respaldo al bucket (no borra objetos existentes).
# Uso (desde deploy/): docker compose run --rm backup_minio /backup/restaurar_minio.sh
set -eu
BUCKET="${S3_BUCKET:-lombardi-adjuntos}"
mc alias set destino http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" > /dev/null
mc mirror --overwrite "/backups/minio/$BUCKET" "destino/$BUCKET"
echo "Adjuntos restaurados en $BUCKET."
