# Plano de Melhorias — VagaSaúde

> Actualizado em 2026-08-02. Parte do estado real em produção (`vagasaude.pt`),
> não do MVP teórico. Complementa [`ROADMAP.md`](./ROADMAP.md) e [`PLANO.md`](./PLANO.md).

---

## Estado actual (baseline)

| Métrica | Valor |
|--------|------:|
| Vagas publicadas | ~516 |
| Privado / Público | ~499 / ~17 |
| Fontes activas | CUF, Luz, Lusíadas, Trofa, JCS, Champalimaud, Germano de Sousa, HPA, BEP |
| Alertas | Double opt-in, filtros, gestão/unsubscribe (Resend) |
| Persistência | JSON files (`jobs.json`, `alerts.json`, …) |
| Runtime | Next standalone + cron scrapers; app ainda em tmux |
| Backups | Cron diário local (`backup.sh`) |

**Já feito recentemente:** alertas, landings SEO (Fase 1), BEP expandido (catálogo + filtro SNS), HPA, heurísticas Outros, dedupe same-source, filtros mobile, fix de slugs BEP.

**Gaps principais:** teto baixo do BEP (~15–25 ofertas SNS activas no catálogo — não há 150–200 públicas abertas), IPSS/labs ainda a zero, interior/ilhas incompletos, backoffice read-mostly, dados em JSON.

### Fase 2 — Oferta (em curso)

| Prioridade | Item | Estado |
|---|---|---|
| 1 | BEP: ULS/EPE/IPO via catálogo completo + filtro SNS (sem keyword exclusive) | Feito (teto = inventário real BEP) |
| 2 | Fontes privadas em falta (HPA, SAMS, Misericórdias, labs…) | HPA feito; resto por scrapabilidade |
| 3 | Cobertura geográfica (interior + ilhas) | HPA → Faro / Setúbal (Sines) / Madeira |
| 4 | Qualidade: dedupeHash duplicados + Outros | Dedupe same-source + reclassify/collapse API |

---

## Princípios

1. **Utilidade primeiro** — mais vagas relevantes e alertas certos batem design novo.
2. **Uma coisa de cada vez** — blocos pequenos, deployáveis, mensuráveis.
3. **Não partir o que já corre** — migrações (Postgres) com dual-write / fallback.
4. **Métricas-norte** — alertas activos + cliques em “Candidatar”.

---

## Bloco A — Dados e cobertura (maior impacto imediato)

**Objectivo:** equilibrar público/privado e baixar ruído.

| # | Item | Notas | Saída |
|---|------|-------|------|
| A1 | Reduzir “Outros” | Regras EN/PT, pós-ingest reclassify, relatório no admin | Outros &lt; 10% |
| A2 | Mais público além do BEP | Diário da República (avisos), sites ULS com carreiras, INEM/IPST se aplicável | +público estável |
| A3 | IPSS / Misericórdias | 2–3 fontes piloto (ex. UMP, Santa Casa distrital) | sector `ipss` &gt; 0 |
| A4 | Net-Empregos / Indeed saúde | Só se ToS/robots ok; filtrar categoria saúde | volume long-tail |
| A5 | Qualidade Trofa/CUF | Datas, localizações, descrições; testes por fonte | menos `pending_review` |
| A6 | Alerta se scraper falhar | Email admin + badge vermelho se `status=error` ou 0 jobs inesperados | MTTR baixo |

**Ordem sugerida:** A1 → A6 → A2 → A3 → A5 → A4.

---

## Bloco B — Produto / SEO / UX

**Objectivo:** aquisição orgânica + conversão em alertas.

| # | Item | Notas | Saída |
|---|------|-------|------|
| B1 | Landings programáticas | `/vagas/enfermagem`, `/vagas/lisboa`, `/vagas/enfermagem/porto` com copy + JSON-LD ItemList | indexação cauda longa |
| B2 | Filtro contrato + ordenação | `contractType` no URL; ordenar por data / relevância | listagem mais útil |
| B3 | Pesquisa com relevância | Ranking simples (título &gt; empresa &gt; descrição); “vagas semelhantes” melhores | menos abandono |
| B4 | Página Como funciona / FAQ | Explicar candidatura externa, alertas, fontes | confiança |
| B5 | Mapa com polígonos | Distritos clicáveis (já há outline); sync com filtros | engagement homepage |
| B6 | Mobile polish | Sticky “Filtros”, empty states, CTA alerta na listagem filtrada | conversão mobile |
| B7 | Rich Results contínuo | Script CI ou cron a validar 5 `JobPosting` aleatórios | SEO técnico estável |

**Ordem sugerida:** B1 → B2 → B6 → B4 → B3 → B5 → B7.

---

## Bloco C — Backoffice operacional

**Objectivo:** operar o site sem SSH.

