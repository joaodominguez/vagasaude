#!/bin/bash
# Job ÚNICO agendado com `at` para 2026-11-27 10:00 UTC (11/27 10:00 Lisboa).
# 1) apanha bounces novos (alerts_email_issues.py); se falhar, NÃO envia.
# 2) envia o último lembrete (a guarda de data UTC está no próprio script).
set -u
LOG=/var/www/vagasaude/data/alerts-last-reminder.log
T=/var/www/vagasaude/scrapers/tools
echo "$(date -u +%FT%TZ) [job] início" >> "$LOG"
if ! /usr/bin/python3 "$T/alerts_email_issues.py" >> "$LOG" 2>&1; then
  echo "$(date -u +%FT%TZ) [job] alerts_email_issues.py falhou: ABORTADO sem enviar" >> "$LOG"
  exit 2
fi
/usr/bin/python3 "$T/alerts_last_reminder.py" --send >> "$LOG" 2>&1
echo "$(date -u +%FT%TZ) [job] fim (exit $?)" >> "$LOG"
