# Alavancas de volume para offertesanita.it

Data: 2026-11-13. Só investigação (congelamento de código de 2 semanas): nada foi construído nem publicado. Pedidos de sonda com UA `OfferteSanitaBot/1.0 (+https://offertesanita.it/bot)`, cerca de 1 s ou mais entre pedidos ao mesmo anfitrião, sem proxies, sem contornar WAF/login/CAPTCHA, sem agregadores. Códigos VPS medidos com `curl` só de estado a partir de 91.99.167.243.

Complementa `fonti-lavoro-sanita-it.md` e `fonti-private-it.md` (não repete o que lá está). Base atual: ~835 vagas (427 públicas: inPA 246, GU 179, Veneto 5; ~400 privadas).

Legenda de verificação: **V** = contado/verificado nesta sessão; **E** = estimativa (método indicado).

## 1. Conclusões principais

1. **inPA e GU estão saturadas; o problema é o que elas não têm.** O sitemap do inPA tem 1919 URLs (todos com `lastmod` de out/nov-2026, sem sitemap paginado nem filtro de expirados escondido); a cache local do leitor tem 268 "keep" (saúde), 1606 "não saúde" e 47 "não abertos". A listagem do inPA é carregada por POST de JavaScript (wp-json, proibido pelo robots); `admin-ajax.php` é permitido mas a lista não o usa. Não há outra listagem permitida. O leitor da GU já lê 8 números (janela de 30 dias).
2. **A cobertura do inPA é muito desigual por região** (das 268 vagas guardadas): Lombardia 91, Veneto 48, Sicília 23, Trentino 17, Ligúria 13, Sardenha 11, Emilia-Romagna 9, Toscana 8, Úmbria 7, Calábria 6, FVG 6, Piemonte 5, Puglia 5, Abruzzo 5, Basilicata 5, Campânia 3, Marche 3, **Lazio 0**. Só há 112 entes distintos. O SSN tem cerca de 290 entes (ASL/ASST/AO/AOU/IRCCS/ARNAS), logo faltam sobretudo Lazio, Campânia, Puglia, Piemonte, Emilia-Romagna e Toscana. Estimativa: o inPA cobre menos de metade dos entes do SSN e quase só os que publicam concursos (não os avisos a termo, mobilidade e incarichi, que são a maior parte da contratação de enfermeiros e OSS).
3. **Correção ao levantamento anterior:** o portal Veneto `concorsieavvisi.it` só tem os concursos centralizados da Azienda Zero (~5 abertos, como o próprio leitor documenta), não as ~100-150 vagas estimadas. As vagas das ULSS estão no CMS regional de cada ULSS (`aulssN.veneto.it/bandi-di-concorso`, "Totale ~1400-1570 elementos" incluindo histórico), e a maioria dá 403 ao VPS.
4. **"Um leitor por plataforma" funciona, mas dá pouco volume por plataforma.** A fragmentação é real: dos ~55 sites de entes do SSN sondados, só encontrei uma plataforma com **API JSON pública, permitida e com muitos entes de saúde** (Plone 6 / io-Sanità na Emilia-Romagna). As restantes plataformas partilhadas têm 2 a 5 entes de saúde cada, ou estão bloqueadas.
5. **O maior volume imediato e legítimo são as agências com sitemap + JSON-LD** (Randstad, Synergie, Gi Group, Umana): ~450-550 vagas clínicas brutas, texto integral, 200 no VPS. Têm risco de duplicação e conteúdo genérico, por isso devem ir marcadas "agenzia".
6. **O grande bloco privado/RSA/cooperativas está atrás do Intervieweb (inRecruiting)**, que o robots proíbe (`/*LAC*`): GVM (`jobgvm.intervieweb.it`), Gemelli, Synlab, Cadiai, Elleuno, Coopselios, Campus Bio-Medico, Sacra Famiglia. Só se desbloqueia com permissão/feed do empregador.
7. **A procura sistemática de ATS** (SmartRecruiters, Recruitee, Teamtailor, Personio, Greenhouse, Lever; ~75 nomes) **não trouxe nenhum empregador italiano de saúde novo**. Vivisol Personio é DE (1 vaga), IVC Evidensia só BE/SE, Sanitas Teamtailor é Espanha. O ATS dominante da saúde privada italiana é Intervieweb/Zucchetti, SuccessFactors, Allibo e sites próprios.

