# Scrapers privados — VagaSaúde

Fontes ativas nesta fase:

| Fonte | Origem | Tipo |
|---|---|---|
| `bep` | https://www.bep.gov.pt | Nível MS + varredura catálogo + keywords (filtro SNS/clínico) |
| `dre` | https://diariodarepublica.pt | Avisos Série II (Chrome/puppeteer-core) — concursos saúde |
| `iefp` | https://iefponline.iefp.pt | Facetas CNP saúde (enfermagem, fisio, TO, TF) |
| `ipo_porto` | https://ipoporto.pt/nos-ipo/emprego-e-carreira/ | Procedimentos concursais IPO Porto |
| `scml` | https://recrutamento.scml.pt/ | Santa Casa Lisboa (filtro saúde, sector IPSS) |
| `scm_esposende` | https://www.scmesposende.pt/recrutamento | Santa Casa Esposende (IPSS) |
| `cuf` | https://carreiras.cuf.pt/jobs.json | JSON Feed / Teamtailor |
| `luz_saude` | CVWarehouse (Luz Saúde) | HTML público |
| `lusiadas` | CVWarehouse (Lusíadas) | HTML público |
| `trofa_saude` | Portal VNC / Trofa Saúde | API JSON |
| `joaquim_chaves` | https://recrutamento.jcs.pt/Offers | Harpoon `/GetOffersFiltered` |
| `champalimaud` | https://www.fchampalimaud.org/pt-pt/posicoes-em-aberto | `/get-offers` JSON |
| `germano_de_sousa` | https://www.germanodesousa.com/contactos/ofertas-de-emprego/ | HTML (portfolio) |
| `hpa` | https://www.grupohpa.com/pt/empregos/ | HTML (Algarve, Alentejo, Madeira) |
| `net_empregos` | https://www.net-empregos.com/emprego-saude-medicina-enfermagem.asp | Categoria saúde, 3 páginas, Portugal + profissões clínicas |
| `sapo_emprego` | https://emprego.sapo.pt/offers?categoria=saude | Categoria saúde + pesquisas clínicas; dedupe com fontes directas |

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
