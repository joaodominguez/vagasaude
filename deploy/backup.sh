#!/usr/bin/env bash
# Backup diário dos dados do VagaSaúde (vagas em jobs.json + jobs.db, alertas, estado).
# Uso no servidor (cron do ROOT — a app grava alguns ficheiros só legíveis pelo root, ex.
# alerts.json; como portal o tar falhava e o arquivo saía sem os alertas):
#   0 3 * * *  /var/www/vagasaude/backup.sh                                   (PT)
#   15 4 * * * VAGASAUDE_ROOT=/var/www/vacantessalud /var/www/vagasaude/backup.sh  (ES)
#   45 4 * * * VAGASAUDE_ROOT=/var/www/vagasaudebr /var/www/vagasaude/backup.sh    (BR)
set -euo pipefail
umask 077

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

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# jobs.db: cópia consistente com a API de backup do SQLite (o site pode estar a gravar).
SNAPSHOT_ARGS=()
if [[ -f "$DATA_DIR/jobs.db" ]]; then
  python3 - "$DATA_DIR/jobs.db" "$TMP/jobs.db.snapshot" <<'PY'
import sqlite3, sys
src = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True, timeout=60)
dst = sqlite3.connect(sys.argv[2])
src.backup(dst)
dst.close(); src.close()
PY
  # No arquivo fica como jobs.db.snapshot (para restaurar: renomear para data/jobs.db).
  SNAPSHOT_ARGS=(-C "$TMP" jobs.db.snapshot)
fi

# As cópias diárias (*.bak-daily-*) já existem à parte na pasta data/; não duplicar.
tar -czf "$ARCHIVE" \
  --exclude='*.bak-daily-*' --exclude='*.tmp-*' --exclude='jobs.db' --exclude='jobs.db-journal' \
  -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")" \
  "${SNAPSHOT_ARGS[@]}"
chmod 600 "$ARCHIVE"

# Cópia externa opcional (rclone remote "storagebox" pré-configurado).
if command -v rclone >/dev/null 2>&1 && [[ "${BACKUP_RCLONE_REMOTE:-}" != "" ]]; then
  rclone copy "$ARCHIVE" "$BACKUP_RCLONE_REMOTE"
fi

find "$DEST" -name 'vagasaude-data-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Backup OK: $ARCHIVE ($(du -h "$ARCHIVE" | awk '{print $1}'))"
