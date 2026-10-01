# Scrapers — VagaSaúde Brasil

Espelho da pasta `scrapers/` (Portugal), para fontes do mercado brasileiro.

## Estado

Ainda sem fontes activas. A app `apps/web-br` está pronta a ingerir via
`POST /api/ingest` (mesmo contrato que o `.pt`).

## Como adicionar uma fonte

1. Copia um scraper de `scrapers/sources/` como ponto de partida.
2. Adapta selectors / RSS / API ao portal BR.
3. Filtra só saúde.
4. Faz POST para o ingest da app BR (`DATA_DIR` / token próprios).
5. Regista o `slug` em `apps/web-br/src/lib/sources.ts` e no admin.

## Arranque local (quando houver fontes)

```bash
cd scrapers-br
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# python run.py  (a criar a partir do run.py do PT)
```

## Domínio

Site: https://vagasaude.com.br  
App: `apps/web-br` (porta local 3011)