## 2. Leitores já existentes (não refazer)

`inpa`, `gu_s4`, `veneto_concorsi`, `humanitas`, `clariane`, `anicura`, `cerba`, `fresenius`, `affidea`, `auxologico`, `maugeri`, `fatebenefratelli` (Allibo), `bianalisi` (Allibo, 0 vagas), `habilita`, `ieo`, mais `_allibo.py`, `_it_priv.py`, `_it_pub.py`, `_template.py`. **Não existem** (e estavam documentados como viáveis): KOS Group, ESTAR Toscana, leitores Lombardia/Plone, Santagostino, Don Gnocchi.

## 3. Alavancas, medidas (V) e estimadas (E)

### 3.1 Setor público

| # | Alavanca | Entes cobertos | Abertas hoje (saúde/avisos) | Texto integral | robots | VPS | Esforço | Risco |
|---|---|---|---|---|---|---|---|---|
| P1 | **Plone 6 / io-Sanità, API REST** `/++api++/@search?portal_type=Bando` (ER) | AUSL Ferrara, AOU Ferrara, AUSL Romagna, AUSL Modena, AUSL Piacenza (+ outros tenants Plone/io-Sanità a descobrir) | V: bandos com `scadenza_bando` >= hoje: Ferrara 23, Osp. Ferrara 36, Romagna 21, Modena 22, Piacenza 7 = **109** (histórico: 743/563/1246/652/166). Em Ferrara metade são concurso/avviso/libero-prof/mobilidade; E: **~60-70 vagas líquidas** (descontando gare, borse, UOC já em GU) | Parcial (campos + descrição + PDF) | Ferrara `Disallow:` vazio; API permitida | **200** (Ferrara, Romagna) | Baixo-médio (1-2 dias; 1 leitor, N domínios) | Mistura "incarichi libero professionali" (rotular), PDFs |
| P2 | **ULSS do Veneto** (CMS regional `aulssN.veneto.it/bandi-di-concorso?stato=1`) | 9 ULSS + AOUI Verona + AO Padova + IOV | E: 15-30 abertas por ULSS = **120-250** (o inPA já tem 48 do Veneto: líquido +80-150) | Parcial | `Allow: /` | **aulss3 200; aulss2/5/8/9, AOVR, AOPD 403; aulss6 sem resposta** | Médio | Só 1-2 ULSS acessíveis do VPS; o resto exige decisão do dono (não contornar) |
| P3 | **Leitores a medida para grandes ASL/AO de regiões descobertas** (Lazio, Campânia, Piemonte, Puglia, Toscana, Sicília) | Prioridade: ASL Roma 1/3/5, Viterbo, S. Camillo (Liferay), Napoli 3 Sud, Cardarelli, Salerno (403), ASL TO4/TO5/Novara (Drupal `concorsi.asl.novara.it`, 50 KB HTML, paginado), Vercelli, Cuneo 1/2, Mauriziano, Città di Torino | V (indicativo): Napoli 3 Sud ~16 datas futuras na página, Novara ~1 nos primeiros itens; E: 5-15 abertas por ente => **~150-300 com ~20 leitores** | Parcial/PDF | maioria sem restrições | **200** em quase todos (Roma 1/3/5, Viterbo, S. Camillo, Napoli 3, Cardarelli, TO4, Vercelli, Novara, Cuneo 1/2, Mauriziano, Bologna, Modena, Parma, Rizzoli, Liguria 1-5, San Martino, ASP Palermo); 403 Salerno; 000 aslto5 | Alto (0,5-1 dia por ente; 1 CMS por leitor reduz) | Manutenção de 20 leitores frágeis; PDF-only |
| P4 | **Robyone** (`*.robyone.net`, Amministrazione Trasparente multi-tenant) | IPAB, ASP, RSA, Casa di riposo, mas também escolas/comuni; IDs 1-~400 em `one33`, também `one69` | V: amostra de 22 IDs, 12 vivos, ~8 RSA/ASP; ex.: ASP Ferrara 3 em 2026; E: **+30-80** (OSS/infermieri de RSA públicas, Veneto/Emilia/Lombardia) | Parcial: CSV open data `listopendata/competition-notices?year=2026` (título, datas, n.º de contratações, link) | só `/ScriptResource.axd`, `/WebResource.axd` | **200** | Médio (tenant discovery + CSV) | Muitos tenants não saúde; poucos postos por tenant |
| P5 | Portal de transparência `*.portaletrasparenza.net` (IFO Lazio, ASST Pavia) | confirmados 2; marca Regione Lazio e Lombardia | ASST Pavia já está no inPA (16); líquido E +20-40 | PDF | `Crawl-delay: 5`, `Disallow: /registrazione`, `/exportPubOpenData*` | 200 | Alto (HTML de 600 KB, 5 s por pedido) | Lento; pouco líquido |
| P6 | Outras famílias: Liferay jcitygov (`trasparenza-valutazione-merito.it`: ASST Valtellina, ATS Montagna), ISWEB (`etrasparenza.it`: Salerno 403 ao VPS), `portaleamministrazionetrasparente.it` (Cardarelli), `amministrazionetrasparente.<ente>.it` (Napoli 3 Sud), Joomla Liguria (ASL1-3, San Martino), FlexCMP (Mauriziano, AOU Modena) | 2-5 entes por família | já parcialmente no inPA | HTML/PDF | variados | 200 (exceto ISWEB 403) | Médio cada | Baixo retorno líquido por leitor |
| P7 | ESTAR Toscana (já documentado) | USL Toscana, AOU | E 10-30 | Parcial | permissivo | 200 | Baixo | Pouco volume |
| P8 | **Relaxar o filtro de ente do inPA** (IPAB, ASP, comuni com OSS/educatore/infermiere/assistente sociale) | n/d | 1606 itens "não saúde" na cache; a cache só guarda o veredicto; E: **+20-50** (2-3 %) | Parcial | OK | 200 | Muito baixo (ajuste de regex e um novo run) | Falsos positivos: manter perfil sanitário obrigatório |
| P9 | BUR regionais (Piemonte HTML+PDF, Lazio PDF, ER Plone PDF) | por região | duplica GU/inPA | PDF | permitido | 200 | Alto | PDF-only, pouco líquido |
| P10 | Azienda Zero Piemonte, ARCS FVG, A.Li.Sa, ARES Sardegna, SoReSa, Puglia (portal único inexistente), Sicília | n/a | candidatura por ISON/SPID (login), sites sem resposta ou 000 | n/a | n/a | ARES/ASP várias 000 | n/a | Não leitura viável; cobrir via GU/inPA |

