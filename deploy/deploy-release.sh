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
  ( set -a; . /var/www/$site/.env.production; set +a; export PORT=$port; cd \$R && exec timeout 60 node server.js ) > /tmp/smoke-$site.log 2>&1 &
  for i in \$(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:$port/robots.txt && break; sleep 0.5; done
  fail=0; for u in $*; do c=\$(curl -s -o /dev/null -w '%{http_code}' \"http://127.0.0.1:$port\$u\"); echo \"smoke \$c \$u\"; [ \"\$c\" = 200 ] || fail=1; done
  kill %1 2>/dev/null || true; wait 2>/dev/null || true
  if grep -qi 'error' /tmp/smoke-$site.log; then echo 'ERROS no log do teste'; grep -i error /tmp/smoke-$site.log | head -5; fail=1; fi
  [ \$fail = 0 ] || { echo 'TESTE DE FUMO FALHOU — produção não foi trocada'; exit 1; }
  cd /var/www/$site && ln -sfn \$R current.new && mv -T current.new current && echo current=\$(readlink current)"
ssh "$ROOT_H" "tmux kill-session -t $sess; tmux new-session -d -s $sess -c /var/www/$site /var/www/$site/start.sh; sleep 4; tmux ls | grep $sess"
