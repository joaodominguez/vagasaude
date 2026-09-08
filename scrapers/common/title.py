from __future__ import annotations

import re
import unicodedata


_WHITESPACE_RE = re.compile(r"\s+")
_ELLIPSIS_RE = re.compile(r"(?:\u2026|\.{2,})\s*$")

# Prefixes típicos de avisos públicos / DRE / BEP / ULS / IPST.
_PREFIX_RE = re.compile(
    r"""^(?:
        (?:abertura\s+d[ae]\s+)?procedimento\s+concursal\s*
        (?:\(?(?:comum|urgente|simplificado)\)?\s*)*
        (?:com\s+car[aá]ter\s+urgente\s*)?
        (?:conducente\s+(?:ao\s+)?(?:recrutamento|à\s+constitui[cç][aã]o)[^.]*?)?
        (?:para\s+)?|
        (?:com\s+vista\s+[aà]\s+)?contrata[cç][aã]o\s+de\s+|
        constitui[cç][aã]o\s+de\s+bolsa\s+de\s+reservas?\s+(?:de\s+)?|
        constitui[cç][aã]o\s+de\s+reserva\s+de\s+recrutamento\s+(?:para\s+)?|
        reserva\s+de\s+recrutamento\s+(?:para\s+)?|
        recrutamento\s+(?:de\s+|por\s+mobilidade\s+para\s+)?|
        call\s+for\s+(?:the\s+)?recruitment\s+of\s+|
        call\s+for\s+(?:one\s+|1\s+)?|
        an[uú]ncio\s+de\s+abertura\s+(?:de\s+)?|
        aviso\s+(?:de\s+abertura\s+)?(?:de\s+)?
    )""",
    re.I | re.X,
)

_MID_NOISE_RE = re.compile(
    r"""(?ix)
    (?:,\s*)?(?:na|com)\s+modalidade\s+de\s+v[ií]nculo[^,.;]*|
    (?:,\s*)?(?:em\s+regime\s+de\s+)?contrato\s+(?:de\s+trabalho\s+)?(?:em\s+fun[cç][oõ]es\s+p[uú]blicas\s+)?(?:por\s+tempo\s+indeterminado|a\s+termo)[^,.;]*|
    (?:,\s*)?contrato\s+individual\s+de\s+trabalho[^,.;]*|
    (?:,\s*)?do\s+mapa\s+de\s+pessoal[^,.;]*|
    (?:,\s*)?rem\s+r[^,.;]*|
    (?:,\s*)?cit\s+(?:a\s+termo)?[^,.;]*|
    (?:,\s*)?m\s*/\s*f\.?|
    (?:,\s*)?proc\.?\s*ci[\s./\d-]+|
    (?:,\s*)?\(?(?:compete|feder|pi|ga)\d[^)]*\)?
    """
)

_COUNT_PATTERNS = [
    re.compile(
        r"(?i)(?:preenchimento|ocupa[cç][aã]o|contrata[cç][aã]o|recrutamento)\s+"
        r"(?:de\s+)?(?:um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|"
        r"onze|doze|dezanove|\d+)\s*\(?(\d+)\)?\s+postos?\s+de\s+trabalho"
    ),
    re.compile(r"(?i)(\d+)\s+postos?\s+de\s+trabalho"),
    re.compile(r"(?i)\((\d+)\)\s*(?:postos?|profissionais?|vagas?)"),
    re.compile(r"(?i)contrata[cç][aã]o\s+de\s+(\d+)\s+"),
    re.compile(r"(?i)recrutamento\s+de\s+(\d+)\s*\(?" ),
]

