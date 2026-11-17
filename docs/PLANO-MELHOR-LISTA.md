# Plano "A melhor lista" — VagaSaúde PT · BR · ES · IT

Estado: **proposta, por aprovar** (2026-11-17). Nada foi implementado.
Levantamento da concorrência que sustenta o plano: `pesquisa-concorrencia-2026-11-17/{pt,br,es,it}.md`
(fora do repositório, na raiz do projeto).

## 1. Intenção

Nas palavras do dono: *"a melhor lista, onde os profissionais, quando estão a pensar em mudar de
emprego, pensam em nós"*. E na lista, *"uma zona de anunciantes colocarem um anúncio, com pagamentos"*.

Não é o site onde o profissional vai todos os dias; é o site para onde vai no momento em que decide
mudar. Isso exige duas coisas: que a lista seja objetivamente a melhor quando chega (completa, limpa
e feita para decidir) e que já tenha ouvido falar de nós antes (alertas, redes, Telegram).

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- Ter, em cada mercado, todas as vagas de saúde (públicas, privadas, IPSS/filantrópicas, agências) numa
  lista sem duplicados nem expiradas, com a data e a fonte visíveis.
- Dar à lista filtros e dados que só um site de saúde pode ter: horário/turnos, setor, salário
  (anunciado ou estimado), recém-licenciado, PCD (BR), remoto.
- Abrir uma fonte de receita própria antes do AdSense: anúncios pagos "Em destaque" na lista.
- Manter o profissional ligado entre mudanças de emprego (alertas por email e Telegram, redes).

**Não-objetivos** (decisões anteriores do dono)
- Perfil do candidato, CV, candidatura no nosso site. A candidatura é sempre no site da entidade.
- App nativa. Fica a web (e, mais tarde, notificações push no browser).
- Conteúdo de "carreira" como produto principal (quizzes de concursos, homologação). Pode vir depois.

**Anti-objetivos** (seria um fracasso mesmo que funcionasse)
- Avaliações de empresas: trazem moderação e risco legal; os generalistas já as têm.
- Muro de registo ou login para ver vagas (o SaudeVagas BR faz isto e é o seu maior defeito).
- Vagas pagas que degradem a lista: anúncios fora de saúde, repetidos ou sem empregador identificado.
- Mostrar salário "estimado" como se fosse anunciado.

## 3. O que o levantamento mostrou (resumo)

| Mercado | Concorrência real | Concorrente direto de saúde |
|---|---|---|
| PT | Indeed, Jooble, Randstad Saúde, bolsas das Ordens | nenhum |
| BR | Vagas.com, Indeed, InfoJobs, apps de plantão (MedShift, Clicknurse, VPS+) | SaudeVagas (fraco, muro de registo) |
| ES | InfoJobs, Indeed, bolsas autonómicas isoladas, Livo (turnos) | portais de saúde mortos ou em construção |
| IT | Concorsando, Concorsipubblici, Indeed | nenhum junta concursos + privado |

Lacunas nossas repetidas em 2+ mercados: push/app; salário na lista e filtro por faixa; PCD (BR) e
remoto (PT/ES); alertas com frequência à escolha e por Telegram/WhatsApp; avaliações de empresa
(descartado, ver anti-objetivos).

Oportunidades que ninguém cobre nos 4: feed único e limpo (concursos + privado + agências) sem
duplicados nem expirados; turnos/plantões como tipo de vaga; salário a três níveis (anunciado,
tabela da carreira, líquido); via para recém-licenciados e estrangeiros.

**Dados nossos que condicionam o plano** (medidos a 17/11 nas vagas publicadas):

| | PT | BR | ES | IT |
|---|---|---|---|---|
| Com salário anunciado | 7% | 13% | 3% | 2% |
| Com tipo de contrato | 65% | 42% | 74% | 82% |
| Mencionam turnos/horário na descrição | 25% | 30% | 30% | 10% |

Conclusão: "salário na lista" só é possível como **estimativa** a partir das tabelas de carreira que já
temos em `/salarios`, claramente marcada. Os turnos dá para **extrair** do texto e transformar em filtro.

