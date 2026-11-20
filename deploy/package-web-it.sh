#!/usr/bin/env bash
# Empacota o standalone Next.js (apps/web-it) para deploy no VPS.
# Uso: ./deploy/package-web-it.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web-it"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
OUT="${1:-/tmp/offertesanita-$SHA.tar.gz}"
STAGE="$(mktemp -d)"

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

if [[ ! -d "$WEB/.next/standalone" || ! -d "$WEB/.next/static" ]]; then
  echo "Build em falta. Corre: (cd apps/web-it && npm run build)" >&2
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
# no VPS regenerar a partir de /var/www/offertesanita/data.
# O mesmo para outras páginas estáticas que dependem dos dados (hub de
# concorsi, índice de stipendi, aziende e dati): senão saem vazias/noindex até ao 1º revalidate.
for page in index concorsi stipendi aziende dati; do
  rm -f "$STAGE/.next/server/app/$page.html" \
    "$STAGE/.next/server/app/$page.rsc" \
    "$STAGE/.next/server/app/$page.meta"
  rm -rf "$STAGE/.next/server/app/$page.segments" 2>/dev/null || true
done

# /offerte/oggi (2026-11-20): pagina nuova con dati. Il prerender del build porta i dati del Mac:
# togliere HTML/RSC/meta (NON la cartella oggi/, che ha il codice della rotta).
rm -f "$STAGE/.next/server/app/offerte/oggi.html" \
  "$STAGE/.next/server/app/offerte/oggi.rsc" \
  "$STAGE/.next/server/app/offerte/oggi.meta"
rm -rf "$STAGE/.next/server/app/offerte/oggi.segments" 2>/dev/null || true

# Pagine nuove (Fase 1, parte A) che dipendono dai dati: concorsi-infermieri-2026, concorsi-oss-2026,
# concorsi/in-scadenza e concorsi/tipo/*. Si tolgono HTML/RSC/meta/segments, non le cartelle di codice.
for page in concorsi-infermieri-2026 concorsi-oss-2026; do
  rm -f "$STAGE/.next/server/app/$page.html" \
    "$STAGE/.next/server/app/$page.rsc" \
    "$STAGE/.next/server/app/$page.meta"
  rm -rf "$STAGE/.next/server/app/$page.segments" 2>/dev/null || true
done
for page in concorsi/in-scadenza concorsi/tipo/concorsi-pubblici concorsi/tipo/avvisi-tempo-determinato concorsi/tipo/mobilita concorsi/tipo/incarichi-libero-professionali concorsi/tipo/graduatorie; do
  rm -f "$STAGE/.next/server/app/$page.html" \
    "$STAGE/.next/server/app/$page.rsc" \
    "$STAGE/.next/server/app/$page.meta"
  rm -rf "$STAGE/.next/server/app/$page.segments" 2>/dev/null || true
done

COPYFILE_DISABLE=1 tar -C "$STAGE" -czf "$OUT" .
echo "OK $OUT (css=$CSS_COUNT, data prerenders stripped: index concorsi stipendi aziende dati offerte/oggi concorsi-infermieri-2026 concorsi-oss-2026 concorsi/in-scadenza concorsi/tipo/*)"