_ROLE_PATTERNS = [
    # "categoria de X" / "nas categorias de X"
    re.compile(
        r"(?i)categorias?\s+de\s+(.+?)(?="
        r",\s*da\s+carreira|,?\s*na\s+modalidade|,?\s*do\s+mapa|"
        r",?\s*em\s+regime|\s+[—\-–―]\s*|\s+para\s+a\s+|\s*$)"
    ),
    # "da carreira de/especial de X" when no categoria
    re.compile(
        r"(?i)carreira\s+(?:especial\s+)?(?:de\s+)?(.+?)(?="
        r",\s*categoria|,?\s*na\s+modalidade|,?\s*do\s+mapa|"
        r"\s+[—\-–―]\s*|\s*$)"
    ),
    # "seleção/contratação/recrutamento de X" / "reserva … ― X"
    re.compile(
        r"(?i)(?:sele[cç][aã]o|contrata[cç][aã]o|recrutamento|reserva\s+de\s+recrutamento)\s*"
        r"(?:e\s+sele[cç][aã]o\s+)?"
        r"(?:de\s+|para\s+|[—\-–―]\s*)?"
        r"(.+?)(?="
        r",\s*da\s+carreira|,?\s*na\s+modalidade|,?\s*do\s+mapa|"
        r"\s+[—\-–―]\s*|\s+para\s+a\s+|\s*$)"
    ),
    # "bolsa de reservas de X"
    re.compile(
        r"(?i)bolsa\s+de\s+reservas?\s+(?:de\s+)?(.+?)(?="
        r"\s+[—\-–―]\s*|\s+para\s+o\s+|\s+para\s+a\s+|\s*$)"
    ),
    # "postos ... na categoria de X" already covered; fallback "para X"
    re.compile(
        r"(?i)(?:postos?\s+de\s+trabalho|profissional(?:ais)?)\s+"
        r"(?:vagos?\s+)?(?:na\s+)?(?:categoria\s+de\s+)?(.+?)(?="
        r",|\s+[—\-–―]\s*|\s*$)"
    ),
]

_SPECIALTY_RE = re.compile(
    r"""(?ix)
    (?:
        [—\-–―]\s*|
        [,.]\s*área\s+de\s+exerc[ií]cio\s+(?:profissional\s+)?(?:de\s+|em\s+|—\s*|-\s*)?|
        [,.]\s*área\s+hospitalar\s*(?:de\s+|em\s+|—\s*|-\s*)?|
        [,.]\s*especialidade\s+(?:de\s+|em\s+)?|
        [,.]\s*profiss[aã]o\s+de\s+|
        \s+para\s+(?:o|a)\s+(?:servi[cç]o|setor|unidade)\s+de\s+
    )
    (.+?)
    (?=\s*[.;]|\s*$|,?\s*(?:da\s+carreira|na\s+modalidade|cit\b|rem\b|contrato|proc\.?))
    """
)

_TSDT_PROFESSION_RE = re.compile(
    r"(?i)(?:t[eé]cnicos?\s+superior(?:es)?\s+(?:das\s+\w+\s+de\s+|de\s+)?"
    r"diagn[oó]stico\s+e\s+terap[eê]utica)\s*"
    r"(?:[—\-–―,]\s*|\s+)(?:"
    r"profiss[aã]o\s+de\s+)?"
    r"(fisioterap\w*|radioterap\w*|medicina\s+nuclear|anatomia\s+patol\w*"
    r"|cardiopneumolog\w*|ortoptic\w*|audiolog\w*|diet[eé]tica\w*"
    r"|terapia\s+da\s+fala|terapia\s+ocupacional|farm[aá]cia)"
)

_TRAILING_JUNK_RE = re.compile(
    r"""(?ix)
    (?:,?\s*(?:da|de)\s+carreira(?:\s+\w+){0,4})?
    (?:,?\s*ou\s+equiparada)?
    (?:,?\s*m\s*/\s*f\.?)?
    (?:,?\s*\d{4})?
    \s*$
    """
)

_BUREAUCRATIC_HINT_RE = re.compile(
    r"(?i)procedimento\s+concursal|posto(?:s)?\s+de\s+trabalho|"
    r"v[ií]nculo\s+de\s+emprego|mapa\s+de\s+pessoal|"
    r"reserva\s+de\s+recrutamento|bolsa\s+de\s+reserva|"
    r"categoria\s+de\s+|carreira\s+(?:especial\s+)?de\s+|"
    r"modalidade\s+de\s+v[ií]nculo|abertura\s+de\s+procedimento|"
    r"call\s+for\s+|contrata[cç][aã]o\s+de\s+\d+"
)


