#!/usr/bin/env bash
# Fontes PT que dão 403 ao IP do VPS (blacklist após o incidente de 17/11/2026):
# scrape no Mac e ingestão via túnel SSH para a API PT do VPS (127.0.0.1:3010),
# sem passar pelo Cloudflare. Chamado pelo LaunchAgent pt.vagasaude.pt-bloqueadas.
# TEMPORÁRIO: quando o IP sair das blacklists, tirar de SKIP_SOURCES (deploy/run-scrapers.sh)
# e desligar o LaunchAgent (launchctl unload ~/Library/LaunchAgents/pt.vagasaude.pt-bloqueadas.plist).
#
# Requisitos: ~/Localhost/vagasaude/.venv-scrapers (httpx, bs4, lxml) e
# ~/.config/vagasaude/pt-scraper.env com SCRAPER_API_TOKEN=… (chmod 600).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${PATH:-}"
VPS="${VPS:-portal@91.99.167.243}"
PORT="${TUNNEL_PORT:-39013}"
PY="${SCRAPERS_PYTHON:-$HOME/Localhost/vagasaude/.venv-scrapers/bin/python}"
ENV_FILE="${ENV_FILE:-$HOME/.config/vagasaude/pt-scraper.env}"
SOURCES="${PT_MAC_SOURCES:-apdp cruz_vermelha irmas_hospitaleiras unisana}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
: "${SCRAPER_API_TOKEN:?SCRAPER_API_TOKEN em falta em $ENV_FILE}"

echo "[$(date '+%F %T')] PT off-VPS ($SOURCES)"
for attempt in 1 2 3; do
  SOCK="$(mktemp -u /tmp/vagasaude-pt-tunnel.XXXXXX)"
  if ssh -M -S "$SOCK" -fNT -o ExitOnForwardFailure=yes -o BatchMode=yes \
    -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=20 \
    -L "127.0.0.1:${PORT}:127.0.0.1:3010" "$VPS"; then
    export INGEST_BASE_URL="http://127.0.0.1:${PORT}"
    rc=0
    for src in $SOURCES; do
      out="$(caffeinate -i "$PY" run.py --source "$src" 2>&1)" || rc=1
      printf '%s\n' "$out" | awk -v s="[$src]" 'index($0, s) == 1'
    done
    ssh -S "$SOCK" -O exit "$VPS" >/dev/null 2>&1 || true
    [[ "$rc" -eq 0 ]] && exit 0
  fi
  echo "[$(date '+%F %T')] tentativa $attempt falhou; nova tentativa em 60 s"
  sleep 60
done
echo "[$(date '+%F %T')] ERRO: ingestão falhou após 3 tentativas"
exit 1
