from __future__ import annotations

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

BASE = "https://app.jobconvo.com"
CAREERS_PATH = (
    "/pt-br/careers/hospital-mater-dei/"
    "6fcf22e3-009f-40e9-94ea-25e36ed95d22/"
)
JOB_HREF_RE = re.compile(
    r"(?:https?://app\.jobconvo\.com)?(/job/[^\"'#?\s]+)",
    re.I,
)
CITY_UF = {
    "belo horizonte": ("Belo Horizonte", "MG"),
    "betim": ("Betim", "MG"),
    "nova lima": ("Nova Lima", "MG"),
    "salvador": ("Salvador", "BA"),
    "feira de santana": ("Feira de Santana", "BA"),
    "mariana": ("Mariana", "MG"),
}


class MaterDeiScraper(BaseScraper):
    """Rede Mater Dei — portal JobConvo (volume volátil)."""

    slug = "mater_dei"
    name = "Rede Mater Dei de Saúde"
    company = "Rede Mater Dei de Saúde"
    sector = "privado"
    max_detail_fetches = 80

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://www.materdei.com.br/",
            }
        )
        try:
            list_url = urljoin(BASE, CAREERS_PATH)
            html = client.get_text(list_url)
            listing = self._parse_list(html)
            if not listing:
                print("[mater_dei] nenhuma vaga listada no JobConvo (board vazio)")
                return []

            jobs: list[JobPayload] = []
            for path, meta in list(listing.items())[: self.max_detail_fetches]:
                title = meta.get("title") or ""
                if title and not looks_like_hospital_employer_job(title):
                    continue
                application_url = urljoin(BASE, path)
                try:
                    detail_html = client.get_text(application_url)
                except Exception as exc:  # noqa: BLE001
                    print(f"[mater_dei] detalhe {path}: {exc}")
                    continue
                job = self._parse_detail(application_url, detail_html, meta)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _parse_list(self, html: str) -> dict[str, dict[str, str | None]]:
        soup = BeautifulSoup(html, "html.parser")
        found: dict[str, dict[str, str | None]] = {}

        # Card layout (.joblist_in > a) when JobConvo renders open roles
        for a in soup.select(".joblist_in a[href], a[href*='/job/']"):
            href = a.get("href") or ""
            match = JOB_HREF_RE.search(href)
            if not match:
                continue
            path = match.group(1)
            title_el = a.select_one("h2.jobname, .jobname, h2, h3")
            title = (
                title_el.get_text(" ", strip=True)
                if title_el
                else a.get_text(" ", strip=True)
            )
            title = re.sub(r"\s+", " ", title).strip()
            if not title or title.lower().startswith("nenhuma"):
                continue
            loc_text = a.get_text(" ", strip=True)
            city, uf = _guess_city(loc_text)
            found[path] = {"title": title, "city": city, "uf": uf}

        # Table layout (historically used on Mater Dei careers)
        for row in soup.select("table tr"):
            a = row.find("a", href=True)
            if not a:
                continue
            match = JOB_HREF_RE.search(a["href"])
            if not match:
                continue
            path = match.group(1)
            cells = [c.get_text(" ", strip=True) for c in row.find_all(["td", "th"])]
            title = a.get_text(" ", strip=True) or (cells[0] if cells else "")
            blob = " ".join(cells)
            city, uf = _guess_city(blob)
            if title:
                found[path] = {"title": title, "city": city, "uf": uf}

        return found

    def _parse_detail(
        self,
        application_url: str,
        html: str,
        meta: dict[str, str | None],
    ) -> JobPayload | None:
        soup = BeautifulSoup(html, "html.parser")
        title_el = soup.find("h1") or soup.find("h2")
        title = (
            title_el.get_text(" ", strip=True)
            if title_el
            else (meta.get("title") or "")
        ).strip()
        if not title:
            return None
        if not looks_like_hospital_employer_job(title):
            return None

        description = ""
        for sel in [
            ".job-description",
            "#description",
            ".description",
            "article",
            ".container",
        ]:
            node = soup.select_one(sel)
            if node:
                description = html_to_text(str(node))
                if len(description) > 80:
                    break
        if not description:
            description = html_to_text(html)[:2500] or title

        city = meta.get("city")
        uf = meta.get("uf")
        if not city or not uf:
            c2, u2 = _guess_city(soup.get_text(" ", strip=True))
            city = city or c2
            uf = uf or u2

        source_id = application_url.rstrip("/").rsplit("/", 1)[-1]
        return JobPayload(
            title=title,
            company=self.company,
            location_district=state_from_uf(uf, None) if uf else state_from_uf("MG", None),
            location_concelho=city,
            profession=guess_profession(title),
            specialty=None,
            sector=self.sector,
            contract_type=guess_contract(f"{title} {description[:200]}"),
            description=description,
            requirements=None,
            salary=None,
            application_url=application_url,
            source=self.slug,
            source_id=source_id,
            published_at=None,
        )


def _guess_city(text: str) -> tuple[str | None, str | None]:
    low = (text or "").lower()
    for key, (city, uf) in CITY_UF.items():
        if key in low:
            return city, uf
    return None, None