| # | Item | Notas | Saída |
|---|------|-------|------|
| C1 | Acções em vagas | Publicar / ocultar / expirar / editar campos chave | CRUD mínimo |
| C2 | Correr scraper manual | Botão no admin → job async + `ScraperRun` | operação 1-clique |
| C3 | GDPR subscritor | Apagar email + deliveries a partir do admin | conformidade |
| C4 | Métricas dashboard | Novas/dia, por fonte, alertas activos, taxa Outros | decisão rápida |
| C5 | Tracking “Candidatar” | Evento leve (GA4 já existe?) ou contador server-side | norte star #2 |
| C6 | Sair do HTTP Basic | Magic link `ADMIN_EMAIL` (+ Cloudflare Access opcional) | auth alinhada ao plano |

**Ordem sugerida:** C1 → C2 → C4 → C3 → C5 → C6.

---

## Bloco D — Infra e fiabilidade (o antigo “plano 3”)

**Objectivo:** deixar de depender de JSON + tmux.

| # | Item | Notas | Saída |
|---|------|-------|------|
| D1 | systemd (app + opcional scrapers) | Units user/system; tirar `@reboot` tmux | restart previsível |
| D2 | Apache VirtualHost ProxyPass | Remover workaround `.htaccess` se ainda existir | proxy limpo |
| D3 | PostgreSQL + Prisma | Schema de `MODELO-DADOS.md`; migrar jobs/alerts/runs | queries + integridade |
| D4 | Dual-write / cutover | JSON→PG com verificação de contagens | zero downtime |
| D5 | Backups off-site | Storage Box + teste de restauro mensal | disaster recovery |
| D6 | Monitorização | Uptime Kuma em `/api/health` + disco + cron scrapers | alertas ops |
| D7 | Testes | Unit (slugify, dedup, guessProfession) + e2e alertas | regressões |

**Ordem sugerida:** D1 → D2 → D6 → D3 → D4 → D5 → D7.

> Nota: backups locais já existem. O salto grande é **D3/D4 (Postgres)**.

---

## Bloco E — Crescimento (depois do polish)

| # | Item | Notas |
|---|------|-------|
| E1 | Soft launch dirigido | Escolas de enfermagem, grupos LinkedIn, ordens |
| E2 | Guias SEO | “Concursos BEP enfermagem”, “Como ler um aviso ULS” |
| E3 | Vagas em destaque | Primeira monetização (pagamento manual no início) |
| E4 | Conta empregador | Publicação self-serve (só após E3 validar procura) |
| E5 | Parcerias fontes | Pedir feeds oficiais a grupos privados |
| E6 | Analytics de funil | alerta criado → confirmado → digest aberto → candidatar |

---

## Ordem de execução recomendada

```
A (dados) ──┬──► B (SEO/UX) ──► E (crescimento)
            │
            └──► C (backoffice) em paralelo com B
            │
            └──► D (infra) em paralelo assim que A1/A6 estáveis
```

### Sequência prática (próximos passos)

1. **A1 + A6** — qualidade + alertas de falha de scraper  
2. **B1** — landings SEO (maior alavanca de tráfego)  
3. **D1 + D2 + D6** — endurecer ops sem migrar BD ainda  
4. **C1 + C2 + C4** — backoffice útil  
5. **D3 + D4** — PostgreSQL  
6. **A2 + A3** — mais público e IPSS  
7. **B2–B6 + C3–C5** — polish produto  
8. **E1–E3** — distribuição e primeira receita  

---

## Critérios de sucesso por horizonte

### Curto prazo
- [ ] Outros &lt; 10% das vagas publicadas  
- [ ] Scraper em falha notifica admin em &lt; 1 ciclo de cron  
- [ ] ≥ 5 landings indexáveis (profissão e/ou distrito)  
- [ ] App sob systemd (sem tmux no reboot)  

### Médio prazo
- [ ] PostgreSQL em produção; JSON só como backup legado  
- [ ] Público ≥ 50 vagas activas (BEP + outras)  
- [ ] Admin consegue ocultar vaga e disparar scrape sem SSH  
- [ ] Lighthouse listagem ≥ 90 (perf + a11y + SEO)  

### Longo prazo
- [ ] 100+ alertas activos  
- [ ] Funil candidatar mensurável  
- [ ] Primeira vaga paga em destaque  

---

## Fora de âmbito (agora)

- App móvel nativa  
- Matching com IA  
- Candidatura interna (sempre redirect para a fonte)  
- Expansão Espanha (`vagasalud.es`)  

---

## Como usar este documento

- Escolher **um bloco** (ou 2 itens do topo da sequência) por iteração.  
- Cada item deve fechar com deploy + verificação em produção.  
- Actualizar a tabela “Estado actual” no topo quando o baseline mudar.
