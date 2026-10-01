# Scrapers BR — avaliação de fontes (VagaSaúde Brasil)

Documento de pesquisa para `scrapers-br/` (espelho de `scrapers/` PT).  
**Não implementa scrapers** — prioriza fontes, ATS e risco legal/técnico.

- Site: https://vagasaude.com.br  
- App: `apps/web-br` · ingest: `POST /api/ingest` · `DATA_DIR=/var/www/vagasaudebr/data`  
- Referência PT: `scrapers/sources/`, `scrapers/README.md`, `docs/SCRAPING.md`  
- Pesquisa de URLs/volumes: Out 2026 (probes HTTP + páginas de carreira públicas)

---

## 1. Padrão PT → BR

| Categoria PT | Analogia BR |
|---|---|
| Público (BEP, DRE, ULS, IPO…) | Concursos / PSS (PCI, MS, AgSUS, HCs, OSS em contratos SUS) |
| Grupos privados (CUF, Luz, Trofa…) | Redes hospitalares (Rede D’Or, Hapvida, Einstein, Moinhos, BP…) |
| IPSS / misericórdias | Filantrópico / Santas Casas / institutos sociais |
| Agregadores (Net-Empregos, Sapo, IEFP) | Gupy job board (cuidado ToS), PCI Concursos, Catho/Vagas.com (evitar scrape genérico) |
| ATS partilhados (`cvwarehouse.py`) | **Gupy** (`*.gupy.io` + `__NEXT_DATA__`), **Vagas.com** employer portals |

Contrato de ingestão igual ao PT: `JobPayload` com `sector: publico | privado | ipss`.

### Sector Filantrópico ↔ `ipss`

Em `apps/web-br/src/lib/job-store.ts` o storage continua `publico|privado|ipss`, mas o label UI já mapeia:

```ts
ipss: "Filantrópico"
```

**Recomendação MVP:** scrapers de Santas Casas / filantropia enviam `sector: "ipss"` — **sem alteração de schema**.  
Opcional depois: renomear a chave para `filantropico` (migration + ingest) se quiserem alinhamento lexical total.

---

## 2. Achado técnico principal: Gupy

A maioria das redes BR de saúde usa **Gupy** (`https://{subdomain}.gupy.io/`).

- HTML SSR Next.js com `__NEXT_DATA__` → `pageProps.jobs[]` (id, title, department, workplace.address UF/cidade).
- `application_url` típica: `https://{subdomain}.gupy.io/jobs/{id}`.
- API employer (`api.gupy.io`) exige Bearer — **não** usar.
- Endpoints “portal” públicos antigos (`employability-portal…`) responderam 404 nesta pesquisa.
- `robots.txt` Gupy: `Allow: /` nas páginas de carreira; Disallow `/companies`, `/candidates`.
- Risco WAF: baixo–médio (CloudFront); rate-limit + UA identificável obrigatórios.

**Arquitectura sugerida (como `cvwarehouse.py` no PT):**  
`scrapers-br/sources/gupy.py` (cliente partilhado) + módulos finos por empregador.

Volumes observados (Oct 2026, títulos com keywords clínicas ≈ “health”):

| Portal | Subdomain | Total jobs | ≈ saúde (título) |
|---|---|---:|---:|
| Rede D’Or | `rededor` | 1908 | ~1513 |
| Hapvida NDI | `hapvidandi` | 592 | ~379 |
| Santa Casa BH | `santacasabh` | 256 | ~147 |
| Sabin | `gruposabin` | 206 | ~42 |
| IRSSL (Sírio social / OSS) | `irssl` | 183 | ~177 |
| Santa Casa BA | `santacasaba` | 66 | ~49 |
| Moinhos de Vento | `hospitalmoinhos` | 52 | ~31 |
| Santa Casa POA | `santacasa` | 50 | ~28 |
| BP SP | `vemserbp` | 37 | ~24 |
| Dasa Assistencial | `dasaassistencial` | 39 | (misto) |
| HAOC Assistencial | `vagasassistenciaishaoc` | 5 | 5 |
| São Camilo (Gupy sede) | `sbsc` | 6 | 4 |

---

## 3. Avaliação por fonte

Legenda volume saúde: **low** &lt; ~30 · **med** 30–200 · **high** &gt; 200 (abertas tipicamente).

### 3.1 Público / SUS / governo

