# Arquitetura & Infraestrutura — VagaSaúde

Documento de apoio ao [`PLANO.md`](./PLANO.md). Contém a proposta concreta de
`docker-compose.yml`, integração com o Apache existente, configuração
Cloudflare, backups e monitorização.

---

## 1. Topologia

O VPS Hetzner já aloja vários sites em Apache. A Cloudflare faz CDN, WAF e
termina o TLS público; o Apache mantém o VirtualHost e o certificado Let's
Encrypt do domínio, encaminhando os pedidos para o Next.js numa porta local.

Dimensionamento inicial recomendado: **4 vCPU, 8 GB RAM e 80 GB SSD**. O
Playwright é o componente com maior consumo transitório de memória. A base de
dados, aplicação, backoffice, Redis, scrapers, Apache e monitorização ficam na
Hetzner; apenas Cloudflare e Resend são serviços externos de aplicação.

```
Internet → Cloudflare → Apache (:443) → Next.js (127.0.0.1:3010)
                                              │
                                      PostgreSQL / Redis
                                              ↑
                                         Scrapers
```

Não instalar Caddy: Apache já ocupa as portas 80/443 e serve outros domínios.

---

## 2. `docker-compose.yml` (proposta)

```yaml
services:
  web:
    build: ./apps/web
    restart: unless-stopped
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    ports:
      # A porta nunca fica exposta à Internet; só o Apache local acede.
      - "127.0.0.1:3010:3000"
    networks: [internal]

  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [internal]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redisdata:/data
    networks: [internal]

  scraper:
    build: ./scrapers
    restart: unless-stopped
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    # Corre em loop com agendamento interno, ou via cron do host.
    command: ["python", "run.py", "--schedule"]
    networks: [internal]

volumes:
  pgdata:
  redisdata:

networks:
  internal:
    driver: bridge
```

Notas:
- O Next.js fica ligado apenas a `127.0.0.1:3010`; nunca a `0.0.0.0`.
- A porta 3000 já é usada por outro site no servidor e não deve ser reutilizada.
- PostgreSQL e Redis do projeto permanecem na rede Docker interna.
- Redis pode ser removido no MVP inicial se não for usado.

---

## 3. Apache (existente)

O VirtualHost HTTPS existente usa Let's Encrypt. No deploy, trocar apenas o
`DocumentRoot` estático pelo reverse proxy, depois de guardar uma cópia do
ficheiro atual:

```apache
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName vagasaude.pt
    ServerAlias www.vagasaude.pt

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3010/ retry=0 timeout=60
    ProxyPassReverse / http://127.0.0.1:3010/
    RequestHeader set X-Forwarded-Proto "https"

    ErrorLog ${APACHE_LOG_DIR}/vagasaude-error.log
    CustomLog ${APACHE_LOG_DIR}/vagasaude-access.log combined

    Include /etc/letsencrypt/options-ssl-apache.conf
    SSLCertificateFile /etc/letsencrypt/live/vagasaude.pt/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/vagasaude.pt/privkey.pem
</VirtualHost>
</IfModule>
```

Ativar uma única vez os módulos necessários:

```bash
sudo a2enmod proxy proxy_http headers
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Executar `configtest` antes de cada reload. A configuração da porta 80 continua
a redirecionar para HTTPS.

---

## 4. Cloudflare

- **DNS:** `A` record de `vagasaude.pt` → IP do VPS, com **proxy ativado** (nuvem laranja). Igual para `www`.
- **SSL/TLS:** modo **Full (strict)**; o certificado Let's Encrypt existente
  no Apache é válido na ligação Cloudflare → origem.
- **Cache:** cache agressivo de estáticos (`/_next/static/*`, imagens). Regras de cache para não cachear páginas dinâmicas/API.
- **WAF:** regras básicas + rate limiting no `/api/*`.
- **Bot protection:** ativar para mitigar scraping do próprio site.
- **Access:** proteger `vagasaude.pt/admin/*`, permitindo apenas o email do
  administrador. A aplicação continua a validar a sessão no servidor.

---

## 5. Variáveis de Ambiente — `.env.example`

```bash
# Base de dados
POSTGRES_USER=vagasaude
POSTGRES_PASSWORD=change-me
POSTGRES_DB=vagasaude
DATABASE_URL=postgresql://vagasaude:change-me@db:5432/vagasaude?schema=public

# Next.js
NEXT_PUBLIC_SITE_URL=https://vagasaude.pt
NODE_ENV=production

# Redis (opcional)
REDIS_URL=redis://redis:6379

# Email (Resend)
RESEND_API_KEY=re_xxx
EMAIL_FROM="VagaSaúde <alertas@vagasaude.pt>"

# Backoffice (um administrador)
ADMIN_EMAIL=administrador@example.com
AUTH_SECRET=generate-a-long-random-value

# Scraper
SCRAPER_API_TOKEN=change-me   # auth para o scraper escrever via API interna
```

---

## 6. Backups (diários, externos e automáticos)

Um backup guardado apenas no mesmo VPS não protege contra perda do servidor.
O destino externo aprovado é uma **Hetzner Storage Box**. Script `backup.sh`
no host, agendado pelo cron:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/vagasaude
set -a
source .env
set +a
STAMP=$(date +%F-%H%M)
DEST=/opt/backups
mkdir -p "$DEST"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$DEST/vagasaude-$STAMP.sql.gz"
# Cópia externa (remote "storagebox" previamente configurado no rclone)
rclone copy "$DEST/vagasaude-$STAMP.sql.gz" storagebox:vagasaude/database
# Retenção local
find "$DEST" -name 'vagasaude-*.sql.gz' -mtime +30 -delete
```

Cron do host:
```
0 3 * * * cd /opt/vagasaude && ./backup.sh >> /var/log/vagasaude-backup.log 2>&1
```

Executar e documentar um teste de restauro pelo menos trimestralmente. Uma
cópia nunca testada não é uma garantia de recuperação.

---

## 7. Monitorização

- **Uptime Kuma** (contentor à parte ou noutro host) a monitorizar
  `https://vagasaude.pt/api/health` e o endpoint público.
- **Healthchecks** Docker em cada serviço.
- **Logs:** `docker compose logs` + rotação; opcionalmente enviar para um
  serviço externo mais tarde.
- Endpoint `/api/health` no Next.js que verifica ligação à BD.

---

## 8. Deploy

1. Clonar o repo no VPS.
2. Copiar `.env.example` → `.env` e preencher segredos.
3. Ativar/iniciar Docker e executar `docker compose build && docker compose up -d`.
4. Confirmar primeiro `curl http://127.0.0.1:3010/api/health`.
5. Correr migrações: `docker compose exec web npx prisma migrate deploy`.
6. Seed inicial: `docker compose exec web npx prisma db seed`.
7. Guardar o VirtualHost atual, configurar o reverse proxy e executar
   `sudo apache2ctl configtest` antes do reload.
8. Configurar Cloudflare Access para `/admin/*` e testar o magic link.
9. Configurar a Storage Box, executar um backup e testar o restauro.
10. Verificar `https://vagasaude.pt` e `/api/health`.