Notas: Puglia não tem portal regional único (pesquisa web confirmou: só sites das ASL e concurso unico regional de infermieri/OSS bloqueado/adiado); Emilia-Romagna também não tem portal único (BUR + sites das aziende; Plone). O ISON (`iscrizioneconcorsi.it`) e o Intervieweb continuam a ser plataformas de candidatura inadequadas.

### 3.2 Agências de recrutamento (categoria `agency`)

Contagens por sitemap, título/slug com perfil sanitário estrito (infermiere, OSS, ASA, fisioterapista, TSRM, medico, educatore, psicologo, logopedista, farmacista, etc.). A contagem bruta tem ruído (ex.: "tecnico di laboratorio e taratura", "produzione farmacêutica"); apliquei redução de ~25 % para o valor líquido (E).

| Agência | Sitemap / formato | Vagas totais | Saúde (V, bruto por slug) | Saúde líquida (E) | Texto integral | robots | VPS | Risco |
|---|---|---|---|---|---|---|---|---|
| **Randstad** | `sitemaps/jobs/it/sitemap-jobdetails.xml` e `-2.xml` (2 x 5000 URLs; possivelmente truncado) | 10 000 | **412** (234 + 178) | **~300** | **Sim, JSON-LD JobPosting** (título, descrição HTML, `validThrough`, `industry: Sanità`, local, salário) | Só Disallow em filtros km/postcode | **200** | Cliente final anónimo; duplica empregadores diretos |
| **Synergie** ("Synergie Care") | `sitemap-jobs.xml` (4727) | 4727 | **134** | **~100** | Sim, JSON-LD | sem restrições | **200** | Idem; muitas "OSS per RSA con alloggio" |
| **Gi Group** | `offerte-sitemap.xml` (4345) | 4345 | **84** | **~70** | HTML/sem JobPosting detetado no levantamento anterior | Disallow `*offerta=*`, mapas, scripts antigos | **200** | Idem |
| **Umana** | `jobs-sitemap.xml` (1308) | 1308 | **49** | **~40** | Sim, JSON-LD | sem restrições | **200** | Badante/assistente familiar misturado com OSS/infermieri |
| Manpower | `sitemap_job-offer.xml` vazio | 0 | 0 | 0 | n/a | n/a | 200 | Sem dados públicos |
| Adecco | sem sitemap público (apenas SPA) | n/d | n/d | n/d | n/d | n/d | 200 | Sem fonte estruturada |
| Openjobmetis | Incapsula WAF ("noindex", `_Incapsula_Resource`) | n/d | n/d | 0 | n/d | n/d | WAF | **Bloqueada, não tentar** |
| Etjca, Lavoropiù, Humangest | sitemaps WordPress só de páginas/filiais, sem vagas | 0 | 0 | 0 | n/a | n/a | 200 | Sem vagas listadas |
| Orienta, Temporary, Tempor | 503 / sem resposta | n/d | n/d | 0 | n/d | n/d | n/d | n/d |