## 4. Decisões assumidas (do autor do plano, a corrigir pelo dono)

O dono ainda não respondeu a duas perguntas; assumi o seguinte para o plano não ficar parado:

1. **O que faz escolher qual vaga abrir:** horário/turnos e salário, por esta ordem. Se o dono vir outra
   coisa (reputação do empregador, distância a casa), a fase 1 muda de ordem.
2. **Quem paga primeiro:** a clínica pequena sem página de carreiras, que publica a vaga sozinha. O
   "destacar esta vaga" para grupos grandes que já aparecem via scraper vem a seguir (2b).
3. **Pagamento:** Stripe Checkout (cartão) em EUR para PT/ES/IT, com recolha do NIF/VAT. No BR, o
   Stripe em BRL/Pix exige entidade brasileira; começar o BR com pedido + fatura manual (ou cartão
   internacional em EUR) e decidir Pix/Mercado Pago quando houver procura.
4. **Preços de arranque** (30 dias, 1 vaga): PT/ES/IT 59 € (destaque simples) e 99 € (destaque +
   email de alertas + post nas redes); BR R$ 149 / R$ 249. Pacotes de 5 com desconto. Ajustar depois
   dos primeiros 10 clientes.
5. **Moderação:** toda a vaga paga passa por aprovação manual no admin antes de publicar (minutos, não
   dias). Reembolso se for recusada.
6. **Onde o destaque aparece:** 2 posições no topo da lista geral, das páginas de categoria e de cidade
   onde a vaga encaixa, com logótipo e selo "Em destaque". Nunca mais de 2, para a lista continuar a
   ser a lista.

## 5. Fases e funcionalidades

### Fase 0 — 26/11, o lote já combinado (1 semana)
Sai no mesmo deploy que o SEO, a performance e o UI/UX pendentes.
- Página `/hoje` (BR, PT, ES, IT): as vagas do post do dia, para o link na bio do Instagram.
- Botão "Receber estas vagas no Telegram" nas páginas de categoria: abre o bot com `start=<profissão>_<local>`;
  o bot guarda a subscrição e envia um digest diário. Reaproveita o bot e o motor dos posts.
- Nos cartões: data de frescura ("há 2 dias") e selo "Nova" (< 24 h). Já temos os dados; é só mostrar.

### Fase 1 — A lista feita para decidir (dezembro, ~2–3 semanas)

**1.1 Horário e turnos como campo e filtro**
- Extrair de título + descrição, no ingest (job-store, partilhado nos 4): `schedule` ∈
  {diurno, noturno, rotativo, fim-de-semana, plantão/12x36 (BR), part-time, full-time}.
  Dicionário por língua; os 25–30% que o mencionam ficam classificados, o resto fica "não indicado".
- Filtro "Horário" na pesquisa e chip no cartão. Página de categoria "Enfermeiro noturno em Lisboa"
  só se houver volume (SEO).
- Qualidade: amostra de 200 vagas por mercado revista à mão antes de ligar o filtro.

**1.2 Salário estimado**
- Quando a vaga não anuncia salário: "Estimativa: 1.500–1.900 €/mês · tabela da carreira", a partir
  de `/salarios` por profissão (+ setor público quando aplicável). Texto e ícone distintos do
  anunciado; tooltip a explicar a origem. Nunca no título nem no JSON-LD (só o anunciado vai ao Google).
- Filtro "Salário mínimo" que usa o anunciado quando existe e a estimativa quando não (com aviso).
- Depende de as tabelas de `/salarios` cobrirem as profissões principais nos 4 mercados; onde não
  cobrirem, não se mostra nada.

**1.3 Sinais de qualidade visíveis**
- No topo da lista: "3.126 vagas · 112 novas hoje · verificadas às 18:33". Sai do que já medimos.
- No cartão: fonte ("via SNS", "via Gupy", "diretamente do empregador") e data.
- Página "Como garantimos a lista" (como-funciona): sem duplicados, expiradas retiradas de 6 em 6 h,
  fontes oficiais. É o argumento de venda contra os generalistas.

