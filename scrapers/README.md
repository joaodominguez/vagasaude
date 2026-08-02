# Scrapers privados — VagaSaúde

Fontes ativas nesta fase:

| Fonte | Origem | Tipo |
|---|---|---|
| `bep` | https://www.bep.gov.pt | ASP.NET (pesquisa saúde) |
| `cuf` | https://carreiras.cuf.pt/jobs.json | JSON Feed / Teamtailor |
| `luz_saude` | CVWarehouse (Luz Saúde) | HTML público |
| `lusiadas` | CVWarehouse (Lusíadas) | HTML público |
| `trofa_saude` | Portal VNC / Trofa Saúde | API JSON |
| `joaquim_chaves` | https://recrutamento.jcs.pt/Offers | Harpoon `/GetOffersFiltered` |
| `champalimaud` | https://www.fchampalimaud.org/pt-pt/posicoes-em-aberto | `/get-offers` JSON |

José de Mello Saúde usa o mesmo portal da CUF para recrutamento externo.

## Executar

```bash
cd scrapers
python3 -m pip install -r requirements.txt
export INGEST_BASE_URL=http://127.0.0.1:3010
export SCRAPER_API_TOKEN=...
python3 run.py --source all
```

Dry-run sem ingestão:

```bash
python3 run.py --source cuf --dry-run
```
