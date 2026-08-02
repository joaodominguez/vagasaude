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
