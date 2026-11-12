#!/usr/bin/env bash
# Helper per cron -- solo IT (Offerte Sanita'). NON usato in produzione: il deploy e' rimandato
# (vedi apps/web-it/README-IT.md). Mai verso l'ingest PT (3010), BR (3011) o ES (3012).
# I percorsi /var/www/offertesanita sono segnaposto, da confermare al momento del deploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH:-}"
APP_DIR="${APP_DIR:-/var/www/offertesanita}"
DATA_DIR="${DATA_DIR:-$APP_DIR/data}"

# Token + Resend: file della app IT (quando esistera').
if [[ -f "$APP_DIR/.env.production" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$APP_DIR/.env.production"
  set +a
fi
# Fissato DOPO il .env (che puo' definire PORT) cosi' nulla lo sovrascrive.
export INGEST_BASE_URL="http://127.0.0.1:3014"

if [[ -d "$ROOT/.venv" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
fi

# Una fonte in errore fa uscire run.py con rc=1, ma le offerte buone sono gia' state inviate.
scrape_rc=0
python3 "$ROOT/run.py" --source all || scrape_rc=$?
if [[ "$scrape_rc" -ne 0 ]]; then
  echo "[run-scrapers-it] run.py terminato con rc=$scrape_rc (errore parziale); si prosegue."
fi

# Fonti guaste (ultime 4 esecuzioni a 0 offerte o in errore) + integrita' di jobs.json.
(
  export NEXT_PUBLIC_SITE_URL="https://offertesanita.it"
  python3 "$ROOT/tools/scraper_health.py" "$DATA_DIR/scraper-runs.json"
  python3 "$ROOT/tools/jobs_integrity.py" "$DATA_DIR" http://127.0.0.1:3014 /offerte/ || true
) || true

# Google Indexing API: TODO -- progetto Google Cloud e chiave dedicati a offertesanita.it,
# da creare solo dopo approvazione. Nessuna chiave in questo repository.

# Digest delle nuove offerte agli iscritti IT (solo se Resend e' configurato).
if [[ -n "${RESEND_API_KEY:-}" && -n "${SCRAPER_API_TOKEN:-}" ]]; then
  curl -sS -X POST "http://127.0.0.1:3014/api/alerts/digest" \
    -H "Authorization: Bearer ${SCRAPER_API_TOKEN}" \
    -H "Content-Type: application/json" \
    || true
  echo
fi
