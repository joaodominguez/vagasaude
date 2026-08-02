#!/usr/bin/env bash
# Backup diário dos dados JSON do VagaSaúde (jobs, alertas, estado).
# Uso no servidor: /var/www/vagasaude/backup.sh
set -euo pipefail

ROOT="${VAGASAUDE_ROOT:-/var/www/vagasaude}"
DATA_DIR="${DATA_DIR:-$ROOT/data}"
DEST="${BACKUP_DEST:-$ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date +%F-%H%M)"
ARCHIVE="$DEST/vagasaude-data-$STAMP.tar.gz"

mkdir -p "$DEST"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "DATA_DIR inexistente: $DATA_DIR" >&2
  exit 1
fi

tar -C "$(dirname "$DATA_DIR")" -czf "$ARCHIVE" "$(basename "$DATA_DIR")"
chmod 600 "$ARCHIVE"

# Cópia externa opcional (rclone remote "storagebox" pré-configurado).
if command -v rclone >/dev/null 2>&1 && [[ "${BACKUP_RCLONE_REMOTE:-}" != "" ]]; then
  rclone copy "$ARCHIVE" "$BACKUP_RCLONE_REMOTE"
fi

find "$DEST" -name 'vagasaude-data-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Backup OK: $ARCHIVE ($(du -h "$ARCHIVE" | awk '{print $1}'))"
