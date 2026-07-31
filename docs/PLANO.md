# Plano Completo e Elaborado — VagaSaude.pt

> Documento mestre do projeto. Versão elaborada e detalhada do plano inicial.
> Documentos de apoio: [`ARQUITETURA.md`](./ARQUITETURA.md), [`MODELO-DADOS.md`](./MODELO-DADOS.md), [`COMPONENTES-REACT.md`](./COMPONENTES-REACT.md), [`SCRAPING.md`](./SCRAPING.md), [`SEO.md`](./SEO.md), [`ROADMAP.md`](./ROADMAP.md), [`PROMPTS-CLAUDE.md`](./PROMPTS-CLAUDE.md).

---

## 1. Visão do Projeto

**Nome:** VagaSaude.pt
**Domínio:** vagasaude.pt
**Objetivo:** Ser o melhor agregador de ofertas de emprego na área da saúde em Portugal (setor público + privado + IPSS), com uma interface extremamente simples, rápida e clara.

**Posicionamento:**
> "Todas as vagas de saúde em Portugal num só sítio. Simples, atualizado e fácil de usar."

**Proposta de valor (porque é que alguém usa em vez do Google/Indeed):**
1. **Especialização** — só saúde, com filtros que fazem sentido para a área (profissão, especialidade, setor público/privado, distrito).
2. **Agregação** — junta fontes que hoje estão dispersas (BEP, grupos privados, portais generalistas), sem o profissional ter de visitar 10 sites.
3. **Alertas úteis** — o utilizador cria um alerta ("Enfermeiro, distrito de Braga, setor público") e recebe email quando surge algo novo.
4. **Velocidade e simplicidade** — carregamento < 1.5s, mobile-first, zero ruído.

**Público-alvo:**
- Enfermeiros
- Médicos (internos e especialistas)
- Técnicos superiores de saúde / técnicos de diagnóstico e terapêutica (TDT)
- Auxiliares de ação médica / geriatria
- Fisioterapeutas, terapeutas, farmacêuticos e restantes profissionais de saúde

**Métricas-norte (North Star):**
- Nº de alertas ativos por email (proxy de retenção real).
- Nº de cliques em "Candidatar" (proxy de valor entregue).

---

## 2. Stack Técnica (Self-hosted na Hetzner + Cloudflare)

| Camada               | Tecnologia                     | Notas |
|----------------------|--------------------------------|-------|
| Frontend + Backend   | Next.js 15 (App Router)        | TypeScript, React Server Components |
| ORM                  | Prisma                         | Migrações versionadas, type-safe |
| Base de Dados        | PostgreSQL 16                  | Docker, com `pg_trgm` para dedup/pesquisa |
| Cache / Filas        | Redis 7 (opcional no início)   | Cache de listagens + fila de emails |
| Scraping             | Python 3.12 + Playwright       | Contentor separado, corre por cron |
| Reverse Proxy        | Caddy 2                        | HTTPS automático (mas ver nota Cloudflare) |
| Orquestração         | Docker Compose                 | Tudo contentorizado |
| DNS + CDN + Proteção | Cloudflare                     | Proxy ativado, cache de estáticos, WAF |
| Hosting              | Hetzner VPS (CX/CPX)           | Já existente |
| Emails               | Resend (recomendado) ou Brevo  | Alertas + transacionais |
| Monitorização        | Uptime Kuma + logs Docker      | Healthchecks e uptime |

**Decisões e justificações:**
- **Prisma vs Drizzle:** recomendado **Prisma** para o MVP — melhor DX, migrações maduras e integração direta com Next.js. Drizzle é uma alternativa válida se quiseres SQL mais próximo do metal.
- **Caddy + Cloudflare:** com o proxy da Cloudflare ativo, o SSL público é terminado na Cloudflare. Usa **Cloudflare "Full (strict)"** com um certificado de origem da Cloudflare no Caddy (ver [`ARQUITETURA.md`](./ARQUITETURA.md)).
- **Redis opcional:** não é bloqueante para o MVP. Introduzir quando a listagem precisar de cache ou quando os emails precisarem de fila.
- **Resend:** DX simples, bom free tier, ótimo para começar. Configurar SPF/DKIM/DMARC no domínio.

---

## 3. Arquitetura (visão de alto nível)

```
                 Utilizador
                     │
             Cloudflare (Proxy + SSL + WAF + CDN)
                     │
        ┌────────────┴─────────────┐
        │        Hetzner VPS        │
        │  ┌─────────────────────┐  │
        │  │  Caddy (80/443)     │  │  reverse proxy + TLS de origem
        │  └──────────┬──────────┘  │
        │             │             │
        │  ┌──────────▼──────────┐  │
        │  │  Next.js (web)      │  │  App Router, SSR/ISR + API routes
        │  └──────────┬──────────┘  │
        │             │             │
        │  ┌──────────▼──────────┐  │
        │  │  PostgreSQL         │  │  dados de vagas, users, alertas
        │  └─────────────────────┘  │
        │  ┌─────────────────────┐  │
        │  │  Redis (opcional)   │  │  cache + fila de emails
        │  └─────────────────────┘  │
        │  ┌─────────────────────┐  │
        │  │  Scraper (Python)   │  │  cron; escreve na BD via API/SQL
        │  └─────────────────────┘  │
        └───────────────────────────┘
```

