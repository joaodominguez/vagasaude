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
  # que solo publican el sumario del día (días sin convocatorias sanitarias).
  HEALTH_IGNORE="${HEALTH_IGNORE:-osakidetza,dog,borm,doe,boc-canarias,bocyl,docm,boib}" python3 "$ROOT/tools/scraper_health.py" /var/www/vacantessalud/data/scraper-runs.json
) || true

# Digest de nuevas ofertas a los suscriptores ES (solo si Resend está configurado).
if [[ -n "${RESEND_API_KEY:-}" && -n "${SCRAPER_API_TOKEN:-}" ]]; then
  curl -sS -X POST "http://127.0.0.1:3012/api/alerts/digest" \
    -H "Authorization: Bearer ${SCRAPER_API_TOKEN}" \
    -H "Content-Type: application/json" \
    || true
  echo
fi
