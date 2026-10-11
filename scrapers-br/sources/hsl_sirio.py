from __future__ import annotations

import re
from html import unescape
from urllib.parse import urljoin

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import (
    guess_contract,
    guess_profession,
    html_to_text,
    looks_like_hospital_employer_job,
    state_from_uf,
)

BASE = "https://vagas.hsl.org.br"
LIST_URLS = [
    f"{BASE}/search/?q=&sortColumn=referencedate&sortDirection=desc",
    f"{BASE}/go/Todas-as-vagas/4566519/",
    f"{BASE}/viewalljobs/",
]


class HslSirioScraper(BaseScraper):
    """Hospital Sírio-Libanês (privado) — SAP SuccessFactors.

    Volume público costuma ser baixo/opaco (cookie wall / JS). O braço OSS/SUS
    do ecossistema Sírio já é coberto por `irssl` (Gupy). Este módulo captura
    vagas do hospital privado quando o board SF lista `/job/…`.
    """

    slug = "hsl_sirio"
    name = "Hospital Sírio-Libanês"
    company = "Hospital Sírio-Libanês"
    sector = "privado"
    max_detail_fetches = 60

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://hospitalsiriolibanes.org.br/trabalhe-conosco",
            }
        )
        try:
            # Warm-up homepage (cookie consent banner)
            try:
                client.get_text(f"{BASE}/")
            except Exception:  # noqa: BLE001
                pass

            paths = self._list_paths(client)
            if not paths:
                print("[hsl_sirio] board SF sem /job/ públicos (usar irssl para OSS)")
                return []

            jobs: list[JobPayload] = []
            for path in paths[: self.max_detail_fetches]:
                job = self._detail(client, path)
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _list_paths(self, client: HttpClient) -> list[str]:
        seen: dict[str, str] = {}
        for url in LIST_URLS:
            try:
                html = client.get_text(url)
            except Exception as exc:  # noqa: BLE001
                print(f"[hsl_sirio] listagem {url}: {exc}")
                continue
            for path in re.findall(r'href="(/job/[^"]+)"', html):
                path = unescape(path)
                if path not in seen:
                    seen[path] = path
        return list(seen)

    def _detail(self, client: HttpClient, path: str) -> JobPayload | None:
        url = urljoin(BASE, path)
        html = client.get_text(url)
        title = _meta(html, "og:title") or _h1(html) or path
        title = re.sub(r"\s+", " ", title).strip()
        if not title:
            return None
        if not looks_like_hospital_employer_job(title):
            return None

        description = (
            _meta(html, "og:description")
            or html_to_text(_job_body(html))
            or title
        )
        source_id = path.rstrip("/").rsplit("/", 1)[-1]
        city, uf = _guess_location(f"{title} {description} {path}")

        return JobPayload(
            title=title,
            company=self.company,
            location_district=state_from_uf(uf, None),
            location_concelho=city,
            profession=guess_profession(title),
            specialty=None,
            sector=self.sector,
            contract_type=guess_contract(f"{title} {description[:200]}"),
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
    return re.sub(
        r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", match.group(1)))
    ).strip()


def _job_body(html: str) -> str:
    match = re.search(
        r'class="[^"]*job[^"]*description[^"]*"[^>]*>(.*?)</div>',
        html,
        re.I | re.S,
    )
    return match.group(1) if match else ""


def _guess_location(text: str) -> tuple[str | None, str]:
    low = text.lower()
    if "brasília" in low or "brasilia" in low or "df" in low:
        return "Brasília", "DF"
    return "São Paulo", "SP"
