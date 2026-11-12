# Fontes de emprego para offertesanita.it (4.º mercado)

Data da pesquisa: 2026-11-12. Só investigação: sem scrapers, sem contas, sem deploys. Foram feitos pedidos de sonda pontuais (>= 1 s entre pedidos, UA genérico) a partir do portátil e, só para códigos HTTP, a partir do VPS 91.99.167.243.

Legenda de verificação: **V** = verificado com pedido real nesta sessão; **P** = parcial (página/plataforma vista, lista ou detalhe não inspecionados); **N** = não verificado (inferido de pesquisa web, a confirmar). Contagens de vagas são estimativas da página/sitemap vistos hoje, não totais auditados.

## 1. Conclusões principais

1. **O volume em Itália está no setor público e é fragmentado.** Não existe um portal único do SSN. Existem três alavancas "um leitor, muitas entidades" verificadas: **inPA** (nacional, sitemap + HTML), **Gazzetta Ufficiale 4.ª Série (RSS `S4`)** e o **portal regional do Veneto `concorsieavvisi.it`** (todas as ULSS/AO/IRCCS + Azienda Zero). Mais **ESTAR Toscana** (concursos centralizados para toda a Toscana).
2. **inPA é a melhor fonte única**: sitemap de bandos (1921 URLs hoje), detalhe em HTML servidor com campos estruturados (Ente, Regione, Stato, datas, n.º de lugares), robots só proíbe `/wp-json/`, acessível do VPS. Limitações: cobre todas as PA (só ~8 % saúde na amostra: 2 de 24), descrição curta, o texto integral está em PDF anexo.
3. **A Gazzetta Ufficiale funciona do VPS** (`/rss/S4`, 4.ª Série, ~68 itens por número, 2x/semana) mas só tem 1-2 linhas de objeto por item e só publica concursos (não avisos a termo, nem mobilidade). `robots.txt` devolve 404 (sem restrições declaradas). O `/rss` (índice) devolveu "Request Rejected" (WAF) no portátil; o feed direto funciona. Respeitar uma frequência baixa.
4. **Plataformas de candidatura (iscrizioneconcorsi.it/ISON, inRecruiting-Intervieweb) NÃO são leitura viável**: ASP.NET com login; `robots.txt` do Intervieweb tem `Disallow: /*LAC*` (todas as listas de clientes usam `LAC=`); `iscrizioneconcorsi.it` declara Content-Signal `ai-train=no` e bloqueia ClaudeBot; `iscrizioneconcorsi.it` devolve 999 ao VPS. Marcar como **bloqueada**.
5. **Sites de várias aulss/AO do Veneto, Niguarda, Abruzzo (asl1), GVM, Gruppo San Donato, Dr. Max e Diaverum dão 403 ao VPS** mas 200 ao portátil: exatamente a lição Cloudflare/WAF do ES. Usar as alternativas centralizadas (concorsieavvisi.it, inPA, GU).
6. **Privados com boa leitura**: Humanitas (SuccessFactors, sitemap+microdata JobPosting), Clariane Italia (WordPress, sitemap + JSON-LD), AniCura Italia (Teamtailor, JSON-LD), Cerba HealthCare Italia (Cornerstone/talent-soft). Todos 200 a partir do VPS.
7. **Agências (Gi Group, Randstad)** têm milhares de ofertas genéricas (Gi Group 4489 com `q=infermiere`, Randstad 283 só para "infermiere"): alto risco de duplicação com os empregadores diretos e com os mesmos clientes; manter para fase tardia e só como "agência".

## 2. Fontes públicas

### 2.1 Nacional e boletins