Total agências: **~510 vagas líquidas (E), ~680 brutas**. Dedupe por (empregador final se visível, local, título) e rótulo `agency`. Recomendo limitar a páginas com perfil sanitário forte e excluir "badante/assistente familiare" até haver política.

### 3.3 RSA, cooperativas, home care, grupos privados

| Entidade | Resultado | Viabilidade |
|---|---|---|
| KOS Group / Anni Azzurri | 79 cartões HTML, ~72 clínicos (já medido no levantamento privado); `lavoraconnoi.kosgroup.com` JS-stub | Média; leitor ainda não existe; +70, sem descrição |
| Cadiai, Elleuno, Coopselios, Codess | Intervieweb (`inrecruiting`/`intervieweb` na página) | **Bloqueada** pelo robots |
| GVM (`gvmspa.it/it-IT/lavora-con-noi`) | Intervieweb (`jobgvm.intervieweb.it`) + `selectio`; página 200 | **Bloqueada** pelo robots |
| Hesperia / GHC | `selectio` | Não verificado |
| Serenì Orizzonti | `sereniorizzonti.it/it/posizioni-aperte/` WordPress 200, 390 KB, sem JobPosting; lista não verificada | A verificar (potencial RSA/OSS) |
| Don Gnocchi | widget Steps Connect (JS) | Média-baixa |
| Santagostino | Teamtailor widget sem slug | Média-baixa |
| Sacro Cuore (Negrar), Israelitico, Gaslini, Villa Maria, CDI | Páginas HTML sem lista estruturada / JS | Baixa |
| Gheron, Over, Segesta, CGM, Kineos, Sol.Co, Proges, Medicair, Sanitaservice | Sem resposta de rede ou 404 a partir do portátil (rede instável); não confirmados | Não verificada |
| Home care (Vivisol, Medicair) | Vivisol Personio só DE (1); Medicair sem resposta | Sem fonte |
| Farmácias/dentárias (Hippocrates, Dr. Max, Benu, Apoteca, DentalPro, Vitaldent, Caring, Farmacie Comunali) | Sem ATS público: SPA vazia, 403, DNS ou sem página de carreiras | Sem fonte |

### 3.4 Grupos privados atrás de WAF (VPS 403)

