from __future__ import annotations

import json
import re
from html import unescape
from urllib.parse import urlencode

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_district, guess_profession, html_to_text

BASE = "https://iefponline.iefp.pt"
SEARCH = f"{BASE}/IEFP/pesquisas/search.do"
DETAIL = f"{BASE}/IEFP/pesquisas/detalheOfertas2.do"

# Facetas CNP com volume útil em saúde clínica.
DCPP_TERMS = [
    "ENFERMEIRO DE CUIDADOS GERAIS",
    "FISIOTERAPEUTA",
    "TERAPEUTA OCUPACIONAL",
    "TERAPEUTA DA FALA",
]

# Pesquisa livre — o IEFP é difuso; filtramos no detalhe pelo título.
TEXT_QUERIES = [
    "formador",
    "formadora",
    "formador enfermagem",
    "formador saúde",
    "delegado informação médica",
    "visitador médico",
    "comercial farmacêutico",
    "key account saúde",
    "farmacêutico",
    "farmaceutico",
    "técnico de farmácia",
    "tecnico de farmacia",
    "auxiliar de farmácia",
    "TAF farmácia",
]

CLINICAL_TITLE_RE = re.compile(
    r"enferm|fisioterap|terapeuta|auxiliar de sa|m[eé]dic|"
    r"farmaceut|farm[aá]cia|\btaf\b|psicolog|nutric|radiolog|sa[uú]de",
    re.I,
)

FORMADOR_TITLE_RE = re.compile(
    r"\bformador(?:a|es|as)?\b|"
    r"instrutor(?:a)?\s+de\s+(?:socorros|sbv|suporte)|"
    r"^forma[cç][aã]o\b",
    re.I,
)

COMERCIAL_TITLE_RE = re.compile(
    r"delegad[oa]\s+de\s+informa[cç][aã]o|"
    r"visitador(?:a)?\s+m[eé]dic|"
    r"comercial\s+farm",
    re.I,
)

HEALTH_CONTEXT_RE = re.compile(
    r"enferm|sa[uú]de|m[eé]dic|farm|fisioterap|terapeuta|"
    r"socorros|sbv|suporte\s+b[aá]sico|auxiliar\s+de\s+a[cç]|"
    r"cl[ií]nic|hospital|cuidados\s+de\s+sa|dent[aá]r|"
    r"radiolog|psicolog|nutri[cç]",
    re.I,
)

# Campos HTML das "Condições Requeridas" → linhas de requirements.
REQUIREMENT_LABELS = (
    "Habilitações Mínimas",
    "Formação Profissional Exigida",
    "Experiência anterior",
    "Tipo(s) de carta condução",
    "Data Prevista para início do Trabalho",
    "Cumprimento de Quotas? Recrutamento de pessoas com deficiência (Lei 4/2019)?",
    "Normas específicas de higiene e segurança no trabalho",
)

# Campos HTML das "Condições Oferecidas" → texto extra na descrição.
OFFERED_LABELS = (
    "Tipo de contrato",
    "Regime de trabalho",
    "Regime Horário",
    "Nº de Horas",
    "Formas de Prestação de Trabalho",
    "Remuneração base ilíquida",
    "Subsídio de refeição",
    "IRCT",
)