| Fonte | Tipo | URL | Plataforma | Acesso | robots | Vagas (estim.) | % saúde | VPS | Texto integral | Viabilidade | Esforço | Cobre muitas entidades | Verif. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **inPA** (Portale del Reclutamento, Funzione Pubblica) | Público, nacional | https://www.inpa.gov.it/bandi-e-avvisi/ | WordPress custom (plugin `dro-dashboard`) | Sitemap `sitemap-bandi.xml` (1921 URLs) + HTML servidor, sem JSON-LD, sem API pública | Só `Disallow: /wp-json/`, `/wp-admin/` etc.; permitido o resto | ~1900 abertas (todas as PA); amostra de 24: 23 "Aperto" | ~8 % (2/24: ASP Ragusa, Ordine Medici) -> ~150 estimadas; mais assistentes sociais/educadores em câmaras | 200 | Parcial: ficha estruturada curta; edital completo em PDF | **Alta** | Baixo (2-3 dias; mais PDF opcional) | **Sim: todo o país, todas as PA** | V |
| **Gazzetta Ufficiale 4.ª Série "Concorsi ed esami"** | Público, nacional | https://www.gazzettaufficiale.it/rss/S4 | Feed RSS 2.0 do último número | RSS (itens com link `/eli/id/AAAA/MM/DD/xxEnnnnn/S4`) | `/robots.txt` -> 404 | ~68 itens/número, ~41 de entidades de saúde no número de 9-nov; 2 números/semana (ter/sex) | ~60 % entidades de saúde (dirigência médica dominante) | 200 (feed); `/rss` índice rejeitado pelo WAF | Não: 1-2 linhas de objeto | **Alta** (descoberta); detalhe/PDF não testado | Baixo (1-2 dias) | **Sim: todas as ASL/AO/IRCCS que publicam concurso** | V (feed), N (detalhe) |
| Portal Gazzetta `30giorni/concorsi` | Público | https://www.gazzettaufficiale.it/30giorni/concorsi | HTML | HTML com WAF F5 ("Request Rejected" ocasional) | n/a | arquivo 30 dias | idem | 200 | Não | Média (WAF) | Médio | Sim | P |
| TSRM-PSTRP "Rubrica concorsi e Avvisi" | Ordem profissional nacional (curadoria) | https://www.tsrm-pstrp.org/index.php/rubrica_concorsi/ | WordPress | HTML servidor, links para o edital de cada entidade | `Disallow: /wp-` apenas | dezenas, atualização irregular (4-nov-2026) | ~100 % (profissões TSRM/PSTRP) | 200 | Parcial (link) | Média (boa para descoberta/ validação) | Baixo | Sim, mas só 18 profissões | V |
| FNOPI "concursos para enfermeiros na GU" | Federação nacional OPI (editorial) | https://www.fnopi.it/ | WordPress | Artigos periódicos | n/a | n/a | 100 % | 200 | n/a | Baixa (editorial) | n/a | n/a | P |
| BUR regionais (Piemonte, Lombardia, Lazio, Toscana, Veneto, E-R, Puglia) | Boletins oficiais | ex.: https://www.regione.piemonte.it/governo/bollettino/abbonati/2026/45/ | Mistura HTML + PDF anexos | Piemonte: HTML + PDFs `co_<ente>_<data>.pdf` (200); Lazio: PDFs `sintesi-concorsi-bur/*.pdf` (200); Lombardia: portal BURL 200; Toscana/Puglia: sem resposta; Veneto/E-R: URLs de teste 404 | Piemonte/Lombardia permitido; restantes não lidos | Não estimado | alto | 200 (Piemonte) | PDF | **Baixa-média**: PDF-only, esforço de OCR/extração, duplicam GU/inPA | Alto | Sim por região | P |

### 2.2 Portais regionais e agregadores de concursos por região

