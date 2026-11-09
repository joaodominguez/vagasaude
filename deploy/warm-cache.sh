#!/usr/bin/env bash
# Aquece a cache ISR de uma app Next acabada de reiniciar (corre NO SERVIDOR, por loopback).
# Uso (o deploy-release.sh chama-o): ssh root@host 'bash -s -- <porta>' < deploy/warm-cache.sh
# Motivo (análise 2026-11-09): cada deploy começa com a cache vazia e o 1.º visitante de cada
# página esperava 0,4–1,2 s. Visita home, categorias, empresas e as vagas mais recentes.
port="$1"
base="http://127.0.0.1:$port"
for _ in $(seq 1 60); do curl -s -o /dev/null "$base/robots.txt" && break; sleep 1; done
urls=$( {
  echo /
  for s in categories empresas jobs; do
    lim=60; [ "$s" = jobs ] && lim=150
    curl -s --max-time 30 "$base/sitemap/$s.xml" | grep -oE '<loc>[^<]+' | sed -E 's#<loc>https?://[^/]+##' | head -n "$lim"
  done
} )
n=0; t0=$(date +%s)
for u in $urls; do curl -s -o /dev/null --max-time 20 "$base$u"; n=$((n + 1)); done
echo "aquecidas=$n páginas em $(( $(date +%s) - t0 ))s"
