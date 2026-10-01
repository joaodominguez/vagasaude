# Cron sugerido (utilizador portal):
# 0 3 * * * /var/www/vagasaude/backup.sh >> /var/www/vagasaude/logs/backup.log 2>&1
#
# Instalar no servidor:
#   mkdir -p /var/www/vagasaude/logs /var/www/vagasaude/backups
#   cp deploy/backup.sh /var/www/vagasaude/backup.sh
#   chmod 750 /var/www/vagasaude/backup.sh
#   crontab -e  # adicionar a linha acima
#
# systemd --user (opcional, em vez de tmux):
#   mkdir -p ~/.config/systemd/user
#   cp deploy/systemd/vagasaude-app.service ~/.config/systemd/user/
#   # Ajustar WorkingDirectory/ExecStart se necessário
#   systemctl --user daemon-reload
#   systemctl --user enable --now vagasaude-app.service
#   loginctl enable-linger $USER
#
# --- Brasil (vagasaude.com.br) — paralelo a PT, nunca misturar DATA_DIR/PORT ---
# Build + package:
#   (cd apps/web-br && NEXT_PUBLIC_SITE_URL=https://vagasaude.com.br npm run build)
#   ./deploy/package-web-br.sh /tmp/vagasaudebr.tar.gz
# Server root: /var/www/vagasaudebr  PORT=3011  tmux: vagasaudebr-app
# Apache: deploy/apache/vagasaude.com.br.conf.example +
#         deploy/apache/vagasaude.com.br.htaccess → public/.htaccess
# Quote EMAIL_FROM in .env.production (angle brackets break `source` in start.sh).
#
# Email / Resend (BR) — script: deploy/configure-br-email.sh (no VPS):
#   RESEND_API_KEY=…   # pode reutilizar a mesma key da conta PT
#   EMAIL_FROM="VagaSaúde Brasil <alertas@vagasaude.com.br>"
#   Domínio vagasaude.com.br no Resend (SPF + DKIM; TXT resend._domainkey)
# Digest cron (portal; wrapper POST :3011/api/alerts/digest se Resend+token):
#   45 */6 * * * /var/www/vagasaudebr/scrapers/run-scrapers.sh >> /var/www/vagasaudebr/data/scrapers.log 2>&1
