# VagaSaúde Brasil (`apps/web-br`)

Cópia estrutural de `apps/web` adaptada ao mercado brasileiro.

- Domínio: https://vagasaude.com.br
- Locale: `pt-BR`
- Localização: estados (UF), não distritos PT
- Setores: Público · Privado · Filantrópico
- Contratos: CLT · PJ · estágio · temporário · plantão
- Moeda: R$ (BRL)
- Scrapers: `scrapers-br/` (ainda vazios)
- Dev: `pnpm dev` → http://127.0.0.1:3011

```bash
cd apps/web-br
cp .env.example .env.local
pnpm install
pnpm dev
```

O site Portugal (`apps/web` / vagasaude.pt) mantém-se independente.
