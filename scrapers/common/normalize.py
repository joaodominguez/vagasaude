from __future__ import annotations

import hashlib
import re
import unicodedata
from html import unescape as html_unescape


DISTRICT_ALIASES = {
    "lisboa": "Lisboa",
    "porto": "Porto",
    "braga": "Braga",
    "coimbra": "Coimbra",
    "faro": "Faro",
    "setubal": "Setúbal",
    "setúbal": "Setúbal",
    "aveiro": "Aveiro",
    "leiria": "Leiria",
    "santarem": "Santarém",
    "santaré": "Santarém",
    "viana do castelo": "Viana do Castelo",
    "vila real": "Vila Real",
    "viseu": "Viseu",
    "guarda": "Guarda",
    "castelo branco": "Castelo Branco",
    "portalegre": "Portalegre",
    "evora": "Évora",
    "évora": "Évora",
    "beja": "Beja",
    "madeira": "Madeira",
    "acores": "Açores",
    "açores": "Açores",
    "ilha da madeira": "Madeira",
    "funchal": "Madeira",
    "grande lisboa": "Lisboa",
    "beira litoral": "Coimbra",
    "norte": "Porto",
    "centro": "Coimbra",
    "sul": "Faro",
    "algarve": "Faro",
}

CITY_TO_DISTRICT = {
    "lisboa": "Lisboa",
    "oeiras": "Lisboa",
    "cascais": "Lisboa",
    "sintra": "Lisboa",
    "amadora": "Lisboa",
    "loures": "Lisboa",
    "odivelas": "Lisboa",
    "almada": "Setúbal",
    "seixal": "Setúbal",
    "setubal": "Setúbal",
    "setúbal": "Setúbal",
    "porto": "Porto",
    "matosinhos": "Porto",
    "gaia": "Porto",
    "vila nova de gaia": "Porto",
    "gondomar": "Porto",
    "maia": "Porto",
    "braga": "Braga",
    "guimaraes": "Braga",
    "guimarães": "Braga",
    "coimbra": "Coimbra",
    "leiria": "Leiria",
    "aveiro": "Aveiro",
    "faro": "Faro",
    "loule": "Faro",
    "loulé": "Faro",
    "portimao": "Faro",
    "portimão": "Faro",
    "olhao": "Faro",
    "olhão": "Faro",
    "tavira": "Faro",
    "vilamoura": "Faro",
    "almancil": "Faro",
    "albufeira": "Faro",
    "lagos": "Faro",
    "lagoa": "Faro",
    "sacavem": "Lisboa",
    "sacavém": "Lisboa",
    "pacos de ferreira": "Porto",
    "paços de ferreira": "Porto",
    "beloura": "Lisboa",
    "evora": "Évora",
    "évora": "Évora",
    "valenca": "Viana do Castelo",
    "valença": "Viana do Castelo",
    "trofa": "Porto",
    "carnaxide": "Lisboa",
    "miraflores": "Lisboa",
    "carcavelos": "Lisboa",
    "ponta delgada": "Açores",
    "abrantes": "Santarém",
    "chamusca": "Santarém",
}


def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def norm(text: str) -> str:
    text = strip_accents(text or "")
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text).lower()
    return re.sub(r"\s+", " ", text).strip()


def dedupe_hash(title: str, company: str, district: str) -> str:
    key = f"{norm(title)}|{norm(company)}|{norm(district)}"
    return hashlib.sha256(key.encode()).hexdigest()


