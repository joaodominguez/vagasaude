#!/usr/bin/env bash
# Empacota o standalone Next.js para deploy no VPS.
# Uso: ./deploy/package-web.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
OUT="${1:-/tmp/vagasaude-$SHA.tar.gz}"
STAGE="$(mktemp -d)"

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

if [[ ! -d "$WEB/.next/standalone" || ! -d "$WEB/.next/static" ]]; then
  echo "Build em falta. Corre: (cd apps/web && npm run build)" >&2
  exit 1
fi

cp -a "$WEB/.next/standalone/." "$STAGE/"
mkdir -p "$STAGE/.next/static"
# Importante: copiar o *conteúdo* de static/ para não criar .next/static/static
cp -a "$WEB/.next/static/." "$STAGE/.next/static/"
cp -a "$WEB/public" "$STAGE/public"

if [[ -d "$STAGE/.next/static/static" ]]; then
  echo "ERRO: estrutura aninhada .next/static/static detectada" >&2
  exit 1
fi

CSS_COUNT="$(find "$STAGE/.next/static" -name '*.css' | wc -l | tr -d ' ')"
if [[ "$CSS_COUNT" -lt 1 ]]; then
  echo "ERRO: nenhum CSS em .next/static" >&2
  exit 1
fi

tar -C "$STAGE" -czf "$OUT" .
echo "OK $OUT (css=$CSS_COUNT)"
