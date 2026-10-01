const WHITESPACE_RE = /\s+/g;
const ELLIPSIS_RE = /(?:\u2026|\.{2,})\s*$/;

// Prefixes típicos de avisos públicos / DRE / BEP / ULS / IPST.
const PREFIX_RE =
  /^(?:(?:abertura\s+d[ae]\s+)?procedimento\s+concursal\s*(?:\(?(?:comum|urgente|simplificado)\)?\s*)*(?:com\s+car[aá]ter\s+urgente\s*)?(?:conducente\s+(?:ao\s+)?(?:recrutamento|à\s+constitui[cç][aã]o)[^.]*?)?(?:para\s+)?|(?:com\s+vista\s+[aà]\s+)?contrata[cç][aã]o\s+de\s+|constitui[cç][aã]o\s+de\s+bolsa\s+de\s+reservas?\s+(?:de\s+)?|constitui[cç][aã]o\s+de\s+reserva\s+de\s+recrutamento\s+(?:para\s+)?|reserva\s+de\s+recrutamento\s+(?:para\s+)?|recrutamento\s+(?:de\s+|por\s+mobilidade\s+para\s+)?|call\s+for\s+(?:the\s+)?recruitment\s+of\s+|call\s+for\s+(?:one\s+|1\s+)?|an[uú]ncio\s+de\s+abertura\s+(?:de\s+)?|aviso\s+(?:de\s+abertura\s+)?(?:de\s+)?)/i;

const MID_NOISE_RE =
  /(?:,\s*)?(?:na|com)\s+modalidade\s+de\s+v[ií]nculo[^,.;]*|(?:,\s*)?(?:em\s+regime\s+de\s+)?contrato\s+(?:de\s+trabalho\s+)?(?:em\s+fun[cç][oõ]es\s+p[uú]blicas\s+)?(?:por\s+tempo\s+indeterminado|a\s+termo)[^,.;]*|(?:,\s*)?contrato\s+individual\s+de\s+trabalho[^,.;]*|(?:,\s*)?do\s+mapa\s+de\s+pessoal[^,.;]*|(?:,\s*)?rem\s+r[^,.;]*|(?:,\s*)?cit\s+(?:a\s+termo)?[^,.;]*|(?:,\s*)?m\s*\/\s*f\.?|(?:,\s*)?proc\.?\s*ci[\s./\d-]+|(?:,\s*)?\(?(?:compete|feder|pi|ga)\d[^)]*\)?/gi;