HSR (311 bruto, ~125 clínicas), GSD (79, ~48), Niguarda (13 no inPA), aulssN. Do levantamento anterior; **não contornar**. Três caminhos legítimos: (a) pedir ao empregador/ente a inclusão do UA/IP na lista de permissões (ou um feed XML); (b) oferta de publicação direta (formulário/feed de empregador); (c) aceitar a cobertura parcial via inPA/GU. Um IP italiano/residencial seria um contorno de bloqueio de datacenter e fica fora das regras desta sessão sem autorização expressa do dono.

### 3.5 Ordens profissionais

| Ordem | Fonte | Estado |
|---|---|---|
| OPI Bergamo | `opibg.it/offerte-lavoro.php` | HTML pequeno, página 200; poucas vagas (não contadas) |
| OPI Firenze-Pistoia | `opifipt.com/category/bacheca/` | blog/bacheca WordPress, volume baixo |
| Ordine Farmacisti Roma / Milano | `/offro-lavoro`, `/farmacista/cerco_offro_lavoro.html` | anúncios de farmácias, poucos e não estruturados |
| OMCeO Milano | bacheca em área reservada (`omceo.latraccia.it`) | login |
| TSRM-PSTRP | Rubrica concorsi (já documentada) | boa para validação, dezenas |
| FNOPI, FNOMCeO, FOFI, CNOP, CNOAS | editorial/sem bacheca | n/a |

Valor: **<30 vagas somadas**, manuais, com pouco SEO. Não prioritário.

## 4. Ranking das alavancas: vagas adicionais x viabilidade

Viabilidade: alta 1,0; média-alta 0,8; média 0,6; baixa 0,3. Vagas = líquidas e deduplicadas (E, salvo indicação).

| Rank | Alavanca | Vagas adicionais (líquidas) | Viabilidade | Pontuação | Fase | Principal risco |
|---|---|---|---|---|---|---|
| 1 | Agências (Randstad ~300, Synergie ~100, Gi Group ~70, Umana ~40) | +450-520 | Alta (V: JSON-LD, sitemap, 200) | ~480 | 1 | Duplicados, cliente anónimo, SEO fino, ToS: marcar `agency` |
| 2 | Leitores a medida de ~20 grandes ASL/AO de Lazio, Campânia, Piemonte, Puglia, Toscana | +150-300 | Média (200 quase todos) | ~135 | 1-2 | 20 leitores frágeis, PDF-only, sobreposição com GU |
| 3 | Plone/io-Sanità API (ER) | +60-80 (109 abertas V) | Alta | ~70 | 1 | Incarichi libero-prof a rotular; algumas já em GU |
| 4 | KOS Group (+ Anni Azzurri) | +70 | Média (sem descrição) | ~42 | 1 | Sem texto integral |
| 5 | ULSS do Veneto (CMS regional) | +80-150 líquido (mas 403 no VPS na maioria) | Baixa-média no VPS | ~40 | 2 | 403; só aulss3 acessível; decisão do dono |
| 6 | Robyone (RSA/IPAB/ASP, CSV) | +30-80 | Média-alta | ~45 | 1-2 | Muitos tenants não saúde |
| 7 | Desbloqueio por permissão/feed: HSR, GSD, Niguarda, Intervieweb (GVM, Gemelli, Cadiai, Elleuno...) | +300-450 (WAF) e +400-800 (Intervieweb), E | Baixa (depende de terceiros) | ~110 | 2-3 | Prazos comerciais; sem garantia |
| 8 | Relaxar filtro de ente do inPA (IPAB/ASP/comuni com perfil sanitário) | +20-50 | Alta | ~35 | 1 | Falsos positivos |
| 9 | Don Gnocchi, Santagostino, Serenì Orizzonti (a verificar) | +40-100 | Baixa-média | ~25 | 2 | JS/slug desconhecido |
| 10 | `portaletrasparenza.net`, Liferay/ISWEB/Joomla (P5/P6) | +30-60 | Média-baixa | ~15 | 3 | Crawl-delay 5 s; ISWEB 403 |

