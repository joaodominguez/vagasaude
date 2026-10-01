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
        (("enfermeir", "tecnic de enfermagem", "tecnica de enfermagem", "auxiliar de enfermagem"), "Enfermagem"),
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
    "pronto socorro",
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
    "enfermagem",
    "assistencial",
)


def looks_like_health_job(title: str, department: str | None = None) -> bool:
    blob = norm(f"{title} {department or ''}")
    if not blob:
        return False
    # Exclude obvious non-clinical corporate roles unless health keyword present
    exclude = (
        "desenvolvedor",
        "software",
        "devops",
        "analista de sistemas",
        "motorista",
        "segurança patrimonial",
        "zelador",
        "jardinagem",
    )
    if any(x in blob for x in exclude) and not any(
        k in blob for k in ("enfermeir", "medico", "fisioterap", "saude", "hospital")
    ):
        return False
    return any(k in blob for k in HEALTH_KEYWORDS)
