# Scrapers — VagaSaúde Brasil

Fontes do mercado brasileiro. **Ingest só em** `http://127.0.0.1:3011` / `vagasaude.com.br`  
(`DATA_DIR=/var/www/vagasaudebr/data`). Nunca usar a API do `.pt`.

## Fontes (MVP)

| Slug | Empregador | ATS | Sector |
|---|---|---|---|
| `rededor` | Rede D’Or (incl. Star) | Gupy | privado |
| `hapvida` | Hapvida NDI | Gupy | privado |
| `irssl` | IRSSL (Sírio social/OSS) | Gupy | publico |
| `santa_casa_bh` | Santa Casa BH | Gupy | ipss → Filantrópico |
| `redeamericas` | Rede Américas (Samaritano, Nove de Julho…) | Gupy | privado |
| `moinhos` | Hospital Moinhos de Vento | Gupy | privado |
| `bp` | Beneficência Portuguesa SP | Gupy | privado |
| `einstein` | Albert Einstein | Vagas.com | privado |

Cliente partilhado Gupy: `sources/gupy.py`.

## Uso

```bash
cd scrapers-br
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export INGEST_BASE_URL=http://127.0.0.1:3011
export SCRAPER_API_TOKEN=…   # do .env.production BR

python run.py --source moinhos --dry-run
python run.py --source all
```

## Cron (servidor)

```bash
15 */6 * * * /var/www/vagasaudebr/scrapers/run-scrapers.sh >> /var/www/vagasaudebr/data/scrapers.log 2>&1
```

O wrapper corre os scrapers e, se `RESEND_API_KEY` + `SCRAPER_API_TOKEN` existirem em
`/var/www/vagasaudebr/.env.production`, faz `POST http://127.0.0.1:3011/api/alerts/digest`
(espelho do digest PT — nunca aponta para :3010).

### Email (Resend)

Em `.env.production` BR:

```bash
RESEND_API_KEY=re_…          # mesma conta PT ok; não commitar
EMAIL_FROM="VagaSaúde Brasil <alertas@vagasaude.com.br>"
```

No [Resend](https://resend.com/domains): adicionar e verificar `vagasaude.com.br`
(SPF + DKIM). Sem DNS verificado, envios de `alertas@vagasaude.com.br` falham.

Ver também `docs/SCRAPERS-BR.md`.