const COUNT_PATTERNS = [
  /(?:preenchimento|ocupa[cç][aã]o|contrata[cç][aã]o|recrutamento)\s+(?:de\s+)?(?:um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|dezanove|\d+)\s*\(?(\d+)\)?\s+postos?\s+de\s+trabalho/i,
  /(\d+)\s+postos?\s+de\s+trabalho/i,
  /\((\d+)\)\s*(?:postos?|profissionais?|vagas?)/i,
  /contrata[cç][aã]o\s+de\s+(\d+)\s+/i,
  /recrutamento\s+de\s+(\d+)\s*\(?/i,
];

const ROLE_PATTERNS = [
  /categorias?\s+de\s+(.+?)(?=,\s*da\s+carreira|,?\s*na\s+modalidade|,?\s*do\s+mapa|,?\s*em\s+regime|\s+[—\-–―]\s*|\s+para\s+a\s+|\s*$)/i,
  /carreira\s+(?:especial\s+)?(?:de\s+)?(.+?)(?=,\s*categoria|,?\s*na\s+modalidade|,?\s*do\s+mapa|\s+[—\-–―]\s*|\s*$)/i,
  /(?:sele[cç][aã]o|contrata[cç][aã]o|recrutamento|reserva\s+de\s+recrutamento)\s*(?:e\s+sele[cç][aã]o\s+)?(?:de\s+|para\s+|[—\-–―]\s*)?(.+?)(?=,\s*da\s+carreira|,?\s*na\s+modalidade|,?\s*do\s+mapa|\s+[—\-–―]\s*|\s+para\s+a\s+|\s*$)/i,
  /bolsa\s+de\s+reservas?\s+(?:de\s+)?(.+?)(?=\s+[—\-–―]\s*|\s+para\s+o\s+|\s+para\s+a\s+|\s*$)/i,
  /(?:postos?\s+de\s+trabalho|profissional(?:ais)?)\s+(?:vagos?\s+)?(?:na\s+)?(?:categoria\s+de\s+)?(.+?)(?=,|\s+[—\-–―]\s*|\s*$)/i,
];

const SPECIALTY_RE =
  /(?:[—\-–―]\s*|[,.]\s*área\s+de\s+exerc[ií]cio\s+(?:profissional\s+)?(?:de\s+|em\s+|—\s*|-\s*)?|[,.]\s*área\s+hospitalar\s*(?:de\s+|em\s+|—\s*|-\s*)?|[,.]\s*especialidade\s+(?:de\s+|em\s+)?|[,.]\s*profiss[aã]o\s+de\s+|\s+para\s+(?:o|a)\s+(?:servi[cç]o|setor|unidade)\s+de\s+)(.+?)(?=\s*[.;]|\s*$|,?\s*(?:da\s+carreira|na\s+modalidade|cit\b|rem\b|contrato|proc\.?))/i;

const TSDT_PROFESSION_RE =
  /(?:t[eé]cnicos?\s+superior(?:es)?\s+(?:das\s+\w+\s+de\s+|de\s+)?diagn[oó]stico\s+e\s+terap[eê]utica)\s*(?:[—\-–―,]\s*|\s+)(?:profiss[aã]o\s+de\s+)?(fisioterap\w*|radioterap\w*|medicina\s+nuclear|anatomia\s+patol\w*|cardiopneumolog\w*|ortoptic\w*|audiolog\w*|diet[eé]tica\w*|terapia\s+da\s+fala|terapia\s+ocupacional|farm[aá]cia)/i;

const TRAILING_JUNK_RE =
  /(?:,?\s*(?:da|de)\s+carreira(?:\s+\w+){0,4})?(?:,?\s*ou\s+equiparada)?(?:,?\s*m\s*\/\s*f\.?)?(?:,?\s*\d{4})?\s*$/i;

const BUREAUCRATIC_HINT_RE =
  /procedimento\s+concursal|posto(?:s)?\s+de\s+trabalho|v[ií]nculo\s+de\s+emprego|mapa\s+de\s+pessoal|reserva\s+de\s+recrutamento|bolsa\s+de\s+reserva|categoria\s+de\s+|carreira\s+(?:especial\s+)?de\s+|modalidade\s+de\s+v[ií]nculo|abertura\s+de\s+procedimento|call\s+for\s+|contrata[cç][aã]o\s+de\s+\d+/i;

const WORD_COUNTS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  três: 3,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  dezanove: 19,
};

function normalizeAsciiLower(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase();
}

function titleCasePt(text: string): string {
  const small = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "em",
    "para",
    "na",
    "no",
    "nas",
    "nos",
    "a",
    "o",
    "as",
    "os",
    "com",
    "ou",
    "por",
  ]);
  const acronyms: Record<string, string> = {
    tdt: "TDT",
    tsdt: "TSDT",
    mgf: "MGF",
    cit: "CIT",
    scp: "SCP",
    ipst: "IPST",
    inem: "INEM",
    uls: "ULS",
    sns: "SNS",
    teph: "TEPH",
  };

  const parts: string[] = [];
  const tokens = text.split(/(\s+|\/|—|-)/);
  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    if (!raw || /^(\s+|\/|—|-)$/.test(raw)) {
      parts.push(raw);
      continue;
    }
    const key = raw.toLowerCase();
    if (key in acronyms) {
      parts.push(acronyms[key]);
    } else if (i > 0 && small.has(key)) {
      parts.push(key);
    } else if (raw === raw.toUpperCase() && raw.length <= 4) {
      parts.push(raw);
    } else {
      parts.push(raw ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : raw);
    }
  }
  return parts.join("").replace(/^[ ,;—\-]+|[ ,;—\-]+$/g, "");
}

