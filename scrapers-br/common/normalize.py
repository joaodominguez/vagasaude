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