Detalhe completo (`docker-compose.yml`, `Caddyfile`, redes, volumes, backups) em [`ARQUITETURA.md`](./ARQUITETURA.md).

---

## 4. Funcionalidades do MVP (versão 1.0)

### Obrigatórias
- **Listagem de vagas** com filtros combináveis:
  - Distrito (e, opcionalmente, concelho)
  - Profissão
  - Setor (Público / Privado / IPSS)
  - Tipo de contrato
  - Pesquisa por texto livre (título/empresa)
- **Página individual** de cada vaga (com `JobPosting` schema.org).
- **Sistema de alertas por email** — utilizador cria alerta com filtros, confirma por email (double opt-in), recebe novidades.
- **Design mobile-first**, limpo e muito rápido.
- **SEO técnico forte** — sitemap, metadados, `JobPosting` structured data, URLs limpas.
- **Atualização automática de vagas** via scraping (mín. 2–3 fontes).

### Explicitamente fora do MVP
- Candidatura interna (redireciona sempre para a fonte).
- Chat.
- Conta de empregador completa (auto-publicação).
- App móvel.
- Matching com IA.

**Critério de "pronto" (Definition of Done) do MVP:** ver Secção 11.

---

## 5. Modelo de Dados

Resumo abaixo; schema Prisma completo, SQL e índices em [`MODELO-DADOS.md`](./MODELO-DADOS.md).

### Tabela principal: `jobs`
`id (uuid)`, `title`, `company`, `location_district`, `location_concelho`,
`profession`, `specialty (nullable)`, `sector (publico|privado|ipss)`,
`contract_type`, `description`, `requirements`, `salary (nullable)`,
`application_url`, `source`, `source_id`, `dedupe_hash`,
`published_at`, `expires_at`, `is_active`, `created_at`, `updated_at`.

### Outras tabelas
- `professions` — taxonomia normalizada de profissões.
- `districts` (+ `concelhos`) — geografia de Portugal.
- `users` — subscritores de alertas.
- `job_alerts` — alertas com filtros por utilizador.
- `sources` — fontes de scraping e respetivo estado.
- `alert_deliveries` (recomendado) — histórico de envios para não repetir vagas.

**Deduplicação:** `dedupe_hash = sha256(normalizar(title) + normalizar(company) + normalizar(location))`, com `unique` por `(source, source_id)` e verificação cruzada por `dedupe_hash` (usando `pg_trgm` para casos aproximados).

---

## 6. Fontes de Dados (Prioridade)

**Fase 1 (arranque):**
- **BEP** — Bolsa de Emprego Público (setor público).
- **Grupos privados:** CUF, Luz Saúde, Lusíadas, Trofa Saúde, José de Mello.
- **Net-Empregos** (filtrado por categoria saúde).
- **Indeed Portugal** (filtrado).

**Fase 2 (expansão):**
- Sites individuais de hospitais e centros hospitalares.
- Agências de recrutamento especializadas em saúde.

**Regras transversais (importante — ver [`SCRAPING.md`](./SCRAPING.md)):**
- Respeitar `robots.txt` e Termos de Serviço de cada fonte; preferir feeds/APIs oficiais quando existirem.
- Rate limiting e user-agent identificável.
- Deduplicação obrigatória.
- Guardar sempre `application_url` original (o VagaSaude reencaminha, não "rouba" a candidatura).

---

## 7. Estrutura de Pastas do Projeto (monorepo)

```
vagasaude/
├── apps/
│   └── web/                 # Next.js 15 (App Router, TypeScript)
├── packages/
│   └── database/            # Prisma schema, client, migrações e seed
├── scrapers/                # Python + Playwright (um módulo por fonte)
│   ├── common/              # http, dedup, normalização, cliente da API
│   ├── sources/             # bep.py, cuf.py, net_empregos.py, ...
│   └── run.py               # orquestrador (cron)
├── docs/                    # este plano e documentos de apoio
├── docker-compose.yml
├── Caddyfile
├── .env.example
└── README.md
```

Estrutura detalhada de componentes em [`COMPONENTES-REACT.md`](./COMPONENTES-REACT.md).

---

## 8. Fases de Desenvolvimento

Roadmap detalhado com checklist por tarefa em [`ROADMAP.md`](./ROADMAP.md). Resumo:

