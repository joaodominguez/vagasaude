#!/usr/bin/env bash
# Einstein + Fleury (vagas.com.br bloqueia o ASN Hetzner) a partir do Mac:
# scrape local e ingestão via túnel SSH para a API BR do VPS (127.0.0.1:3011),
# sem passar pelo Cloudflare. Chamado pelo LaunchAgent pt.vagasaude.br-vagas-com.
#
# Requisitos: ~/Localhost/vagasaude/.venv-scrapers (httpx, bs4, lxml) e
# ~/.config/vagasaude/br-scraper.env com SCRAPER_API_TOKEN=… (chmod 600).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${PATH:-}"
VPS="${VPS:-portal@91.99.167.243}"
PORT="${TUNNEL_PORT:-39011}"
PY="${SCRAPERS_PYTHON:-$HOME/Localhost/vagasaude/.venv-scrapers/bin/python}"
ENV_FILE="${ENV_FILE:-$HOME/.config/vagasaude/br-scraper.env}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
: "${SCRAPER_API_TOKEN:?SCRAPER_API_TOKEN em falta em $ENV_FILE}"

echo "[$(date '+%F %T')] vagas.com.br off-VPS (einstein, fleury)"
for attempt in 1 2 3; do
  SOCK="$(mktemp -u /tmp/vagasaudebr-tunnel.XXXXXX)"
  if ssh -M -S "$SOCK" -fNT -o ExitOnForwardFailure=yes -o BatchMode=yes \
    -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=20 \
    -L "127.0.0.1:${PORT}:127.0.0.1:3011" "$VPS"; then
    export INGEST_BASE_URL="http://127.0.0.1:${PORT}"
    rc=0
    for src in einstein fleury; do
      caffeinate -i "$PY" run.py --source "$src" 2>&1 | grep -E "^\[$src\]" || rc=1
    done
    ssh -S "$SOCK" -O exit "$VPS" >/dev/null 2>&1 || true
    [[ "$rc" -eq 0 ]] && exit 0
  fi
  echo "[$(date '+%F %T')] tentativa $attempt falhou; nova tentativa em 60 s"
  sleep 60
done
echo "[$(date '+%F %T')] ERRO: ingestão falhou após 3 tentativas"
exit 1