**1.4 Filtros de saúde**
- Recém-licenciado / sem experiência (extração: "recém", "júnior", "sem experiência", "neolaureato"…).
- PCD (BR): extração de "PCD", "pessoa com deficiência".
- Remoto / teleconsulta (PT, ES): extração.
- Mantêm-se os que já existem (setor público/privado/IPSS, contrato, local).

**1.5 Ordenação**
- Relevância (atual), mais recentes, salário (anunciado primeiro, depois estimado).

### Fase 2 — Zona de anunciantes (dezembro–janeiro, ~3 semanas)

**2.1 Página `/anunciar`** (PT: "Anunciar vaga"; BR: "Anunciar vaga"; ES: "Publicar oferta"; IT: "Pubblica un annuncio")
- Argumento: "X profissionais de saúde por mês", "a sua vaga no topo da lista e no email de Y pessoas".
- Formulário: empresa, NIF/VAT, email de contacto, logótipo; vaga: título, profissão (lista nossa),
  local (concelho/cidade), contrato, horário, salário (opcional, recomendado), descrição, como candidatar
  (link ou email). Plano e pagamento no fim.
- Pré-visualização do cartão antes de pagar.

**2.2 Pagamento**
- Stripe Checkout (cartão), moeda EUR, com `tax_id_collection`; recibo automático do Stripe.
  Webhook `checkout.session.completed` → encomenda "paga, por aprovar".
- BR: botão "Pedir fatura" (pedido por email, pagamento por transferência/Pix manual) até haver
  entidade brasileira. Reavaliar com os primeiros pedidos.
- Dados: `data/ads-orders.json` (ou tabela no jobs.db): id, mercado, empresa, contacto, plano, valor,
  estado (pendente/paga/aprovada/publicada/expirada/recusada), stripeSessionId, vaga (payload), datas.

**2.3 Admin: fila de anúncios**
- Lista de encomendas com estado; aprovar (publica e marca `featured.until = +30 dias`), recusar (com
  motivo e reembolso no Stripe), editar texto, ver estatísticas.
- A vaga publicada entra no jobs.json/jobs.db com `source = "direct"`, `sector` escolhido, e um
  `featured {plan, until, orderId}`. Expira sozinha; email ao anunciante 3 dias antes com link para renovar.

**2.4 Destaque na lista**
- Componente "Em destaque" (2 cartões no topo, com logótipo e selo) na lista geral, nas páginas de
  categoria e de cidade onde a profissão/local encaixam. Rotação se houver mais de 2 elegíveis.
- Plano 99 €: 1 vaga destacada no topo do email de alertas dessa profissão (máx. 1 por email) e 1 post
  nas redes do mercado (reaproveita `social_post.py`).
- Google: JSON-LD JobPosting normal (é uma vaga real). Sem `rel=sponsored` nos links internos; o
  selo "Em destaque" é visível ao utilizador, como manda a prática.

**2.5 Relatório ao anunciante** (diferenciador barato)
- No fim dos 30 dias: email com visualizações, cliques em candidatar, posição média. Vem do
  `site-stats.json` que já temos. Nenhum concorrente pequeno faz isto.

**2b. "Destacar esta vaga"** (janeiro)
- Botão discreto na página da vaga, "É o empregador? Destaque esta vaga", que pré-preenche o
  formulário de 2.1 com a vaga existente. Para os grupos que já aparecem via scraper.

### Fase 3 — Lembrada (janeiro, ~1–2 semanas)
- Alertas por email com frequência à escolha (imediato/diário/semanal) e filtro de horário.
- Notificações push no browser (Web Push), sobretudo BR, ligadas aos mesmos filtros dos alertas.
- Medir por canal (UTM) o que traz visitas e candidaturas; cortar o que não traz.

### Depois (sem data)
- Mapa com raio de deslocação (PT, ES).
- Páginas por profissão + horário (SEO) quando houver volume.
- Conteúdo de carreira (concursos, homologação, recém-licenciados) se a fase 1–2 estiver estável.
- Pix/Mercado Pago no BR; faturação automática fora do Stripe se a contabilidade exigir.

