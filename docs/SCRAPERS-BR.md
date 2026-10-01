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
| **Albert Einstein** | https://trabalheconosco.vagas.com.br/alberteinstein/oportunidades | Privado | Vagas.com employer HTML (Cloudflare) | med (~18+ na listagem) | SP / GO | **P1** |
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
  gupy.py                      # cliente partilhado (parse __NEXT_DATA__)
  vagas_com.py                 # cliente employer Vagas.com
  rededor.py
  hapvida.py
  irssl.py
  santa_casa_bh.py
  santa_casa_poa.py
  santa_casa_ba.py             # P1/P2
  moinhos.py
  beneficencia_portuguesa.py
  einstein.py
  fleury.py
  sabin.py
  dasa.py                      # agrega subdomains assistencial+atendimento
  pci_concursos.py
  agsus.py
  ms_concursos.py              # P1
  hsl_sirio.py                 # P2 SuccessFactors
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