| Fonte | URL | Sector | Feasibility | Vol. | Geo | Pri |
|---|---|---|---|---|---|---|
| **PCI Concursos** (filtro saúde) | https://www.pciconcursos.com.br/ | Público | HTML público; `robots.txt` Allow (bloqueia PDF directo) | high (editais, não CLT diário) | Nacional | **P0** |
| **AgSUS — Trabalhe conosco** | https://agenciasus.org.br/trabalheconosco/ | Público | HTML/WP + WP JSON; lista de editais PSS | med (em vagas) | Nacional | **P0** |
| **MS — Concursos e seleções** | https://www.gov.br/saude/pt-br/acesso-a-informacao/concursos-e-selecoes | Público | HTML Plone; **WAF/403** observado | low–med (event-driven) | Federal | **P1** |
| **IRSSL (Instituto Sírio — OSS/SUS)** | https://irssl.gupy.io/ | Público* / Filantrópico | Gupy `__NEXT_DATA__` | high | SP (hospitais públicos geridos) | **P0** |
| HCs / INCA / federais | sites próprios + editais | Público | HTML fragmentado por órgão | low contínuo | UF / RJ | **P2** |
| Emprega Brasil / SINE | https://servicos.mte.gov.br/ | — | **Login GOV.BR** — sem API pública de vagas | — | — | **Skip** |
| DOU bruto | inlabs / DOU | Público | Complexo; overlap PCI | — | Federal | **P2**/skip MVP |

\*IRSSL gere equipamentos SUS: preferir `publico` no ingest (ou `ipss` se se quiser agrupar “terceiro sector”); documentar a escolha no scraper.

### 3.2 Redes hospitalares privadas

| Fonte | URL | Sector | Feasibility | Vol. | Geo | Pri |
|---|---|---|---|---|---|---|
| **Rede D’Or** | https://rededor.gupy.io/ | Privado | Gupy JSON embutido | **high** | Nacional | **P0** |
| **Hapvida NotreDame** | https://hapvidandi.gupy.io/ | Privado | Gupy (portal antigo `sistemahapvida` descontinuado) | **high** | Nacional | **P0** |
| **Albert Einstein** | https://trabalheconosco.vagas.com.br/alberteinstein/oportunidades | Privado | Vagas.com employer HTML + JobPosting JSON-LD; **CF 1005 no VPS Hetzner** (correr fora do VPS / ingest remoto) | med (~18 listagem; ~11 saúde) | SP / GO | **P1** (activo `einstein.py`) |
| **Sírio-Libanês (hospital)** | https://vagas.hsl.org.br/ · https://hospitalsiriolibanes.org.br/trabalhe-conosco | Privado | **SAP SuccessFactors** (sessão/cookies) | med | SP / DF / etc. | **P2** (usar IRSSL primeiro) |
| **Moinhos de Vento** | https://hospitalmoinhos.gupy.io/ | Privado | Gupy | med | RS | **P1** |
| **BP — Beneficência Portuguesa SP** | https://vemserbp.gupy.io/ | Privado* | Gupy | med | SP | **P1** |
| HAOC (vários portais Gupy) | `vagasassistenciaishaoc`, `…administrativas…`, `ishaoc` | Privado / Filantrópico | Gupy multi-página | low–med | SP | **P2** |
| São Camilo | https://sbsc.gupy.io/ + Vagas.com | Filantrópico/Privado | Gupy + Vagas.com | low no Gupy sede | SP + rede | **P2** |

\*BP é associação beneficente histórica; UI pode mostrar Filantrópico (`ipss`) se alinharem branding — tecnicamente recrutamento CLT hospitalar privado.

### 3.3 Clínicas / labs / diagnósticos

| Fonte | URL | Sector | Feasibility | Vol. | Geo | Pri |
|---|---|---|---|---|---|---|
| **Grupo Fleury** | https://trabalheconosco.vagas.com.br/grupo-fleury/oportunidades · https://carreiras.grupofleury.com.br/ | Privado | Vagas.com (~227 abertas) | **high** | Nacional | **P0** |
| **Sabin** | https://gruposabin.gupy.io/ | Privado | Gupy | med | Nacional | **P1** |
| **Dasa** | https://dasaassistencial.gupy.io/ · https://dasaatendimento.gupy.io/ · https://dasa.com.br/carreira | Privado | Gupy multi-board | med | Nacional | **P1** |

