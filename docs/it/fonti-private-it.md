# Fontes privadas de saúde em Itália (levantamento) para offertesanita.it

Data: 2026-11-12. Só investigação: não foram construídos scrapers. Complementa `docs/it/fonti-lavoro-sanita-it.md` (não repete o que lá está: Humanitas, Clariane, AniCura, Cerba e Fresenius/NephroCare em construção; GSD, GVM, Dr. Max, Diaverum e Niguarda 403 no VPS; Synlab e Gemelli bloqueadas por robots do Intervieweb).

Método: ~190 pedidos de sonda (>= 1 s entre pedidos, UA `OfferteSanitaBot/1.0 (+https://offertesanita.it/bot)`), a partir do portátil; códigos HTTP a partir do VPS 91.99.167.243 com dois UA (bot / `Mozilla/5.0`, dá sempre o mesmo código abaixo, salvo indicação). Sem proxies, sem truques de cabeçalhos, nada em caminhos proibidos por robots. Não foram usados agregadores como fonte (apenas pesquisa web para descobrir o nome do ATS de Affidea). Contagens = lidas da página/API hoje; "clínicas" = contagem por palavras-chave nos títulos (médico, infermiere, OSS, fisioterapista, tecnici sanitari, farmacista, psicologo, biologo...), com margem de erro de cerca de ±15 %.

## 1. Descoberta principal: Allibo (`joblink.allibo.com`) e Recruitee

- **Allibo** (ATS italiano, ASP.NET) é a plataforma comum de **Gruppo San Donato/San Raffaele (hsr.it)**, **Fatebenefratelli (Ordine Ospedaliero San Giovanni di Dio)** e **Bianalisi**. `robots.txt` de `joblink.allibo.com`: `User-agent:* Allow: /`. Dois endpoints úteis, ambos 200 do VPS:
  - Lista: `https://joblink.allibo.com/ats<N>/Widget/connector.aspx?DM=<token>&SG=2&FT=<n>&LN=IT` devolve **JSON** (`Content.WidgetData.AdsList[]`: Job, Title, JobLocation, DetailLink, ListPlaces com lat/lon). O token `DM` está no HTML público da página de carreiras de cada cliente (não reproduzido aqui).
  - Detalhe: `.../job-offer.aspx?DM=<id>&ID=<n>&LN=IT` em HTML servidor (título + descrição + sede; `og:title`, sem JobPosting).
  - Um leitor "Allibo" serve vários clientes (só muda `DM`/`ats<N>`).
- **Recruitee**: Affidea Italia (`affideaitaly.recruitee.com/api/offers`, JSON completo com descrição), robots `Disallow: /v/` apenas. Há leitor equivalente em ES/BR/PT? Reutilizar o leitor Recruitee se existir; caso contrário é trivial (JSON).
- Plataforma "PHP job-seekers" (`*/job-seekers.php?job_post_id=N`, usada por CDI, KOS, La Villa): HTML devolve apenas um *stub* JS (redireciona com `?source=`, `localStorage.clear()`+reload). **JS-only**, sem API pública. robots: `Disallow /admin/ /ajax/ /candidate/`.
- Intervieweb/inRecruiting (Synlab, Gemelli, Coopselios, Policlinico Campus Bio-Medico `zinrec.intervieweb.it`, Sacra Famiglia): **bloqueado por robots** (confirmado no documento anterior), não tentado.

## 2. Resultados verificados (todos os candidatos com leitura possível)

Legenda VPS: código bot / código Mozilla. Viabilidade: alta / média / baixa / bloqueada.