| Região / entidade | URL | Plataforma | Acesso | robots | Vagas (estim.) | VPS | Texto integral | Viabilidade | Esforço | Cobre | Verif. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Veneto: portal regional "Concorsi, Avvisi e Incarichi libero professionali"** (Azienda Zero) | https://www.aziendazero.concorsieavvisi.it/index.cfm (liga a `ulss0.mys.it`) | ColdFusion + jQuery (`cambia_concorsi`, `mostradett`), filtros por Ente/Figura/Stato | HTML + chamadas AJAX (endpoints ainda não mapeados) | `Disallow` só em `?action=mys.print`, `mys.cerca`, `debug=mys` | O site de cada ULSS mostra: ULSS2 18 abertas/1569 total, ULSS5 ~34, ULSS8 ~22, ULSS9 ~12 -> ~100-150 abertas (inclui LP e bolsas) | **200** | Parcial (ficha + anexos PDF) | **Média-alta** | Médio (3-5 dias; mapear AJAX com cuidado, sem contornar nada) | **Sim: 9 ULSS + AOUI Verona + AO Padova + IOV + Azienda Zero + Regione** | V (índice), P (AJAX) |
| Veneto: sites `aulssN.veneto.it/bandi-di-concorso?stato=1` | https://www.aulss2.veneto.it/bandi-di-concorso | CMS regional comum (HTML servidor, "Totale N elementi", paginação) | HTML servidor, `sitemap.xml` 200 | `Allow: /` | idem acima | **403** em aulss2/aulss5/aovr/aopd (200 no portátil) | Parcial | **Bloqueada do VPS** (usar o portal regional) | n/a | mesmo CMS em várias ULSS | V |
| **Toscana: ESTAR** (concursos unificados USL Centro/Nordovest/Sudest, AOU Careggi, Meyer, etc.) | https://www.estar.toscana.it/index.php/concorsi/ | WordPress, lista HTML com n.º/ano/tipo (`104/2026/ST`, `107/2026/CON`) e links `/index.php/104-2026-st/` | HTML servidor; sem sitemap WP (404) | `Disallow: /wp-admin/`, `/wp-includes/`, `/wp-content/` | ~10-30 abertas por vez (12 itens na página 1) | 200 | Parcial (ficha + PDF) | **Alta** | Baixo (2 dias) | **Sim: SSR Toscana** (concursos); mobilidade em `/avvisi-di-mobilita/` | V |
| **Piemonte: Azienda Zero** (concorsi unificados, "Portale Concorsi") | portal próprio (não localizado com URL público verificável) | N | Candidatura por SPID/CIE (login) | n/a | 12 concursos ativos / 558 lugares segundo imprensa | n/a | n/a | **Baixa** (candidatura em login; usar GU + BUR Piemonte + inPA) | n/a | Sim (aziende piemontesas) | N |
| **FVG: ARCS** | https://arcs.sanita.fvg.it/ (301); candidatura `arcssanitafvg.iscrizioneconcorsi.it` | Site institucional + ISON (login) | HTML + PDF no Regione FVG | n/a | ex.: 251 enfermeiros (GU 5-mai), 19 administrativos | 301 (home) | PDF | **Baixa-média** (usar GU/inPA/BUR) | Médio | Sim (aziende FVG) | P |
| **Lombardia: portal Amministrazione Trasparente multi-ente** (`<ente>.portaletrasparenza.net`) | https://asst-pavia.portaletrasparenza.net/it/trasparenza/bandi-di-concorso/bandi-e-avvisi-di-selezione-per-i-quali-e-possibile-presentare-domanda-di-partecipazione.html | Plataforma comum com marca "Regione Lombardia" (confirmada em ASST Pavia; outras ASST/ATS **não confirmadas** neste formato) | HTML servidor, páginas grandes (580 KB), sem sitemap (404) | `Crawl-delay: 5`, `Disallow: /registrazione`, `/exportPubOpenData*` | n/d | 200 | Parcial (PDF) | **Média** | Médio-alto (rate limit 5 s; estrutura em cascata) | Possível mais ASST/ATS (a confirmar) | P |
| Lombardia: sites ASST/ATS individuais | ex.: asst-mantova.it/concorsi, asst-santipaolocarlo.it/concorsi, asst-fbf-sacco.it/concorsi, ats-milano.it/ats/concorsi-avvisi (liga a `concorsi.ats-milano.it`), asst-lariana.it (WP), asst-spedalicivili.it/albo-pretorio-concorsi; Niguarda 403 no VPS | CMS heterogéneos | HTML (não inspecionados em detalhe) | n/d | n/d | 200 (maioria); Niguarda 403; asst-lodi timeout | PDF/HTML | **Média-baixa**: 1 leitor por CMS | Alto | Sem leitor comum | P |
| Lombardia: Regione "Concorsi e avvisi presso enti sanitari" | https://www.regione.lombardia.it/sanita/personale-sanitario-e-sociosanitario/concorsi-e-avvisi-presso-enti-sanitari/concorsi-e-avvisi-presso-enti-sanitari | Portal Regione Lombardia | Página 382 KB; lista não encontrada em HTML estático (provável JS) | `Allow: /` | n/d | 200 | n/d | Média-baixa | Médio | Possivelmente todas as ASST/ATS/IRCCS | P |
| **Emilia-Romagna** (AUSL Romagna, Piacenza, Modena: **Plone 6**) | https://www.auslromagna.it/bandi-concorsi ; https://www.ausl.pc.it/it/azienda/bandi-e-concorsi ; https://www.ausl.mo.it/ausl-comunica/concorsi | **Plone 6** (3 aziendas), AUSL Reggio: "Netribe on.Cube" + app `apps.ausl.re.it/BandiConcorsieIncarichi/#/home` (SPA) | HTML servidor; páginas 540-900 KB; listas por estado não inspecionadas | robots 200 (conteúdo não lido) | n/d | 200 | PDF | **Média** (um leitor Plone cobre 3+ AUSL) | Médio | Parcial (Plone: Romagna, Piacenza, Modena) | P |
| **Lazio** (ASL Roma 2 etc.) | https://www.aslroma2.it/external/concorsi/ | Joomla-Helix (ASL Roma 2); BUR Lazio com "sintesi" PDF | n/d | n/d | n/d | 200 (Roma 2); Latina/Umberto I falham TLS | PDF | Baixa-média | Alto | Não | P |
| **Campania** (SoReSa) | https://portale.soresa.it/ (avvisos só de SIAPS/formação, **não recrutamento**) | n/a | n/a | n/a | n/a | 301 | n/a | **Não aplicável**; aziende individuais (Cardarelli usa `portaleamministrazionetrasparente.it`) | Alto | Cardarelli: plataforma "trasparenza" partilhada (não confirmada) | P |
| **Puglia** | n/a (sem portal regional único, segundo pesquisa) | n/a | n/a | n/a | n/a | asl.bari.it 200 | n/a | Baixa (usar inPA/GU) | n/a | n/a | N |
| **Sardegna** (ARES) | https://www.aress.sardegna.it/ (sem resposta a ambos os lados) | n/a | n/a | n/a | n/a | 000 | n/a | **Não acessível** | n/a | n/a | V (falha) |
| **Trentino: APSS/ASUIT** | https://www.asuit.tn.it/bandi-concorsi (Drupal, filtros por estado/tipologia) | Drupal | HTML servidor | n/d | n/d | apss.tn.it 301 | n/d | Média (não lido em detalhe) | Médio | APSS apenas | P |
| **Alto Adige: SABES/ASDAA** | https://www.asdaa.it/it/ | n/d | n/d | n/d | n/d | 301 | n/d | N | n/d | n/d | N |
| **Valle d'Aosta** | https://www.regione.vda.it/amministrazione/concorsi/default_i.asp | ASP clássico + Lotus Notes | HTML | n/d | n/d | n/d | n/d | Baixa-média | n/d | n/d | P |
| **Liguria** (ALiSa) | https://www.liguriasalute.atsliguria.it/amministrazione-trasparente/bandi-di-concorso.html | n/d | HTML | n/d | n/d | 301 (alisa.liguria.it) | n/d | Média-baixa | n/d | n/d | P |
| Piemonte aziendas (ASL TO, Cuneo) | aslcittaditorino.it/concorsi-pubblici/; Cuneo usa BUR e "concorsi-avvisi" | n/d | n/d | n/d | n/d | 200 | PDF | Média-baixa | n/d | n/d | P |
| Marche (AST), Umbria, Calabria, Abruzzo, Molise, Basilicata, Sicilia | domínios testados falham/geobloqueiam (Abruzzo asl1: "Forbidden by geolocation"; Sicilia, Marche, BAT, Basilicata: sem resposta; Molise 500; Umbria regione 404) | n/a | n/a | n/a | n/a | n/a | n/a | **Cobrir via inPA + GU** | n/a | n/a | V (falhas) |