### 3.4 Filantrópico / Santas Casas

| Fonte | URL | Sector | Feasibility | Vol. | Geo | Pri |
|---|---|---|---|---|---|---|
| **Santa Casa BH** | https://santacasabh.gupy.io/ | Filantrópico → `ipss` | Gupy | **high** | MG | **P0** |
| **Santa Casa Porto Alegre** | https://santacasa.gupy.io/ | Filantrópico → `ipss` | Gupy | med | RS | **P1** |
| **Santa Casa Bahia** | https://santacasaba.gupy.io/ | Filantrópico → `ipss` | Gupy | med | BA | **P1** |
| Santa Casa SP | https://santacasasp.org.br/trabalhe-conosco/ | Filantrópico | **Email + LinkedIn** — sem bolsa scrapeável | low | SP | **Skip** |

### 3.5 Agregadores

| Fonte | URL | Notas | Pri |
|---|---|---|---|
| Gupy portal genérico | portal.gupy.io | Sem API estável sem auth; overlap com portais employer | Skip MVP (preferir employers) |
| Catho | catho.com.br | Login/paywall parcial; ToS; overlap | **Skip** |
| Vagas.com (busca genérica) | vagas.com.br | Melhor usar **employer portals** (Einstein, Fleury) | Employer only |
| Indeed.br | br.indeed.com | `robots.txt` bloqueia `/empregos`; Cloudflare — igual PT | **Skip** |
| LinkedIn | linkedin.com/jobs | Login wall / ToS | **Skip** |

---

## 4. Top 8–12 para implementar primeiro (MVP)

Equilíbrio **público + privado + filantrópico**, maximizando volume e ATS reutilizável.

| # | Pri | Módulo sugerido | Fonte | Sector ingest | Porquê |
|---|---|---|---|---|---|
| 1 | P0 | `gupy.py` + `rededor.py` | Rede D’Or | `privado` | Maior volume clínico nacional |
| 2 | P0 | `hapvida.py` | Hapvida NDI | `privado` | 2ª maior rede; mesmo ATS |
| 3 | P0 | `irssl.py` | IRSSL (Sírio OSS) | `publico` | Saúde pública via Gupy; fácil vs SuccessFactors |
| 4 | P0 | `santa_casa_bh.py` | Santa Casa BH | `ipss` | Filantrópico high-volume |
| 5 | P0 | `pci_concursos.py` | PCI Concursos (saúde) | `publico` | Analogia Net-Empregos/BEP para concursos |
| 6 | P0 | `fleury.py` | Grupo Fleury | `privado` | Diagnósticos nacionais (Vagas.com) |
| 7 | P0 | `agsus.py` | AgSUS trabalhe conosco | `publico` | PSS/CLT saúde federal-adjacente |
| 8 | P1 | `einstein.py` | Albert Einstein | `privado` | Marca + Vagas.com (partilhar cliente c/ Fleury) |
| 9 | P1 | `moinhos.py` | Moinhos de Vento | `privado` | Sul; Gupy trivial |
| 10 | P1 | `beneficencia_portuguesa.py` | BP SP | `privado` ou `ipss` | SP; Gupy |
| 11 | P1 | `sabin.py` | Sabin | `privado` | Labs; Gupy |
| 12 | P1 | `santa_casa_poa.py` | Santa Casa POA | `ipss` | Filantrópico RS |

**Ordem de build sugerida:** (1) `gupy.py` partilhado → Rede D’Or + Hapvida + IRSSL + Santa Casa BH → (2) `vagas_com.py` partilhado → Fleury + Einstein → (3) `pci_concursos.py` + `agsus.py`.

---

## 5. O que saltar (MVP)

| Skip | Motivo |
|---|---|
| Indeed.br | robots/ToS + WAF (política igual PT) |
| LinkedIn | Login / ToS |
| Catho / busca genérica Vagas.com | Risco legal + overlap com employers |
| Emprega Brasil / SINE | Login GOV.BR; sem feed público |
| Sírio SuccessFactors (`vagas.hsl.org.br`) | Sessão/ATS pesado; IRSSL cobre parte pública |
| Santa Casa SP | Só email/LinkedIn |
| DOU full-text / dezenas de HCs isolados | Baixo ROI até PCI + AgSUS + MS estáveis |
| Portais HAOC/São Camilo fragmentados | Volume baixo até haver capacidade |

