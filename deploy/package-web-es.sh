#!/usr/bin/env bash
# Empacota o standalone Next.js (apps/web-es) para deploy no VPS.
# Uso: ./deploy/package-web-br.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web-es"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
OUT="${1:-/tmp/vacantessalud-$SHA.tar.gz}"
STAGE="$(mktemp -d)"

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

if [[ ! -d "$WEB/.next/standalone" || ! -d "$WEB/.next/static" ]]; then
  echo "Build em falta. Corre: (cd apps/web-es && npm run build)" >&2
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

# Homepage / listagens ISR dependem de DATA_DIR em produção. Builds locais
# sem jobs.json bakeiam seed (3 vagas) no HTML — apagar para a 1ª request
# no VPS regenerar a partir de /var/www/vacantessalud/data.
# O mesmo para outras páginas estáticas que dependem dos dados (hub de
# oposiciones e índice de salários): senão saem vazias/noindex até ao 1º revalidate.
for page in index oposiciones salarios; do
  rm -f "$STAGE/.next/server/app/$page.html" \
    "$STAGE/.next/server/app/$page.rsc" \
    "$STAGE/.next/server/app/$page.meta"
  rm -rf "$STAGE/.next/server/app/$page.segments" 2>/dev/null || true
done

tar -C "$STAGE" -czf "$OUT" .
echo "OK $OUT (css=$CSS_COUNT, data prerenders stripped: index oposiciones salarios)"
