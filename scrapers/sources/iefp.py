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
]

CLINICAL_TITLE_RE = re.compile(
    r"enferm|fisioterap|terapeuta|auxiliar de sa|m[eé]dic|"
    r"farmaceut|psicolog|nutric|radiolog|sa[uú]de",
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

        description = html_to_text((posting or {}).get("description") or "")
        if not description:
            description = _section_text(html) or title
        blob = f"{title}\n{description}"

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

        salary = None
        base_salary = (posting or {}).get("baseSalary") or {}
        value = (base_salary.get("value") or {}) if isinstance(base_salary, dict) else {}
        if isinstance(value, dict) and value.get("value") not in (None, ""):
            try:
                amount = float(str(value["value"]).replace(",", "."))
            except ValueError:
                amount = None
            if amount is not None and amount > 0:
                if amount < 80:
                    salary = f"{amount:g} €/hora"
                else:
                    salary = f"{amount:g} €/mês"

        contract = None
        emp = (posting or {}).get("employmentType")
        if emp:
            contract = "Tempo inteiro" if "FULL" in str(emp).upper() else str(emp)

        published_at = (posting or {}).get("datePosted")
        if published_at and len(published_at) == 10:
            published_at = f"{published_at}T00:00:00+00:00"
        expires_at = (posting or {}).get("validThrough")
        if expires_at and len(expires_at) == 10:
            expires_at = f"{expires_at}T00:00:00+00:00"

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
            requirements=None,
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
