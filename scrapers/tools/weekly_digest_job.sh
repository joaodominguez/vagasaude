#!/bin/bash
# Resumo de domingo: job semanal (corre como ROOT; ver crontab do root).
# Uso: weekly_digest_job.sh [pt|br|es|it ...]   (sem argumentos: todos os sites, como antes)
# Entradas de cron (root; o crontab do Ubuntu não tem CRON_TZ, por isso horas UTC; o próprio weekly_digest.py
# só envia ao domingo em Lisboa e recusa sites com o digest diário ainda por sair, por isso repetir é seguro:
# quem já recebeu hoje fica de fora):
#   0 8-10 * * 0   weekly_digest_job.sh pt es it     (domingo de manhã na Europa; a manhã de PT/ES/IT já saiu às ~06:30 UTC)
#   10,25,40,55 13 * * 0   weekly_digest_job.sh br   (domingo ~10h em Brasília, depois do digest da manhã do BR e antes das 11h)
# 1) apanha bounces novos (alerts_email_issues.py); se falhar, NÃO envia.
# 2) envia o resumo, site a site (uma falha num site não impede os outros).
set -u
LOG=/var/www/vagasaude/data/weekly-digest.log
T=/var/www/vagasaude/scrapers/tools
echo "$(date -u +%FT%TZ) [job] início ($*)" >> "$LOG"
if ! (cd /tmp && /usr/bin/python3 "$T/alerts_email_issues.py" >> "$LOG" 2>&1); then
  echo "$(date -u +%FT%TZ) [job] alerts_email_issues.py falhou: ABORTADO sem enviar" >> "$LOG"
  exit 2
fi
rc=0
if [ "$#" -eq 0 ]; then
  (cd /tmp && /usr/bin/python3 "$T/weekly_digest.py" --send >> "$LOG" 2>&1) || rc=$?
else
  for site in "$@"; do
    (cd /tmp && /usr/bin/python3 "$T/weekly_digest.py" --send --site "$site" >> "$LOG" 2>&1) || rc=$?
  done
fi
echo "$(date -u +%FT%TZ) [job] fim (exit $rc)" >> "$LOG"
exit $rc
