from __future__ import annotations

import json
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_profession,
    html_to_text,
    looks_like_hospital_employer_job,
    state_from_uf,
)

BASE = "https://trabalheconosco.vagas.com.br"
LD_JSON_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.I | re.S,
)
CITY_UF_RE = re.compile(
    r"([A-Za-zÀ-ú][A-Za-zÀ-ú .'-]{1,40}),\s*([A-Z]{2})\b"
)


class VagasComScraper(BaseScraper):
    """Cliente partilhado para employer portals `trabalheconosco.vagas.com.br/{slug}`."""

    slug: str
    name: str
    company: str
    employer_path: str  # ex.: alberteinstein | grupo-fleury
    sector: str = "privado"
    max_pages = 25
    referer: str = "https://www.google.com/"

    @property
    def list_url(self) -> str:
        return f"{BASE}/{self.employer_path}/oportunidades"

    @property
    def job_href_re(self) -> re.Pattern[str]:
        return re.compile(
            rf"^/{re.escape(self.employer_path)}/oportunidade/([^/]+)/(\d+)/?$",
            re.I,
        )

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
                "Referer": self.referer,
            }
        )
        try:
            seen: dict[str, str] = {}
            next_url: str | None = self.list_url
            for _ in range(self.max_pages):
                if not next_url:
                    break
                html = client.get_text(next_url)
                batch = self._parse_list(html)
                if not batch:
                    break
                for job_id, path in batch.items():
                    seen[job_id] = path
                next_url = self._next_page_url(html)

            jobs: list[JobPayload] = []
            for job_id, path in seen.items():
                application_url = urljoin(BASE, path)
                try:
                    detail_html = client.get_text(application_url)
                except Exception as exc:  # noqa: BLE001
                    print(f"[{self.slug}] detalhe {job_id}: {exc}")
                    continue
                job = self._parse_detail(job_id, application_url, detail_html)
                if job and looks_like_hospital_employer_job(job.title):
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _parse_list(self, html: str) -> dict[str, str]:
        soup = BeautifulSoup(html, "html.parser")
        found: dict[str, str] = {}
        href_re = self.job_href_re
        for a in soup.select(
            "a.job-box[href], a.box.job-box[href], a[href*='/oportunidade/']"
        ):
            href = (a.get("href") or "").split("?")[0]
            match = href_re.match(href)
            if not match:
                continue
            found[match.group(2)] = href
        if found:
            return found
        for a in soup.find_all("a", href=True):
            href = a["href"].split("?")[0]
            match = href_re.match(href)
            if match:
                found[match.group(2)] = href
        return found

    def _next_page_url(self, html: str) -> str | None:
        soup = BeautifulSoup(html, "html.parser")
        link = soup.find("link", rel="next")
        if link and link.get("href"):
            return urljoin(BASE, link["href"])
        a = soup.select_one('a[rel="next"], a.next_page, a[aria-label*="róxima" i]')
        if a and a.get("href"):
            return urljoin(BASE, a["href"])
        return None

    def _parse_detail(
        self, job_id: str, application_url: str, html: str
    ) -> JobPayload | None:
        soup = BeautifulSoup(html, "html.parser")
        ld = self._job_posting_ld(html)

        title = ""
        if ld and ld.get("title"):
            title = str(ld["title"]).strip()
        if not title:
            title_el = soup.find("h1") or soup.find("h2")
            title = title_el.get_text(" ", strip=True) if title_el else ""
        if not title:
            slug = application_url.rstrip("/").split("/")[-2]
            title = slug.replace("-", " ").strip()
        if not title:
            return None

        city, uf = self._location_from_ld(ld)
        if not city or not uf:
            local = soup.select_one(".local-wrapper, .localization")
            if local:
                c2, u2 = _extract_location(local.get_text(" ", strip=True))
                city = city or c2
                uf = uf or u2
        if not city or not uf:
            c2, u2 = _extract_location(soup.get_text("\n", strip=True))
            city = city or c2
            uf = uf or u2
        if not uf:
            uf = "SP"

        description = ""
        if ld and ld.get("description"):
            description = html_to_text(str(ld["description"]))
        if len(description) < 80:
            for sel in [
                ".job-description",
                "#job-description",
                ".vg-job-description",
                "article",
                ".conteudo",
            ]:
                node = soup.select_one(sel)
                if node:
                    description = html_to_text(str(node))
                    if len(description) > 80:
                        break
        if not description:
            description = html_to_text(html)[:2500] or title

        blob = f"{title}\n{description[:400]}"
        contract = guess_contract(blob)
        if not contract and ld:
            emp = ld.get("employmentType")
            if isinstance(emp, str):
                contract = guess_contract(emp) or emp
            elif isinstance(emp, list):
                contract = guess_contract(" ".join(str(x) for x in emp))

        published = None
        if ld and ld.get("datePosted"):
            published = str(ld["datePosted"])[:32]

        org = None
        if ld and isinstance(ld.get("hiringOrganization"), dict):
            org = ld["hiringOrganization"].get("name")

        return JobPayload(
            title=title,
            company=str(org).strip() if org else self.company,
            location_district=state_from_uf(uf, None),
            location_concelho=city,
            profession=guess_profession(title),
            specialty=None,
            sector=self.sector,
            contract_type=contract,
            description=description,
            requirements=None,
            salary=None,
            application_url=application_url,
            source=self.slug,
            source_id=job_id,
            published_at=published,
        )

    def _job_posting_ld(self, html: str) -> dict | None:
        for match in LD_JSON_RE.finditer(html):
            raw = match.group(1).strip()
            raw = re.sub(r"^//<!\[CDATA\[\s*", "", raw)
            raw = re.sub(r"\s*//\]\]>$", "", raw)
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") == "JobPosting":
                        return item
            elif isinstance(data, dict) and data.get("@type") == "JobPosting":
                return data
        return None

    def _location_from_ld(self, ld: dict | None) -> tuple[str | None, str | None]:
        if not ld:
            return None, None
        loc = ld.get("jobLocation")
        if isinstance(loc, list) and loc:
            loc = loc[0]
        if not isinstance(loc, dict):
            return None, None
        addr = loc.get("address") if isinstance(loc.get("address"), dict) else loc
        if not isinstance(addr, dict):
            return None, None
        city = addr.get("addressLocality")
        region = addr.get("addressRegion")
        uf = None
        if isinstance(region, str):
            region = region.strip()
            if re.fullmatch(r"[A-Z]{2}", region):
                uf = region
            else:
                city = city or region
        return (
            str(city).strip() if city else None,
            uf,
        )


