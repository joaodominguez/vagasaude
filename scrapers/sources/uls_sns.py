from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_profession, html_to_text

# Sites SNS WordPress (template snsch-contests) — acessíveis a partir do VPS.
MAX_PAGES = 8
SKIP_RE = re.compile(
    r"central\s+telef|telefonista|jardim|limpeza\b|motorista|"
    r"administrador(?:es)?\s+hospitalares",
    re.I,
)
CLINICAL_RE = re.compile(
    r"enferm|m[eé]dic|farmac|fisioterap|terapeuta|radiolog|nutric|"
    r"psicolog|t[eé]cnic|auxiliar\s+de\s+sa[uú]de|assistente\s+operacional|"
    r"diagn[oó]stico|terap[eê]utica|sa[uú]de",
    re.I,
)
BEP_RE = re.compile(r"OE\d{6}/\d+|CodOferta=(\d+)", re.I)


class _UlsWpBase(BaseScraper):
    company: str
    district: str
    list_url: str

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(timeout=45.0, min_interval=0.45)
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
        try:
            jobs: list[JobPayload] = []
            seen: set[str] = set()
            for page in range(1, MAX_PAGES + 1):
                url = self._page_url(page)
                try:
                    html = client.get_text(url)
                except Exception:  # noqa: BLE001
                    break
                batch = _parse_tenders(html, self)
                if not batch:
                    break
                for job in batch:
                    if job.source_id in seen:
                        continue
                    seen.add(job.source_id)
                    jobs.append(job)
                if len(batch) < 5:
                    break
            return jobs
        finally:
            client.close()

    def _page_url(self, page: int) -> str:
        base = self.list_url.rstrip("/") + "/"
        if page <= 1:
            return f"{base}?status=active"
        return f"{base}page/{page}/?status=active"


def _parse_tenders(html: str, scraper: _UlsWpBase) -> list[JobPayload]:
    soup = BeautifulSoup(html, "lxml")
    jobs: list[JobPayload] = []
    for art in soup.select("article.tender-item"):
        badge = art.select_one(".tender-status-badge")
        status = badge.get_text(" ", strip=True).lower() if badge else ""
        if badge and "open" not in (badge.get("class") or []) and "curso" not in status:
            continue
        link_el = art.select_one("h2.tender-title a") or art.select_one("a[href]")
        if not link_el:
            continue
        title = link_el.get_text(" ", strip=True)
        href = urljoin(scraper.list_url, link_el.get("href") or "")
        if not title or not href:
            continue
        if SKIP_RE.search(title):
            continue
        if not CLINICAL_RE.search(title):
            continue
        excerpt = ""
        ex = art.select_one(".tender-excerpt")
        if ex:
            excerpt = html_to_text(str(ex))
        source_id = None
        m = BEP_RE.search(excerpt) or BEP_RE.search(href)
        if m:
            source_id = m.group(0) if m.lastindex is None else (m.group(1) or m.group(0))
        if not source_id:
            source_id = href.rstrip("/").rsplit("/", 1)[-1]
        desc = excerpt or title
        jobs.append(
            JobPayload(
                title=title,
                company=scraper.company,
                location_district=scraper.district,
                location_concelho=scraper.district,
                profession=guess_profession(title, excerpt[:240]),
                specialty=None,
                sector="publico",
                contract_type="Contrato",
                description=desc[:5000],
                requirements=None,
                salary=None,
                application_url=href,
                source=scraper.slug,
                source_id=str(source_id),
                published_at=None,
            )
        )
    return jobs


class UlsSaoJoseScraper(_UlsWpBase):
    slug = "uls_sao_jose"
    name = "ULS São José"
    company = "ULS São José, EPE"
    district = "Lisboa"
    list_url = "https://www.ulssjose.min-saude.pt/concursos-de-admissao-de-pessoal/"


class UlsCoimbraScraper(_UlsWpBase):
    slug = "uls_coimbra"
    name = "ULS Coimbra"
    company = "ULS de Coimbra, EPE"
    district = "Coimbra"
    list_url = "https://www.ulscoimbra.min-saude.pt/concursos/"