### 2.3 Plataformas partilhadas (as grandes alavancas) - resumo

| Plataforma | Evidência | Entidades | Veredicto |
|---|---|---|---|
| inPA | Verificada | Todas as PA do país | **Fase 1** |
| GU 4.ª Série RSS | Verificada | Todos os concursos em GU | **Fase 1** |
| Veneto `concorsieavvisi.it` (MyS / ulss0.mys.it) | Verificada (índice) | 14 entes veneto | **Fase 1** (mapear AJAX) |
| ESTAR Toscana | Verificada | USL Toscana (3), AOU (4), etc. | **Fase 1** |
| `portaletrasparenza.net` (Lombardia) | Confirmada em ASST Pavia | Possível: várias ASST/ATS | Fase 2 (confirmar quais) |
| Plone 6 (E-R) | Generator detetado em 3 AUSL | AUSL Romagna, Piacenza, Modena | Fase 2 |
| `iscrizioneconcorsi.it` (ISON) | Verificada: login | Dezenas (ASST Lodi, PG23, ARCS...) | **Bloqueada/inadequada** |
| inRecruiting / Intervieweb (Zucchetti) | Verificada: `Disallow: /*LAC*` | Synlab, Gemelli e muitos | **Bloqueada** (respeitar robots) |
| Concorsi Smart (`concorsismart.it`) | Home 301 do VPS; pesquisa web sem resultados; sem evidência | n/d | **Não verificada** |
| Altamira | Não encontrada nos sites testados | n/d | N |

