#!/usr/bin/env bash
# Fontes PT que dão 403 ao IP do VPS (blacklist após o incidente de 17/11/2026):
# scrape no Mac e ingestão via túnel SSH para a API PT do VPS (127.0.0.1:3010),
# sem passar pelo Cloudflare. Chamado pelo LaunchAgent pt.vagasaude.pt-bloqueadas.
# Servidor primeiro, Mac como reserva (19-11-2026): o VPS tenta estas fontes (deploy/run-scrapers.sh
# testa o host com o user-agent do scraper e só as salta se derem 000/403/429). Aqui só se correm as
# que o servidor não recolheu bem («ok com vagas») nos últimos FRESH_MIN minutos (120), segundo o
# scraper-runs.json do VPS. FORCE_ALL=1 corre todas. Sem ligação ao servidor para ver, corre todas.
# Quando o bloqueio acabar, o VPS volta a recolhê-las e este runner passa a não fazer nada.
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
FRESH_MIN="${FRESH_MIN:-120}"

if [[ "${FORCE_ALL:-}" != "1" ]]; then
  status="$(ssh -o BatchMode=yes -o ConnectTimeout=20 "$VPS" python3 - "$FRESH_MIN" $SOURCES 2>/dev/null <<'PY' || true
import json, sys
from datetime import datetime, timedelta, timezone
fresh, sources = int(sys.argv[1]), sys.argv[2:]
runs = json.load(open("/var/www/vagasaude/data/scraper-runs.json")).get("runs", [])
cut = datetime.now(timezone.utc) - timedelta(minutes=fresh)
for src in sources:
    mine = sorted((r for r in runs if r.get("source") == src), key=lambda r: r.get("startedAt") or "")
    last = mine[-1] if mine else {}
    started = last.get("startedAt") or ""
    fresh_ok = bool(started) and datetime.fromisoformat(started) >= cut
    ok = last.get("status") == "ok" and bool(last.get("found")) and fresh_ok
    print(src, "ok" if ok else "run", started[:16] or "-", last.get("found", 0))
PY
)"
  todo=""
  for src in $SOURCES; do
    line="$(grep "^$src " <<<"$status" || true)"
    if [[ "$line" == "$src ok "* ]]; then
      read -r _ _ when found <<<"$line"
      echo "[$(date '+%F %T')] $src: já recolhida às $when UTC ($found vagas, VPS ou Mac) — omitida"
    else
      todo="$todo $src"
    fi
  done
  SOURCES="${todo# }"
  if [[ -z "$SOURCES" ]]; then
    echo "[$(date '+%F %T')] PT off-VPS: nada a fazer (fontes de reserva já recolhidas)"
    exit 0
  fi
fi

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
    if [[ "$rc" -eq 0 ]]; then
      # Limpa a cache Cloudflare como o run-scrapers.sh do servidor (senão até 6 h desatualizado).
      ssh -o BatchMode=yes -o ConnectTimeout=20 "$VPS" \
        'nohup /var/www/vagasaude/cf_purge_later.sh 767eabea9b74de2fe7073bc0bdd1af83 >> /var/www/vagasaude/logs/cf-purge.log 2>&1 </dev/null &' \
        && echo "[$(date '+%F %T')] purge Cloudflare agendado" || echo "[$(date '+%F %T')] AVISO: purge Cloudflare falhou"
      exit 0
    fi
  fi
  echo "[$(date '+%F %T')] tentativa $attempt falhou; nova tentativa em 60 s"
  sleep 60
done
echo "[$(date '+%F %T')] ERRO: ingestão falhou após 3 tentativas"
exit 1