def _title_case_pt(text: str) -> str:
    small = {
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
    }
    acronyms = {
        "tdt": "TDT",
        "tsdt": "TSDT",
        "mgf": "MGF",
        "cit": "CIT",
        "scp": "SCP",
        "ipst": "IPST",
        "inem": "INEM",
        "uls": "ULS",
        "sns": "SNS",
        "teph": "TEPH",
    }
    parts: list[str] = []
    for i, raw in enumerate(re.split(r"(\s+|/|—|-)", text)):
        if not raw or re.fullmatch(r"\s+|/|—|-", raw):
            parts.append(raw)
            continue
        key = raw.lower()
        if key in acronyms:
            parts.append(acronyms[key])
        elif i > 0 and key in small:
            parts.append(key)
        elif raw.isupper() and len(raw) <= 4:
            parts.append(raw)
        else:
            parts.append(raw[:1].upper() + raw[1:].lower() if raw else raw)
    return "".join(parts).strip(" ,;—-")


def _clean_role(role: str) -> str:
    role = _WHITESPACE_RE.sub(" ", role).strip(" ,;—-–―.")
    role = re.sub(r"(?i)^(?:um|uma|dois|duas|tr[eê]s|\d+)\s+", "", role)
    role = re.sub(r"(?i)^(?:para\s+)", "", role)
    role = re.sub(r"(?i)^(?:profissional(?:ais)?\s+para\s+(?:a\s+)?)?", "", role)
    role = re.sub(r"(?i)^(?:pessoal\s+)", "", role)
    role = re.sub(r"(?i)\s+vagos?\b", "", role)
    role = re.sub(r"(?i)\s+da\s+carreira(?:\s+\w+){0,6}$", "", role)
    role = re.sub(r"(?i)\s+ou\s+equiparada$", "", role)
    role = re.sub(r"(?i)^assistentes\s+operacionais\b", "Assistente Operacional", role)
    role = re.sub(r"(?i)^assistentes\b", "Assistente", role)
    role = re.sub(r"(?i)^enfermeiros\b", "Enfermeiro", role)
    role = re.sub(r"(?i)^m[eé]dicos\b", "Médico", role)
    role = re.sub(r"(?i)^t[eé]cnicos?\s+superior(?:es)?\b", "Técnico Superior", role)
    role = re.sub(r"(?i)^t[eé]cnicos?\s+auxiliares?\b", "Técnico Auxiliar", role)
    role = re.sub(r"(?i)\boperacionais\b", "Operacional", role)
    role = re.sub(
        r"(?i)t[eé]cnico\s+superior\s+das\s+[aá]reas\s+de\s+diagn[oó]stico\s+e\s+terap[eê]utica",
        "Técnico Superior de Diagnóstico e Terapêutica",
        role,
    )
    role = re.sub(
        r"(?i)t[eé]cnicos?\s+superiores?\s+de\s+diagn[oó]stico\s+e\s+terap[eê]utica",
        "Técnico Superior de Diagnóstico e Terapêutica",
        role,
    )
    # Drop duplicated "categoria/carreira" leftovers inside role.
    role = re.sub(r"(?i),\s*categoria\s+de\s+", " — ", role)
    role = _WHITESPACE_RE.sub(" ", role).strip(" ,;—-.")
    return _title_case_pt(role)


def _extract_count(text: str) -> int | None:
    for pat in _COUNT_PATTERNS:
        m = pat.search(text)
        if m:
            try:
                return int(m.group(1))
            except ValueError:
                continue
    words = {
        "um": 1,
        "uma": 1,
        "dois": 2,
        "duas": 2,
        "três": 3,
        "tres": 3,
        "quatro": 4,
        "cinco": 5,
        "seis": 6,
        "sete": 7,
        "oito": 8,
        "nove": 9,
        "dez": 10,
        "dezanove": 19,
    }
    m = re.search(
        r"(?i)(?:postos?|profissionais?|vagas?)\s+(?:de\s+trabalho\s+)?"
        r"(?:vagos?\s+)?(?:na\s+categoria\s+de\s+)?"
        r"|"
        r"(?:preenchimento|ocupa[cç][aã]o)\s+de\s+"
        r"(um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|dezanove)\b",
        text,
    )
    # Simpler word-count near start of postos phrase
    m = re.search(
        r"(?i)(?:de\s+)?(um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|dezanove)"
        r"\s+(?:\(?\d+\)?\s+)?postos?\s+de\s+trabalho",
        text,
    )
    if m:
        return words.get(m.group(1).lower())
    return None


