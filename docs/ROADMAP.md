# Roadmap Detalhado — VagaSaúde

Documento de apoio ao [`PLANO.md`](./PLANO.md). Checklist acionável por fase.
As fases estão ordenadas por dependência técnica, não por calendário.

---

## Fase 1 — Fundação

**Objetivo:** infraestrutura reproduzível + esqueleto navegável.

- [ ] Criar monorepo (`apps/web`, `packages/database`, `scrapers`, `docs`).
- [ ] `docker-compose.yml` com `web` ligado apenas a `127.0.0.1:3010` e `db` (Redis/scraper podem entrar depois).
- [ ] VirtualHost Apache como reverse proxy + certificado Let's Encrypt existente.
- [ ] `.env.example` completo.
- [ ] DNS na Cloudflare (`A` + proxy) e SSL **Full (strict)**.
- [ ] Schema Prisma inicial, incluindo estados de vaga, `ScraperRun` e `AdminAuditLog`.
- [ ] Migração inicial + `prisma db seed` (distritos, concelhos, profissões, sources).
- [ ] Tokens do design, Manrope e temas claro/escuro/sistema.
- [ ] Componentes base e logótipo vetorial.
- [ ] Página inicial + `/vagas` a listar dados seed/mock.
- [ ] Magic link para `ADMIN_EMAIL`, sessão no servidor e proteção Cloudflare Access.
- [ ] Layout e navegação base de `/admin`.
- [ ] `/api/health` e Uptime Kuma a monitorizar.

**Saída:** `docker compose up` num VPS limpo serve o site com dados de exemplo.

---

## Fase 2 — Core

**Objetivo:** produto realmente útil com dados reais.

### Listagem & detalhe
- [ ] `FilterBar` com estado no URL (distrito, profissão, setor, contrato, keyword).
- [ ] Paginação.
- [ ] Página `/vagas/[slug]` com conteúdo completo.
- [ ] `JobPosting` JSON-LD válido (Rich Results Test).

### Alertas por email
- [ ] `AlertForm` + `POST /api/alerts`.
- [ ] Double opt-in (email de confirmação, `/alertas/confirmar?token=`).
- [ ] Job diário que consulta vagas novas por alerta e envia via Resend.
- [ ] `alert_deliveries` para não repetir vagas.
- [ ] Link de cancelamento em todos os emails (`/alertas/gerir?token=`).

### Scraping
- [ ] `scrapers/` com `BaseScraper` + `run.py`.
- [ ] Endpoint `POST /api/ingest` autenticado (upsert + dedup).
- [ ] Scraper **BEP** (público).
- [ ] Scraper **1–2 grupos privados** (ex.: CUF, Lusíadas).
- [ ] (Opcional) Net-Empregos / Indeed filtrado.
- [ ] Agendamento (APScheduler ou cron do host).
- [ ] Deduplicação a funcionar entre fontes.
- [ ] Publicação automática de vagas válidas.
- [ ] Fila `pending_review` para vagas incompletas ou suspeitas.
- [ ] Histórico `ScraperRun` com contadores e erros.

### Backoffice
- [ ] Dashboard com métricas e estado das fontes.
- [ ] Gestão de vagas e ações em massa.
- [ ] Gestão de fontes e execução manual assíncrona dos scrapers.
- [ ] Gestão de profissões, localizações e contratos.
- [ ] Gestão de alertas/subscritores e eliminação GDPR.
- [ ] Registo de auditoria das ações administrativas.

### SEO
- [ ] `sitemap.ts` dinâmico + `robots.ts`.
- [ ] `generateMetadata` em todas as páginas.
- [ ] 2–3 landing pages programáticas (distrito/profissão).

**Saída:** vagas reais e publicadas automaticamente, alertas a chegar por
email e operação completa através do backoffice.

---

## Fase 3 — Polimento

**Objetivo:** qualidade de lançamento.

- [ ] Polimento do design aprovado e consistência visual.
- [ ] Acessibilidade WCAG 2.2 AA (axe/Lighthouse).
- [ ] Performance: LCP < 1.5s, Lighthouse ≥ 90.
- [ ] Testes unitários (normalização, dedup, queries) + e2e do fluxo de alertas.
- [ ] Backups diários automáticos para Hetzner Storage Box + teste de restauro.
- [ ] Página de privacidade + fluxo GDPR (apagar dados).
- [ ] Tratamento de erros e estados vazios.
- [ ] **Soft launch** (partilha limitada, recolha de feedback).

**Saída:** cumpre a *Definition of Done* do MVP (Secção 11 do plano).

---

## Fase 4 — Crescimento

**Objetivo:** escalar fontes, audiência e receita.

- [ ] Mais fontes de scraping (hospitais individuais, agências).
- [ ] Conta de empregador (publicação manual de vagas).
- [ ] Vagas em destaque (primeira monetização).
- [ ] Conteúdo/guias (SEO editorial: carreiras, concursos públicos, etc.).
- [ ] Analytics de produto (alertas ativos, cliques em candidatar).
- [ ] Preparar expansão para Espanha.

---

## Dependências entre fases

```
Fase 1 (infra + schema)
   └── Fase 2 (core: listagem, alertas, scraping, SEO)
            └── Fase 3 (polimento + launch)
                     └── Fase 4 (crescimento + monetização)
```

O scraping (Fase 2) depende do schema e do `/api/ingest` (Fase 1/2). Os alertas
dependem de existir volume de vagas reais. SEO programático depende de a
listagem/detalhe estarem estáveis.
