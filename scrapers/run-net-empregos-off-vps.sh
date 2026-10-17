#!/usr/bin/env bash
# Net-Empregos com descrição completa — correr FORA do VPS (o IP do VPS recebe
# a página de login nas páginas de detalhe). Ingestão via túnel SSH para a API
# PT local do VPS (127.0.0.1:3010), sem passar pelo Cloudflare.
#
# Requisitos (uma vez):
#   python3 -m venv ~/Localhost/vagasaude/.venv-scrapers
#   ~/Localhost/vagasaude/.venv-scrapers/bin/pip install httpx beautifulsoup4 lxml
#   ~/.config/vagasaude/pt-scraper.env com SCRAPER_API_TOKEN=… (chmod 600)
#
# Uso:
#   ./run-net-empregos-off-vps.sh            # scrape + detalhe + ingestão
#   ./run-net-empregos-off-vps.sh --dry-run  # sem enviar para a API
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

SOCK="$(mktemp -u /tmp/vagasaude-tunnel.XXXXXX)"
ssh -M -S "$SOCK" -fNT -o ExitOnForwardFailure=yes -o BatchMode=yes \
  -L "127.0.0.1:${PORT}:127.0.0.1:3010" "$VPS"
trap 'ssh -S "$SOCK" -O exit "$VPS" >/dev/null 2>&1 || true' EXIT

export INGEST_BASE_URL="http://127.0.0.1:${PORT}"
echo "[$(date '+%F %T')] net_empregos off-VPS (detalhe: $NET_EMPREGOS_DETAIL_CACHE)"
"$PY" run.py --source net_empregos "$@"