## 6. Modelo de dados (resumo das alterações)

Vaga (jobs.json / jobs.db), campos novos, todos opcionais:
- `schedule: string | null` — diurno | noturno | rotativo | fim_de_semana | plantao | part_time | full_time
- `flags: { entryLevel?: true, pcd?: true, remote?: true }`
- `salaryEstimate: { min, max, currency, basis: "career_table" } | null` — calculado no ingest, nunca sobrepõe `salary`
- `featured: { plan, until, orderId } | null`
- `source = "direct"` para vagas anunciadas; `sourceId = orderId`

Anúncios: `data/ads-orders.json` (ver 2.2). Estatísticas por vaga: já existem em `site-stats.json`
(`paths`, `applyBySlug`).

Código partilhado nos 4 mercados (job-store, extração, componentes de cartão e filtros): fazer num
mercado, portar aos outros 3 no mesmo lote. Dicionários de extração por língua.

## 7. Esforço e ordem

| Fase | O quê | Esforço (1 pessoa + agentes) | Quando |
|---|---|---|---|
| 0 | /hoje, Telegram por categoria, frescura nos cartões | 3–4 dias | lote de 26/11 |
| 1 | turnos, salário estimado, sinais de qualidade, filtros, ordenação | 10–14 dias (4 mercados) | dezembro |
| 2 | /anunciar, Stripe, admin, destaque, relatório | 12–15 dias | dez.–jan. |
| 2b | "destacar esta vaga" | 2 dias | janeiro |
| 3 | frequência dos alertas, push | 5–8 dias | janeiro |

Ordem dentro da fase 1: 1.3 (sinais) → 1.1 (turnos) → 1.5 (ordenação) → 1.4 (filtros) → 1.2 (salário
estimado; é a mais delicada). A fase 2 pode arrancar em paralelo com a 1.2 porque toca ficheiros
diferentes.

## 8. Como medir se resultou (meta: fevereiro de 2027)

- Lista: % de vagas com horário classificado ≥ 25% (PT/BR/ES); % com salário (anunciado + estimado)
  ≥ 70%; cliques cartão→vaga por visita a subir face a novembro.
- Lembrada: alertas BR 20 → 100; subscritores Telegram por mercado; % de visitas diretas + redes.
- Anunciantes: 10 anúncios pagos no total nos 4 mercados; ≥ 1 renovação; 0 anúncios recusados por
  serem fora de saúde (sinal de que a página explica bem).
- Receita: primeiros 500–1.000 € antes do AdSense (março/abril).

## 9. Riscos

- **Extração de turnos com erros** → filtro mente. Mitigação: amostra manual antes de ligar; "não
  indicado" é melhor do que errado.
- **Salário estimado mal interpretado** → perda de credibilidade. Mitigação: rótulo, tooltip, nunca no
  Google, só onde a tabela existe.
- **Fiscalidade dos anúncios** (IVA por país, fatura): Stripe com NIF/VAT cobre o recibo; confirmar com
  a contabilidade se chega ou se é preciso fatura própria.
- **BR sem Pix** limita as vendas. Mitigação: fatura manual no arranque; decidir entidade mais tarde.
- **Pausa até 26/11**: nada disto toca os sites antes dessa data.
- **4 repositórios**: cada funcionalidade é ×4. Mitigação: fazer no PT ou BR primeiro, portar no
  mesmo lote; testes de extração com fixtures por língua.

## 10. Por decidir pelo dono

1. O que faz escolher qual vaga abrir (ver 4.1): confirma turnos + salário, ou outra coisa?
2. Quem paga primeiro: clínica pequena (assumido) ou grupos grandes?
3. Preços e planos (ver 4.4).
4. Conta Stripe: entidade e país da faturação; BR com fatura manual no arranque?
5. Os anúncios pagos entram nos posts das redes (plano 99 €)? Assumido que sim.
6. Nome do produto nas páginas: "Em destaque" (assumido) ou "Patrocinado"?