### Fase 1 — Fundação
- Setup Docker Compose (Next.js + PostgreSQL + Caddy).
- Configuração Cloudflare + DNS.
- Schema da base de dados (Prisma) + seed de distritos/profissões.
- Página inicial + listagem básica (dados seed/mock).

### Fase 2 — Core
- Filtros completos + pesquisa.
- Página de detalhe da vaga + `JobPosting` schema.
- Sistema de alertas por email (double opt-in + envio).
- Scraping das primeiras 3–4 fontes + deduplicação.
- SEO técnico (sitemap, metadados, robots).

### Fase 3 — Polimento
- Design final, acessibilidade, performance (Lighthouse ≥ 90).
- Testes (unitários + e2e do fluxo de alertas).
- Backups automáticos + monitorização (Uptime Kuma).
- Soft launch.

### Fase 4 — Crescimento
- Mais fontes de scraping.
- Conta de empregador (publicação de vagas).
- Conteúdo/guias (SEO editorial).
- Expansão futura para Espanha (`vagasalud.es`?).

---

## 9. Requisitos Não-Funcionais

| Requisito | Alvo | Como medir |
|-----------|------|------------|
| Tempo de carregamento da listagem | < 1.5s | Lighthouse / WebPageTest (LCP) |
| Mobile-friendly | 100% | Lighthouse mobile |
| HTTPS | Obrigatório | Cloudflare Full (strict) |
| Conformidade GDPR | Total | Consentimento, double opt-in, política de privacidade, direito ao esquecimento |
| Backups da BD | Diários automáticos | `pg_dump` + retenção 7/30 dias |
| Monitorização | Básica | Uptime Kuma + healthchecks Docker |
| Acessibilidade | WCAG AA (razoável) | axe / Lighthouse a11y |

**GDPR — pontos concretos:** minimização de dados (só email para alertas), double opt-in, link de cancelamento em todos os emails, política de privacidade clara, e endpoint para apagar dados do utilizador.

---

## 10. Monetização (futuro)

1. **Destaque de vagas** — empregadores pagam para promover uma vaga no topo/realçada.
2. **Pacotes mensais** para clínicas/hospitais (publicação recorrente).
3. **Publicidade** de cursos e formações da área.
4. **Serviços premium** para candidatos (alertas avançados, CV, etc.) — mais tarde.

Nenhuma monetização é ativada no MVP. O foco é audiência e utilidade primeiro.

---

## 11. Critérios de Sucesso do MVP (Definition of Done)

- [ ] **150+ vagas ativas** na base de dados, provenientes de scraping.
- [ ] **Pelo menos 2–3 fontes** a atualizar automaticamente (cron a correr sem intervenção).
- [ ] **Sistema de alertas** funcional ponta-a-ponta (criar → confirmar → receber email).
- [ ] **Listagem com filtros** a funcionar (distrito, profissão, setor, contrato) com bom tempo de resposta.
- [ ] **Página de detalhe** com `JobPosting` structured data válido (testado no Rich Results Test).
- [ ] **Performance:** LCP da listagem < 1.5s; Lighthouse ≥ 90 (perf + a11y + SEO).
- [ ] **Deduplicação** a evitar vagas repetidas entre fontes.
- [ ] **Backups diários** e monitorização ativos.
- [ ] **Deploy reproduzível** via `docker compose up` num VPS limpo.

---

## 12. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Fontes mudam o HTML / bloqueiam scraping | Alto | Scrapers modulares por fonte; alertas quando uma fonte falha; preferir APIs/feeds oficiais |
| Questões legais/ToS de scraping | Médio/Alto | Respeitar robots.txt e ToS; reencaminhar candidatura; guardar fonte; contactar fontes para parcerias |
| Conteúdo duplicado prejudica SEO | Médio | Reescrever/normalizar descrições; canonical; foco em páginas de qualidade |
| Emails caem em spam | Médio | SPF/DKIM/DMARC; provider reputado (Resend); double opt-in |
| VPS único = ponto único de falha | Médio | Backups diários off-site; docker compose reproduzível; monitorização |
| Baixa qualidade de dados (campos em falta) | Médio | Normalização + validação no ingest; marcar vagas incompletas |

---

## 13. Próximos Passos Imediatos

1. Aprovar este plano e a stack (Prisma, Resend, Cloudflare Full strict).
2. Criar o esqueleto do monorepo (`apps/web`, `packages/database`, `scrapers`).
3. Subir `docker-compose.yml` + `Caddyfile` (ver [`ARQUITETURA.md`](./ARQUITETURA.md)).
4. Definir e migrar o schema (ver [`MODELO-DADOS.md`](./MODELO-DADOS.md)) + seed de distritos/profissões.
5. Construir a listagem com dados seed e, em paralelo, o primeiro scraper (BEP).

Prompts prontos para acelerar cada passo com o Claude em [`PROMPTS-CLAUDE.md`](./PROMPTS-CLAUDE.md).

---

**Fim do Plano.**