class IefpScraper(BaseScraper):
    slug = "iefp"
    name = "IEFP (ofertas saúde)"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=60.0, min_interval=0.45)
        try:
            client.client.headers.update(
                {
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    ),
                    "Accept-Language": "pt-PT,pt;q=0.9",
                }
            )
            ids: list[str] = []
            seen: set[str] = set()
            for dcpp in DCPP_TERMS:
                for offer_id in self._list_ids(client, dcpp=dcpp):
                    if offer_id in seen:
                        continue
                    seen.add(offer_id)
                    ids.append(offer_id)
            for text in TEXT_QUERIES:
                for offer_id in self._list_ids(client, text=text):
                    if offer_id in seen:
                        continue
                    seen.add(offer_id)
                    ids.append(offer_id)
            jobs: list[JobPayload] = []
            for offer_id in ids:
                job = self._detail(client, offer_id)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _list_ids(
        self,
        client: HttpClient,
        *,
        dcpp: str | None = None,
        text: str | None = None,
    ) -> list[str]:
        params: dict[str, str] = {
            "cat": "ofertaEmprego",
            "currentPage": "1",
            "resultsPerPage": "100",
        }
        if dcpp:
            params["dcpp"] = dcpp
        if text:
            params["text"] = text
        html = client.get_text(f"{SEARCH}?{urlencode(params)}")
        ids: list[str] = []
        for offer_id in re.findall(r"idOferta=(\d+)", html):
            if offer_id not in ids:
                ids.append(offer_id)
        return ids

    def _detail(self, client: HttpClient, offer_id: str) -> JobPayload | None:
        html = client.get_text(f"{DETAIL}?idOferta={offer_id}")
        posting = _json_ld_job(html)
        title = ((posting or {}).get("title") or _h1(html) or "").strip()
        if not title:
            return None

        fields = _labeled_fields(html)
        profile = html_to_text((posting or {}).get("description") or "")
        if not profile:
            profile = _section_text(html) or title

        blob = f"{title}\n{profile}"
        if not _is_relevant(title, blob):
            return None

        locality = ""
        region = ""
        job_location = (posting or {}).get("jobLocation") or {}
        address = job_location.get("address") or {}
        if isinstance(address, dict):
            locality = address.get("addressLocality") or ""
            region = address.get("addressRegion") or ""
        if not locality:
            locality = _locality_fallback(html)

        salary = _salary_from_fields(fields) or _salary_from_jsonld(posting)
        contract = _contract_from_fields(fields) or _contract_from_jsonld(posting)
        requirements = _requirements_from_fields(fields)
        vacancies = _vacancies(html)
        description = _compose_description(profile, fields, vacancies)

        published_at = (posting or {}).get("datePosted")
        if published_at and len(published_at) == 10:
            published_at = f"{published_at}T00:00:00+00:00"
        expires_at = (posting or {}).get("validThrough")
        if expires_at and len(expires_at) == 10:
            expires_at = f"{expires_at}T00:00:00+00:00"

        # O IEFP não expõe o empregador real (JSON-LD = "IEFP I.P.").
        company = "Entidade anunciante (via IEFP)"

        return JobPayload(
            title=title,
            company=company,
            location_district=guess_district(locality, region),
            location_concelho=locality or None,
            profession=guess_profession(title),
            specialty=None,
            sector="privado",
            contract_type=contract,
            description=description,
            requirements=requirements,
            salary=salary,
            application_url=f"{DETAIL}?idOferta={offer_id}",
            source=self.slug,
            source_id=str(offer_id),
            published_at=published_at,
            expires_at=expires_at,
        )


def _is_relevant(title: str, blob: str) -> bool:
    if COMERCIAL_TITLE_RE.search(title):
        return True
    if FORMADOR_TITLE_RE.search(title):
        return bool(HEALTH_CONTEXT_RE.search(blob))
    return bool(CLINICAL_TITLE_RE.search(title))


def _json_ld_job(html: str) -> dict | None:
    for match in re.finditer(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html,
        re.I | re.S,
    ):
        raw = match.group(1).strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("@type") == "JobPosting":
            return data
    return None


def _h1(html: str) -> str:
    match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    if not match:
        return ""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", match.group(1)))).strip()


def _locality_fallback(html: str) -> str:
    match = re.search(
        r'class="card-footer-text"[^>]*>(.*?)</span>',
        html,
        re.I | re.S,
    )
    if not match:
        return ""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", match.group(1)))).strip(" ;")


def _section_text(html: str) -> str:
    clean = re.sub(r"<script.*?</script>", " ", html, flags=re.I | re.S)
    match = re.search(
        r"Descri[cç][aã]o do Perfil(.*?)Condi[cç][oõ]es Oferecidas",
        clean,
        re.I | re.S,
    )
    if not match:
        return ""
    return html_to_text(match.group(1))