## 3. Grupos privados

| Fonte | Tipo | URL | ATS/Plataforma | Acesso | robots | Vagas (estim.) | % clínico | VPS | Texto integral | Viabilidade | Esforço | Verif. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Humanitas** | Privado (hospitalar) | https://jobs.humanitas.it/ | SAP SuccessFactors Career Site Builder | `sitemap.xml` (146 URLs) + microdata schema.org JobPosting no detalhe | `Disallow` só em apply/talentcommunity/etc. | 146 | ~75 % (amostra de títulos: 54 médicos, 19 enfermeiros, 11 técnicos, 7 biólogos/ricerca, 4 OSS; ~51 outros/admin) | 200 | Sim | **Alta** (reaproveita `_sf_es.py`) | Baixo (1-2 dias) | V |
| **Clariane Italia (ex-Korian)** | RSA/reabilitação | https://carriere.clariane.it/ | WordPress custom | `korian-jobs-sitemap.xml` (215 URLs; 69 de 2026, resto antigas -> filtrar por `validThrough`/lastmod) + JSON-LD JobPosting | Yoast: `Disallow: /wp/wp-admin/` | ~70-215 (a confirmar atividade) | ~90 % (médicos RSA, enfermeiros, OSS, fisioterapeutas) | 200 | Sim | **Alta** (padrão fresenius/vitalia) | Baixo (1-2 dias) | V |
| **AniCura Italia** | Veterinário | https://jobs.anicura.it/jobs | Teamtailor | HTML listagem (20/página, `?page=N`) + JSON-LD JobPosting no detalhe; RSS global `anicuraglobal.teamtailor.com/jobs.rss` (só 6 itens IT) | `Disallow: /app/`, `/messages/` (UA `aihitdata` bloqueado) | 67 | ~85 % (veterinários, técnicos) | 200 | Sim | **Alta** (`_teamtailor_es.py`) | Baixo | V |
| **Cerba HealthCare Italia (ex-Lifebrain)** | Laboratórios/diagnóstico | https://cerbahealthcare-career.talent-soft.com/offre-de-emploi/liste-toutes-offres.aspx?LCID=1040 | Cornerstone (talent-soft) | HTML lista ("82 offerte"); detalhe não validado (sem JobPosting no 1.º teste) | robots vazio/sem regras | ~82 | ~70 % (enfermeiros, técnicos, médicos) | 200 | A confirmar | **Média-alta** (reaproveita leitor Cornerstone) | Médio | V/P |
| Gruppo San Donato (GSD) | Privado grande | https://www.grupposandonato.it/lavora-con-noi/{medico,infermiere,oss,fisioterapista,farmacista,biologo,coordinatore-infermieristico} | CMS próprio; listagens por profissão (sem JobPosting visível) | HTML | `Disallow` só em filtros | n/d (≈37 anúncios noutras plataformas) | alto | **403** | n/d | **Bloqueada do VPS** | n/a | V |
| GVM Care & Research | Privado grande | gvmnet.it | n/d | n/d | n/d | n/d | n/d | **403** | n/d | **Bloqueada do VPS** | n/a | V |
| Policlinico Gemelli | Privado/Univ. | https://www.policlinicogemelli.it/lavora-con-noi/ | inRecruiting (Intervieweb) | login/iframe | `Disallow: /*LAC*` (domínio central) | n/d | alto | 302 | n/d | **Bloqueada** | n/a | V |
| Synlab Italia | Laboratórios | https://www.synlab.it/lavora-con-noi | inRecruiting (widget `LAC=synlabitalia`) | iframe/JS | `Disallow: /*LAC*` | n/d | médio | 200 | n/d | **Bloqueada** | n/a | V |
| Centro Medico Santagostino | Ambulatórios | https://www.santagostino.it/it/lavora-con-noi | custom (não identificado) | HTML (não inspecionado) | n/d | n/d (>40 vagas médicas segundo imprensa) | alto | 301 | n/d | Média (por investigar) | n/d | P |
| Affidea Itália | Diagnóstico | https://affidea.it/ ; `careers.affidea.com` sem resposta | n/d | n/d | n/d | n/d | alto | 301 | n/d | N | n/d | N |
| Fresenius / NephroCare / Diaverum / B. Braun Avitum | Diálise | `careers.fresenius.com` (global, 200); NephroCare `nephrocare.com/it-it/` sem página de carreiras localizada; Diaverum 403 | n/d | n/d | n/d | n/d | alto | Fresenius 200 / Diaverum 403 | n/d | N (verificar filtro IT) | n/d | N |
| KOS Group, Garofalo (GHC), Villa Maria, Istituto Clinico... | Privados | sites sem URL de carreiras verificável (404/TLS) | n/d | n/d | n/d | n/d | n/d | n/d | n/d | N | n/d | N |