function cleanRole(role: string): string {
  role = role.replace(WHITESPACE_RE, " ").replace(/^[ ,;—\-–―.]+|[ ,;—\-–―.]+$/g, "");
  role = role.replace(/^(?:um|uma|dois|duas|tr[eê]s|\d+)\s+/i, "");
  role = role.replace(/^para\s+/i, "");
  role = role.replace(/^(?:profissional(?:ais)?\s+para\s+(?:a\s+)?)?/i, "");
  role = role.replace(/^pessoal\s+/i, "");
  role = role.replace(/\s+vagos?\b/i, "");
  role = role.replace(/\s+da\s+carreira(?:\s+\w+){0,6}$/i, "");
  role = role.replace(/\s+ou\s+equiparada$/i, "");
  role = role.replace(/^assistentes\s+operacionais\b/i, "Assistente Operacional");
  role = role.replace(/^assistentes\b/i, "Assistente");
  role = role.replace(/^enfermeiros\b/i, "Enfermeiro");
  role = role.replace(/^m[eé]dicos\b/i, "Médico");
  role = role.replace(/^t[eé]cnicos?\s+superior(?:es)?\b/i, "Técnico Superior");
  role = role.replace(/^t[eé]cnicos?\s+auxiliares?\b/i, "Técnico Auxiliar");
  role = role.replace(/\boperacionais\b/i, "Operacional");
  role = role.replace(/\s*,?\s*ip\.?\s*$/i, "");
  role = role.replace(/^postos?\s+de\s+trabalho\s+(?:da\s+carreira\s+(?:de\s+)?)?/i, "");
  role = role.replace(
    /t[eé]cnico\s+superior\s+das\s+[aá]reas\s+de\s+diagn[oó]stico\s+e\s+terap[eê]utica/i,
    "Técnico Superior de Diagnóstico e Terapêutica",
  );
  role = role.replace(
    /t[eé]cnicos?\s+superiores?\s+de\s+diagn[oó]stico\s+e\s+terap[eê]utica/i,
    "Técnico Superior de Diagnóstico e Terapêutica",
  );
  role = role.replace(/,\s*categoria\s+de\s+/i, " — ");
  role = role.replace(WHITESPACE_RE, " ").replace(/^[ ,;—\-–.]+|[ ,;—\-–.]+$/g, "");
  return titleCasePt(role);
}

function extractCount(text: string): number | null {
  for (const pat of COUNT_PATTERNS) {
    const m = text.match(pat);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) {
        return n;
      }
    }
  }

  const m = text.match(
    /(?:de\s+)?(um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|dezanove)\s+(?:\(?\d+\)?\s+)?postos?\s+de\s+trabalho/i,
  );
  if (m?.[1]) {
    return WORD_COUNTS[m[1].toLowerCase()] ?? null;
  }
  return null;
}

function extractSpecialty(text: string, role: string): string | null {
  let m = text.match(SPECIALTY_RE);
  if (!m) {
    m = text.match(/[—\-–―]\s*([^—\-–―]{3,80})$/);
  }
  if (!m?.[1]) {
    return null;
  }

  let spec = m[1].replace(WHITESPACE_RE, " ").replace(/^[ ,.;]+|[ ,.;]+$/g, "");
  spec = spec.replace(/^profiss[aã]o\s+de\s+/i, "");
  spec = spec.replace(/^[aá]rea\s+(?:hospitalar|de\s+exerc[ií]cio)\s*/i, "");
  spec = spec.replace(/\s*\(scp\)\s*/i, " ");
  spec = spec.replace(WHITESPACE_RE, " ").replace(/^[ ,.;]+|[ ,.;]+$/g, "");

  if (spec.length < 3 || spec.length > 70) {
    return null;
  }

  const roleN = normalizeAsciiLower(role);
  const specN = normalizeAsciiLower(spec);
  if (specN.includes(roleN) || roleN.includes(specN)) {
    return null;
  }
  if (/modalidade|v[ií]nculo|contrato|mapa de pessoal|procedimento/i.test(spec)) {
    return null;
  }
  return titleCasePt(spec);
}

function repairCommonGlitches(text: string): string {
  text = text.replace(
    /t[eé]cnicos?\s+superior(?:es)?\s+das\s+\S+\s+de\s+diagn[oó]stico\s+e\s+terap\S*/gi,
    "Técnico Superior de Diagnóstico e Terapêutica",
  );
  text = text.replace(
    /t[eé]cnico\s+superior\s+de\s+diagn[oó]stico\s+e\s+terap[eê]utica\s+(fisioterap\w*|radioterap\w*|radiologia|farm[aá]cia)/gi,
    "Técnico Superior de Diagnóstico e Terapêutica — $1",
  );
  text = text.replace(/\s*[—\-–―]\s*aviso\s+n\.?º?.*$/i, "");
  text = text.replace(/\s*[—\-–―]\s*\d{4}\s*$/i, "");
  text = text.replace(/^com\s+vista\s+[aà]\s+contrata[cç][aã]o\s+de\s+/i, "");
  text = text.replace(/^contrata[cç][aã]o\s+de\s+/i, "");
  text = text.replace(
    /^(?:carreira\s+)?(?:especial\s+)?m[eé]dica(?:\s+ou\s+especial)?\s+m[eé]dica\s+hospitalar.*$/i,
    "Médico — Carreira Hospitalar",
  );
  text = text.replace(/\s*\(tsdt\)\s*/gi, " ");
  text = text.replace(/\s*[—\-–―]\s*fis\s*$/i, " — Fisioterapia");
  text = text.replace(/\s*[—\-–―]\s*anatomia\s+patol\s*$/i, " — Anatomia Patológica");
  text = text.replace(/\s*[—\-–―]\s*t[eé]cnico\s+de\s*$/i, "");
  text = text.replace(/\s*[—\-–―]\s*[aáÁA]rea\s+(?:de\s+)?/gi, " — ");
  text = text.replace(/^farmac[eê]uticos\s+assistentes\b/i, "Farmacêutico Assistente");
  return text.replace(WHITESPACE_RE, " ").replace(/^[ ,;—\-–―]+|[ ,;—\-–―]+$/g, "");
}

