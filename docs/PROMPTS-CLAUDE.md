# Prompts para o Claude (ou outra IA) — VagaSaúde

Documento de apoio ao [`PLANO.md`](./PLANO.md). Prompts prontos a copiar para
gerar cada peça do projeto, por ordem de execução. Ajusta os detalhes entre
`< >` conforme necessário.

> Dica: dá sempre ao Claude o contexto do plano (`docs/PLANO.md`) e do documento
> específico da tarefa (ex.: `docs/MODELO-DADOS.md`) antes de pedir código.

---

## 0. Prompt de contexto (usar no início de cada sessão)

```
És um engenheiro sénior a construir o VagaSaude.pt, um agregador de vagas de
saúde em Portugal. Stack: Next.js 15 (App Router, TypeScript), Prisma,
PostgreSQL, Python + Playwright para scraping, Docker Compose, Caddy, Cloudflare,
Resend para emails. Inclui um backoffice /admin para um único administrador e
publicação automática de vagas válidas. Segue docs/PLANO.md, docs/DESIGN.md e
docs/BACKOFFICE.md. Escreve código limpo, tipado, acessível e mobile-first. Não
incluas funcionalidades fora do MVP (sem candidatura interna, chat, app móvel,
portal de empregador ou IA de matching).
```

---

## 1. Esqueleto do monorepo

```
Cria o esqueleto do monorepo do VagaSaude com esta estrutura:
apps/web (Next.js 15 + TypeScript + Tailwind + shadcn/ui),
packages/database (Prisma), scrapers/ (Python + Playwright),
docker-compose.yml, Caddyfile, .env.example.
Configura workspaces (pnpm) e scripts base. Mostra todos os ficheiros de config.
```

---

## 2. Infraestrutura (Docker + Caddy + Cloudflare)

```
Com base em docs/ARQUITETURA.md, gera o docker-compose.yml final (web, db,
redis opcional, scraper, caddy), o Caddyfile com certificado de origem da
Cloudflare, e o .env.example. Explica os passos de deploy no VPS Hetzner e a
configuração DNS/SSL na Cloudflare (Full strict).
```

---

## 3. Base de dados (Prisma)

```
Com base em docs/MODELO-DADOS.md, cria o schema.prisma completo, a migração
inicial, e um seed que popula distritos, concelhos, profissões e sources de
Portugal. Ativa a extensão pg_trgm e cria os índices de pesquisa/dedup.
Inclui um helper prisma client partilhável em packages/database.
```

---

## 4. Listagem + filtros

```

## 4A. Design system e homepage

```
Com base em docs/DESIGN.md, implementa os tokens CSS dos modos claro e escuro,
Manrope via next/font, alternador claro/escuro/sistema sem flash inicial e os
componentes base acessíveis. Implementa a homepage aprovada: cabeçalho, hero com
pesquisa, chips de profissões, vagas recentes e CTA para alertas. Mantém WCAG
2.2 AA, alvos táteis de 44px e evita fotografias genéricas de saúde.
```
Com base em docs/COMPONENTES-REACT.md, implementa a rota /vagas como Server
Component que lê filtros dos searchParams (distrito, profissão, setor, contrato,
keyword), consulta via Prisma e renderiza JobList + JobCard. Cria a FilterBar
com estado no URL (mobile-first, shadcn/ui) e paginação. Otimiza para LCP < 1.5s.
```

---

## 5. Página de detalhe + SEO

```
Com base em docs/SEO.md, cria a rota /vagas/[slug] com o conteúdo completo da
vaga, generateMetadata (título/descrição/canonical/OG) e o componente JobJsonLd
com JobPosting válido para o Google for Jobs. Usa generateStaticParams + ISR.
Gera também app/sitemap.ts e app/robots.ts.
```

---

## 6. Alertas por email

```
Implementa o sistema de alertas: AlertForm (client) + POST /api/alerts que cria
o utilizador (se novo) e o alerta com double opt-in. Cria o email de confirmação
via Resend e a rota /alertas/confirmar?token=. Depois, um job diário que, por
cada alerta ativo, procura vagas novas (usando alert_deliveries para não
repetir) e envia um email com as novas vagas. Inclui link de cancelamento em
todos os emails (GDPR).
```

---

## 7. Scraper (por fonte)

```
Com base em docs/SCRAPING.md, cria o BaseScraper e o scraper da fonte <BEP>.
Deve devolver JobPayload normalizado, respeitar robots.txt e rate limiting, e
enviar as vagas via POST /api/ingest (Bearer SCRAPER_API_TOKEN). Implementa a
normalização e o dedupe_hash em common/normalize.py. Adiciona o run.py com
--once --source <slug> e --schedule (APScheduler).
```

Repetir este prompt trocando `<BEP>` por `CUF`, `Lusíadas`, `Net-Empregos`, etc.

---

## 8. Endpoint de ingestão

```
Cria POST /api/ingest no Next.js, autenticado por Bearer SCRAPER_API_TOKEN.
Recebe { source, jobs[] }, valida com zod, calcula dedupe_hash, faz upsert por
(source, source_id), evita duplicados cruzados por dedupe_hash, e atualiza
sources.last_run_at/last_status. Devolve um resumo (inseridas, atualizadas,
ignoradas, em revisão). Publica automaticamente as vagas completas quando
source.auto_publish está ativo; usa pending_review para exceções e duplicate
para correspondências já existentes. Cria um ScraperRun por execução.
```

---

## 9. Backoffice

```
Com base em docs/BACKOFFICE.md, implementa /admin integrado no Next.js para um
único ADMIN_EMAIL. Usa magic link via Resend, sessão validada no servidor e
assume Cloudflare Access como camada adicional. Cria dashboard, gestão de vagas,
fontes, execuções dos scrapers, taxonomias, alertas/subscritores, auditoria e
estado do sistema. Todas as Server Actions validam autorização e Zod; ações
destrutivas pedem confirmação e criam AdminAuditLog. Não implementes RBAC.
```

---

## 10. Testes

```
Escreve testes: (a) unitários para normalize/dedupe_hash e para a query de
listagem; (b) e2e (Playwright) do fluxo de criar alerta → confirmar → simular
vaga nova → receber email (mock do Resend); (c) autorização de todas as rotas
/admin e transições de estado da publicação automática. Configura o CI.
```

---

## 11. Backups + monitorização

```
Com base em docs/ARQUITETURA.md, cria o script backup.sh (pg_dump + gzip +
retenção local de 30 dias + cópia obrigatória para Hetzner Storage Box) e a
entrada cron. Documenta e testa o restauro. Adiciona /api/health que verifica a
BD e explica como ligar o Uptime Kuma.
```

---

## Dicas para melhores resultados

- Peça **um ficheiro/módulo de cada vez** e reveja antes de avançar.
- Cole os erros de compilação/testes de volta para o Claude corrigir.
- Peça sempre para **respeitar o MVP** e não adicionar features extra.
- Para scrapers, forneça **HTML de exemplo** real da fonte — melhora muito o parsing.
```