## 4. RSA e cooperativas

| Fonte | Estado | Nota |
|---|---|---|
| Clariane Italia | **Verificada** (ver 3) | Melhor candidato RSA, com OSS e infermieri |
| emeis (Orpea) Italia | https://www.emeis.it/ devolve 999 ao VPS | Não verificável |
| Sereni Orizzonti, La Villa, Over, Gheron, Codess | Sites sem URL de carreiras verificável (404, 403, TLS, DNS) | N |
| CGM, Proges, Coopselios | Home 200, sem ATS identificado | N; prioridade baixa; OSS/educatori maioritariamente via cooperativas locais e inPA (comuni) |

## 5. Dentárias, farmácias, veterinário

| Fonte | Resultado |
|---|---|
| DentalPro | Site com timeout em portátil e VPS (000); carreiras com filtro por categoria/província segundo pesquisa. N |
| Vitaldent Italia | Home 200 (612 bytes: SPA), sem carreiras localizadas. N |
| Caring Dental, Primo Dental | DNS/sem resposta. N |
| Hippocrates Holding / LaFarmacia | `hippocrates.it/lavora-con-noi` 404; vagas só em agregadores (Indeed, Jooble). N |
| Dr. Max Italia | `drmax.it/lavora-con-noi` existe mas **403** ao VPS e ao portátil. Bloqueada |
| FOFI / Ordine Farmacisti (bacheca) | Home 200, sem bacheca localizada. N |
| LloydsFarmacia/Benu, Farmacie Comunali | Não pesquisados em detalhe. N |
| AniCura Italia | **Verificada** (ver 3) |
| IVC Evidensia Italia, CVit | Sem resposta de rede ou TLS. N |

## 6. Ordens profissionais

| Ordem | Resultado |
|---|---|
| FNO TSRM e PSTRP | **Rubrica concorsi e avvisi** pública, sem login, HTML, robots permissivo (ver 2.1). Útil como camada de descoberta/validação |
| FNOPI / OPI | Bacheca de trabalho só em algumas ordens provinciais (ex.: OPI Firenze-Pistoia); nacional é área reservada. Editorial FNOPI sobre concursos em GU |
| FNOMCeO, FNOPO, FOFI, Ordem Psicólogos | Sem bacheca pública localizada |

## 7. Agências (listar à parte; duplicação)

| Agência | URL | Acesso | robots | Dimensão | VPS | Risco |
|---|---|---|---|---|---|---|
| Gi Group (Healthcare) | https://www.gigroup.it/offerte-lavoro/ | HTML servidor (sem JobPosting detetado em `q=infermiere`); sitemap em `sitemap_index.xml` | `Disallow` em `candidati-ricerche-attive...`, `offerte-lavoro-con-mappa` | 4489 ofertas totais (todas as áreas) | 200 | Duplica clientes finais; conteúdo genérico; ToS |
| Randstad (Healthcare) | https://www.randstad.it/offerte-lavoro/ | HTML (283 para "infermiere") | `Disallow` em filtros km/postcode/sh/sd | n/d | 200 | idem |
| Openjobmetis, Adecco Medical, Synergie | Openjobmetis: 200 mas só 212 bytes (SPA); restantes não verificados | n/d | n/d | n/d | 200 (OJM) | idem |

Recomendação: marcar como "Agência" com `source_type=agency`; deduplicar por (empregador final, localização, título). Fase 3.

## 8. Agregadores / editoriais (excluídos por política)

Concorsando, ConcorsiPubblici, Edises, LeggiOggi, Simone Concorsi, Indeed, Jooble, Jobijoba, Jobbydoo, TiConsiglio: úteis para validar se uma fonte primária escapou, mas **não usar como fonte** (snippet/ToS/SEO).

