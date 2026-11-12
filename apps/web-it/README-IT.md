# Offerte Sanità (apps/web-it) — notas de adaptação

Versão italiana (it-IT) do agregador de emprego em saúde, para **offertesanita.it**.
Preparada **apenas localmente** a partir de `apps/web-es`. Nada foi enviado para servidor, DNS,
Cloudflare, Resend ou GitHub. `apps/web-es` ficou intacto neste branch (`it/inicial`) e pode ser
removido mais tarde.

## O que foi adaptado
- Todo o texto de UI, metadados, JSON-LD (`JobPosting`, `inLanguage` it-IT, `addressCountry` IT, moeda EUR),
  emails/alertas, área admin, páginas de erro, consentimento de cookies e páginas legais, em italiano.
- Rotas: `/offerte`, `/offerte/[slug]`, `/offerte/[professione|regione]/[...]` (+ `/pagina-N`, províncias),
  `/concorsi` (+ profissão / profissão×região), `/aziende`, `/dati`, `/stipendi`, `/contatti` (nova),
  `/privacy`, `/cookie`, `/note-legali`, `/come-funziona`, `/avvisi` (+ `gestisci`, `conferma`), `/preferiti`,
  `/notizie`, `/admin/{offerte,fonti,avvisi,statistiche,scrapers,sistema}`. APIs `/api/*` mantêm nomes em inglês.
- Parâmetros de `/offerte`: `q`, `regione`, `professione`, `settore`, `contratto`, `periodo`, `ordina`, `pagina`.
- Geografia: as 20 regioni (etiquetas oficiais) em `src/lib/italy-map.ts`; províncias → região em
  `src/lib/provinces.ts` (gerado de `scrapers-it/common/normalize.py`); cidades → região nos scrapers.
  Mapa SVG derivado de **Natural Earth** (domínio público, `ne_10m_admin_1_states_provinces` 5.1.1), províncias
  dissolvidas por região e simplificadas. Cabeçalho de `italy-map.ts` cita a fonte.
- Categorias (slugs): medicina, infermieristica, oss, fisioterapia, tecnici-sanitari, ostetricia, farmacia,
  psicologia, odontoiatria, veterinaria, servizio-sociale, nutrizione-dietistica, logopedia-riabilitazione,
  ottica-audiometria, amministrativo, gestione-supporto, formazione; fallback `altro`.
  Regras de classificação iguais em `src/lib/job-store.ts` e `scrapers-it/common/normalize.py`.
- Tipos de oferta pública (`src/lib/job-type.ts`): `concorso`, `graduatoria`, `mobilita`, `tempo_determinato`,
  `incarico` (libero-professionale), `offerta`. `/concorsi` lista todos os públicos exceto `offerta`.
- Setores: Pubblico / Privato / Accreditato (internamente `pubblico|privato|accreditato` na ingestão).
- Contratos agrupados (`src/lib/contracts.ts`): Tempo pieno, Part-time, Turni, Libero professionale,
  Tempo indeterminato, Tempo determinato.
- Titular legal: igual ao site ES (`src/lib/legal.ts`, Truecode, Lda.). Email de contacto `contatti@offertesanita.it`.
- Variáveis de ambiente (`.env.example`, sem segredos): `NEXT_PUBLIC_SITE_URL=https://offertesanita.it`,
  GA/Clarity vazios por defeito (não carregam sem ID e sem consentimento; consentimento agora é opt-in),
  `JOB_STORE` e repositório SQLite como no ES.
- Removido do ES: simulador de salário líquido (IRPF/Seg. Social), tabelas salariais, logos de parceiros
  (`public/partners/`), artigos de notícias, fontes espanholas (`sources.ts` vazio).

## Decisões a confirmar
- Marca: "Offerte Sanità" (com acento); domínio sem acento.
- Rotas e nomes das categorias acima (ex.: "OSS", "Tecnici sanitari", "Logopedia e riabilitazione").
- `/concorsi` inclui avvisi a tempo determinato e incarichi públicos (no ES `temporal` ficava fora de `/oposiciones`).
- Consentimento de analytics opt-in (no ES era opt-out) — alinhado com as diretrizes do Garante.
- `LEGAL_LAST_UPDATED` definido como 12 novembre 2026; rever textos legais com o titular/jurista.

## TODO (tudo depende de aprovação do utilizador)
- **Dados salariais**: `salary-benchmarks.ts` / `salary-tables.ts` vazios; `/stipendi` mostra "dados em preparação"
  (noindex) e está fora de menus e sitemap. Só preencher com fonte pública citada (p. ex. CCNL Sanità).
- **Fontes/parceiros**: `src/lib/sources.ts` vazio; escolher fontes após a investigação em `docs/it/`, escrever
  scrapers em `scrapers-it/sources/` (ver `_template.py`) e só então registar logos com licença verificada.
- **Mapa**: gerado com Natural Earth; rever posição dos marcadores (ponto representativo da região).
- **Províncias**: a tabela cidade→província só cobre capoluoghi; falta tabela ISTAT comune→provincia.
  Rever o assetto das províncias sardas (reforma 2025).
- **Notícias/guias**: `content/notizie/` vazio; escrever artigos em italiano antes de mostrar a secção.
- **Caixa de email** `contatti@offertesanita.it` **ainda não existe**; também `avvisi@offertesanita.it` (EMAIL_FROM).
- **Analytics**: criar propriedades GA4/Clarity próprias para o IT.
- **Deploy**: porta 3014, Apache vhost, Cloudflare (cache rules), Search Console, Resend (domínio de envio),
  `run-scrapers.sh` de `scrapers-it` (placeholder) — nada feito.
- Comentários em `globals.css` e `partners.module.css`/`card-icons.tsx` ainda em PT/ES (não visíveis ao utilizador).