| # | Entidade | Tipo | URL de listagem | ATS / acesso | robots | Vagas abertas hoje (Itália) | Clínicas (est.) | Texto integral | VPS (bot/Moz) | Viabilidade | Esforço | Leitor reutilizável |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Affidea Italia** (diagnóstico, ambulatórios, cuidados domiciliares) | Privado | https://affideaitaly.recruitee.com/api/offers | Recruitee, API JSON | `Disallow: /v/` apenas | **66** | **~50** (médicos em libera professione, infermieri, TSRM, fisioterapisti, OSS, receptionist/admin fora) | Sim (descrição HTML no JSON) | 200/200 | **Alta** | Baixo (0,5 dia) | Recruitee (ou JSON simples) |
| 2 | **Istituto Auxologico Italiano** (IRCCS+RSA) | Privado sem fins lucrativos | https://www.auxologico.it/lavora-con-noi/posizioni-aperte?page=0..2 | Drupal, HTML servidor, 20 itens/página, 54 detalhes únicos `/lavora-con-noi/posizioni-aperte/<slug>` | Bloqueios só em `/@servizi/data`, `?search`; listagem permitida | **54** | **~46** (32 médicos, 8 infermieri, 4 técnicos, fisio, farmacista, OSS, psicólogo) | Sim (HTML detalhe) | 200/200 | **Alta** | Médio-baixo (1 dia, HTML novo) | Novo (HTML) |
| 3 | **ICS Maugeri** (reabilitação, IRCCS) | Privado sem fins lucrativos | https://carriere.icsmaugeri.it/ (sitemap 20 URLs; `/search/?q=&startrow=N`) | SAP SuccessFactors CSB com microdata `itemprop` (title, datePosted, validThrough, description, jobLocation) | `Disallow` só applybutton/talentcommunity/preapply... | **20** | **~19** (neurologo, fisiatra, infermieri, fisioterapisti, logopedista, terapista occ., tirocini) | Sim | 200/200 | **Alta** | Muito baixo (0,25 dia: igual a Humanitas) | `_sf_es.py` (Humanitas) |
| 4 | **Fatebenefratelli / Ordine Ospedaliero S. Giovanni di Dio** (Brescia, Cernusco, S. Colombano, Romano d'Ezzelino, S. Maurizio C.se, Orzinuovi, Verona...) | Religioso / não lucrativo | https://www.fatebenefratelli.it/lavora-con-noi (widget Allibo `ats1`) | Allibo, JSON | Allibo `Allow: /` | **12** | **~11** (OSS, infermieri, psichiatra, fisioterapista, educatore, TERP, coord. infermieristico) | Sim (detalhe HTML) | 200/200 | **Alta** | Médio (1-1,5 dia, serve também o resto de clientes Allibo) | Novo: leitor Allibo |
| 5 | **KOS Group** (Santo Stefano, Anni Azzurri, Villa dei Pini, Medicalia, Neomesia...) | Privado, RSA e reabilitação | https://kosgroup.com/it/lavorare-in-kos/posizioni-aperte | Site corporativo: 79 cartões em HTML servidor (título, local, contrato, link `lavoraconnoi.kosgroup.com/job-seekers.php?job_post_id=N`). Detalhe só em JS-stub | `Disallow` só `?query=`/`?formId=` | **79** | **~72** (23 OSS, 20 infermieri, 9 fisioterapisti, médicos, educatori) | **Não** (só título/local/contrato; descrição só na plataforma JS) | 200/200 | **Média** (alta para "ficha curta" com link de candidatura) | Médio (1 dia) | Novo (HTML) |
| 6 | **IEO / Fondazione IEO-Monzino** (oncologia, Milão) | Privado, IRCCS | https://www.ieo.it/it/CHI-SIAMO/Lo-IEO/Lavora-con-noi/ | Página única HTML servidor com ~34 anúncios (cada um `<h3>` + texto, candidatura por email `servizio.selezione@ieo.it`, referências AMM2026 etc.) | `Disallow` só `/it/RESEARCH/` e PDFs | **~34** | **~28** (8 infermieri, 9 médicos, técnicos, farmacista, fisico, OSS; 3 bolsas) | Sim (texto na página) | 200/200 | **Média** (sem URL individual: usar âncora/hash do título; deduplicação instável) | Médio (1 dia) | Novo (HTML) |
| 7 | **Habilita** (Bergamo/Lombardia, ospedali e centros) | Privado | https://habilita.it/posizioni/ (WP; detalhe `/posizioni/<slug>/`) | WordPress, HTML servidor; `wp-sitemap.xml` | `Disallow` só wp-admin | **~12** | **~9** | Sim | 200/200 | **Média-alta** | Baixo (0,5 dia) | Padrão WP (Clariane) |
| 8 | Fondazione Don Gnocchi (50+ estruturas, 2 IRCCS) | Privado sem fins lucrativos | https://www.dongnocchi.it/lavora-con-noi (abas Sanitaria/Amministrativa/Ricerca) | Widget **Steps Connect** (`career-widget-production.stepsconnect.com`, back-end Firebase). Lista não está no HTML | Sem restrição relevante (`?search`) | n/d (estim. 20-50) | alta | n/d | 200/200 (página) | **Média-baixa** (API não pública/documentada; JS) | Alto/incerto | Novo |
| 9 | Centro Medico Santagostino (ambulatórios, MI/RM/BO/TO) | Privado | https://www.santagostino.it/it/lavora-con-noi e `/it/lavora-con-noi-professionisti` | Widget **Teamtailor** embebido por JS (departamentos, chave de API pública no HTML; slug da conta não identificado: `santagostino.teamtailor.com` dá 404) | `Disallow` só `/it/prenota?*`, `/admin/` | n/d (imprensa: >40) | alta | n/d | 200/200 (página) | **Média-baixa** (falta o host Teamtailor; não usei a chave) | Médio-alto | `_teamtailor_es.py` se se achar o slug |
| 10 | CDI Centro Diagnostico Italiano | Privado | https://careers.cdi.it/jobs.php | Plataforma "job-seekers" JS-only (stub com reload) | `Disallow /admin/ /ajax/ /candidate/` | n/d | alta | n/d | 200/200 (stub) | **Baixa** (JS-only) | Alto (headless) | n/a |
| 11 | La Villa (RSA) | Privado | https://candidature.lavillaspa.it/posizioni-aperte/ | Mesma plataforma JS-stub | idem | n/d | alta | n/d | n/t | **Baixa** | Alto | n/a |
| 12 | Policlinico di Monza (GVM) | Privado | https://www.policlinicodimonza.it/lavora-con-noi/ | WordPress, HTML servidor; anúncios com email, sem URL individual | n/d | ~8 (maioria não clínica: manutenção, fisico medico...) | ~3 | Sim | 200/200 | **Baixa** (poucas vagas, sem URL) | Baixo | n/a |
| 13 | IDI IRCCS Roma | Privado/religioso | https://www.idi.it/lavora-con-noi | WP, 3 páginas (dermatologo, infermiere, TSRM) | n/d | 3 | 3 | Sim | 200/200 | **Baixa** (volume irrisório) | Baixo | n/a |
| 14 | Poliambulanza Brescia | Fundação | https://www.poliambulanza.it/lavora-con-noi/poliambulanza-lavora-con-noi | Página única; candidatura por email; anúncios sem estrutura | n/d | ~5 (n/d) | n/d | parcial | 200/200 | **Baixa** | Médio | n/a |
| 15 | MultiMedica | Privado | https://multimedica.it/lavora-con-noi/ (+ `/sezione_lavora_con_noi/area-medica/` etc.) | WordPress com CPT `sezione_lavora_con_noi`; as secções não trazem lista no HTML (JS ou vazio). Há "archivio bandi di ricerca" (bolsas) | n/d | n/d | n/d | n/d | 200/200 | **Baixa** (por investigar) | n/d | n/a |
| 16 | Bianalisi | Laboratórios | https://bianalisi.it/ricerca-personale-sanitario | Allibo `ats9`, **0 anúncios** (só candidatura espontânea) | n/d | **0** | 0 | n/a | 200/200 | Sem vagas hoje | n/a | leitor Allibo (se voltar a publicar) |
| 17 | Colosseum Dental Italia (ex-Odontosalute) | Dentária | https://www.colosseumdental.it/unisciti-a-noi/ | WP, "Al momento non abbiamo offerte di lavoro" | n/d | **0** | 0 | n/a | n/t | Sem vagas hoje | n/a | n/a |
| 18 | Policlinico Campus Bio-Medico | Privado/Univ. | https://www.policlinicocampusbiomedico.it/lavora-con-noi/area-sanitaria | Lista via `zinrec.intervieweb.it` (inRecruiting) + PDFs de "manifestazioni di interesse" | robots Intervieweb: bloqueado | n/d | n/d | n/d | n/t | **Bloqueada (robots)** | n/a | n/a |
| 19 | Isokinetic, Miulli (Bari), Garofalo Health Care (GHC), Neuromed, Moncucco | Privados | `/lavora-con-noi` próprios | Apenas formulário de candidatura espontânea (GHC: formulário por região/estrutura; Isokinetic e Miulli: formulário). Neuromed: `candidature.neuromed.it` não resolve (DNS) | n/d | 0 publicadas | n/a | n/a | 200/200 | **Sem vagas publicadas** | n/a | n/a |

## 3. "Bloqueadas no VPS mas viáveis a partir de um IP italiano/residencial"

Verificado: o portátil acede, o VPS recebe 403 com os dois UA. Nenhum contorno foi tentado.

| Entidade | URL | ATS / acesso (visto do portátil) | Vagas abertas | Clínicas (est.) | VPS | Notas |
|---|---|---|---|---|---|---|
| **Gruppo San Donato** (GSD: ICCB, ICSAN, Policlinico S. Donato, S. Ambrogio...) | https://www.grupposandonato.it/lavora-con-noi/{medico,infermiere,tecnico-di-radiologia,...} | CMS próprio; `sitemap.xml` com 79 URLs `/lavora-con-noi/<categoria>/<slug>` (24 médico, 6 TSRM, 6 infermiere, 4 biologo, 3 tec. laboratório, 2 fisio...) + JSON-LD em detalhe (1 bloco `ld+json`, tipo a confirmar). `robots` não bloqueia `/lavora-con-noi` | **79** | **~48** | 403/403 | Reutilizável o leitor sitemap+JSON-LD |
| **IRCCS San Raffaele (hsr.it)** | https://www.hsr.it/lavora-con-noi | Allibo `ats3` (DM=1959): **311** ofertas únicas na página, quase todas de investigação (PNRR/Ricerca) | **311** | **~125** (médicos, psicólogos, fisioterapisti, biólogos, study coordinators; restantes ricerca pura) | listagem hsr.it 403/403; **mas** `joblink.allibo.com` detalhe 200/200 | O VPS lê os detalhes Allibo mas a listagem está atrás do 403 do hsr.it; não procurei a lista noutro sítio sem confirmação. Rever a descoberta de IDs com o dono do projecto |
| GVM Care & Research | https://www.gvmnet.it/lavora-con-noi | n/d (403 também no VPS; não lido) | n/d (centenas segundo imprensa/Jooble) | n/d | 403 | Não inspecionada |
| Dr. Max Italia | drmax.it/lavora-con-noi | 403 (também no portátil, segundo o doc anterior) | n/d | n/d | 403 | Rever com IP italiano |
| Diaverum | diaverum.com/it-IT | 403 do portátil e do VPS | n/d | n/d | 403 | Rever |
| Unilabs Italia | unilabs.it/lavora-con-noi | **522** (Cloudflare, origem em baixo) no portátil; carreiras globais em `unilabs.dvinci-hr.com` (maioria Suíça/IT corporativa) | n/d | n/d | n/t | Reavaliar mais tarde |

Soma estimada (a partir de IP italiano/residencial): GSD ~48 + HSR ~125 clínicas (total bruto 390) = **~170 clínicas (390 bruto)**, mais GVM/Dr. Max/Diaverum não quantificados.

## 4. Sem fonte útil / não encontrados (para não repetir)

| Grupo | Resultado |
|---|---|
| Robots/login (Intervieweb, Zucchetti HR) | Synlab, Gemelli, Coopselios (`coopselios.intervieweb.it`), Campus Bio-Medico, Sacra Famiglia (`zinrec.intervieweb.it` + `saas.hrzucchetti.it`), Auxologico usa só o site próprio (OK). Coopselios/Codess ligados ao mesmo Intervieweb |
| Dentárias | DentalPro, Caring Dental, Primo Dental, Dentalcoop: timeout/DNS/404. Vitaldent: `vitaldent.it` 404, `vitaldent.com/it` 404 (só ES). Colosseum Dental: 0 vagas |
| Farmácias | Hippocrates/LaFarmacia: site SPA de 677 bytes e `lafarmacia.it` 403; Lloyds/BENU: DNS falha; Apoteca Natura e AFM/AFC (Farmácias Comunais): sem página de carreiras; AIOP (`aiop.it`) sem resposta; ARIS: site sem job board |
| RSA/cooperativas | emeis Italia (shell de 8 KB, sem carreiras), Sereni Orizzonti, Over, Segesta, Codess: DNS/TLS/404; Gheron: portal sem carreiras; Proges, Domus Salutis/Camplani: sem ATS identificável |
| Veterinário | IVC Evidensia: o Teamtailor `ivcevidensia.teamtailor.com` só tem Bélgica (38) e `evidensia.teamtailor.com` só Suécia (41). **Nenhuma vaga italiana**. CVit: sem resposta |
| Diálise | B. Braun Avitum Italia: sem resposta (`bbraunavitum.it`) e `bbraun.it` carreiras 404 |
| Homecare | Vivisol Italia: página sem lista ("Posizioni aperte: nascosta"); Personio de Vivisol só DE. Medicair: TLS inválido |
| Fisioterapia | Isokinetic: só formulário; FisioSalus: sem carreiras |
| Associações | AIOP e ARIS: sem bolsa de emprego |
| Outros ATS testados por slug (Recruitee, Teamtailor RSS, SmartRecruiters, Personio, Greenhouse, Lever; ~54 nomes de empresas) | Sem acertos italianos relevantes além de Affidea (descoberto por pesquisa) |

## 5. Ranking por (vagas de saúde abertas em Itália) x viabilidade

Pontuação = vagas clínicas estimadas x peso (alta 1,0; média-alta 0,8; média 0,6; média-baixa 0,3; baixa 0,1; bloqueada 0 no VPS).

| Rank | Fonte | Vagas clínicas (est.) | Viabilidade (VPS) | Pontuação | Fase |
|---|---|---|---|---|---|
| 1 | Affidea Italia (Recruitee) | ~50 | Alta | 50 | A |
| 2 | Auxologico (Drupal HTML) | ~46 | Alta | 46 | A |
| 3 | KOS Group (HTML corporativo) | ~72 | Média (sem descrição) | 43 | B |
| 4 | ICS Maugeri (SuccessFactors) | ~19 | Alta | 19 | A |
| 5 | IEO / Fondazione IEO-Monzino | ~28 | Média | 17 | B |
| 6 | Fatebenefratelli (Allibo) | ~11 | Alta | 11 | A |
| 7 | Habilita | ~9 | Média-alta | 7 | B |
| 8 | Don Gnocchi (Steps) | ~30 (estim.) | Média-baixa | ~9 | B/C |
| 9 | Santagostino (Teamtailor widget) | ~30 (estim.) | Média-baixa | ~9 | B/C |
| 10 | Policlinico di Monza | ~3 | Baixa | 0,3 | C |
| 11 | IDI | 3 | Baixa | 0,3 | C |
| 12 | Poliambulanza | ~5 | Baixa | 0,5 | C |
| 13 | CDI, La Villa, MultiMedica | n/d | Baixa (JS) | n/a | C |
| 14-20 | Bianalisi, Colosseum Dental (0 vagas, monitorizar); Campus BM, Synlab, Gemelli (robots); IVC (sem Itália) | 0 | nula | 0 | n/a |

Em separado, bloqueadas no VPS: **HSR ~125**, **GSD ~48**, GVM n/d (ver secção 3).

### Top 20 consolidado (incluindo as fontes já conhecidas em construção, estimativas do doc anterior)

| # | Fonte | Vagas (saúde) | Viabilidade |
|---|---|---|---|
| 1 | Humanitas (SuccessFactors) [conhecida] | ~110 clínicas (146 total) | Alta, em construção |
| 2 | Clariane Italia [conhecida] | ~70-215 | Alta, em construção |
| 3 | AniCura Italia [conhecida] | ~57 (67 total) | Alta, em construção |
| 4 | Cerba HealthCare [conhecida] | ~82 | Média-alta, em construção |
| 5 | Affidea Italia | ~50 (66) | Alta |
| 6 | Auxologico | ~46 (54) | Alta |
| 7 | KOS Group | ~72 (79) | Média (sem descrição) |
| 8 | IEO / Monzino | ~28 (34) | Média |
| 9 | ICS Maugeri | ~19 (20) | Alta |
| 10 | Fatebenefratelli (Allibo) | ~11 (12) | Alta |
| 11 | Habilita | ~9 (12) | Média-alta |
| 12 | Don Gnocchi | ~30 est. | Média-baixa |
| 13 | Santagostino | ~30 est. | Média-baixa |
| 14 | Fresenius/NephroCare [conhecida] | n/d | Alta, em construção |
| 15 | Policlinico di Monza | ~3 | Baixa |
| 16 | IDI | 3 | Baixa |
| 17 | Poliambulanza | ~5 | Baixa |
| 18 | HSR (San Raffaele) | ~125 (311) | Bloqueada VPS (listagem) |
| 19 | Gruppo San Donato | ~48 (79) | Bloqueada VPS |
| 20 | GVM / Dr. Max / Diaverum | n/d | Bloqueada VPS |

## 6. Totais e estimativa de ganho

Estimativas, sem deduplicação, com a margem de erro indicada acima.

| Fase | Fontes novas (além das 5 em construção) | Vagas totais | Vagas clínicas |
|---|---|---|---|
| **A (alta)** | Affidea (66), Auxologico (54), Maugeri (20), Fatebenefratelli/Allibo (12) | **~152** | **~126** |
| **B (média / média-alta)** | KOS (79), IEO (34), Habilita (12) + eventuais Don Gnocchi e Santagostino (se se resolver o acesso: +40 a +80) | **~125 (+40-80)** | **~110 (+40-80)** |
| C (baixa, não recomendado agora) | Monza, IDI, Poliambulanza, CDI, La Villa, MultiMedica | <30 | <15 |
| Bloqueadas VPS (IP italiano) | HSR (311), GSD (79), GVM/Dr. Max/Diaverum (n/d) | **~390+** | **~170+** |

Com as 5 fontes já em construção (Humanitas ~146, Clariane ~70-215, AniCura 67, Cerba ~82, Fresenius n/d, total ~365-510), fases A+B somam **~280 vagas novas (até ~360)**, levando o catálogo privado para **~650-870 vagas**; com IP italiano mais ~390 brutas. Para ter noção de escala: as 427 vagas atuais são todas públicas.

Nota de realismo: o Italia privado está fragmentado em muitos sites pequenos sem ATS (formulários, email). O grande volume privado (GVM, Policlinico Gemelli, Synlab, Campus BM, Coopselios, Sacra Famiglia) está atrás do WAF ou de robots; o ganho desproporcionado vem de: (a) leitor **Allibo** (HSR + GSD-ecossistema + FBF + outros clientes), (b) um IP italiano para GSD/HSR/GVM, (c) o leitor Recruitee/SuccessFactors já existente (Affidea, Maugeri).

## 7. Recomendações de implementação

1. Fase A (1-3 dias no total): Maugeri (reutilizar `_sf_es.py`), Affidea (Recruitee JSON), Auxologico (HTML `?page=N`), Fatebenefratelli (leitor Allibo JSON; o mesmo leitor serve HSR, se o VPS conseguir o token `DM`/lista).
2. Fase B: KOS (cartões HTML; guardar só título/local/contrato + link para a candidatura, sem descrição), IEO (uma página, id por hash do título), Habilita (WP).
3. Perguntar ao dono do projecto se aceita correr leitores IT de um IP italiano (GSD, HSR, GVM, Dr. Max, Diaverum): +~390 vagas brutas.
4. Rever em 30 dias: Bianalisi e Colosseum Dental (0 vagas hoje), Santagostino (achar o host Teamtailor oficial de forma legítima), Don Gnocchi (se Steps tiver API pública documentada).
5. Marcar `employer_type=private`, `source=...` e deduplicar por (empregador, local, título); contratos "libera professione" (Affidea) devem ficar com etiqueta própria.