## 9. Top 15 por valor e viabilidade

| # | Fonte | Tipo | Viab. | Vagas estim. (abertas) | Reutiliza |
|---|---|---|---|---|---|
| 1 | inPA | Público nacional | Alta | ~150-250 saúde (~1900 PA) | novo (sitemap + HTML) |
| 2 | GU 4.ª Série RSS (`/rss/S4`) | Público nacional | Alta | ~250-320 em 30 dias (~40/número) | novo (RSS) |
| 3 | Veneto `concorsieavvisi.it` | Público regional (14 entes) | Média-alta | ~100-150 | novo (AJAX) |
| 4 | ESTAR Toscana | Público regional | Alta | ~10-30 | novo (HTML WP) |
| 5 | Humanitas (SuccessFactors) | Privado | Alta | 146 | `_sf_es.py` |
| 6 | Clariane Italia | RSA | Alta | ~70-215 | padrão fresenius/vitalia |
| 7 | AniCura Italia | Veterinário | Alta | 67 | `_teamtailor_es.py` |
| 8 | Cerba HealthCare Italia | Diagnóstico | Média-alta | ~82 | leitor Cornerstone |
| 9 | Lombardia `portaletrasparenza.net` (ASST Pavia confirmada) | Público | Média | n/d | novo |
| 10 | Emilia-Romagna Plone 6 (Romagna, Piacenza, Modena) | Público | Média | n/d | novo (1 leitor) |
| 11 | TSRM-PSTRP rubrica concorsi | Ordem (curadoria) | Média | dezenas | novo, para validação |
| 12 | BUR Piemonte / Azienda Zero Piemonte | Público | Média-baixa | n/d (558 lugares em 12 concursos, imprensa) | PDFs |
| 13 | Gi Group | Agência | Média | grande, genérico | novo |
| 14 | Randstad | Agência | Média | grande, genérico | novo |
| 15 | Gruppo San Donato | Privado | Bloqueada (VPS 403) | ~37 | n/a (só se houver saída permitida) |

## 10. Totais

- Entidades/fontes examinadas: ~90 (domínios únicos sondados ~85 + plataformas).
- **Verificadas e viáveis (alta/média-alta): 8** (inPA, GU S4, Veneto portal, ESTAR, Humanitas, Clariane, AniCura, Cerba).
- Viáveis com ressalvas (média/média-baixa): ~8 (Lombardia trasparenza, Plone E-R, TSRM rubrica, BUR Piemonte, Gi Group, Randstad, Trentino ASUIT, ARCS/FVG).
- Bloqueadas por robots/login/WAF a partir do VPS: ~12 (iscrizioneconcorsi.it, inRecruiting/Synlab/Gemelli, GSD, GVM, Dr. Max, Diaverum, emeis, aulss2/5, AOVR, AOPD, Niguarda, asl1 abruzzo).
- Sem resposta/não localizadas: ~35 (ARES, ASP Palermo/Catania, Marche, DentalPro, IVC, etc.).
- Plataformas partilhadas confirmadas: 3 de leitura viável (inPA, GU RSS, Veneto) + 1 regional (ESTAR) + 2 candidatas (trasparenza Lombardia, Plone E-R); 2 bloqueadas (ISON, Intervieweb).

## 11. Taxonomia recomendada

Evidência: números de 9-nov-2026 da GU (41 itens de entidades de saúde: ~21 dirigentes médicos, 9 ricerca/universidade, restante enfermeiro, ostetrica, fisioterapista, assistente social, técnicos sanitários, amministrativo), Humanitas (146 vagas: 54 médicos, 51 admin/outros, 19 enfermeiros, 11 técnicos, 7 biólogos/investigação, 4 OSS), Clariane (médico de reparto, fisioterapista, enfermeiro, OSS dominam os títulos do sitemap), AniCura (médico veterinário dominante), amostra inPA (Assistente Sociale, EQ) e filtro "Figura professionale" do portal Veneto.

**Profissão (categoria principal)**: Médico (com especialidade/disciplina), Enfermeiro, OSS (Operatore Socio Sanitario), Fisioterapeuta, Técnico sanitário (laboratório biomédico, radiologia médica, neurofisiopatologia, audiometria, ortopedia), Ostetrica, Farmacêutico, Psicólogo, Odontoiatra/igienista, Veterinário, Assistente social, Dietista, Logopedista, Educador profissional, Biólogo/químico/físico, Assistente sanitário, Técnico da prevenção, Amministrativo/técnico, Investigação.