---

## 6. Nomes de módulos (`scrapers-br/sources/`)

Estilo PT (`cuf.py`, `net_empregos.py`, `scm_faro.py`):

```
scrapers-br/sources/
  __init__.py
  gupy.py                      # cliente partilhado (parse __NEXT_DATA__) + employers Gupy
  einstein.py                  # Vagas.com employer
  hcor.py                      # Pandapé / InfoJobs
  mater_dei.py                 # JobConvo
  hsl_sirio.py                 # SuccessFactors (hospital privado)
  # employers Gupy registados em gupy.py:
  #   rededor, hapvida, irssl, santa_casa_bh, redeamericas, moinhos, bp, haoc
```

Registar slugs em `apps/web-br/src/lib/sources.ts` com `sector: "Público" | "Privado" | "Filantrópico"`.

---

## 7. Notas de produto / legal

1. Respeitar `robots.txt` e rate limits; UA `VagaSaudeBot/… (+https://vagasaude.com.br/bot)`.
2. Sempre `application_url` para a fonte original (não hospedar candidatura).
3. Filtrar títulos/departamentos clínicos (enfermagem, médico, TASY, farmácia, etc.) — Gupy mistura hotelaria/admin.
4. Geografia BR: mapear `workplace.address.stateShortName` → UF em `location_district` (já há taxonomia UF em `web-br`).
5. Concursos (PCI/AgSUS/MS) são **editais**, não vagas CLT contínuas — UX pode distinguir `contract_type` / badge “Concurso/PSS”.
6. Contactar Gupy/empregadores para feed oficial quando o volume justificar (paridade com nota Indeed no README PT).

---

## 8. Próximo passo (fora deste doc)

1. Copiar `scrapers/run.py` + `common/` → `scrapers-br/`.
2. Implementar `gupy.py` + 2–3 employers P0.
3. Seeds reais via ingest no `DATA_DIR` BR.
4. Preencher `JOB_SOURCES` em `apps/web-br/src/lib/sources.ts`.

---

## 9. Hospitais premium investigados

Probe HTTP + páginas de carreira públicas (Out 2026). Objetivo: decidir **módulo próprio** vs **cobertos por agregador de rede** (Rede D’Or / Rede Américas).

### Clarificações de rede (crítico)

| Marca | Rede real | Portal de vagas | Nota |
|---|---|---|---|
| **Vila Nova Star / Copa Star** (+ DF Star, Maternidade Star) | **Rede D’Or** | `rededor.gupy.io` | ~133 títulos com “Star”; **não** criar módulo Star separado |
| **Samaritano Higienópolis / Paulista / Botafogo / Barra** | **Rede Américas** (Amil+Dasa / ex-UHG Americas) | `redeamericas.gupy.io` | **Não** é Rede D’Or |
| **Hospital Nove de Julho** | **Rede Américas** (via Rede Ímpar / Dasa) | `redeamericas.gupy.io` | **Não** está na lista de unidades Rede D’Or; ouvidoria `americasmed.com.br` |
| **Samaritano Goiânia** (`hospsamaritano.com.br`) | Independente (GO) | formulário HTML | Homónimo — **não** confundir com Samaritano SP/RJ |
| **Samaritano Campinas / Americana** | Samaritano Saúde (interior SP) | e-mail RH | Homónimo — skip MVP |

### Tabela — 10 hospitais

