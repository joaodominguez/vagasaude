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
- Email: Resend (`RESEND_API_KEY` + `EMAIL_FROM="VagaSaúde Brasil <alertas@vagasaude.com.br>"`).
  Verificar DNS do domínio `vagasaude.com.br` no dashboard Resend (SPF/DKIM) antes de enviar.

```bash
cd apps/web-br
cp .env.example .env.local
pnpm install
pnpm dev
```

O site Portugal (`apps/web` / vagasaude.pt) mantém-se independente.
