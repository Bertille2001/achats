#!/bin/bash
# Sauvegarde automatique de la base de données BIASA (Postgres dans Docker).
# Pensé pour être lancé chaque nuit via cron.
#
# Vérifie/adapte les 4 variables ci-dessous avant la première utilisation :
#   - CONTAINER_NAME : nom du conteneur Docker Postgres (voir `docker ps`)
#   - DB_USER / DB_NAME : identifiants de connexion (voir biasa/.env -> DATABASE_URL)
#   - BACKUP_DIR : dossier où stocker les sauvegardes (hors du dépôt git)
set -euo pipefail

CONTAINER_NAME="biasa-postgres"
DB_USER="biasa"
DB_NAME="biasa"
BACKUP_DIR="/home/ubuntu/biasa-backups"
RETENTION_JOURS=30

mkdir -p "$BACKUP_DIR"
HORODATAGE=$(date +%Y-%m-%d_%H-%M)
FICHIER="$BACKUP_DIR/biasa_${HORODATAGE}.sql.gz"

docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FICHIER"

echo "$(date '+%Y-%m-%d %H:%M') - Sauvegarde créée : $FICHIER ($(du -h "$FICHIER" | cut -f1))"

# Supprime les sauvegardes de plus de RETENTION_JOURS jours pour ne pas
# saturer le disque au fil du temps.
find "$BACKUP_DIR" -name "biasa_*.sql.gz" -mtime +"$RETENTION_JOURS" -delete
