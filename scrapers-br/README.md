# Scrapers — VagaSaúde Brasil

Fontes do mercado brasileiro. **Ingest só em** `http://127.0.0.1:3011` / `vagasaude.com.br`  
(`DATA_DIR=/var/www/vagasaudebr/data`). Nunca usar a API do `.pt`.

## Fontes activas

| Slug | Empregador | ATS | Sector | Notas |
|---|---|---|---|---|
| `pci_concursos` | PCI Concursos (saúde) | HTML | publico | Analogia BEP — editais |
| `agsus` | AgSUS | WP REST | publico | PSS / Trabalhe Conosco |
| `inca` | INCA | Plone gov.br | publico | Analogia IPO — volume baixo |
| `rededor` | Rede D’Or (incl. Vila Nova Star / Copa Star) | Gupy | privado | Agregador — não criar scraper Star |
| `hapvida` | Hapvida NDI | Gupy | privado | |
| `irssl` | IRSSL (Sírio social/OSS) | Gupy | publico | Braço público do Sírio |
| `hsl_sirio` | Hospital Sírio-Libanês (privado) | SuccessFactors | privado | Volume público baixo; SF |
| `santa_casa_bh` | Santa Casa BH | Gupy | ipss → Filantrópico | |
| `santa_casa_poa` | Santa Casa Porto Alegre | Gupy | ipss → Filantrópico | |
| `santa_casa_ba` | Santa Casa da Bahia | Gupy | ipss → Filantrópico | |
| `aacd` | AACD | Gupy | ipss → Filantrópico | |
| `redeamericas` | Rede Américas (Samaritano, Nove de Julho…) | Gupy | privado | Agregador Ímpar |
| `moinhos` | Hospital Moinhos de Vento | Gupy | privado | Filtro hospitalar alargado |
| `bp` | Beneficência Portuguesa SP | Gupy | privado | Filtro hospitalar alargado |
| `einstein` | Albert Einstein | Vagas.com | privado | **CF 1005 no VPS** — skip em `--source all`; correr off-VPS |
| `haoc` | Hospital Alemão Oswaldo Cruz (+ ISHAOC) | Gupy multi-board | privado/publico | 5 subdomains |
| `hcor` | HCor — Hospital do Coração | Pandapé | ipss → Filantrópico | |
| `mater_dei` | Rede Mater Dei | JobConvo | privado | Volume volátil |
| `spdm` | SPDM/PAIS (+ afiliadas HGG/HED/HSP/RJ/Diadema) | Gupy multi-board | publico | OSS/SUS — como IRSSL |
| `davita` | DaVita Serviços Assistenciais | Gupy | privado | Diálise (`servicosassistenciais`) |
| `seconci_sp` | Seconci-SP | Gupy | ipss → Filantrópico | SST / assistência |
| `fleury` | Grupo Fleury | Vagas.com | privado | **CF 1005 no VPS** — skip + off-VPS |
| `dasa` | Dasa Assistencial + Atendimento | Gupy multi-board | privado | Skip board tecnologia |
| `sabin` | Grupo Sabin | Gupy | privado | Labs |
| `fidi` | FIDI | Gupy | privado | Diagnóstico por imagem |
| `unimed` | Unimed (top 10 coops Gupy) | Gupy multi-board | privado | Campinas, Nacional, JF, Cuiabá… |
| `solides` | Unimeds Solides + clínicas/home care | Solides multi-tenant | privado | JP, Santos, RB, Patos, Home Doctor, Solar |
| `vera_cruz` | Hospital Vera Cruz | Gupy | privado | Campinas |
| `baia_sul` | Hospital Baía Sul | Gupy | privado | Florianópolis |
| `fhsa` | Hospital São Francisco de Assis | Gupy | ipss → Filantrópico | BH · 100% SUS |
| `pilar` | Pilar Hospital | Gupy | privado | |
| `sao_lucas` | Hospital São Lucas | Gupy | privado | |
| `medmais` | MedMais | Gupy | privado | Urgência / socorro |
| `imed` | IMED (OSS) | Gupy | publico | Gestão HU Goiás/SP |
| `oncologia_dor` | Oncologia D’Or | Gupy | privado | |

Cliente partilhado Gupy: `sources/gupy.py`.  
Cliente partilhado Vagas.com: `sources/vagas_com.py` (Einstein + Fleury).  
Cliente partilhado Solides: `sources/solides.py` (`apigw.solides.com.br/jobs/v3`).

## Einstein / Fleury / vagas.com.br (off-VPS)

O ASN Hetzner (`AS24940`) recebe Cloudflare **error 1005 / 403** em
`trabalheconosco.vagas.com.br`. Headers de browser **não** contornam.

- No cron VPS, `run.py --source all` **salta** `einstein` e `fleury`
  (`SKIP_SOURCES=einstein,fleury`) sem registar Erro (preserva a última OK
  off-VPS). Opcional: `REPORT_SKIPS=1` para status admin `skipped`.
- Para actualizar vagas: num host não bloqueado:

```bash
cd scrapers-br
export SCRAPER_API_TOKEN=…          # .env.production BR
export INGEST_BASE_URL=https://vagasaude.com.br
./run-vagas-com-off-vps.sh          # einstein + fleury
./run-vagas-com-off-vps.sh fleury   # só Fleury
# compat: ./run-einstein-off-vps.sh
```

Pedido explícito `--source einstein|fleury` **não** é saltado (caminho off-VPS).

## Uso

```bash
cd scrapers-br
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export INGEST_BASE_URL=http://127.0.0.1:3011
export SCRAPER_API_TOKEN=…   # do .env.production BR

python run.py --source moinhos --dry-run
python run.py --source haoc --dry-run
python run.py --source all
```

## Cron (servidor)

```bash
45 */6 * * * /var/www/vagasaudebr/scrapers/run-scrapers.sh >> /var/www/vagasaudebr/data/scrapers.log 2>&1
```

O wrapper define `SKIP_SOURCES=einstein,fleury` e corre os scrapers. Se
`RESEND_API_KEY` + `SCRAPER_API_TOKEN` existirem em
`/var/www/vagasaudebr/.env.production`, faz `POST http://127.0.0.1:3011/api/alerts/digest`
(espelho do digest PT — nunca aponta para :3010).

### Email (Resend)

Em `.env.production` BR (produção já configurada no VPS):

```bash
RESEND_API_KEY=re_…          # mesma conta PT ok; não commitar
EMAIL_FROM="VagaSaúde Brasil <alertas@vagasaude.com.br>"
```

Domínio `vagasaude.com.br` no Resend com DKIM (`resend._domainkey`). Sem DNS
verificado, envios de `alertas@vagasaude.com.br` falham. Admin `/admin/sistema`
mostra Resend **Configurado** quando a key está no env.

Ver também `docs/SCRAPERS-BR.md` e `deploy/configure-br-email.sh`.
