#!/usr/bin/env bash
# Deploy de uma release Next.js standalone para a avencas2, com teste de fumo.
#
# Uso:
#   deploy/deploy-release.sh <site> <release> <tgz> <tmux-session> <smoke-port> <url>...
#   ex.: deploy/deploy-release.sh vagasaude pt-x-20261024-abc1234 /tmp/vagasaude-abc1234.tar.gz \
#        vagasaude-app 39020 / /vagas /sitemap/jobs.xml
#
# Passos: envia o tarball, extrai para releases/<release>, troca o sharp darwin pelos
# binários linux da release atual (build feito em macOS), arranca a release numa porta
# de teste e pede os URLs; só se todos derem 200 e o log não tiver erros é que troca o
# symlink current e reinicia a sessão tmux (que corre como root).
# Portas de teste: 39020 (PT) e 39021 (BR) — a 3020 é de outro site do servidor.
# Rollback: apontar current para a release anterior (impressa como prev=) e reiniciar.
set -euo pipefail
site=$1; rel=$2; tgz=$3; sess=$4; port=$5; shift 5
H="${DEPLOY_HOST:-portal@91.99.167.243}"
ROOT_H="${DEPLOY_ROOT_HOST:-root@91.99.167.243}"

scp -q "$tgz" "$H:/tmp/"
ssh "$H" "set -e; R=/var/www/$site/releases/$rel; CUR=\$(readlink -f /var/www/$site/current); echo prev=\$(basename \$CUR)
  mkdir -p \$R && tar -C \$R -xzf /tmp/$(basename "$tgz")
  rm -rf \$R/node_modules/@img/*darwin*; cp -a \$CUR/node_modules/@img/sharp-linux* \$CUR/node_modules/@img/sharp-libvips-linux* \$R/node_modules/@img/
  if ss -ltn | grep -q ':$port '; then echo 'ERRO: porta de teste $port ocupada'; exit 1; fi
  ( set -a; . /var/www/$site/.env.production; set +a; export PORT=$port; NODE_BIN=\$(grep -oE '^exec [^ ]*node' /var/www/$site/start.sh | awk '{print \$2}'); cd \$R && exec timeout 60 \${NODE_BIN:-node} server.js ) > /tmp/smoke-$site.log 2>&1 &
  for i in \$(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:$port/robots.txt && break; sleep 0.5; done
  fail=0; for u in $*; do c=\$(curl -s -o /dev/null -w '%{http_code}' \"http://127.0.0.1:$port\$u\"); echo \"smoke \$c \$u\"; [ \"\$c\" = 200 ] || fail=1; done
  kill %1 2>/dev/null || true; wait 2>/dev/null || true
  if grep -qi 'error' /tmp/smoke-$site.log; then echo 'ERROS no log do teste'; grep -i error /tmp/smoke-$site.log | head -5; fail=1; fi
  [ \$fail = 0 ] || { echo 'TESTE DE FUMO FALHOU — produção não foi trocada'; exit 1; }
  cd /var/www/$site && ln -sfn \$R current.new && mv -T current.new current && echo current=\$(readlink current)
  rm -f /tmp/$(basename "$tgz")"
ssh "$ROOT_H" "tmux kill-session -t $sess; tmux new-session -d -s $sess -c /var/www/$site /var/www/$site/start.sh; sleep 4; tmux ls | grep $sess"
# Limpar a cache do Cloudflare (regra de cache das páginas de vagas/categorias, 2026-11-09):
# sem isto o edge podia servir HTML do build anterior a apontar para ficheiros JS que já não existem.
case "$site" in vagasaude) zone=767eabea9b74de2fe7073bc0bdd1af83 ;; vagasaudebr) zone=d7a19a81de0b4dade9438b4a503fddd3 ;; vacantessalud) zone=7012aefe54fe06725b78c758410f165f ;; *) zone= ;; esac
cf_token_file="${CF_PURGE_TOKEN_FILE:-$HOME/.config/vagasaude/cloudflare-purge-token}"
if [ -n "$zone" ] && [ -f "$cf_token_file" ]; then
  if curl -s -X POST -H "Authorization: Bearer $(cat "$cf_token_file")" -H "Content-Type: application/json" \
      --data '{"purge_everything":true}' "https://api.cloudflare.com/client/v4/zones/$zone/purge_cache" | grep -qE '"success": ?true'; then
    echo "cloudflare: cache limpa"
  else
    echo "AVISO: limpeza da cache do Cloudflare falhou — limpar à mão no painel"
  fi
else
  echo "AVISO: sem token Cloudflare ($cf_token_file) — cache do edge não foi limpa"
fi
# Aquecer a cache das páginas mais visitadas (não bloqueia o deploy se falhar).
case "$site" in vagasaude) prod=3010 ;; vagasaudebr) prod=3011 ;; vacantessalud) prod=3012 ;; *) prod= ;; esac
[ -z "$prod" ] || ssh "$ROOT_H" "bash -s -- $prod" < "$(dirname "$0")/warm-cache.sh" || echo "AVISO: aquecimento falhou (deploy concluído)"
# Limpeza (como root, DEPOIS do reinício, nunca bloqueia o deploy): cada release acumula a
# cache ISR do Next, escrita pelo app que corre como root (BR ~2,5 GB/release) — o portal
# não a consegue apagar. Guardar as KEEP_RELEASES (4) mais recentes, nunca a atual nem _*.
ssh "$ROOT_H" "cd /var/www/$site && CUR=\$(basename \$(readlink -f current)); OLD=\$(ls -td releases/*/ | sed 's#/\$##' | tail -n +$(( ${KEEP_RELEASES:-4} + 1 )) | grep -v '/_' | grep -vx \"releases/\$CUR\" || true); [ -z \"\$OLD\" ] || { echo \"\$OLD\" | xargs rm -rf --; echo removidas=\$(echo \"\$OLD\" | wc -l) releases antigas; }" || echo "AVISO: limpeza de releases falhou (deploy concluído)"