def slugify(text: str) -> str:
    text = norm(text).replace(" ", "-")
    return re.sub(r"-+", "-", text).strip("-")[:80]


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

    def is_list_item(line: str) -> bool:
        return bool(re.match(r"^[-•*]\s+\S", line) or re.match(r"^\d+[.)]\s+\S", line))

    raw_lines: list[str] = []
    for raw_line in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if not line:
            raw_lines.append("")
            continue
        # Remove residual CSS / boilerplate from ATS HTML wrappers.
        if (
            line.startswith(".")
            or "{" in line
            or "}" in line
            or line.lower().startswith("a document with")
            or line.lower() in {"html", "body"}
        ):
            continue
        raw_lines.append(line)

    lines: list[str] = []
    for i, line in enumerate(raw_lines):
        if not line:
            prev = next((l for l in reversed(lines) if l), "")
            nxt = next((l for l in raw_lines[i + 1 :] if l), "")
            if not prev or not nxt:
                continue
            # Keep list blocks tight; no blank between intro/title and list.
            if is_list_item(prev) and is_list_item(nxt):
                continue
            if not is_list_item(prev) and is_list_item(nxt):
                continue
            if lines and lines[-1] == "":
                continue
            lines.append("")
            continue
        lines.append(line)

    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def guess_district(city: str | None, region: str | None = None) -> str:
    for value in (city, region):
        if not value:
            continue
        cleaned = value.strip("[]\"' ")
        # region may be JSON-like list
        cleaned = cleaned.replace('"', "").replace("[", "").replace("]", "")
        first = cleaned.split(",")[0].strip()
        key = norm(first)
        if key in DISTRICT_ALIASES:
            return DISTRICT_ALIASES[key]
        if key in CITY_TO_DISTRICT:
            return CITY_TO_DISTRICT[key]
        for alias, district in DISTRICT_ALIASES.items():
            if alias in key:
                return district
        for alias, district in CITY_TO_DISTRICT.items():
            if alias in key:
                return district
    return "Portugal"


def guess_profession(title: str, fallback: str | None = None) -> str:
    t = norm(title)
    rules = [
        (("enfermeir", "enfermagem", "nurse", "nursing"), "Enfermagem"),
        (
            (
                "auxiliar",
                "acao medica",
                "accao medica",
                "assistente operacional",
                "geriatr",
            ),
            "Auxiliares",
        ),
        (("medico", "medica ", "medicas", "cirurgi", "internato", "physician"), "Medicina"),
        (("fisioterapeut", "fisioterap", "physiotherapist", "physiotherapy"), "Fisioterapia"),
        (("farmaceut", "farmacia", "pharmacist"), "Farmácia"),
        (
            (
                "radiologia",
                "cardiopneumolog",
                "cardiolog",
                "analises",
                "laboratorio",
                "laboratory",
                "tdt",
                "diagnostico",
                "terapeut",
                "audiolog",
                "imagiolog",
                "ortoptic",
                "ortotic",
                "neurofisiolog",
                "anatomia patol",
                "oftalmolog",
                "higienista",
                "research technician",
                "tecnico de investig",
            ),
            "Técnico de Saúde",
        ),
        (("psicolog", "psychologist"), "Psicologia"),
        (("nutric", "dietista"), "Nutrição"),
        (("assistente social",), "Assistência Social"),
        (
            (
                "administrativ",
                "recepcion",
                "rececion",
                "secretaria",
                "assistente dent",
                "gestor de cliente",
                "contact center",
            ),
            "Administrativo",
        ),
        (
            (
                "recursos humanos",
                "qualidade",
                "logistica",
                "armazem",
                "motorista",
                "cozinheir",
                "restauracao",
                "manutencao",
                "contabil",
                "financeiro",
                "helpdesk",
                "informatica",
                "sistemas",
                "data analytics",
                "engenheir",
                "postdoc",
                "postdoctoral",
                "phd student",
                "investigador",
                "researcher",
            ),
            "Outros",
        ),
    ]
    for needles, label in rules:
        if any(n in t for n in needles):
            return label
    if fallback:
        return guess_profession(fallback)
    return "Outros"


def guess_contract(text: str | None) -> str | None:
    if not text:
        return None
    t = norm(text)
    if "part" in t or "parcial" in t:
        return "Tempo parcial"
    if "turno" in t:
        return "Turnos"
    if "prestacao" in t or "recibo" in t:
        return "Prestação de serviços"
    if "inteiro" in t or "full" in t or "completo" in t:
        return "Tempo inteiro"
    if "termo" in t or "contrato" in t:
        return "Contrato"
    return text.strip()[:60]
