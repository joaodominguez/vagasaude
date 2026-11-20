#!/usr/bin/env bash
# Helper per cron -- solo IT (Offerte Sanita', /var/www/offertesanita, app su 127.0.0.1:3014).
# Mai verso l'ingest PT (3010), BR (3011), ES (3012) o vagaeducacao (3013).
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
# Cache dei dettagli inPA (evita ~1900 richieste a ogni esecuzione): nella cartella dati, persistente.
export INPA_CACHE="${INPA_CACHE:-$DATA_DIR/inpa-cache.json}"
# Cache delle pagine Randstad (pilota agenzie): solo le offerte nuove si scaricano.
export RANDSTAD_CACHE="${RANDSTAD_CACHE:-$DATA_DIR/randstad-cache.json}"
# Cache delle schede Intervieweb (Gemelli, GVM, Synlab; in futuro HSR e GSD): ~100 pagine da 300 KB, 2 s l'una.
export INTERVIEWEB_CACHE="${INTERVIEWEB_CACHE:-$DATA_DIR/intervieweb-cache.json}"

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
  # ASL/AO do Lazio e da Campania (lote 1 da fase 2): 0 vagas abertas durante dias e' normal; a estrutura do site mudar
  # levanta erro no leitor (lista nao reconhecida) e isso conta sempre como avaria.
  export HEALTH_ALLOW_EMPTY="${HEALTH_ALLOW_EMPTY:-asl-roma-1,asl-roma-2,asl-roma-3,asl-roma-5,asl-napoli-3-sud,aorn-colli}"
  python3 "$ROOT/tools/scraper_health.py" "$DATA_DIR/scraper-runs.json"
  python3 "$ROOT/tools/jobs_integrity.py" "$DATA_DIR" http://127.0.0.1:3014 /offerte/ || true
) || true

# Google Indexing API: offerte nuove/ritirate. Progetto Google Cloud proprio dell'IT
# (my-project-1483913428749, "offertesanita-it"): 200 richieste/giorno solo per questo sito.
INDEXING_KEY="${GOOGLE_INDEXING_KEY:-/home/portal/.config/vagasaude/indexing-key-it.json}"
if [[ -f "$INDEXING_KEY" && -x /home/portal/.venvs/indexing/bin/python ]]; then
  GOOGLE_INDEXING_KEY="$INDEXING_KEY" INDEXING_DAILY_QUOTA="${INDEXING_DAILY_QUOTA:-200}" /home/portal/.venvs/indexing/bin/python "$ROOT/tools/indexing_notify.py" \
    --sitemap http://127.0.0.1:3014/sitemap/jobs.xml \
    --state "$DATA_DIR/indexing-state.json" || true
fi

# IndexNow (Bing e, a cascata, ChatGPT) -- chiave propria dell'IT (https://offertesanita.it/<chiave>.txt,
# apps/web-it/public). Avvisa solo di quello che e' cambiato nel sitemap dall'ultima esecuzione.
python3 "$ROOT/tools/indexnow_notify.py" \
  --sitemap http://127.0.0.1:3014/sitemap/jobs-meta.json \
  --state "$DATA_DIR/indexnow-state.json" || true

# Digest delle nuove offerte agli iscritti IT (solo se Resend e' configurato).
if [[ -n "${RESEND_API_KEY:-}" && -n "${SCRAPER_API_TOKEN:-}" ]]; then
  curl -sS -X POST "http://127.0.0.1:3014/api/alerts/digest" \
    -H "Authorization: Bearer ${SCRAPER_API_TOKEN}" \
    -H "Content-Type: application/json" \
    || true
  echo
fi

# Cache Cloudflare de 6 h (2026-11-16): limpar a cache 11 min depois do fim desta execução, em fundo
# (ver /var/www/vagasaude/cf_purge_later.sh). Sem isto, listagens e vagas ficavam até 6 h desatualizadas.
nohup /var/www/vagasaude/cf_purge_later.sh d7bb205baa3fad9abc05934e468d10aa >> /var/www/offertesanita/logs/cf-purge.log 2>&1 &
