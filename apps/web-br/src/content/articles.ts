export type ArticleSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type Article = {
  slug: string;
  title: string;
  lede: string;
  summary: string;
  eyebrow: string;
  readMinutes: number;
  publishedAt: string;
  sections: ArticleSection[];
  relatedJobsHref: string;
  relatedJobsLabel: string;
};

/**
 * Guias curtos para quem busca emprego em saúde no Brasil.
 * Sem blog genérico: cada peça aponta para candidatura ou alerta.
 */
export const articles: Article[] = [
  {
    slug: "cv-enfermagem-saude",
    title: "Como fazer um currículo para enfermagem e saúde",
    lede:
      "Um currículo de saúde se lê em segundos: título claro, experiência recente e o que o anúncio pede. Menos páginas, mais prova.",
    summary:
      "Estrutura de currículo para enfermagem, técnico de enfermagem e profissionais de saúde no Brasil: o que incluir, o que cortar e como adaptar à vaga.",
    eyebrow: "Candidatura",
    readMinutes: 6,
    publishedAt: "2026-10-01",
    relatedJobsHref: "/vagas/enfermagem",
    relatedJobsLabel: "Ver vagas de enfermagem",
    sections: [
      {
        heading: "O que o recrutador procura primeiro",
        paragraphs: [
          "Em hospitais, clínicas, redes privadas e unidades do SUS o primeiro filtro costuma ser: a função (enfermeiro, técnico de enfermagem, auxiliar), o registro profissional (COREN, CRM, CREFITO etc., quando aplicável), a experiência recente no tipo de serviço e a disponibilidade (plantão, escala 12×36, CLT ou PJ).",
          "O objetivo do currículo não é contar a biografia — é mostrar, em uma página (duas no máximo), que você atende ao anúncio e vale a pena ser contactado.",
        ],
      },
      {
        heading: "Estrutura que funciona",
        paragraphs: [
          "Mantenha esta ordem; adapte os títulos ao seu percurso, mas não invente seções decorativas.",
        ],
        bullets: [
          "Cabeçalho: nome, cidade e UF, celular com DDD, e-mail profissional, LinkedIn (opcional).",
          "Título profissional em uma linha: ex. «Enfermeiro(a) — UTI / pronto-socorro» ou «Técnico(a) de enfermagem — clínica médica».",
          "Resumo de 3–4 linhas: anos de experiência, setores onde atuou, o que busca agora (CLT, plantão, cidade).",
          "Experiência (mais recente primeiro): instituição, função, datas, 3–5 bullets com responsabilidades concretas (unidade, população, procedimentos).",
          "Formação e registro: curso, instituição, ano; número do COREN/CRM ou equivalente se for relevante para a vaga.",
          "Competências: sistemas hospitalares, idiomas, CNH — só o que o anúncio pede ou o serviço usa.",
        ],
      },
      {
        heading: "Erros frequentes a evitar",
        paragraphs: [],
        bullets: [
          "Currículo genérico enviado a todos os anúncios — a vaga pede centro cirúrgico e o CV só fala de home care.",
          "Fotos, cores excessivas ou tabelas que quebram no ATS / PDF.",
          "Listar tarefas óbvias («trabalhei em equipe») sem contexto de unidade ou perfil de paciente.",
          "Omitir meses nas datas ou deixar lacunas sem uma linha curta de explicação.",
          "Anexar todos os certificados de uma vez — guarde-os para a próxima etapa, salvo se o edital ou o anúncio exigir.",
        ],
      },
      {
        heading: "Antes de enviar",
        paragraphs: [
          "Leia o anúncio outra vez e destaque requisitos obrigatórios. Se o VagaSaúde levou você à vaga, candidate-se sempre no site da instituição e confirme lá a lista de documentos.",
        ],
      },
    ],
  },
  {
    slug: "carta-apresentacao-hospital",
    title: "Carta de apresentação curta para hospitais e redes de saúde",
    lede:
      "Meia página basta. Diga quem você é, por que este serviço, e o que pode entregar nas primeiras semanas.",
    summary:
      "Modelo curto de carta de apresentação para emprego em saúde no Brasil: hospitais, clínicas, SUS e redes privadas — sem floreios.",
    eyebrow: "Candidatura",
    readMinutes: 5,
    publishedAt: "2026-10-01",
    relatedJobsHref: "/vagas",
    relatedJobsLabel: "Buscar vagas",
    sections: [
      {
        heading: "Quando vale a pena",
        paragraphs: [
          "Use carta quando o anúncio pedir, quando a candidatura for por e-mail, ou quando quiser destacar uma transição (ex.: clínica médica → pronto-socorro). Em formulários online com poucos campos, um parágrafo no campo «mensagem» substitui a carta formal.",
        ],
      },
      {
        heading: "Estrutura em 4 parágrafos",
        paragraphs: [],
        bullets: [
          "1. Função + onde viu a vaga + disponibilidade para começar (e regime: CLT, PJ ou plantão).",
          "2. Experiência mais relevante para aquele serviço (não para toda a carreira).",
          "3. Uma contribuição concreta: o que sabe fazer bem nas primeiras semanas (escala, perfil de paciente, técnica).",
          "4. Fecho: disponibilidade para conversa, contato, agradecimento.",
        ],
      },
      {
        heading: "Tom que funciona em saúde",
        paragraphs: [
          "Direto, correto e sem slogans. Evite «apaixonado pela excelência» e foque serviço, segurança do paciente e trabalho em equipe com exemplos curtos.",
          "Se for para hospital filantrópico, Santa Casa ou unidade do SUS, pode referir experiência com alta demanda, urgência ou atenção básica — só se for verdade e estiver no currículo.",
        ],
      },
      {
        heading: "Exemplo de abertura",
        paragraphs: [
          "«Venho me candidatar à vaga de enfermeiro(a) no serviço de clínica médica, anunciada em [fonte]. Tenho X anos de experiência em enfermaria e disponibilidade para escala 12×36 a partir de [data].»",
          "Em seguida, um parágrafo com a experiência mais próxima do anúncio e um fecho com contato. Salve o PDF com o nome `Nome_Funcao_Carta.pdf`.",
        ],
      },
    ],
  },
  {
    slug: "ler-edital-concurso-saude",
    title: "Como ler um edital de concurso público em saúde",
    lede:
      "No concurso público, a letra miúda manda: prazo, requisitos e onde enviar a inscrição. Um detalhe perdido custa a vaga.",
    summary:
      "Guia prático para ler editais de concurso e processos seletivos em saúde no Brasil: prazos, documentos e armadilhas comuns (SUS, prefeituras, estados).",
    eyebrow: "Setor público",
    readMinutes: 7,
    publishedAt: "2026-10-01",
    relatedJobsHref: "/vagas?setor=Público",
    relatedJobsLabel: "Ver vagas no setor público",
    sections: [
      {
        heading: "O que confirmar nos primeiros 2 minutos",
        paragraphs: [],
        bullets: [
          "Data-limite de inscrição (e horário, se indicado).",
          "Cargo e nível (enfermeiro, técnico de enfermagem, auxiliar, médico, etc.).",
          "Número de vagas, cadastro de reserva e tipo de vínculo (estatutário, CLT, temporário).",
          "Local de lotação / município / UF / órgão.",
          "Onde e como se inscrever (site da banca, portal do município, presencial).",
        ],
      },
      {
        heading: "Requisitos que eliminam cedo",
        paragraphs: [
          "Escolaridade, registro no conselho (COREN, CRM etc.), tempo de experiência e formação específica costumam ser eliminatórios. Se o edital exige «registro ativo» ou «diploma reconhecido no Brasil», não assuma equivalências — confirme antes de investir tempo no processo.",
        ],
      },
      {
        heading: "Documentos típicos",
        paragraphs: [
          "Currículo, diplomas, comprovante de registro profissional, documentos de identificação e, em muitos concursos, formulário próprio da banca. Siga a ordem e os formatos pedidos (PDF, tamanho máximo).",
          "No VagaSaúde resumimos a vaga para pesquisa; o texto oficial do edital, Diário Oficial ou órgão exigente prevalece sempre.",
        ],
      },
      {
        heading: "Armadilhas comuns",
        paragraphs: [],
        bullets: [
          "Inscrever-se no dia-limite sem margem para falhas da plataforma ou boleto.",
          "Ignorar o método de seleção (prova objetiva, títulos, entrevista, análise curricular).",
          "Confundir cadastro de reserva com nomeação imediata.",
          "Usar um e-mail pouco profissional ou que você não consulta todos os dias — convocações chegam por aí.",
        ],
      },
    ],
  },
  {
    slug: "alertas-emprego-saude",
    title: "Como usar alertas de emprego na saúde",
    lede:
      "Um alerta bem filtrado poupa você de atualizar sites. Um alerta amplo demais enche a caixa de entrada.",
    summary:
      "Como criar alertas úteis no VagaSaúde Brasil: profissão, estado (UF) e setor — e o que fazer na primeira semana.",
    eyebrow: "Alertas",
    readMinutes: 4,
    publishedAt: "2026-10-01",
    relatedJobsHref: "/alertas",
    relatedJobsLabel: "Criar alerta",
    sections: [
      {
        heading: "Escolha filtros que importam",
        paragraphs: [
          "Comece por profissão + estado (UF). Acrescente setor (público, privado, filantrópico) só se for mesmo um critério de decisão — cada filtro a mais reduz o volume.",
        ],
        bullets: [
          "Exemplo útil: Enfermagem · São Paulo · Público.",
          "Exemplo amplo demais: «saúde» em todo o Brasil — você vai receber ruído.",
          "Se está aberto a dois estados, crie dois alertas em vez de um genérico.",
        ],
      },
      {
        heading: "A primeira semana",
        paragraphs: [],
        bullets: [
          "Confirme o e-mail (double opt-in) para o alerta ficar ativo.",
          "Abra 2–3 vagas do digest e veja se batem com o que você quer; ajuste filtros se necessário.",
          "Candidate-se cedo nas que forem boas — em saúde o volume de respostas sobe rápido.",
          "Guarde favoritos no VagaSaúde para voltar aos anúncios sem os perder.",
        ],
      },
      {
        heading: "O que o alerta não faz",
        paragraphs: [
          "Não enviamos o seu currículo nem nos candidatamos por você. O e-mail é um aviso: a candidatura continua no site da instituição. Você pode gerenciar ou cancelar o alerta a qualquer momento a partir do link no e-mail.",
        ],
      },
    ],
  },
];

export function articlesSorted() {
  return [...articles].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
}

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug) ?? null;
}
