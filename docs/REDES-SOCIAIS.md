# Redes sociais — VagaSaúde BR

Proposta aprovada pelo dono do projeto a 2026-11-16. O BR é o primeiro mercado; PT, ES e IT seguem
o mesmo modelo depois de validado aqui.

## Objetivo

- Trazer visitas que não dependem do Google (o BR perdeu ~80% dos cliques orgânicos depois do
  incidente de 2026-10-27 e está em recuperação).
- Aumentar a procura direta pela marca e os subscritores de alertas por e-mail (16 no BR em 2026-11-16).
- Criar audiência por mercado que mais tarde suporte posts patrocinados de empregadores (plano de
  monetização).

Não mexe nos sites: corre fora da app, por isso pode avançar durante o congelamento até 2026-11-26.

## O post diário: "as vagas mais procuradas"

Um único post por dia e por canal, com 3–4 vagas. Nunca uma vaga por post (as redes tratam isso
como spam e cortam o alcance).

### Regra de seleção

1. **Pontuação** = visualizações da página da vaga + 3 × cliques em "candidatar", nas últimas 48 h
   (à segunda-feira conta o fim de semana inteiro). Fonte: `data/site-stats.json` (`paths`,
   `applyBySlug`), que são as estatísticas próprias do site, sem cookies.
2. **Filtros:** vaga publicada; publicada há ≤ 14 dias; empregador identificado (sem "confidencial",
   "empresa anunciante"…); fora de banco de talentos, aprendiz, estágio e funções não clínicas;
   não publicada nas redes nos últimos 7 dias.
3. **Variedade:** no máximo 1 vaga por empresa e 1 por profissão. Administrativo, Gestão e Outros
   só entram se faltarem vagas clínicas.
4. **Reserva:** se houver poucas vagas com sinal, completar com as mais recentes de empregadores
   conhecidos.

Exemplo real (fim de semana 2026-11-14/15): Técnico de Enfermagem (Unimed Guarulhos, Guarulhos/SP),
Fisioterapeuta (Fundação José Silveira, Salvador/BA), Farmacêutico(a) (Clamed, Blumenau/SC) e
Técnico de Nutrição (CEMA Hospital Especializado, São Paulo/SP).

### Formatos

| Canal | Conteúdo | Automação |
|---|---|---|
| Instagram | Carrossel 1080×1350: capa + 1 imagem por vaga + imagem final "Receba vagas como estas no seu e-mail"; legenda com a lista e hashtags; "link na bio" | Sim (API Meta, conta Business) |
| Facebook | Imagem única 1080×1080 com as 4 vagas + texto com o link de cada vaga | Sim (API Meta, página) |
| Telegram | A mesma imagem + texto com links | Sim (bot, gratuito) |
| Canal de WhatsApp | A mesma imagem + texto com links | **Manual** (não há API pública para canais): o pacote do dia chega ao dono às 7h30 (Brasília) e a publicação leva < 1 min |
| LinkedIn | Mais tarde, semanal; a API exige aprovação | Manual |

- Visual: cores e logo da marca (azul #072f5f, verde #16a6aa), letra Outfit, texto em pt-BR.
- Todos os links levam UTM: `utm_source=<canal>&utm_medium=social&utm_campaign=top-vagas-AAAA-MM-DD`.
- Hora de publicação: 8h de Brasília.
- Exemplos gerados: `docs/redes-sociais/exemplo-2026-11-17/`.

### Outros posts (depois do diário estar estável)

- Semanal: concursos públicos de saúde da semana e as empresas com mais vagas.
- Mensal: números do mercado (salários, profissões mais procuradas) a partir de `/dados`.

## Medição

- Analytics por `utm_source`: visitas, cliques em "candidatar" e novos alertas por canal.
- Seguidores por canal, semanalmente.
- Meta para meados de dezembro: alertas BR 16 → 100.

## Estado (2026-11-16): em produção

| Canal | Conta | Publicação |
|---|---|---|
| Telegram | t.me/vagasaudebr (bot @vagasaudebr_bot) | automática, 8h Brasília |
| Facebook | facebook.com/vagasaudebr | automática, 8h Brasília (imagem única + links) |
| Instagram | instagram.com/vagasaudebr | automática, 8h Brasília (carrossel de 6) |
| Canal de WhatsApp | whatsapp.com/channel/0029Vb9QPDsLY6dDeq2VVQ2i | manual: pacote por e-mail às 7h30 |

- Script: `scrapers-br/social/social_post.py` → servidor `/var/www/vagasaudebr/scrapers/social/`, venv `/home/portal/.venvs/social`.
- Cron (portal): `30 10 * * *` `--deliver` (gera o pacote e envia o e-mail do WhatsApp) e `0 11 * * *` `--publish`.
- Credenciais: `/home/portal/.config/vagasaude/social-br.json` (chmod 600): bot do Telegram, token da página
  (system user "publicador" do portefólio Meta "VagaSaúde Brasil", app "VagaSaude Publicador", sem expiração), IDs da página e do Instagram.
- Instagram: a API só aceita imagens por URL; o script carrega-as na página como fotos não publicadas, usa o URL do CDN e apaga-as no fim.
- Registos: `data/social.log`, pacotes em `data/social/AAAA-MM-DD/` (30 dias), `published.json` por pacote (não publica 2x), `data/social-state.json` (não repete vagas em 7 dias).
- Site: "Siga-nos" com os 4 canais no rodapé e no menu do telemóvel (`apps/web-br/src/components/social-links.tsx`).

## Protótipo

- `prototipo/social_pick_br.py`: escolhe as vagas no servidor (só leitura): `ssh root@… 'python3 -' < social_pick_br.py`.
- `prototipo/social_render.py`: gera o carrossel, a imagem única e os textos. Depende de ficheiros
  de trabalho fora do repositório (geometria do logo e fonte Outfit convertida); a versão de
  produção vai ser autónoma.