| Hospital | Careers URL | ATS | Roles~ | Saúde? | Feasibility | WAF / login | Sector | Geo | Pri |
|---|---|---|---:|---|---|---|---|---|---|
| **1. Albert Einstein** | https://trabalheconosco.vagas.com.br/alberteinstein/oportunidades · hub https://www.einstein.br/n/o-einstein/carreiras | **Vagas.com** employer | **~18** (~11 saúde após filtro) | Sim | Boa (HTML + JSON-LD JobPosting; `einstein.py` activo) | **CF 1005 no VPS Hetzner** (ASN bloqueado; scrape off-VPS + ingest BR) | Privado* (Sociedade Beneficente) | SP + GO | **P1** |
| **2. Sírio-Libanês (hospital)** | https://vagas.hsl.org.br/ · https://hospitalsiriolibanes.org.br/trabalhe-conosco | **SAP SuccessFactors** | Lista pública vazia/JS+cookie wall; volume real opaco | Sim (quando abertas) | Má — sessão/cookies/JS | Cookie “clique para continuar”; sem JSON estável | Filantrópico / Privado | SP / DF | **P2** (hospital) |
| **2b. IRSSL (Sírio OSS/SUS)** | https://irssl.gupy.io/ | **Gupy** | **183** (~122 saúde) | Sim | Excelente (`__NEXT_DATA__`) | Baixo–médio (CloudFront) | Público* / Filantrópico | SP (equip. públicos) | **P0** (já no MVP) |
| **3. Moinhos de Vento** | https://hospitalmoinhos.gupy.io/ | **Gupy** | **52** (~25 saúde) | Sim | Excelente | Baixo–médio | Privado / Associação | RS (POA) | **P1** |
| **4. Alemão Oswaldo Cruz (HAOC)** | Hub https://www.hospitaloswaldocruz.org.br/trabalhe-conosco/ → multi-Gupy | **Gupy** (4 boards + ISHAOC) | Assist **5** + Admin **11** + Ops **2** + Lead **0**; ISHAOC **14** | Sim (assistencial) | Boa mas **fragmentada** (múltiplos subdomains) | Baixo–médio | Privado; ISHAOC = OSS/público | SP (+ Mogi/Santos no ISHAOC) | **P2** (privado) / **P1** ISHAOC se quiserem OSS |
| **5. HCor** | https://hcoracao.pandape.infojobs.com.br/ · hub https://www.hcor.com.br/sobre-o-hcor/trabalhe-conosco/ | **Pandapé / InfoJobs** | **~20** (várias enfermagem/farmácia) | Sim | Média (HTML Pandapé; ATS novo vs Gupy/Vagas.com) | Baixo | Filantrópico (Assoc. Beneficente Síria) → `ipss` | SP | **P2** |
| **6. Vila Nova Star / Copa Star** | https://rededor.gupy.io/ (títulos com unidade) | **Gupy** = Rede D’Or | Star no board: **~133** (~102 saúde); VNS **~50**, Copa **~18** | Sim | N/A — **coberto por `rededor.py`** | = Rede D’Or | Privado | SP / RJ (+ DF Star) | **Skip módulo** (usar agregador D’Or) |
| **7. Samaritano (SP/RJ Américas)** | https://redeamericas.gupy.io/ · site https://www.hospitalsamaritano.com.br/ | **Gupy** = Rede Américas | Board Américas **236** (~82 saúde); Samaritano nomeado esparso | Sim | N/A — **coberto por agregador Américas** | = Gupy | Privado | SP + RJ | **Skip módulo** (usar `redeamericas.py`) |
| **8. Mater Dei** | https://app.jobconvo.com/pt-br/careers/hospital-mater-dei/6fcf22e3-009f-40e9-94ea-25e36ed95d22/ (link no site materdei.com.br) | **JobConvo** (custom) | **0–~25** (volátil; SSR por vezes “Nenhuma vaga”) | Sim quando listadas | Média — HTML/JobConvo sem API pública estável | Baixo | Privado (capital aberto) | MG + BA (+ rede 4 UF) | **P1**/P2 |
| **9. Nove de Julho** | https://redeamericas.gupy.io/ (Rede Américas / Ímpar) | **Gupy** = Rede Américas | Sem título “Nove de Julho” no snapshot; cai no board de **236** | Sim (via rede) | N/A — **não** é Rede D’Or | = Gupy | Privado | SP | **Skip módulo** (usar `redeamericas.py`) |
| **10. BP — Beneficência Portuguesa SP** | https://vemserbp.gupy.io/ · https://www.bp.org.br/institucional/trabalhe-conosco | **Gupy** | **37** (~17 saúde) | Sim | Excelente | Baixo–médio | Privado* / Filantrópico histórico → `privado` ou `ipss` | SP | **P1** |

\*Einstein/BP: marca filantrópica histórica; recrutamento CLT hospitalar — ingest `privado` no MVP (ou `ipss` se branding Filantrópico).

### Recomendação: módulos próprios vs agregadores

**Cobertos por agregador — não criar scraper por hospital**

