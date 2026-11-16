#!/bin/bash
# Limpa a cache do Cloudflare de uma zona, com atraso (2026-11-16).
#
# Porquê: as páginas ficam 6 h no Cloudflare. O Apache só envia `s-maxage=21600` quando o Next
# devolve uma página fresca (X-Nextjs-Cache HIT/MISS); uma resposta STALE leva `no-store` e nunca
# é guardada. Os dados só mudam no fim de cada run-scrapers.sh, que chama este script em fundo.
# O atraso de 11 min (> revalidate=600 das páginas) garante que qualquer página gerada antes da
# ingestão já está STALE quando o Cloudflare a voltar a pedir, e por isso não fica 6 h na CDN.
#
# Uso: cf_purge_later.sh <zone_id> [atraso_em_segundos]   (token só de leitura de ficheiro, 600)
set -u
ZONE=${1:?zone id}
DELAY=${2:-660}
TOKEN_FILE=${CF_PURGE_TOKEN_FILE:-$HOME/.config/vagasaude/cloudflare-purge-token}

sleep "$DELAY"
if [[ ! -r "$TOKEN_FILE" ]]; then
  echo "[cf-purge] $(date -u +%FT%TZ) $ZONE: sem token ($TOKEN_FILE) — cache não limpa"
  exit 0
fi
# Cabeçalho lido de um descritor (printf é builtin): o token nunca aparece na lista de processos.
resp=$(curl -sS -m 30 -X POST \
  -H @<(printf 'Authorization: Bearer %s\n' "$(<"$TOKEN_FILE")") \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}' \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/purge_cache" 2>&1)
if [[ "$resp" == *'"success":true'* ]]; then
  echo "[cf-purge] $(date -u +%FT%TZ) $ZONE: cache limpa"
else
  echo "[cf-purge] $(date -u +%FT%TZ) $ZONE: FALHOU — ${resp:0:200}"
fi
