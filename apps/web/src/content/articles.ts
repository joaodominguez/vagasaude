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
 * Guias curtos para quem procura emprego em saúde em Portugal.
 * Sem blog genérico: cada peça aponta para candidatura ou alerta.
 */
export const articles: Article[] = [
  {
    slug: "cv-enfermagem-saude",
    title: "Como fazer um CV para enfermagem e saúde",
    lede:
      "Um CV de saúde lê-se em segundos: título claro, experiência recente e o que o aviso pede. Menos páginas, mais prova.",
    summary:
      "Estrutura de CV para enfermagem, auxiliares e TDT em Portugal: o que incluir, o que cortar e como adaptar ao anúncio.",
    eyebrow: "Candidatura",
    readMinutes: 6,
    publishedAt: "2026-09-14",
    relatedJobsHref: "/vagas/enfermagem",
    relatedJobsLabel: "Ver vagas de enfermagem",
    sections: [
      {
        heading: "O que o recrutador procura primeiro",
        paragraphs: [
          "Em hospitais, clínicas e IPSS o primeiro filtro costuma ser: a categoria profissional, a cédula ou título profissional (quando aplicável), a experiência recente no tipo de serviço e a disponibilidade (turnos, part-time, concelho).",
          "O objectivo do CV não é contar a tua biografia — é mostrar, em uma página (duas no máximo), que cumples o aviso e que vales a pena contactar.",
        ],
      },
      {
        heading: "Estrutura que funciona",
        paragraphs: [
          "Mantém esta ordem; adapta os títulos ao teu percurso, mas não inventes secções decorativas.",
        ],
        bullets: [
          "Cabeçalho: nome, concelho ou distrito, telemóvel, email profissional, LinkedIn (opcional).",
          "Título profissional numa linha: ex. «Enfermeiro/a — urgência / medicina interna» ou «Auxiliar de ação médica».",
          "Resumo de 3–4 linhas: anos de experiência, serviços onde trabalhaste, o que procuras agora.",
          "Experiência (mais recente primeiro): entidade, função, datas, 3–5 bullets com resultados ou responsabilidades concretas.",
          "Formação e cédula: curso, instituição, ano; número de cédula/OE ou equivalente se for relevante.",
          "Competências: software clínico, idiomas, carta de condução — só o que o aviso pede ou o serviço usa.",
        ],
      },
      {
        heading: "Erros frequentes a evitar",
        paragraphs: [],
        bullets: [
          "CV genérico enviado a todos os anúncios — o aviso pede bloco operatório e o CV só fala de lar.",
          "Fotografias, cores excessivas ou tabelas que partem no ATS / PDF.",
          "Listar tarefas óbvias («trabalhei em equipa») sem contexto de serviço ou população.",
          "Omitir meses nas datas ou deixar buracos sem uma linha de explicação curta.",
          "Anexar certificados todos de uma vez — guarda-os para a fase seguinte, salvo se o aviso exigir.",
        ],
      },
      {
        heading: "Antes de enviares",
        paragraphs: [
          "Lê o anúncio outra vez e sublinha requisitos obrigatórios. Se o VagaSaúde te levou à vaga, candidata-te sempre no site da entidade e confirma lá a lista de documentos.",
        ],
      },
    ],
  },
  {
    slug: "carta-apresentacao-hospital",
    title: "Carta de apresentação curta para hospitais e IPSS",
    lede:
      "Meia página chega. Diz quem és, porque este serviço, e o que podes fazer nas primeiras semanas.",
    summary:
      "Modelo curto de carta de apresentação para emprego em saúde: hospitais, clínicas e IPSS — sem floreados.",
    eyebrow: "Candidatura",
    readMinutes: 5,
    publishedAt: "2026-09-14",
    relatedJobsHref: "/vagas",
    relatedJobsLabel: "Procurar vagas",
    sections: [
      {
        heading: "Quando vale a pena",
        paragraphs: [
          "Usa carta quando o aviso a pede, quando a candidatura é por email, ou quando queres destacar uma transição (ex.: medicina interna → urgência). Em formulários online com poucos campos, um parágrafo no campo «mensagem» substitui a carta formal.",
        ],
      },
      {
        heading: "Estrutura em 4 parágrafos",
        paragraphs: [],
        bullets: [
          "1. Função + onde viste o anúncio + disponibilidade para começar.",
          "2. Experiência mais relevante para aquele serviço (não para toda a carreira).",
          "3. Um contributo concreto: o que sabes fazer bem nas primeiras semanas (turnos, população, técnica).",
          "4. Fecho: disponibilidade para conversa, contacto, agradecimento.",
        ],
      },
      {
        heading: "Tom que funciona em saúde",
        paragraphs: [
          "Directo, correcto e sem slogans. Evita «apaixonado pela excelência» e foca serviço, segurança do doente e trabalho em equipa com exemplos curtos.",
          "Se fores para IPSS ou Misericórdia, podes referir experiência com pessoas idosas, cuidados continuados ou comunidade — só se for verdade e estiver no CV.",
        ],
      },
      {
        heading: "Exemplo de abertura",
        paragraphs: [
          "«Candidato-me à função de enfermeiro/a no vosso serviço de medicina interna, anunciada em [fonte]. Tenho X anos de experiência em enfermaria médica e disponibilidade para turnos rotativos a partir de [data].»",
          "A seguir, um parágrafo com a experiência mais próxima do aviso e um fecho com contacto. Guarda o PDF com o nome `Nome_Funcao_Carta.pdf`.",
        ],
      },
    ],
  },
  {
    slug: "ler-aviso-concurso-bep",
    title: "Como ler um aviso de concurso ou anúncio do BEP",
    lede:
      "Nos concursos e no BEP, a letra pequena manda: prazo, requisitos habilitacionais e onde se entrega a candidatura.",
    summary:
      "Guia prático para ler avisos de concurso público e ofertas BEP em saúde: prazos, documentos e armadilhas comuns.",
    eyebrow: "Sector público",
    readMinutes: 7,
    publishedAt: "2026-09-14",
    relatedJobsHref: "/vagas?setor=Público",
    relatedJobsLabel: "Ver vagas no sector público",
    sections: [
      {
        heading: "O que confirmar nos primeiros 2 minutos",
        paragraphs: [],
        bullets: [
          "Data-limite de candidatura (e fuso / hora, se indicada).",
          "Categoria e carreira (enfermeiro, assistente técnico, auxiliar, etc.).",
          "Número de postos e tipo de vínculo (termo certo, indeterminado, mobilidade).",
          "Local de trabalho / ULS / organismo.",
          "Onde e como se candidata (plataforma, email, presencial).",
        ],
      },
      {
        heading: "Requisitos que eliminam cedo",
        paragraphs: [
          "Habilitações, cédula profissional, tempo de experiência e formação específica costumam ser eliminatórios. Se o aviso exige «cédula válida» ou «licenciatura reconhecida em Portugal», não assumes equivalências — confirma antes de investires tempo no processo.",
        ],
      },
      {
        heading: "Documentos típicos",
        paragraphs: [
          "CV, certificados de habilitações, cédula, documentos de identificação e, em muitos concursos, requerimento próprio do aviso. Segue a ordem e os formatos pedidos (PDF, tamanho máximo).",
          "No VagaSaúde resumimos a vaga para pesquisa; o texto oficial do BEP, DRE ou entidade prevalece sempre.",
        ],
      },
      {
        heading: "Armadilhas comuns",
        paragraphs: [],
        bullets: [
          "Candidatar-te no dia-limite sem margem para falhas da plataforma.",
          "Ignorar o método de selecção (avaliação curricular, entrevista, provas).",
          "Confundir «bolsa de reserva» com colocação imediata.",
          "Usar um email pouco profissional ou que não consultas todos os dias — as convocatórias chegam por aí.",
        ],
      },
    ],
  },
  {
    slug: "alertas-emprego-saude",
    title: "Como usar alertas de emprego na saúde",
    lede:
      "Um alerta bem filtrado poupa-te a refrescar sites. Um alerta demasiado largo enche-te a caixa de correio.",
    summary:
      "Como criar alertas úteis no VagaSaúde: profissão, distrito e sector — e o que fazer na primeira semana.",
    eyebrow: "Alertas",
    readMinutes: 4,
    publishedAt: "2026-09-14",
    relatedJobsHref: "/alertas",
    relatedJobsLabel: "Criar alerta",
    sections: [
      {
        heading: "Escolhe filtros que importam",
        paragraphs: [
          "Começa por profissão + distrito (ou concelho, se fores muito móvel). Acrescenta sector (público, privado, IPSS) só se for mesmo um critério de decisão — cada filtro a mais reduz o volume.",
        ],
        bullets: [
          "Exemplo útil: Enfermagem · Braga · Público.",
          "Exemplo demasiado largo: «saúde» em todo o país — vais receber ruído.",
          "Se estás aberto a dois distritos, cria dois alertas em vez de um genérico.",
        ],
      },
      {
        heading: "A primeira semana",
        paragraphs: [],
        bullets: [
          "Confirma o email (double opt-in) para o alerta ficar activo.",
          "Abre 2–3 vagas do digest e verifica se batem certo com o que queres; ajusta filtros se necessário.",
          "Candidata-te cedo nas que forem boas — em saúde o volume de respostas sobe depressa.",
          "Guarda favoritos no VagaSaúde para voltar aos anúncios sem os perder.",
        ],
      },
      {
        heading: "O que o alerta não faz",
        paragraphs: [
          "Não enviamos o teu CV nem candidamo-nos por ti. O email é um aviso: a candidatura continua no site da entidade. Podes gerir ou cancelar o alerta a qualquer momento a partir da ligação no email.",
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
