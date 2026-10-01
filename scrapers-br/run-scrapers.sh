#!/usr/bin/env bash
# Cron helper — só BR. Nunca aponta para o ingest PT.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export INGEST_BASE_URL="${INGEST_BASE_URL:-http://127.0.0.1:3011}"
# Token: preferir env do sistema / ficheiro da app BR
if [[ -z "${SCRAPER_API_TOKEN:-}" && -f /var/www/vagasaudebr/.env.production ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  source /var/www/vagasaudebr/.env.production
  set +a
fi

if [[ -d "$ROOT/.venv" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
fi

exec python3 "$ROOT/run.py" --source all
