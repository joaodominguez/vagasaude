#!/usr/bin/env bash
# Fontes IT AUTORIZADAS que dão 403 (WAF) ao IP do VPS: Gruppo San Donato (gsd) e San Raffaele (hsr).
# Autorização escrita do GSD/HSR a 17/11/2026; pedido de allowlist do IP do VPS (91.99.167.243) pendente.
# Enquanto o IP não for libertado, recolhe-se no Mac (mesmo user-agent OfferteSanitaBot, >=2 s entre pedidos,
# sem proxy) e ingere-se na API IT do VPS (127.0.0.1:3014) por túnel SSH, sem passar pelo Cloudflare.
# Chamado pelo LaunchAgent it.offertesanita.it-bloqueadas. Quando o VPS for libertado: registar gsd/hsr em
# sources/__init__.py, desligar o LaunchAgent e apagar este runner.
#
# Requisitos: ~/Localhost/vagasaude/.venv-scrapers (httpx, bs4, lxml) e
# ~/.config/vagasaude/it-scraper.env com SCRAPER_API_TOKEN=... (chmod 600).
# DRY_RUN=1 recolhe e mostra, sem ingerir.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${PATH:-}"
VPS="${VPS:-portal@91.99.167.243}"
PORT="${TUNNEL_PORT:-39016}"
PY="${SCRAPERS_PYTHON:-$HOME/Localhost/vagasaude/.venv-scrapers/bin/python}"
ENV_FILE="${ENV_FILE:-$HOME/.config/vagasaude/it-scraper.env}"
SOURCES="${IT_MAC_SOURCES:-gsd hsr}"
DRY="${DRY_RUN:-0}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
: "${SCRAPER_API_TOKEN:?SCRAPER_API_TOKEN em falta em $ENV_FILE}"

run_sources() {
  caffeinate -i "$PY" - "$DRY" $SOURCES <<'PY'
import json, sys
import run
from sources import SCRAPERS
from sources.gsd import GsdScraper
from sources.hsr import HsrScraper
# Fora do registo do VPS (lá dão 403); aqui registam-se só para esta execução.
SCRAPERS.setdefault("gsd", GsdScraper)
SCRAPERS.setdefault("hsr", HsrScraper)
dry = sys.argv[1] == "1"
rc = 0
for slug in sys.argv[2:]:
    result = run.run_source(slug, dry_run=dry)
    keep = {k: result.get(k) for k in ("found", "ingest", "status", "error")}
    print(f"[{slug}] resultado: " + json.dumps(keep, ensure_ascii=False))
    if result.get("status") != "ok":
        rc = 1
sys.exit(rc)
PY
}

echo "[$(date '+%F %T')] IT off-VPS ($SOURCES) dry=$DRY"
if [[ "$DRY" == "1" ]]; then
  run_sources
  exit $?
fi

for attempt in 1 2 3; do
  SOCK="$(mktemp -u /tmp/offertesanita-it-tunnel.XXXXXX)"
  if ssh -M -S "$SOCK" -fNT -o ExitOnForwardFailure=yes -o BatchMode=yes \
    -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=20 \
    -L "127.0.0.1:${PORT}:127.0.0.1:3014" "$VPS"; then
    export INGEST_BASE_URL="http://127.0.0.1:${PORT}"
    rc=0
    run_sources || rc=1
    ssh -S "$SOCK" -O exit "$VPS" >/dev/null 2>&1 || true
    if [[ "$rc" -eq 0 ]]; then
      # Limpa a cache Cloudflare da zona IT (como depois de uma recolha no servidor).
      ssh -o BatchMode=yes -o ConnectTimeout=20 "$VPS" \
        'nohup /var/www/vagasaude/cf_purge_later.sh d7bb205baa3fad9abc05934e468d10aa >> /var/www/vagasaude/logs/cf-purge.log 2>&1 </dev/null &' \
        && echo "[$(date '+%F %T')] purge Cloudflare IT agendado" || echo "[$(date '+%F %T')] AVISO: purge Cloudflare falhou"
      exit 0
    fi
  fi
  echo "[$(date '+%F %T')] tentativa $attempt falhou; nova tentativa em 60 s"
  sleep 60
done
echo "[$(date '+%F %T')] ERRO: ingestão IT falhou após 3 tentativas"
exit 1
