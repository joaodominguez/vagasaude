#!/usr/bin/env bash
# Cron helper — solo ES (VacantesSalud). Nunca apunta al ingest PT (3010) ni BR (3011).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH:-}"

# Token + Resend: ficheiro de la app ES.
if [[ -f /var/www/vacantessalud/.env.production ]]; then
  set -a
  # shellcheck source=/dev/null
  source /var/www/vacantessalud/.env.production
  set +a
fi
# Fijado DESPUÉS del .env (que define PORT=3012) para que nada lo sobrescriba.
export INGEST_BASE_URL="http://127.0.0.1:3012"
# Caché de descripciones (DomusVi/SuccessFactors) en la carpeta de datos: sobrevive a los despliegues.
export ES_DETAIL_CACHE_DIR="${ES_DETAIL_CACHE_DIR:-/var/www/vacantessalud/data}"

if [[ -d "$ROOT/.venv" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
fi

# Una fuente con error hace que run.py salga con rc=1, pero las ofertas buenas ya
# se han ingerido: no abortar el digest por eso.
scrape_rc=0
python3 "$ROOT/run.py" --source all || scrape_rc=$?
if [[ "$scrape_rc" -ne 0 ]]; then
  echo "[run-scrapers-es] run.py terminó con rc=$scrape_rc (fallo parcial); se continúa con el digest."
fi

# Fuentes averiadas (últimas 4 ejecuciones con 0 ofertas o error): log + email interno.
# Mientras el ES no tenga Resend propio, el aviso interno sale por la cuenta del PT.
(
  if [[ -z "${RESEND_API_KEY:-}" && -f /var/www/vagasaude/.env.production ]]; then
    set -a
    # shellcheck source=/dev/null
    source /var/www/vagasaude/.env.production
    set +a
  fi
  export NEXT_PUBLIC_SITE_URL="https://vacantessalud.es"
  # Devuelven 0 legítimamente: Osakidetza sin convocatorias abiertas y los boletines
  # que solo publican el sumario del día. Solo avisan si dan error.
  HEALTH_ALLOW_EMPTY="${HEALTH_ALLOW_EMPTY:-osakidetza,dog,borm,doe,boc-canarias,bocyl,docm,boib}" python3 "$ROOT/tools/scraper_health.py" /var/www/vacantessalud/data/scraper-runs.json
  # Integridad de jobs.json (incidente BR 2026-10-27): slugs desaparecidos, caídas, 404.
  python3 "$ROOT/tools/jobs_integrity.py" /var/www/vacantessalud/data http://127.0.0.1:3012 /empleo/ || true
) || true

# Google Indexing API: ofertas nuevas/retiradas. Proyecto Google Cloud propio del ES
# (le-frique-1479653849743, "vacantessalud-es"): 200 peticiones/día solo para este sitio.
INDEXING_KEY="${GOOGLE_INDEXING_KEY:-/home/portal/.config/vagasaude/indexing-key-es.json}"
if [[ -f "$INDEXING_KEY" && -x /home/portal/.venvs/indexing/bin/python ]]; then
  GOOGLE_INDEXING_KEY="$INDEXING_KEY" INDEXING_DAILY_QUOTA="${INDEXING_DAILY_QUOTA:-200}" /home/portal/.venvs/indexing/bin/python "$ROOT/tools/indexing_notify.py" \
    --sitemap http://127.0.0.1:3012/sitemap/jobs.xml \
    --state /var/www/vacantessalud/data/indexing-state.json || true
fi

# Digest de nuevas ofertas a los suscriptores ES (solo si Resend está configurado).
if [[ -n "${RESEND_API_KEY:-}" && -n "${SCRAPER_API_TOKEN:-}" ]]; then
  curl -sS -X POST "http://127.0.0.1:3012/api/alerts/digest" \
    -H "Authorization: Bearer ${SCRAPER_API_TOKEN}" \
    -H "Content-Type: application/json" \
    || true
  echo
fi
