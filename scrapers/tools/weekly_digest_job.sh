#!/bin/bash
# Resumo de domingo: job semanal (INATIVO até haver OK; não está no crontab).
# Entrada de cron proposta (root; domingos às 09:00 em Lisboa, CRON_TZ cobre a mudança de hora):
#   CRON_TZ=Europe/Lisbon
#   0 9 * * 0 /var/www/vagasaude/scrapers/tools/weekly_digest_job.sh
# 1) apanha bounces novos (alerts_email_issues.py); se falhar, NÃO envia.
# 2) envia o resumo (o próprio script recusa fora de domingo e sites com o digest diário ainda por sair).
set -u
LOG=/var/www/vagasaude/data/weekly-digest.log
T=/var/www/vagasaude/scrapers/tools
echo "$(date -u +%FT%TZ) [job] início" >> "$LOG"
if ! (cd /tmp && /usr/bin/python3 "$T/alerts_email_issues.py" >> "$LOG" 2>&1); then
  echo "$(date -u +%FT%TZ) [job] alerts_email_issues.py falhou: ABORTADO sem enviar" >> "$LOG"
  exit 2
fi
(cd /tmp && /usr/bin/python3 "$T/weekly_digest.py" --send >> "$LOG" 2>&1)
echo "$(date -u +%FT%TZ) [job] fim (exit $?)" >> "$LOG"