def _extract_location(text: str) -> tuple[str | None, str | None]:
    """Parse 'São Paulo, SP' — ignore short tokens like 'Ps' from 'Uti, Ps, PA'."""
    for match in CITY_UF_RE.finditer(text or ""):
        city = match.group(1).strip(" -•|,")
        uf = match.group(2)
        if len(city) < 3 or city.lower() in {"uti", "ps", "pa", "cme", "pcd"}:
            continue
        if uf in {
            "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
            "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO",
            "RR", "SC", "SP", "SE", "TO",
        }:
            return city, uf
    known = {
        "São Paulo": "SP",
        "Rio de Janeiro": "RJ",
        "Belo Horizonte": "MG",
        "Goiânia": "GO",
        "Aparecida de Goiânia": "GO",
    }
    for city, uf in known.items():
        if re.search(rf"\b{re.escape(city)}\b", text or "", re.I):
            return city, uf
    return None, None


class EinsteinScraper(VagasComScraper):
    """Hospital Israelita Albert Einstein — portal Vagas.com.

    Nota operacional: o ASN/IP do VPS Hetzner recebe Cloudflare 1005 (403) em
    vagas.com.br. Correr off-VPS + ingest em :3011 / vagasaude.com.br.
    """

    slug = "einstein"
    name = "Hospital Israelita Albert Einstein"
    company = "Hospital Israelita Albert Einstein"
    employer_path = "alberteinstein"
    sector = "privado"
    referer = "https://www.einstein.br/"


class FleuryScraper(VagasComScraper):
    """Grupo Fleury — medicina diagnóstica (Vagas.com).

    Mesmo bloqueio CF 1005 no VPS Hetzner que Einstein — skip em `--source all`.
    """

    slug = "fleury"
    name = "Grupo Fleury"
    company = "Grupo Fleury"
    employer_path = "grupo-fleury"
    sector = "privado"
    referer = "https://carreiras.grupofleury.com.br/"
