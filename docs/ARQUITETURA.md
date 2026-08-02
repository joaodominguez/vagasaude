# Arquitetura & Infraestrutura — VagaSaúde

Documento de apoio ao [`PLANO.md`](./PLANO.md). Contém a proposta concreta de
`docker-compose.yml`, `Caddyfile`, configuração Cloudflare, backups e monitorização.

---

## 1. Topologia

Um único VPS Hetzner corre todos os serviços via Docker Compose, atrás da
Cloudflare (proxy laranja ativo). A Cloudflare faz CDN, WAF e termina o TLS
público; o Caddy no VPS serve como reverse proxy interno e termina o TLS de
origem (certificado de origem da Cloudflare).

Dimensionamento inicial recomendado: **4 vCPU, 8 GB RAM e 80 GB SSD**. O
Playwright é o componente com maior consumo transitório de memória. A base de
dados, aplicação, backoffice, Redis, scrapers, Caddy e monitorização ficam na
Hetzner; apenas Cloudflare e Resend são serviços externos de aplicação.

```
Internet → Cloudflare (SSL público + WAF + CDN) → Caddy → Next.js → Postgres/Redis
                                                          ↑
                                              Scraper (cron) escreve na BD
```

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
    expose:
      - "3000"
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

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./caddy/origin.crt:/etc/caddy/origin.crt:ro
      - ./caddy/origin.key:/etc/caddy/origin.key:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [web]
    networks: [internal]

volumes:
  pgdata:
  redisdata:
  caddy_data:
  caddy_config:

networks:
  internal:
    driver: bridge
```

Notas:
- Só o Caddy expõe portas ao host; tudo o resto comunica pela rede `internal`.
- O `web` usa `expose` (não `ports`) — só acessível internamente.
- Redis pode ser removido no MVP inicial se não for usado.

---

## 3. `Caddyfile` (com certificado de origem Cloudflare)

Com Cloudflare em modo **Full (strict)**, gera um *Origin Certificate* na
Cloudflare e coloca-o em `./caddy/origin.crt` / `./caddy/origin.key`.

```
vagasaude.pt, www.vagasaude.pt {
    tls /etc/caddy/origin.crt /etc/caddy/origin.key

    encode zstd gzip

    # Redireciona www → apex (opcional)
    @www host www.vagasaude.pt
    redir @www https://vagasaude.pt{uri} permanent

    reverse_proxy web:3000

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        X-Frame-Options "SAMEORIGIN"
    }
}
```

Alternativa (sem Cloudflare como proxy): usa `tls interno@email` e deixa o
Caddy obter certificados Let's Encrypt automaticamente — mas nesse caso perdes
CDN/WAF da Cloudflare.

---

## 4. Cloudflare

- **DNS:** `A` record de `vagasaude.pt` → IP do VPS, com **proxy ativado** (nuvem laranja). Igual para `www`.
- **SSL/TLS:** modo **Full (strict)** + Origin Certificate no Caddy.
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
3. Colocar `origin.crt`/`origin.key` da Cloudflare em `./caddy/`.
4. `docker compose build && docker compose up -d`.
5. Correr migrações: `docker compose exec web npx prisma migrate deploy`.
6. Seed inicial: `docker compose exec web npx prisma db seed`.
7. Configurar Cloudflare Access para `/admin/*` e testar o magic link.
8. Configurar a Storage Box, executar um backup e testar o restauro.
9. Verificar `https://vagasaude.pt` e `/api/health`.
