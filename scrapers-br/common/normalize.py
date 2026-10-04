from __future__ import annotations

import re
import unicodedata
from html import unescape as html_unescape

UF_TO_STATE = {
    "AC": "Acre",
    "AL": "Alagoas",
    "AP": "Amapá",
    "AM": "Amazonas",
    "BA": "Bahia",
    "CE": "Ceará",
    "DF": "Distrito Federal",
    "ES": "Espírito Santo",
    "GO": "Goiás",
    "MA": "Maranhão",
    "MT": "Mato Grosso",
    "MS": "Mato Grosso do Sul",
    "MG": "Minas Gerais",
    "PA": "Pará",
    "PB": "Paraíba",
    "PR": "Paraná",
    "PE": "Pernambuco",
    "PI": "Piauí",
    "RJ": "Rio de Janeiro",
    "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul",
    "RO": "Rondônia",
    "RR": "Roraima",
    "SC": "Santa Catarina",
    "SP": "São Paulo",
    "SE": "Sergipe",
    "TO": "Tocantins",
}

def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def norm(text: str) -> str:
    text = strip_accents(text or "")
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text).lower()
    return re.sub(r"\s+", " ", text).strip()


STATE_ALIASES: dict[str, str] = {}
for _uf, _name in UF_TO_STATE.items():
    STATE_ALIASES[_uf.lower()] = _name
    STATE_ALIASES[norm(_name)] = _name


