#!/usr/bin/env bash
# Run ON the VPS as portal (or root) — configures BR Resend env + digest cron.
# Does NOT print or commit secrets. Reuses PT RESEND_API_KEY when BR key is empty.
set -euo pipefail

BR_ROOT="${BR_ROOT:-/var/www/vagasaudebr}"
PT_ENV="${PT_ENV:-/var/www/vagasaude/.env.production}"
BR_ENV="${BR_ENV:-$BR_ROOT/.env.production}"

if [[ ! -f "$BR_ENV" ]]; then
  echo "Missing $BR_ENV" >&2
  exit 1
fi

# Ensure EMAIL_FROM is quoted BR address
if grep -q '^EMAIL_FROM=' "$BR_ENV"; then
  sed -i 's|^EMAIL_FROM=.*|EMAIL_FROM="VagaSaúde Brasil <alertas@vagasaude.com.br>"|' "$BR_ENV"
else
  printf '\nEMAIL_FROM="VagaSaúde Brasil <alertas@vagasaude.com.br>"\n' >>"$BR_ENV"
fi

# Copy RESEND_API_KEY from PT if BR is empty
br_key="$(grep -E '^RESEND_API_KEY=' "$BR_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
if [[ -z "${br_key}" && -f "$PT_ENV" ]]; then
  pt_key="$(grep -E '^RESEND_API_KEY=' "$PT_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  if [[ -n "${pt_key}" ]]; then
    if grep -q '^RESEND_API_KEY=' "$BR_ENV"; then
      sed -i "s|^RESEND_API_KEY=.*|RESEND_API_KEY=${pt_key}|" "$BR_ENV"
    else
      printf '\nRESEND_API_KEY=%s\n' "$pt_key" >>"$BR_ENV"
    fi
    echo "RESEND_API_KEY copied from PT env (value not printed)."
  else
    echo "PT RESEND_API_KEY also empty — set manually." >&2
  fi
else
  echo "BR RESEND_API_KEY already set (or PT env missing) — left as-is."
fi

# Digest cron (portal crontab) if missing
CRON_LINE='45 */6 * * * /var/www/vagasaudebr/scrapers/run-scrapers.sh >> /var/www/vagasaudebr/data/scrapers.log 2>&1'
if crontab -l 2>/dev/null | grep -q 'vagasaudebr/scrapers/run-scrapers.sh'; then
  echo "Digest/scraper cron already present."
else
  (crontab -l 2>/dev/null || true; echo "$CRON_LINE") | crontab -
  echo "Added BR scraper+digest cron."
fi

# Restart BR app tmux session
if tmux has-session -t vagasaudebr-app 2>/dev/null; then
  tmux kill-session -t vagasaudebr-app || true
fi
tmux new-session -d -s vagasaudebr-app -c "$BR_ROOT" "$BR_ROOT/start.sh"
echo "Restarted tmux session vagasaudebr-app."

# Dry-check: key presence only
if grep -qE '^RESEND_API_KEY=.+' "$BR_ENV"; then
  echo "OK: RESEND_API_KEY is non-empty in BR env."
else
  echo "WARN: RESEND_API_KEY still empty." >&2
fi
grep -E '^EMAIL_FROM=' "$BR_ENV" || true
echo "Reminder: verify vagasaude.com.br (SPF/DKIM) in Resend dashboard."
