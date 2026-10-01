#!/usr/bin/env bash
# Cron helper — só BR. Nunca aponta para o ingest PT.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH:-}"
export INGEST_BASE_URL="${INGEST_BASE_URL:-http://127.0.0.1:3011}"

# Token + Resend: preferir env do sistema / ficheiro da app BR
if [[ -f /var/www/vagasaudebr/.env.production ]]; then
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

# Corre os scrapers. Falha parcial não deve abortar o digest.
scrape_rc=0
python3 "$ROOT/run.py" --source all || scrape_rc=$?
if [[ "$scrape_rc" -ne 0 ]]; then
  echo "[run-scrapers-br] run.py terminou com rc=$scrape_rc (falha parcial); a continuar para o digest."
fi

# Envia digest de novas vagas aos subscritores BR (se Resend estiver configurado).
if [[ -n "${RESEND_API_KEY:-}" && -n "${SCRAPER_API_TOKEN:-}" ]]; then
  curl -sS -X POST "http://127.0.0.1:3011/api/alerts/digest" \
    -H "Authorization: Bearer ${SCRAPER_API_TOKEN}" \
    -H "Content-Type: application/json" \
    || true
  echo
fi