def html_to_text(html: str | None) -> str:
    if not html:
        return ""
    text = re.sub(r"(?is)<(script|style|head|title).*?>.*?</\1>", " ", html)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|h[1-6]|tr)>", "\n", text)
    text = re.sub(r"(?i)</li>", "\n", text)
    text = re.sub(r"(?i)<li[^>]*>", "- ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_unescape(text)
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line and not line.startswith(".")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def state_from_uf(uf: str | None, state_name: str | None = None) -> str:
    if uf:
        mapped = UF_TO_STATE.get(uf.strip().upper())
        if mapped:
            return mapped
    if state_name:
        key = norm(state_name)
        if key in STATE_ALIASES:
            return STATE_ALIASES[key]
        for alias, name in STATE_ALIASES.items():
            if alias and alias in key:
                return name
        cleaned = state_name.strip()
        if cleaned:
            return cleaned
    return "Brasil"


def guess_contract(text: str | None) -> str | None:
    t = norm(text or "")
    if not t:
        return None
    if "residenc" in t:
        return "Residência"
    if "concurso" in t:
        return "Concurso"
    if re.search(r"\bpss\b", t) or "processo seletivo" in t or "selecao publica" in t:
        return "PSS"
    if "clt" in t or "efetiv" in t:
        return "CLT"
    if "pessoa juridica" in t or re.search(r"\bpj\b", t):
        return "PJ"
    if "estagio" in t or "estagiario" in t:
        return "Estágio"
    if "temporar" in t:
        return "Temporário"
    if "plantao" in t or "plantões" in t or "plantao" in t:
        return "Plantão"
    if "meio periodo" in t or "part time" in t or "meio-período" in (text or "").lower():
        return "Meio período"
    return None


def guess_profession(title: str, fallback: str | None = None) -> str:
    t = norm(title)
    rules: list[tuple[tuple[str, ...], str]] = [
        (("enfermeir", "enfermagem", "tecnic de enfermagem", "tecnica de enfermagem", "auxiliar de enfermagem"), "Enfermagem"),
        (("medico", "médico", "psiquiatra", "pediatra", "cirurgiao", "anestesi"), "Medicina"),
        (("fisioterap",), "Fisioterapia"),
        (("nutricion", "nutri "), "Nutrição"),
        (("psicolog",), "Psicologia"),
        (("farmaceut", "farmacia", "farmacêut"), "Farmácia"),
        (("fonoaudi",), "Técnico de Saúde"),
        (("terapeuta ocupacional", "terapia ocupacional"), "Técnico de Saúde"),
        (("radiolog", "biomédic", "biomedic", "laboratorio", "laborator", "gasoterapia"), "Técnico de Saúde"),
        (("odontolog", "dentista", "auxiliar de saude bucal"), "Técnico de Saúde"),
        (("assistente social",), "Assistência Social"),
        (("auxiliar de saude", "tecnico de saude", "tecnica de saude", "instrumentador"), "Auxiliares"),
        (("comercial", "propagandista", "key account"), "Comercial / Farma"),
        (("coordenador", "supervisor", "gestor", "gerente", "administrador"), "Gestão & suporte"),
        (("recepcion", "administrativ", "assistente administrativo", "secretaria"), "Administrativo"),
    ]
    # Fix médicos matching: norm strips accents so medico is fine
    for needles, label in rules:
        if any(n in t for n in needles):
            return label
    if fallback:
        return fallback
    return "Outros"


HEALTH_KEYWORDS = (
    "enfermeir",
    "medico",
    "médico",
    "fisioterap",
    "nutricion",
    "nutri ",
    "psicolog",
    "farmaceut",
    "farmacia",
    "fonoaudi",
    "terapeuta",
    "radiolog",
    "biomédic",
    "biomedic",
    "odontolog",
    "dentista",
    "instrumentador",
    "gasoterapia",
    "auxiliar de enfermagem",
    "tecnic de enfermagem",
    "tecnica de enfermagem",
    "assistente social",
    "saude",
    "saúde",
    "hospital",
    "uti",
    "uco",
    "pronto socorro",
    "pronto atendimento",
    "centro cirurgico",
    "centro cirúrgico",
    "cme",
    "hemodin",
    "oncolog",
    "pediatr",
    "obstetr",
    "clinico",
    "clínico",
    "ambulator",
    "plantao",
    "plantão",
    "cuidador",
    "tecnico de laboratorio",
    "laboratorio",
    "diagnostico",
    "diagnóstico",
    "imagem",
    "ressonancia",
    "tomografia",
    "endoscopia",
    "enfermagem",
    "assistencial",
    # Hospital ops / patient-facing
    "atendimento ao paciente",
    "recepcion",
    "agendamento",
    "contas medicas",
    "contas médicas",
    "faturamento",
    "prontuario",
    "prontuário",
    "internacao",
    "internação",
    "semi intensiva",
    "semi-intensiva",
    "opme",
    "farmacia hospitalar",
    "servico de nutricao",
    "serviço de nutrição",
    "dietetica",
    "dietética",
    "higienizacao",
    "higienização",
    "central de exames",
    "medicina diagnostica",
    "medicina diagnóstica",
    "corpo clinico",
    "corpo clínico",
    "bloco cirurgico",
    "bloco cirúrgico",
    "hemoterapia",
    "banco de sangue",
    "nefrolog",
    "dialise",
    "diálise",
    "anestesi",
)

# Hard excludes for dedicated hospital boards (keep patient-facing admin)
HOSPITAL_HARD_EXCLUDE = (
    "desenvolvedor",
    "software",
    "devops",
    "fullstack",
    "front end",
    "back end",
    "engenheiro de dados",
    "cientista de dados",
    "analista de sistemas",
    "advogad",
    "juridic",
    "jurídic",
    "motorista",
    "segurança patrimonial",
    "vigilante",
    "jardinagem",
    "marketing digital",
    "social media",
    "designer",
    "contabil",
    "contábil",
    "contador",
    "folha de pagamento",
    "banco de talentos",
    "cadastre o seu curriculo",
    "cadastre o seu currículo",
)


def looks_like_health_job(title: str, department: str | None = None) -> bool:
    blob = norm(f"{title} {department or ''}")
    if not blob:
        return False
    exclude = (
        "desenvolvedor",
        "software",
        "devops",
        "analista de sistemas",
        "motorista",
        "segurança patrimonial",
        "zelador",
        "jardinagem",
        "banco de talentos",
    )
    if any(x in blob for x in exclude) and not any(
        k in blob for k in ("enfermeir", "medico", "fisioterap", "saude", "hospital")
    ):
        return False
    return any(k in blob for k in HEALTH_KEYWORDS)


# Concursos PCI / editais: órgãos claramente fora da saúde (tribunais, Forças
# Armadas, Correios…) só passam se houver cargo clínico explícito.
_CONCURSO_CLINICAL_ROLES = (
    "enfermeir",
    "enfermagem",
    "medico",
    "medica ",
    "odontolog",
    "dentista",
    "fisioterap",
    "nutricion",
    "psicolog",
    "farmaceut",
    "farmacia",
    "fonoaudi",
    "biomedic",
    "radiolog",
    "terapeuta ocupacional",
    "terapia ocupacional",
    "assistente social",
    "auxiliar de enfermagem",
    "tecnico de enfermagem",
    "tecnica de enfermagem",
    "agente comunitario",
    "agente de saude",
    "samu",
    "ubs",
    "hospital",
    "vigilancia sanitaria",
    "sanitarista",
    "saude da familia",
    "secretaria de saude",
    "secretaria municipal de saude",
    "secretaria estadual de saude",
    "ministerio da saude",
    "area da saude",
    "area de saude",
    "profissional de saude",
    "tecnico de saude",
    "tecnica de saude",
    "tecnico em saude",
    "tecnica em saude",
    "residencia medica",
    "residencia multiprofissional",
    "multiprofissional",
    "oficial medico",
    "oficial odont",
    "servico de saude",
    "hemocentro",
    "hemoterapia",
    "banco de sangue",
    "pronto socorro",
    "pronto atendimento",
    "areas de saude",
    "areas da saude",
    "na area da saude",
    "na area de saude",
)

_CONCURSO_HEALTH_EMPLOYERS = (
    "secretaria de saude",
    "ministerio da saude",
    "fiocruz",
    "imip",
    "hospital",
    "santa casa",
    "hemocentro",
    "samu",
    "fundacao de saude",
    "fundacao saude",
    "instituto de medicina",
    "escola de saude",
    "servico de saude",
    "sesa",
)

# Tokens curtos com boundary (evita "tre " ⊂ "entre").
_CONCURSO_NON_HEALTH_TOKENS = (
    "trt",
    "tre",
    "trf",
    "stj",
    "stf",
    "stm",
    "tse",
    "mpu",
    "tcu",
    "tce",
)

_CONCURSO_NON_HEALTH_PHRASES = (
    "tribunal",
    "judiciario",
    "analista judiciario",
    "tecnico judiciario",
    "oficial de justica",
    "cartorio",
    "ministerio publico",
    "defensoria",
    "policia federal",
    "policia civil",
    "policia militar",
    "policia rodoviaria",
    "guarda municipal",
    "corpo de bombeiros",
    "bombeiro militar",
    "bombeiros militar",
    "exercito",
    "marinha do brasil",
    "aeronautica",
    "comando da aeronautica",
    "correios",
    "banco do brasil",
    "receita federal",
    "detran",
    "ibge",
    "transpetro",
    "relacoes exteriores",
    "educacao fisica",
    "concurso publico nacional unificado",
    "concurso nacional unificado",
    "agente penitenciario",
    "escrivao",
    "delegado",
)

_CONCURSO_TOKEN_RE = re.compile(
    r"(?:^|\s)(?:" + "|".join(_CONCURSO_NON_HEALTH_TOKENS) + r")(?:\s|$|-)"
)


# Cargos clínicos para títulos ("Médico — CBMERJ (RJ)"). Ordem = prioridade.
_CONCURSO_ROLE_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\b(?:tecnic[oa]s?\s+de\s+enfermagem|tecnica?\s+de\s+enfermagem)\b", re.I), "Técnico de Enfermagem"),
    (re.compile(r"\b(?:auxiliares?\s+de\s+enfermagem)\b", re.I), "Auxiliar de Enfermagem"),
    (re.compile(r"\b(?:agentes?\s+comunit[aá]rios?\s+de\s+sa[uú]de|agente\s+comunitario\s+de\s+saude)\b", re.I), "Agente Comunitário de Saúde"),
    (re.compile(r"\b(?:agentes?\s+de\s+combate\s+[aà]s?\s+endemias?)\b", re.I), "Agente de Combate às Endemias"),
    (re.compile(r"\b(?:enfermeir[oa]s?|enfermagem)\b", re.I), "Enfermeiro"),
    (re.compile(r"\b(?:m[eé]dic[oa]s?|medicina(?!\s+veterinar))\b", re.I), "Médico"),
    (re.compile(r"\b(?:dentistas?|odont[oó]log[oa]s?|odontologia)\b", re.I), "Dentista"),
    (re.compile(r"\b(?:fisioterapeutas?|fisioterapia)\b", re.I), "Fisioterapeuta"),
    (re.compile(r"\b(?:psic[oó]log[oa]s?|psicologia)\b", re.I), "Psicólogo"),
    (re.compile(r"\b(?:nutricionistas?|nutri[cç][aã]o)\b", re.I), "Nutricionista"),
    (re.compile(r"\b(?:farmac[eê]utic[oa]s?|farm[aá]cia)\b", re.I), "Farmacêutico"),
    (re.compile(r"\b(?:fonoaudi[oó]log[oa]s?|fonoaudiologia)\b", re.I), "Fonoaudiólogo"),
    (re.compile(r"\b(?:biom[eé]dic[oa]s?|biomedicina)\b", re.I), "Biomédico"),
    (re.compile(r"\b(?:terapeutas?\s+ocupacionais?|terapia\s+ocupacional)\b", re.I), "Terapeuta Ocupacional"),
    (re.compile(r"\b(?:assistentes?\s+sociais?|servi[cç]o\s+social)\b", re.I), "Assistente Social"),
    (re.compile(r"\b(?:radiologistas?|t[eé]cnic[oa]s?\s+em\s+radiologia)\b", re.I), "Radiologia"),
    (re.compile(r"\b(?:veterin[aá]ri[oa]s?)\b", re.I), "Veterinário"),
)