def _extract_specialty(text: str, role: str) -> str | None:
    m = _SPECIALTY_RE.search(text)
    if not m:
        # Trailing "— MEDICINA INTERNA" after cleanup
        m = re.search(r"[—\-–―]\s*([^—\-–―]{3,80})$", text)
    if not m:
        return None
    spec = _WHITESPACE_RE.sub(" ", m.group(1)).strip(" ,.;")
    spec = re.sub(r"(?i)^profiss[aã]o\s+de\s+", "", spec)
    spec = re.sub(r"(?i)^[aá]rea\s+(?:hospitalar|de\s+exerc[ií]cio)\s*", "", spec)
    spec = re.sub(r"(?i)\s*\(scp\)\s*", " ", spec)
    spec = _WHITESPACE_RE.sub(" ", spec).strip(" ,.;")
    if len(spec) < 3 or len(spec) > 70:
        return None
    # Avoid repeating the role
    role_n = unicodedata.normalize("NFKD", role).encode("ascii", "ignore").decode().lower()
    spec_n = unicodedata.normalize("NFKD", spec).encode("ascii", "ignore").decode().lower()
    if spec_n in role_n or role_n in spec_n:
        return None
    if re.search(r"(?i)modalidade|v[ií]nculo|contrato|mapa de pessoal|procedimento", spec):
        return None
    return _title_case_pt(spec)


def _repair_common_glitches(text: str) -> str:
    """Corrige restos de títulos já truncados ou mal encurtados."""
    text = re.sub(
        r"(?i)t[eé]cnicos?\s+superior(?:es)?\s+das\s+\S+\s+de\s+"
        r"diagn[oó]stico\s+e\s+terap\S*",
        "Técnico Superior de Diagnóstico e Terapêutica",
        text,
    )
    text = re.sub(
        r"(?i)t[eé]cnico\s+superior\s+de\s+diagn[oó]stico\s+e\s+terap[eê]utica\s+"
        r"(fisioterap\w*|radioterap\w*|radiologia|farm[aá]cia)",
        r"Técnico Superior de Diagnóstico e Terapêutica — \1",
        text,
    )
    text = re.sub(r"(?i)\s*[—\-–―]\s*aviso\s+n\.?º?.*$", "", text)
    text = re.sub(r"(?i)\s*[—\-–―]\s*\d{4}\s*$", "", text)
    text = re.sub(r"(?i)^com\s+vista\s+[aà]\s+contrata[cç][aã]o\s+de\s+", "", text)
    text = re.sub(r"(?i)^contrata[cç][aã]o\s+de\s+", "", text)
    text = re.sub(
        r"(?i)^(?:carreira\s+)?(?:especial\s+)?m[eé]dica(?:\s+ou\s+especial)?\s+"
        r"m[eé]dica\s+hospitalar.*$",
        "Médico — Carreira Hospitalar",
        text,
    )
    text = re.sub(r"(?i)\s*\(tsdt\)\s*", " ", text)
    text = re.sub(r"(?i)\s*[—\-–―]\s*fis\s*$", " — Fisioterapia", text)
    text = re.sub(r"(?i)\s*[—\-–―]\s*anatomia\s+patol\s*$", " — Anatomia Patológica", text)
    text = re.sub(r"(?i)\s*[—\-–―]\s*t[eé]cnico\s+de\s*$", "", text)
    text = re.sub(r"(?i)\s*[—\-–―]\s*[aá]rea\s+(?:de\s+)?", " — ", text)
    text = re.sub(r"(?i)^farmac[eê]uticos\s+assistentes\b", "Farmacêutico Assistente", text)
    text = re.sub(
        r"(?i)t[eé]cnicos?\s+superior(?:es)?\s+das\s+\S+\s+de\s+"
        r"diagn[oó]stico\s+e\s+terap\S*",
        "Técnico Superior de Diagnóstico e Terapêutica",
        text,
    )
    return _WHITESPACE_RE.sub(" ", text).strip(" ,;—-–―")


