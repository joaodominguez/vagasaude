from __future__ import annotations

import json
import re
from urllib.parse import unquote

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, guess_profession, html_to_text, norm

SITEMAP = "https://jobs.freseniusmedicalcare.com/sitemap-a4072ddc-pt.xml"
COMPANY = "Fresenius Medical Care (NephroCare)"

# O sitemap "pt" mistura Portugal e Brasil; estes slugs são claramente do Brasil
# (bancos de talentos, Fluminense, vocabulário pt-BR) — evita pedidos inúteis.
BR_SLUG_RE = re.compile(
    r"banco-de-talentos|fluminense|estoquista|planejamento|-pleno|jovem-aprendiz|"
    r"analista-contabil|copeiro",
    re.I,
)
PT_COUNTRIES = {"pt", "prt", "portugal"}
EMPLOYMENT = {"FULL_TIME": "Tempo inteiro", "PART_TIME": "Tempo parcial"}
SALARY_RE = re.compile(
    r"Vencimento\s+Base\s+Anual,?\s*entre\s*([\d.,]+\s*€)\s*e\s*([\d.,]+\s*€)", re.I
)


class FreseniusScraper(BaseScraper):
    slug = "fresenius"
    name = "Fresenius Medical Care (NephroCare)"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        try:
            urls = _sitemap_urls(client.get_text(SITEMAP))
            for url in urls:
                if BR_SLUG_RE.search(unquote(url)):
                    continue
                source_id = _job_id(url)
                if source_id in seen:
                    continue
                seen.add(source_id)
                try:
                    html = client.get_text(url)
                except Exception:
                    continue
                job = parse_fresenius_detail(html, url=url, source=self.slug)
                if job:
                    jobs.append(job)
        finally:
            client.close()
        return jobs


def _sitemap_urls(xml: str) -> list[str]:
    out: list[str] = []
    for loc in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml):
        if "/job/" in loc and loc not in out:
            out.append(loc)
    return out


def _job_id(url: str) -> str:
    return url.rstrip("/").split("/")[-1]


def _job_posting(html: str) -> dict | None:
    for raw in re.findall(
        r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I
    ):
        try:
            data = json.loads(raw)
        except ValueError:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict) and item.get("@type") == "JobPosting":
                return item
    return None


def _pt_address(posting: dict) -> dict | None:
    locations = posting.get("jobLocation") or []
    if isinstance(locations, dict):
        locations = [locations]
    for loc in locations:
        address = (loc or {}).get("address") or {}
        country = address.get("addressCountry")
        if isinstance(country, dict):
            country = country.get("name")
        if norm(str(country or "")) in PT_COUNTRIES:
            return address
    return None


def _concelho_from_title(title: str) -> str | None:
    # "Enfermeiro | Madeira - Machico" -> "Machico"; addressLocality às vezes é a rua.
    if "|" not in title:
        return None
    for part in re.split(r"\s*\|\s*|\s+-\s+", title.split("|", 1)[1]):
        part = part.strip()
        if part and norm(part) not in {"madeira", "acores"}:
            return part
    return None


def _clean_text(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"(?m)^•\s*", "- ", text)
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def parse_fresenius_detail(html: str, url: str, source: str = "fresenius") -> JobPayload | None:
    posting = _job_posting(html)
    if not posting:
        return None
    # Só vagas em Portugal (o site PT também lista o Brasil).
    address = _pt_address(posting)
    if address is None:
        return None
    title = re.sub(r"\s+", " ", posting.get("title") or "").strip()
    if not title:
        return None
    # Só funções de saúde (ex.: fica de fora "Field Sales Service Technician").
    if guess_profession(title) == "Outros":
        return None
    city = _concelho_from_title(title) or (address.get("addressLocality") or "").strip() or None
    region = (address.get("addressRegion") or "").strip() or None
    # addressRegion já vem como distrito (ex.: Setúbal); a localidade é o concelho.
    district = guess_district(region, city)
    if district == "Portugal":
        district = guess_district(city)
    description = _clean_text(html_to_text(posting.get("description"))) or title

    types = posting.get("employmentType") or []
    if isinstance(types, str):
        types = [types]
    contract = next((EMPLOYMENT[t] for t in types if t in EMPLOYMENT), None)
    contract = contract or guess_contract(description[:600])

    salary = None
    m = SALARY_RE.search(description)
    if m:
        salary = f"{m.group(1).replace(' ', '')} – {m.group(2).replace(' ', '')} (base anual)"

    valid = posting.get("validThrough")
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession=guess_profession(title),
        specialty=None,
        sector="privado",
        contract_type=contract,
        description=description,
        requirements=None,
        salary=salary,
        application_url=posting.get("url") or url,
        source=source,
        source_id=_job_id(url),
        published_at=posting.get("datePosted"),
        expires_at=str(valid)[:10] if valid else None,
    )
