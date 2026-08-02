# VagaSaúde

Agregador de ofertas de emprego na área da saúde em Portugal (público + privado + IPSS).

> "Todas as vagas de saúde em Portugal num só sítio. Simples, atualizado e fácil de usar."

## Documentação / Plano

O plano completo e elaborado do projeto está em [`docs/`](./docs):

- [**PLANO.md**](./docs/PLANO.md) — plano mestre (visão, stack, MVP, fases, sucesso).
- [ARQUITETURA.md](./docs/ARQUITETURA.md) — Docker Compose, Apache, Cloudflare e backups.
- [BACKOFFICE.md](./docs/BACKOFFICE.md) — painel administrativo, publicação automática e segurança.
- [DESIGN.md](./docs/DESIGN.md) — identidade visual, temas, componentes e experiência.
- [MODELO-DADOS.md](./docs/MODELO-DADOS.md) — schema Prisma, SQL, dedup, queries.
- [COMPONENTES-REACT.md](./docs/COMPONENTES-REACT.md) — rotas e componentes Next.js.
- [SCRAPING.md](./docs/SCRAPING.md) — estratégia e arquitetura dos scrapers.
- [SEO.md](./docs/SEO.md) — SEO técnico e `JobPosting` / Google for Jobs.
- [ROADMAP.md](./docs/ROADMAP.md) — checklist detalhado por fase.
- [PROMPTS-CLAUDE.md](./docs/PROMPTS-CLAUDE.md) — prompts prontos para gerar o projeto.

## Stack

Next.js 15 · TypeScript · Prisma · PostgreSQL · Redis (opcional) · Python + Playwright · Apache · Docker Compose · Cloudflare · Hetzner · Resend.