**Tipo de contrato/procedimento (público)**: Concorso pubblico (tempo indeterminado), Avviso a tempo determinato, Mobilità, Incarico libero-professionale, Borsa di studio, Incarico di direzione di struttura complessa (UOC), Selezione/graduatoria, Medicina generale/continuità assistenziale (incarichi vacanti).

**Dimensões adicionais**: região/província, tipo de ente (ASL/ASST/AO/IRCCS/Privado/RSA/Agência), área (dirigenza vs comparto), data de fecho.

Nota: "Dirigenza medica" vs "comparto" são categorias relevantes em Itália; recomendo exportar ambas como facetas.

## 12. Estimativa de volume

Estimativas (não contagens): ver nota de método abaixo.

| Fase | Fontes | Vagas abertas simultâneas (antes de dedupe) | Após dedupe (est.) |
|---|---|---|---|
| Fase 1 | Top 10 (inPA, GU, Veneto, ESTAR, Humanitas, Clariane, AniCura, Cerba, Lombardia trasparenza, Plone E-R) | ~900-1400 | ~700-1000 (GU e inPA sobrepõem-se; Veneto aparece em GU/inPA) |
| Fase 2 | + sites ASST/ATS Lombardia, BUR Piemonte, Trentino, FVG/ARCS, Santagostino, TSRM rubrica, mais privados/RSA identificados | +800-1500 | ~1500-2500 |
| Fase 3 | agências | +grande volume genérico | marcar `agency` |

Método: inPA = 8 % de ~1900 em amostra de 24 (alta incerteza: ±5 pp); GU = 41 itens saúde/número x 2/semana ≈ 330 em 30 dias; Veneto soma das contagens "Aperto" por ULSS; privados = sitemap atual. O SSN italiano tem ~200 aziende; o universo real de vagas abertas é provavelmente maior (muitas só em PDF/ISON) e o objetivo plausível de longo prazo é 2500-4000 simultâneas.

## 13. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| **PDF-only** (bandos, BUR, Lazio) | Texto integral em falta; SEO fraco | Extração PDF (pdftotext), manter só campos estruturados + link para fonte; avaliar conteúdo parafraseado |
| **CAPTCHA/login** (ISON, inRecruiting, candidatura SPID) | Sem acesso | Não contornar; usar inPA/GU para descoberta e linkar para o portal de candidatura |
| **WAF/datacenter** (GU `/rss`, GSD, GVM, Dr. Max, ULSS venetas, Niguarda) | Funciona do portátil, falha do VPS | Testar sempre a partir do VPS; usar fontes centralizadas |
| **robots/ToS**: Content-Signal (`ai-train=no`) em iscrizioneconcorsi.it; Crawl-delay 5 s (trasparenza); UAs bloqueados (Teamtailor `aihitdata`) | Legal/ban | Respeitar; UA identificável; baixa frequência |
| **Dados pessoais/títulos** em avisos | RGPD | Guardar só dados do anúncio |
| **Duplicação** (inPA vs GU vs site do ente; agências vs empregador) | Qualidade/SEO | Chave de dedupe (ente + profilo + scadenza + n.º lugares) |
| **Informação instável**: sitemap de Clariane com URLs antigas; Puglia OSS 1000 lugares com adiamentos; vagas "fino a copertura" | Vagas expiradas | Usar `validThrough`, estado "Aperto/Chiuso", remover após scadenza |
| Sites com cert/TLS ou DNS falhando (vários) | Cobertura incompleta | Reverificar; inPA/GU como rede de segurança |

## 14. Próximos passos recomendados

1. Leitor inPA (sitemap `sitemap-bandi.xml`; filtrar por ente de saúde por nome/palavras-chave; guardar PDF como anexo). Atenção: o sitemap usa `inpa.gov.it` sem `www`.
2. Leitor GU `S4` (2x/semana, ter/sex) + enriquecimento com a página `/eli/id/.../S4` (testar do VPS).
3. Mapear AJAX de `concorsieavvisi.it` (apenas chamadas feitas pelo próprio site, sem contornar nada).
4. ESTAR (HTML), Humanitas (`_sf_es`), Clariane (JSON-LD), AniCura (`_teamtailor_es`), Cerba (Cornerstone).
5. Fase 2 após confirmar `portaletrasparenza.net` noutras ASST e o padrão Plone.