1. **Rede D’Or** (`rededor.py` / `rededor.gupy.io`) — inclui **Vila Nova Star, Copa Star, DF Star, Maternidade Star** e restante da rede. Filtrar `title` por unidade se quiserem landing “Star”.
2. **Rede Américas** (`redeamericas.py` **novo P0/P1**) — inclui **Samaritano Higienópolis/Botafogo/etc.** e **Nove de Julho** (Ímpar). **Não** misturar com Rede D’Or.

**Módulos próprios (prioridade)**

| Pri | Módulo | Motivo |
|---|---|---|
| P0 | `irssl.py` | Já no MVP — braço público do ecossistema Sírio |
| P1 | `einstein.py` | Marca premium; Vagas.com partilhável |
| P1 | `moinhos.py` | Gupy trivial; Sul |
| P1 | `beneficencia_portuguesa.py` | Gupy trivial; SP |
| P1 | `redeamericas.py` | 236 jobs; cobre Samaritano + Nove de Julho + Leforte/Ímpar |
| P1–P2 | `mater_dei.py` | JobConvo; volume médio/volátil; MG/BA |
| P2 | `haoc.py` | Multi-board Gupy; ROI baixo até consolidar boards |
| P2 | `hcor.py` | Pandapé (cliente novo); ~20 roles |
| P2 | `hsl_sirio.py` | SuccessFactors — só se IRSSL não bastar para marca Sírio privada |
| Skip | Star / Samaritano Américas / Nove de Julho standalone | Redundante com agregadores |
| Skip | Samaritano Goiânia / Campinas e-mail | Form/e-mail; baixo ROI |

### Estado de implementação (Out 2026)

| Hospital (lista user) | Fonte / URL | Scraper | Status | ≈ jobs (probe) |
|---|---|---|---|---:|
| 1. Albert Einstein | https://trabalheconosco.vagas.com.br/alberteinstein/oportunidades | `einstein` | OK (paginação p1–p2; CF 1005 no VPS) | ~18 listagem |
| 2. Sírio-Libanês (hospital) | https://vagas.hsl.org.br/ | `hsl_sirio` | OK (SF; board público frequentemente vazio) | 0–baixo |
| 2b. Sírio OSS / IRSSL | https://irssl.gupy.io/ | `irssl` | OK | ~180 |
| 3. Moinhos de Vento | https://hospitalmoinhos.gupy.io/ | `moinhos` | OK (filtro hospitalar alargado) | ~40+ |
| 4. Alemão Oswaldo Cruz | multi-Gupy + ISHAOC | `haoc` | OK (5 boards) | ~30 |
| 5. HCor | https://hcoracao.pandape.infojobs.com.br/ | `hcor` | OK (Pandapé) | ~15–20 |
| 6. Vila Nova Star / Copa Star | https://rededor.gupy.io/ | `rededor` | Coberto (agregador) | Star ~133 no board |
| 7. Samaritano (SP/RJ) | https://redeamericas.gupy.io/ | `redeamericas` | Coberto (agregador) | board ~236 |
| 8. Mater Dei | JobConvo careers | `mater_dei` | OK (board por vezes 0) | 0–~25 |
| 9. Nove de Julho | https://redeamericas.gupy.io/ | `redeamericas` | Coberto (agregador) | via rede |
| 10. BP SP | https://vemserbp.gupy.io/ | `bp` | OK (filtro hospitalar alargado) | ~25+ |

**O que faltava antes:** scrapers dedicados HAOC / HCor / Mater Dei / Sírio-SF; filtro clínico demasiado apertado em Moinhos/BP (descartava recepção, agendamento, nutrição hospitalar); Einstein já existia mas o filtro clínico também podia cortar volume.

## 7. Alertas por email (Resend) — BR

Isolado do PT (`:3010` / `vagasaude.pt`). App BR em `:3011`.

| Var | Valor típico |
|---|---|
| `RESEND_API_KEY` | Mesma conta Resend do PT (não commitar) |
| `EMAIL_FROM` | `"VagaSaúde Brasil <alertas@vagasaude.com.br>"` (com aspas) |
| `NEXT_PUBLIC_SITE_URL` | `https://vagasaude.com.br` |

**Obrigatório no Resend:** Domains → adicionar `vagasaude.com.br` → publicar SPF + DKIM.  
Sem verificação DNS, envios de `alertas@vagasaude.com.br` são rejeitados.

Digest: `scrapers-br/run-scrapers.sh` faz `POST /api/alerts/digest` em `:3011` após o scrape (espelho de `deploy/run-scrapers.sh` PT).
