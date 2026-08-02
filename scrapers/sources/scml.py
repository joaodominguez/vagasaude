from __future__ import annotations

import re
from html import unescape
from urllib.parse import urljoin

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_district, guess_profession, html_to_text

BASE = "https://recrutamento.scml.pt"
LIST_URLS = [
    f"{BASE}/go/Todas-as-oportunidades/8801502/",
    f"{BASE}/search/?q=&sortColumn=referencedate&sortDirection=desc",
]

HEALTH_RE = re.compile(
    r"enferm|auxiliar de a[cç][aã]o m[eé]dica|auxiliar de geriatr|"
    r"m[eé]dic|fisioterap|terapeuta|sa[uú]de|cuidador|"
    r"psicolog|nutric|farmac",
    re.I,
)
SKIP_RE = re.compile(
    r"educadora de inf[aâ]ncia|a[cç][aã]o educativa|inform[aá]tic|"
    r"jur[ií]dic|motorista|cozinh",
    re.I,
)


class ScmlScraper(BaseScraper):
    slug = "scml"
    name = "Santa Casa Misericórdia Lisboa"

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.4)
        try:
            paths = self._list_paths(client)
            jobs: list[JobPayload] = []
            for path in paths:
                job = self._detail(client, path)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _list_paths(self, client: HttpClient) -> list[str]:
        seen: dict[str, str] = {}
        for url in LIST_URLS:
            html = client.get_text(url)
            for path in re.findall(r'href="(/job/[^"]+)"', html):
                path = unescape(path)
                if path not in seen:
                    seen[path] = path
        return list(seen)

    def _detail(self, client: HttpClient, path: str) -> JobPayload | None:
        url = urljoin(BASE, path)
        html = client.get_text(url)
        title = _meta(html, "og:title") or _h1(html) or path
        title = title.strip()
        if SKIP_RE.search(title) and not HEALTH_RE.search(title):
            return None
        if not HEALTH_RE.search(title):
            # permanent ads for non-health roles
            return None

        description = (
            _meta(html, "og:description")
            or html_to_text(_job_body(html))
            or title
        )
        source_id = path.rstrip("/").rsplit("/", 1)[-1]
        district = guess_district(description, "Lisboa")
        # URLs often include parish names
        for city in ("Mafra", "Albarraque", "Lisboa", "Amadora", "Sintra"):
            if re.search(rf"\b{city}\b", f"{title} {description} {path}", re.I):
                district = guess_district(city)
                break

        return JobPayload(
            title=title,
            company="Santa Casa da Misericórdia de Lisboa",
            location_district=district,
            location_concelho=None,
            profession=guess_profession(title, description[:240]),
            specialty=None,
            sector="ipss",
            contract_type=None,
            description=description,
            requirements=None,
            salary=None,
            application_url=url,
            source=self.slug,
            source_id=source_id,
            published_at=None,
        )


def _meta(html: str, prop: str) -> str:
    match = re.search(
        rf'property="{re.escape(prop)}"[^>]*content="([^"]*)"',
        html,
        re.I,
    )
    return unescape(match.group(1)).strip() if match else ""


def _h1(html: str) -> str:
    match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    if not match:
        return ""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", match.group(1)))).strip()


def _job_body(html: str) -> str:
    match = re.search(
        r'class="[^"]*job[^"]*description[^"]*"[^>]*>(.*?)</div>',
        html,
        re.I | re.S,
    )
    return match.group(1) if match else ""