def extract_concurso_health_roles(text: str | None, *, limit: int = 6) -> list[str]:
    """Extrai cargos de saúde mencionados no edital (ordem de prioridade)."""
    if not text:
        return []
    found: list[str] = []
    seen: set[str] = set()
    for pattern, label in _CONCURSO_ROLE_PATTERNS:
        if pattern.search(text) and label not in seen:
            found.append(label)
            seen.add(label)
            if len(found) >= limit:
                break
    return found


def looks_like_health_concurso(
    title: str,
    company: str | None = None,
    summary: str | None = None,
) -> bool:
    """Relevância para editais/concursos (PCI).

    A listagem PCI /vagas/saude/ mistura editais gerais; rejeita tribunais,
    Forças Armadas, Correios, etc. e editais sem cargo/órgão de saúde.
    """
    blob = norm(f"{title} {company or ''} {summary or ''}")
    if not blob:
        return False
    if any(h in blob for h in _CONCURSO_HEALTH_EMPLOYERS):
        return True
    if any(c in blob for c in _CONCURSO_CLINICAL_ROLES):
        return True
    if extract_concurso_health_roles(f"{title} {company or ''} {summary or ''}"):
        return True
    if _CONCURSO_TOKEN_RE.search(f" {blob} "):
        return False
    if any(p in blob for p in _CONCURSO_NON_HEALTH_PHRASES):
        return False
    # Sem cargo/órgão clínico explícito: rejeita (ex.: "vários cargos" genérico).
    return False


def looks_like_hospital_employer_job(
    title: str, department: str | None = None
) -> bool:
    """Filtro alargado para boards de um único hospital (Moinhos, BP, HAOC…).

    Mantém funções hospitalares (recepção, agendamento, nutrição, etc.) e
    descarta só IT/jurídico/banco de talentos genérico.
    """
    blob = norm(f"{title} {department or ''}")
    if not blob:
        return False
    # Talent pools are evergreen CV forms — not open vacancies
    if "banco de talentos" in blob or "cadastre o seu curriculo" in blob:
        return False
    if any(x in blob for x in HOSPITAL_HARD_EXCLUDE):
        if any(
            k in blob
            for k in (
                "enfermeir",
                "enfermagem",
                "medico",
                "fisioterap",
                "farmaceut",
                "farmacia",
                "nutric",
                "psicolog",
                "uti",
                "cme",
            )
        ):
            return True
        return False
    return True