/** Encurta títulos burocráticos para a função (ex.: Assistente Técnico). */
export function shortenJobTitle(title: string, maxLen = 96): string {
  let raw = (title || "").trim().replace(WHITESPACE_RE, " ");
  raw = raw.replace(ELLIPSIS_RE, "");
  if (!raw) {
    return raw;
  }

  raw = repairCommonGlitches(raw);

  if (raw.length <= 70 && !BUREAUCRATIC_HINT_RE.test(raw)) {
    return raw.slice(0, maxLen);
  }

  const count = extractCount(raw);
  let working = raw;
  working = working.replace(MID_NOISE_RE, " ");
  working = working.replace(WHITESPACE_RE, " ").replace(/^[ ,;—\-]+|[ ,;—\-]+$/g, "");

  const tsdt = raw.match(TSDT_PROFESSION_RE);
  if (tsdt?.[1]) {
    const profession = titleCasePt(tsdt[1]);
    let out = `Técnico Superior de Diagnóstico e Terapêutica — ${profession}`;
    if (count && count > 1) {
      out = `${out} (${count} vagas)`;
    }
    return out.slice(0, maxLen);
  }

  let role: string | null = null;
  for (const pat of ROLE_PATTERNS) {
    const match = working.match(pat);
    if (match?.[1]) {
      const candidate = cleanRole(match[1]);
      if (candidate.length >= 3 && candidate.length <= 90) {
        role = candidate;
        break;
      }
    }
  }

  if (!role) {
    let stripped = working.replace(PREFIX_RE, "").replace(/^[ ,;—\-]+|[ ,;—\-]+$/g, "");
    stripped = stripped.replace(MID_NOISE_RE, " ");
    stripped = stripped.replace(TRAILING_JUNK_RE, "");
    stripped = stripped.replace(WHITESPACE_RE, " ").replace(/^[ ,;—\-]+|[ ,;—\-]+$/g, "");
    stripped = stripped.split(
      /,\s*(?:na modalidade|da carreira|do mapa|em regime|para a categoria)/i,
    )[0];
    role = stripped ? cleanRole(stripped) : raw;
  }

  let specialty = extractSpecialty(raw, role);
  if (specialty) {
    specialty = specialty.replace(/^profissional\s+(?:de\s+)?/i, "").trim();
    specialty = specialty.replace(/^[ ,;—\-–―.]+|[ ,;—\-–―.]+$/g, "");
    specialty = titleCasePt(specialty);
    if (/^m\s*\/\s*f$/i.test(specialty)) {
      specialty = null;
    }
  }

  let out = role;
  if (specialty && !out.toLowerCase().includes(specialty.toLowerCase())) {
    out = `${out} — ${specialty}`;
  }

  const parts = out
    .split(/\s*[—\-–―]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const deduped: string[] = [];
  for (const part of parts) {
    const key = normalizeAsciiLower(part);
    const lastKey = deduped.length
      ? normalizeAsciiLower(deduped[deduped.length - 1])
      : "";
    if (!deduped.length || key !== lastKey) {
      deduped.push(part);
    }
  }
  out = deduped.join(" — ");

  if (count && count > 1 && !/\(\d+\s*vagas?\)/i.test(out)) {
    out = `${out} (${count} vagas)`;
  }

  out = out.replace(WHITESPACE_RE, " ").replace(/^[ ,;—\-–―]+|[ ,;—\-–―]+$/g, "");
  out = out.replace(ELLIPSIS_RE, "");
  out = out.replace(/[ \-–—―]+$/g, "");

  if (out.length < 3 || out.length > raw.length + 10) {
    out = raw;
  }
  if (out.length > maxLen) {
    out = out.slice(0, maxLen - 1).replace(/[ ,;—\-]+$/g, "") + "…";
  }
  return out;
}
