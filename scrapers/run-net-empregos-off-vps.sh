#!/usr/bin/env bash
# Net-Empregos com descrição completa — correr FORA do VPS (o IP do VPS recebe
# a página de login nas páginas de detalhe). Ingestão via túnel SSH para a API
# PT local do VPS (127.0.0.1:3010), sem passar pelo Cloudflare.
#
# Duas fases: (1) scrape + detalhe para a cache, sem túnel (a parte longa);
# (2) túnel aberto só para a ingestão, que reutiliza a cache (~1 min), com
# nova tentativa. Tudo sob caffeinate: o Mac a dormir matava o túnel.
#
# Requisitos (uma vez):
#   python3 -m venv ~/Localhost/vagasaude/.venv-scrapers
#   ~/Localhost/vagasaude/.venv-scrapers/bin/pip install httpx beautifulsoup4 lxml
#   ~/.config/vagasaude/pt-scraper.env com SCRAPER_API_TOKEN=… (chmod 600)
#
# Uso:
#   ./run-net-empregos-off-vps.sh            # scrape + detalhe + ingestão
#   ./run-net-empregos-off-vps.sh --dry-run  # só actualiza a cache
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${PATH:-}"
VPS="${VPS:-portal@91.99.167.243}"
PORT="${TUNNEL_PORT:-39010}"
PY="${SCRAPERS_PYTHON:-$HOME/Localhost/vagasaude/.venv-scrapers/bin/python}"
ENV_FILE="${ENV_FILE:-$HOME/.config/vagasaude/pt-scraper.env}"
export NET_EMPREGOS_DETAIL_CACHE="${NET_EMPREGOS_DETAIL_CACHE:-$HOME/.cache/vagasaude/net_empregos_details.json}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
: "${SCRAPER_API_TOKEN:?SCRAPER_API_TOKEN em falta em $ENV_FILE}"

echo "[$(date '+%F %T')] net_empregos off-VPS (detalhe: $NET_EMPREGOS_DETAIL_CACHE)"

# Fase 1: detalhe para a cache (sem ingestão).
caffeinate -i "$PY" run.py --source net_empregos --dry-run | grep -E "^\[net_empregos\]" || true
if [[ "${1:-}" == "--dry-run" ]]; then
  exit 0
fi

# Fase 2: túnel só durante a ingestão (até 3 tentativas).
for attempt in 1 2 3; do
  SOCK="$(mktemp -u /tmp/vagasaude-tunnel.XXXXXX)"
  if ssh -M -S "$SOCK" -fNT -o ExitOnForwardFailure=yes -o BatchMode=yes \
    -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=20 \
    -L "127.0.0.1:${PORT}:127.0.0.1:3010" "$VPS"; then
    export INGEST_BASE_URL="http://127.0.0.1:${PORT}"
    rc=0
    # Sem pedidos de detalhe novos aqui: a fase 1 já encheu a cache.
    NET_EMPREGOS_MAX_DETAILS=0 caffeinate -i "$PY" run.py --source net_empregos >"$SOCK.out" 2>&1 || rc=$?
    ssh -S "$SOCK" -O exit "$VPS" >/dev/null 2>&1 || true
    grep -E "^\[net_empregos\]" "$SOCK.out" || true
    rm -f "$SOCK.out"
    [[ "$rc" -eq 0 ]] && exit 0
  fi
  echo "[$(date '+%F %T')] tentativa $attempt falhou; nova tentativa em 60 s"
  sleep 60
done
echo "[$(date '+%F %T')] ERRO: ingestão falhou após 3 tentativas"
exit 1
