#!/usr/bin/env bash
# Einstein / Fleury — vagas.com.br Cloudflare bloqueia ASN Hetzner (error 1005 / 403).
# Correr este script FORA do VPS (laptop, CI, cloud agent) e ingerir na API BR.
#
# Uso:
#   export SCRAPER_API_TOKEN=…   # do .env.production BR
#   ./run-vagas-com-off-vps.sh              # einstein + fleury
#   ./run-vagas-com-off-vps.sh einstein
#   ./run-vagas-com-off-vps.sh fleury --dry-run
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH:-}"
# Produção pública BR (não :3011 local do VPS)
export INGEST_BASE_URL="${INGEST_BASE_URL:-https://vagasaude.com.br}"

if [[ -z "${SCRAPER_API_TOKEN:-}" ]]; then
  echo "SCRAPER_API_TOKEN em falta. Exportar o token do .env.production BR." >&2
  exit 1
fi

if [[ -d "$ROOT/.venv" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
fi

SOURCES=("einstein" "fleury")
EXTRA_ARGS=()
if [[ $# -gt 0 && "$1" != --* ]]; then
  SOURCES=("$1")
  shift
fi
EXTRA_ARGS=("$@")

echo "[vagas-com-off-vps] INGEST_BASE_URL=$INGEST_BASE_URL sources=${SOURCES[*]}"
rc=0
for src in "${SOURCES[@]}"; do
  python3 "$ROOT/run.py" --source "$src" "${EXTRA_ARGS[@]}" || rc=$?
done
exit "$rc"