Excluídos por baixo valor ou sem fonte: BUR regionais (duplicam GU/inPA), ordens profissionais (<30), farmácias/dentárias (sem ATS), ATS descobertos por slug (0 novos empregadores italianos), plataformas ISON/Intervieweb por scraping (proibido/robots).

## 5. Projeção realista

| Cenário | Vagas totais | Composição |
|---|---|---|
| Hoje | ~835 | 427 públicas + ~400 privadas |
| **Fase 1** (alta feasibilidade, sem permissões): agências, Plone ER, KOS, filtro inPA, Robyone parcial, ~8-10 leitores ASL | **~1 500-1 700** | +~480 agências, +~70 Plone, +~70 KOS, +~35 inPA, +~40 Robyone, +~100 ASL; ~2/3 de aumento, dos quais ~480 são `agency` (sem agências: ~1 050-1 200 diretas) |
| **Fase 2** (esforço médio, parte depende de terceiros): +~10-15 leitores ASL, Veneto ULSS acessíveis, Robyone completo, Serenì/Santagostino/Don Gnocchi, desbloqueios negociados parciais | **~2 300-3 200** | +150-300 ASL, +80-150 Veneto, +40-100 privados, +300-800 se houver acordos com grupos WAF/Intervieweb |

Teto realista no horizonte de 6 meses sem acordos: ~2 500. Os ~9 400 do Brasil não são atingíveis só por scraping, porque o mercado italiano está fragmentado em sites bespoke e plataformas de candidatura (ISON, Intervieweb) que não se podem ler.

**Alavanca mais importante:**
- Por volume imediato: **agências** (Randstad sozinha ~300), com a ressalva da qualidade (duplicados e anúncios genéricos).
- Por valor estrutural e qualidade: **cobertura por ente das ASL/AO das regiões que o inPA quase não cobre** (Lazio 0 vagas, Campânia 3, Puglia 5, Piemonte 5), iniciando pelo Plone ER (um leitor, API oficial) e depois leitores a medida. Se tivesse de escolher uma única, para crescimento sustentável de vagas diretas, é esta; para dobrar o número de vagas em duas semanas, são as agências.

## 6. Riscos transversais

| Risco | Detalhe | Mitigação |
|---|---|---|
| Duplicação | Agências vs empregador; inPA/GU vs site do ente; Plone vs GU | Chave (ente final, perfil, local, prazo); prioridade empregador direto > agência |
| Conteúdo fino | Agências e KOS sem texto integral; PDFs | Rótulo `agency`, `noindex` opcional para fichas finas, link para a fonte |
| WAF/robots | 403 VPS (Veneto, HSR, GSD, Niguarda, ISWEB, Dr. Max); Openjobmetis Incapsula; Intervieweb `/*LAC*`; Crawl-delay 5 s (portaletrasparenza) | Não contornar; pedir allowlist/feed; respeitar delays |
| Informação instável | Datas e vagas expiradas; sitemaps de agências com URLs antigas | `validThrough`/`scadenza_bando`; remoção após prazo |
| Manutenção | 20 leitores a medida | Priorizar por vagas abertas; testes com fixtures; `scraper_health` |
| Rede de teste | O portátil teve várias falhas 000 (DNS/timeouts): alguns "sem resposta" podem ser falsos negativos | Reverificar a partir do VPS antes de decidir |

## 7. Limitações desta pesquisa

- Contagens de agências são por slug/título nos sitemaps (V para totais, E para a depuração de ruído); Randstad limitada a 2 sitemaps de 5000 URLs.
- ASL "a medida": contagens por entes não foram auditadas uma a uma; os valores de 5-15 abertas por ente são estimativas a partir de amostras (Napoli 3 Sud, Novara, Ferrara) e dos 109 abertos medidos no Plone.
- Robyone: amostra de 22 IDs numa instância (`one33`); a descoberta completa de tenants fica por fazer.
- O scan Plone nos restantes domínios (Lazio, Campânia, Puglia, Sul) devolveu 404 nas amostras vistas; só ER (Plone/io-Sanità) tem API aberta.
