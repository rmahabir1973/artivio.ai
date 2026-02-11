#!/bin/bash

BACKUP_DIR="/home/runner/workspace/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/production_backup_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

if [ -z "$PRODUCTION_DATABASE_URL" ]; then
  echo "Error: PRODUCTION_DATABASE_URL is not set."
  exit 1
fi

echo "Starting production database backup..."
echo "Timestamp: $(date)"
echo "Output: ${BACKUP_FILE}"

pg_dump "$PRODUCTION_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=plain \
  > "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
  FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  TABLES=$(grep -c "CREATE TABLE" "$BACKUP_FILE" || echo 0)
  echo "Backup completed successfully!"
  echo "File size: ${FILESIZE}"
  echo "Tables found: ${TABLES}"
  
  gzip "$BACKUP_FILE"
  GZIP_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
  echo "Compressed to: ${BACKUP_FILE}.gz (${GZIP_SIZE})"
  
  MAX_BACKUPS=5
  BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/production_backup_*.sql.gz 2>/dev/null | wc -l)
  if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    ls -1t "${BACKUP_DIR}"/production_backup_*.sql.gz | tail -n "$REMOVE_COUNT" | xargs rm -f
    echo "Cleaned up ${REMOVE_COUNT} old backup(s). Keeping last ${MAX_BACKUPS}."
  fi
else
  echo "Error: Backup failed!"
  cat "$BACKUP_FILE" 2>/dev/null
  rm -f "$BACKUP_FILE"
  exit 1
fi
