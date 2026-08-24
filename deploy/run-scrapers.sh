#!/usr/bin/env bash
set -euo pipefail
# Cron costuma ter PATH mínimo — garante Xvfb/Chrome/python.
export PATH="/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH:-}"
source /var/www/vagasaude/scrapers/.chrome.env 2>/dev/null || true
set -a
source /var/www/vagasaude/.env.production
set +a
export INGEST_BASE_URL=http://127.0.0.1:3010
cd /var/www/vagasaude/scrapers

# Chrome headful (IPO Porto / PHARMABSC / Net-Empregos) precisa de X.
# Preferimos xvfb-run se existir; o BrowserSession também arranca Xvfb
# sozinho, mas o wrapper evita falhas quando o cron não tem DISPLAY.
run_py=(python3 run.py --source all)
if command -v xvfb-run >/dev/null 2>&1 && [[ -z "${DISPLAY:-}" ]]; then
  run_py=(xvfb-run -a -s "-screen 0 1366x900x24" "${run_py[@]}")
fi

# Corre os scrapers. Uma falha parcial de fontes faz o run.py sair com rc=1,
# mas as vagas boas já foram ingeridas — por isso NÃO deixamos essa falha
# abortar o envio do digest (senão os alertas por email deixam de sair).
scrape_rc=0
"${run_py[@]}" || scrape_rc=$?
if [[ "$scrape_rc" -ne 0 ]]; then
  echo "[run-scrapers] run.py terminou com rc=$scrape_rc (falha parcial de fontes); a continuar para o digest."
fi

# Envia digest de novas vagas aos subscritores (se Resend estiver configurado).
if [[ -n "${RESEND_API_KEY:-}" && -n "${SCRAPER_API_TOKEN:-}" ]]; then
  curl -sS -X POST "http://127.0.0.1:3010/api/alerts/digest" \
    -H "Authorization: Bearer ${SCRAPER_API_TOKEN}" \
    -H "Content-Type: application/json" \
    || true
  echo
fi