def _clean_label_text(value: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", value))
    text = text.replace("\xa0", " ").replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", text).strip(" ;")


def _labeled_fields(html: str) -> dict[str, str]:
    """Extrai pares label/valor do detalhe IEFP (Condições Oferecidas/Requeridas)."""
    fields: dict[str, str] = {}
    pattern = re.compile(
        r'<div class="text-muted text-uppercase">(.*?)</div>\s*'
        r"<div><strong>(.*?)</strong></div>",
        re.I | re.S,
    )
    for raw_label, raw_value in pattern.findall(html):
        label = _clean_label_text(raw_label)
        value = _clean_label_text(raw_value)
        if not label or not value:
            continue
        # Primeiro valor ganha (evita duplicados do layout responsivo).
        fields.setdefault(label, value)
    return fields


def _field(fields: dict[str, str], *names: str) -> str | None:
    for name in names:
        value = fields.get(name)
        if value:
            return value
        # Match case-insensitive / accents-tolerant.
        target = _norm_key(name)
        for key, val in fields.items():
            if _norm_key(key) == target and val:
                return val
    return None


def _norm_key(text: str) -> str:
    return (
        text.encode("ascii", "ignore")
        .decode("ascii")
        .lower()
        .replace(" ", "")
    )


def _vacancies(html: str) -> str | None:
    match = re.search(
        r"N\.?\s*º\s*de\s*Vagas.*?<div class=\"fs-3\">\s*(\d+)\s*</div>",
        html,
        re.I | re.S,
    )
    if not match:
        return None
    return match.group(1)


def _salary_from_jsonld(posting: dict | None) -> str | None:
    if not posting:
        return None
    base_salary = posting.get("baseSalary") or {}
    value = (base_salary.get("value") or {}) if isinstance(base_salary, dict) else {}
    if not isinstance(value, dict) or value.get("value") in (None, ""):
        return None
    try:
        amount = float(str(value["value"]).replace(",", "."))
    except ValueError:
        return None
    if amount <= 0:
        return None
    unit = str(value.get("unitText") or "").upper()
    if unit == "HOUR" or amount < 80:
        return f"{amount:g} €/hora"
    return f"{amount:g} €/mês"


def _salary_from_fields(fields: dict[str, str]) -> str | None:
    raw = _field(fields, "Remuneração base ilíquida")
    if not raw:
        return None
    # Ex.: "1499.15 EUR/Mês"
    match = re.search(
        r"([\d.,]+)\s*(?:EUR|€)?\s*/?\s*(m[eê]s|hora|h\b|month|hour)?",
        raw,
        re.I,
    )
    if not match:
        return raw
    try:
        amount = float(match.group(1).replace(",", "."))
    except ValueError:
        return raw
    unit = (match.group(2) or "").lower()
    if unit.startswith("hora") or unit == "h" or unit == "hour" or amount < 80:
        return f"{amount:g} €/hora"
    return f"{amount:g} €/mês"


def _contract_from_jsonld(posting: dict | None) -> str | None:
    if not posting:
        return None
    emp = posting.get("employmentType")
    if not emp:
        return None
    blob = str(emp).upper()
    if "PART" in blob:
        return "Tempo parcial"
    if "FULL" in blob:
        return "Tempo inteiro"
    return str(emp)


def _contract_from_fields(fields: dict[str, str]) -> str | None:
    tipo = _field(fields, "Tipo de contrato")
    regime = _field(fields, "Regime de trabalho")
    parts: list[str] = []
    if tipo:
        parts.append(tipo)
    if regime:
        # Evita repetir "A tempo completo" se já estiver no tipo.
        if not tipo or _norm_key(regime) not in _norm_key(tipo):
            parts.append(regime)
    if not parts:
        return None
    joined = " · ".join(parts)
    # Normaliza para buckets de filtro do site quando possível.
    low = joined.lower()
    if "parcial" in low:
        return f"{joined}" if tipo else "Tempo parcial"
    if "completo" in low or "inteiro" in low or "sem termo" in low:
        return joined
    return joined


def _requirements_from_fields(fields: dict[str, str]) -> str | None:
    lines: list[str] = []
    for label in REQUIREMENT_LABELS:
        value = _field(fields, label)
        if not value:
            continue
        # Encurtar label demasiado longa (quotas).
        short = label
        if "Quotas" in label or "deficiência" in label:
            short = "Recrutamento de pessoas com deficiência (Lei 4/2019)"
        if "início do Trabalho" in label or "inicio do Trabalho" in label:
            short = "Início previsto"
        if "carta condução" in label:
            short = "Carta de condução"
        if "higiene e segurança" in label:
            short = "Normas de higiene e segurança no trabalho"
        lines.append(f"- {short}: {value}")
    return "\n".join(lines) if lines else None


def _compose_description(
    profile: str,
    fields: dict[str, str],
    vacancies: str | None,
) -> str:
    blocks = [profile.strip()]
    offered: list[str] = []
    for label in OFFERED_LABELS:
        value = _field(fields, label)
        if value:
            offered.append(f"- {label}: {value}")
    if vacancies:
        offered.append(f"- N.º de vagas: {vacancies}")
    if offered:
        blocks.append("Condições oferecidas:\n" + "\n".join(offered))
    return "\n\n".join(block for block in blocks if block).strip()