def shorten_job_title(title: str, *, max_len: int = 96) -> str:
    """Encurta títulos burocráticos para a função (ex.: Assistente Técnico)."""
    raw = _ELLIPSIS_RE.sub("", _WHITESPACE_RE.sub(" ", (title or "").strip()))
    if not raw:
        return raw

    raw = _repair_common_glitches(raw)

    # Títulos já curtos e sem jargão concursal: manter (após repair).
    if len(raw) <= 70 and not _BUREAUCRATIC_HINT_RE.search(raw):
        return raw[:max_len]

    count = _extract_count(raw)
    working = raw
    # Remover ruído legal no meio/fim antes de extrair papel.
    working = _MID_NOISE_RE.sub(" ", working)
    working = _WHITESPACE_RE.sub(" ", working).strip(" ,;—-")

    # Atalho TSDT + profissão (Fisioterapia, Radioterapia, …)
    tsdt = _TSDT_PROFESSION_RE.search(raw)
    if tsdt:
        profession = _title_case_pt(tsdt.group(1))
        out = f"Técnico Superior de Diagnóstico e Terapêutica — {profession}"
        if count and count > 1:
            out = f"{out} ({count} vagas)"
        return out[:max_len]

    role = None
    for pat in _ROLE_PATTERNS:
        m = pat.search(working)
        if m:
            candidate = _clean_role(m.group(1))
            if 3 <= len(candidate) <= 90:
                role = candidate
                break

    if not role:
        # Strip known prefixes and take the remainder.
        stripped = _PREFIX_RE.sub("", working).strip(" ,;—-")
        stripped = _MID_NOISE_RE.sub(" ", stripped)
        stripped = _TRAILING_JUNK_RE.sub("", stripped)
        stripped = _WHITESPACE_RE.sub(" ", stripped).strip(" ,;—-")
        # Cut at first heavy clause
        stripped = re.split(
            r"(?i),\s*(?:na modalidade|da carreira|do mapa|em regime|para a categoria)",
            stripped,
            maxsplit=1,
        )[0]
        role = _clean_role(stripped) if stripped else raw

    specialty = _extract_specialty(raw, role)
    if specialty:
        specialty = re.sub(r"(?i)^profissional\s+(?:de\s+)?", "", specialty).strip()
        specialty = specialty.strip(" ,;—-–―.")
        specialty = _title_case_pt(specialty)
        if re.search(r"(?i)^m\s*/\s*f$", specialty):
            specialty = None

    out = role
    if specialty and specialty.lower() not in out.lower():
        out = f"{out} — {specialty}"

    # Deduplicar segmentos repetidos ("X — X").
    parts = [p.strip() for p in re.split(r"\s*[—\-–―]\s*", out) if p.strip()]
    deduped: list[str] = []
    for part in parts:
        key = unicodedata.normalize("NFKD", part).encode("ascii", "ignore").decode().lower()
        if not deduped or key != unicodedata.normalize(
            "NFKD", deduped[-1]
        ).encode("ascii", "ignore").decode().lower():
            deduped.append(part)
    out = " — ".join(deduped)

    if count and count > 1 and not re.search(r"\(\d+\s*vagas?\)", out, re.I):
        out = f"{out} ({count} vagas)"

    out = _WHITESPACE_RE.sub(" ", out).strip(" ,;—-–―")
    out = _ELLIPSIS_RE.sub("", out)
    out = out.rstrip(" –—-―")

    if len(out) < 3 or len(out) > len(raw) + 10:
        out = raw
    if len(out) > max_len:
        out = out[: max_len - 1].rstrip(" ,;—-") + "…"
    return out
