from __future__ import annotations

import re
from html import unescape
from urllib.parse import urljoin

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_profession, html_to_text

BASE = "https://ipoporto.pt"
LIST_URL = f"{BASE}/nos-ipo/emprego-e-carreira/"

CLOSED_RE = re.compile(
    r"homologa[cç][aã]o|lista (unit[aá]ria|de ordena)|"
    r"cessa[cç][aã]o|sem efeito|encerrado|prazo.*termin",
    re.I,
)


class IpoPortoScraper(BaseScraper):
    slug = "ipo_porto"
    name = "IPO Porto (emprego)"

    def fetch(self) -> list[JobPayload]:
        # O WordPress do IPO limita pedidos seguidos (429).
        client = HttpClient(timeout=45.0, min_interval=1.2)
        try:
            items = self._list(client)
            jobs: list[JobPayload] = []
            for item in items:
                try:
                    job = self._detail(client, item)
                except Exception:
                    continue
                if job:
                    jobs.append(job)
            return jobs
        finally:
            client.close()

    def _list(self, client: HttpClient) -> list[dict]:
        html = client.get_text(LIST_URL)
        by_url: dict[str, dict] = {}
        for href, label in re.findall(
            r'<a[^>]+href="(https://ipoporto\.pt/emprego/[^"]+)"[^>]*>(.*?)</a>',
            html,
            re.I | re.S,
        ):
            title = re.sub(
                r"\s+",
                " ",
                unescape(re.sub(r"<[^>]+>", " ", label)),
            ).strip()
            if not title or href.rstrip("/") == f"{BASE}/emprego":
                continue
            by_url[href] = {"title": title, "url": href}
        return list(by_url.values())

    def _detail(self, client: HttpClient, item: dict) -> JobPayload | None:
        html = client.get_text(item["url"])
        title = _page_title(html) or item["title"]
        if CLOSED_RE.search(title):
            return None
        description = _extract_body(html) or title
        if CLOSED_RE.search(description[:500]):
            return None

        source_id = item["url"].rstrip("/").rsplit("/", 1)[-1]
        published = _published_at(html)

        return JobPayload(
            title=_clean_title(title),
            company="IPO Porto",
            location_district="Porto",
            location_concelho="Porto",
            profession=guess_profession(title, description[:240]),
            specialty=None,
            sector="publico",
            contract_type="Contrato",
            description=description,
            requirements=None,
            salary=None,
            application_url=item["url"],
            source=self.slug,
            source_id=source_id,
            published_at=published,
        )


def _page_title(html: str) -> str:
    match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    if not match:
        return ""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", match.group(1)))).strip()


def _extract_body(html: str) -> str:
    match = re.search(r"<article[^>]*>(.*?)</article>", html, re.I | re.S)
    if not match:
        match = re.search(
            r'class="[^"]*entry-content[^"]*"[^>]*>(.*?)</div>',
            html,
            re.I | re.S,
        )
    if not match:
        return ""
    return html_to_text(match.group(1))


def _clean_title(title: str) -> str:
    # "proc. 021/2026 CONTRATAÇÃO DE 20 ENFERMEIROS..."
    cleaned = re.sub(r"^proc\.?\s*\d+/\d+\s*", "", title, flags=re.I).strip()
    if len(cleaned) > 160:
        cleaned = cleaned[:157].rstrip() + "…"
    return cleaned or title


def _published_at(html: str) -> str | None:
    match = re.search(r'datetime="(\d{4}-\d{2}-\d{2})', html, re.I)
    if match:
        return f"{match.group(1)}T00:00:00+00:00"
    return None
