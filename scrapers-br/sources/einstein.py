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
    looks_like_health_job,
    state_from_uf,
)

BASE = "https://trabalheconosco.vagas.com.br"
LIST_PATH = "/alberteinstein/oportunidades"
JOB_HREF_RE = re.compile(
    r"^/alberteinstein/oportunidade/([^/]+)/(\d+)/?$",
    re.I,
)


class EinsteinScraper(BaseScraper):
    slug = "einstein"
    name = "Hospital Israelita Albert Einstein"
    company = "Hospital Israelita Albert Einstein"
    sector = "privado"
    max_pages = 15

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            seen: dict[str, str] = {}
            for page in range(1, self.max_pages + 1):
                url = f"{BASE}{LIST_PATH}" if page == 1 else f"{BASE}{LIST_PATH}?pagina={page}"
                html = client.get_text(url)
                batch = self._parse_list(html)
                if not batch:
                    break
                for job_id, path in batch.items():
                    seen[job_id] = path
                if f"pagina={page + 1}" not in html and page > 1:
                    # last page heuristic
                    if len(batch) < 5:
                        break

            jobs: list[JobPayload] = []
            for job_id, path in seen.items():
                application_url = urljoin(BASE, path)
                try:
                    detail_html = client.get_text(application_url)
                except Exception as exc:  # noqa: BLE001
                    print(f"[einstein] detalhe {job_id}: {exc}")
                    continue
                job = self._parse_detail(job_id, application_url, detail_html)
                if job and looks_like_health_job(job.title):
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _parse_list(self, html: str) -> dict[str, str]:
        soup = BeautifulSoup(html, "html.parser")
        found: dict[str, str] = {}
        for a in soup.find_all("a", href=True):
            href = a["href"]
            match = JOB_HREF_RE.match(href.split("?")[0])
            if not match:
                continue
            job_id = match.group(2)
            found[job_id] = href.split("?")[0]
        return found

    def _parse_detail(
        self, job_id: str, application_url: str, html: str
    ) -> JobPayload | None:
        soup = BeautifulSoup(html, "html.parser")
        title_el = soup.find("h1") or soup.find("h2")
        title = title_el.get_text(" ", strip=True) if title_el else ""
        if not title:
            # fallback from URL slug
            slug = application_url.rstrip("/").split("/")[-2]
            title = slug.replace("-", " ").strip()
        if not title:
            return None

        text = soup.get_text("\n", strip=True)
        city, uf = _extract_location(text)
        description = ""
        for sel in [".job-description", "#job-description", "article", ".conteudo"]:
            node = soup.select_one(sel)
            if node:
                description = html_to_text(str(node))
                if len(description) > 80:
                    break
        if not description:
            description = html_to_text(html)[:2500] or title

        return JobPayload(
            title=title,
            company=self.company,
            location_district=state_from_uf(uf, None),
            location_concelho=city,
            profession=guess_profession(title),
            specialty=None,
            sector=self.sector,
            contract_type=guess_contract(title + " " + description[:200]),
            description=description,
            requirements=None,
            salary=None,
            application_url=application_url,
            source=self.slug,
            source_id=job_id,
            published_at=None,
        )


def _extract_location(text: str) -> tuple[str | None, str | None]:
    match = re.search(
        r"([A-Za-zÀ-ú .'-]+),\s*([A-Z]{2})\b",
        text,
    )
    if match:
        return match.group(1).strip(), match.group(2)
    match = re.search(r"\b(São Paulo|Rio de Janeiro|Belo Horizonte|Goiânia)\b", text)
    if match:
        city = match.group(1)
        uf = {
            "São Paulo": "SP",
            "Rio de Janeiro": "RJ",
            "Belo Horizonte": "MG",
            "Goiânia": "GO",
        }.get(city)
        return city, uf
    return None, "SP"
