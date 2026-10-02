from __future__ import annotations

import re
from html import unescape
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_profession, html_to_text

BASE = "https://www.gov.br/inca/pt-br"
CONCURSO_INDEX = f"{BASE}/acesso-a-informacao/institucional/concurso-publico"
CONCURSO_YEARS = (
    f"{CONCURSO_INDEX}/2025",
)
ENSINO_PAGES = (
    f"{BASE}/assuntos/ensino/residencias/medica",
    f"{BASE}/assuntos/ensino",
)
NEWS_SEARCH = f"{BASE}/@@search"

OPEN_HINT_RE = re.compile(
    r"edital|sele[cç][aã]o|concurso|inscri[cç]|vaga|resid[eê]ncia|fellow|aperfei[cç]",
    re.I,
)
SKIP_RE = re.compile(r"cookie|privacidade|acessibilidade|mapa\s+do\s+site", re.I)


class IncaScraper(BaseScraper):
    """INCA — analogia IPO (oncologia pública). Editais event-driven no gov.br."""

    slug = "inca"
    name = "INCA — Instituto Nacional de Câncer"
    enrich_details: bool = True
    max_detail_fetches: int = 25

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=0.45)
        try:
            candidates = self._collect_candidates(client)
            details: dict[str, dict] = {}
            if self.enrich_details:
                for item in candidates[: self.max_detail_fetches]:
                    try:
                        details[item["url"]] = self._fetch_detail(client, item["url"])
                    except Exception as exc:  # noqa: BLE001
                        print(f"[{self.slug}] detalhe {item['url']}: {exc}")

            jobs: list[JobPayload] = []
            for item in candidates:
                detail = details.get(item["url"]) or {}
                title = (detail.get("title") or item["title"]).strip()
                if not title or SKIP_RE.search(title):
                    continue
                description = detail.get("description") or item.get("summary") or title
                if not OPEN_HINT_RE.search(f"{title} {description[:400]}"):
                    continue
                contract = guess_contract(f"{title} {description}") or "Concurso"
                source_id = item["url"].rstrip("/").split("/")[-1][:160]
                jobs.append(
                    JobPayload(
                        title=title[:200],
                        company="INCA — Instituto Nacional de Câncer",
                        location_district="Rio de Janeiro",
                        location_concelho="Rio de Janeiro",
                        profession=guess_profession(title),
                        specialty="Oncologia" if re.search(r"oncol|c[aâ]ncer", title, re.I) else None,
                        sector="publico",
                        contract_type=contract,
                        description=description[:8000],
                        requirements=None,
                        salary=None,
                        application_url=item["url"],
                        source=self.slug,
                        source_id=source_id,
                        published_at=detail.get("published_at"),
                        expires_at=None,
                    )
                )
            return jobs
        finally:
            client.close()

    def _collect_candidates(self, client: HttpClient) -> list[dict]:
        by_url: dict[str, dict] = {}

        for url in (CONCURSO_INDEX, *CONCURSO_YEARS):
            try:
                html = client.get_text(url)
            except Exception as exc:  # noqa: BLE001
                print(f"[{self.slug}] index {url}: {exc}")
                continue
            for item in self._parse_cards(html, url):
                by_url[item["url"]] = item

        for url in ENSINO_PAGES:
            try:
                html = client.get_text(url)
            except Exception as exc:  # noqa: BLE001
                print(f"[{self.slug}] ensino {url}: {exc}")
                continue
            for item in self._parse_content_links(html, url):
                by_url[item["url"]] = item

        try:
            html = client.get_text(
                NEWS_SEARCH,
                params={
                    "SearchableText": "edital seleção residência",
                    "portal_type:list": "News Item",
                },
            )
            for item in self._parse_search_results(html):
                by_url[item["url"]] = item
        except Exception as exc:  # noqa: BLE001
            print(f"[{self.slug}] search: {exc}")

        return list(by_url.values())

    def _parse_cards(self, html: str, page_url: str) -> list[dict]:
        soup = BeautifulSoup(html, "lxml")
        items: list[dict] = []
        for a in soup.select("a.govbr-card-content[href], a.card[href], .govbr-cards a[href]"):
            href = a.get("href") or ""
            title_el = a.select_one(".titulo") or a
            title = title_el.get_text(" ", strip=True)
            if not href or not title:
                continue
            full = urljoin(page_url, href)
            if "/inca/" not in full:
                continue
            items.append({"title": unescape(title), "url": full, "summary": title})
        # Fallback: folder listing links under content-core
        if not items:
            core = soup.select_one("#content-core") or soup.select_one("#content")
            if core:
                for a in core.select("a[href]"):
                    href = a.get("href") or ""
                    title = a.get_text(" ", strip=True)
                    if not href or not title or len(title) < 8:
                        continue
                    if not OPEN_HINT_RE.search(title):
                        continue
                    full = urljoin(page_url, href)
                    if "/inca/" not in full:
                        continue
                    items.append({"title": unescape(title), "url": full, "summary": title})
        return items

    def _parse_content_links(self, html: str, page_url: str) -> list[dict]:
        soup = BeautifulSoup(html, "lxml")
        core = soup.select_one("#content-core") or soup.select_one("#main-content") or soup
        items: list[dict] = []
        for a in core.select("a[href]"):
            href = a.get("href") or ""
            title = a.get_text(" ", strip=True)
            if not href or not title or len(title) < 12:
                continue
            if not OPEN_HINT_RE.search(title):
                continue
            if SKIP_RE.search(title):
                continue
            full = urljoin(page_url, href)
            if "gov.br/inca" not in full:
                continue
            items.append({"title": unescape(title), "url": full, "summary": title})
        return items

    def _parse_search_results(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "lxml")
        items: list[dict] = []
        for a in soup.select("a[href*='/assuntos/noticias/']"):
            href = a.get("href") or ""
            title = a.get_text(" ", strip=True)
            if not href or not title or len(title) < 12:
                continue
            if not OPEN_HINT_RE.search(title):
                continue
            items.append({"title": unescape(title), "url": href, "summary": title})
        return items

    def _fetch_detail(self, client: HttpClient, url: str) -> dict:
        html = client.get_text(url)
        soup = BeautifulSoup(html, "lxml")
        h1 = soup.select_one("h1") or soup.select_one("#content h1")
        title = h1.get_text(" ", strip=True) if h1 else None
        core = soup.select_one("#content-core") or soup.select_one("#content")
        description = html_to_text(str(core))[:8000] if core else None
        published = None
        time_el = soup.select_one("time[datetime], span.documentPublished, .documentPublished")
        if time_el:
            published = time_el.get("datetime") or time_el.get_text(" ", strip=True)
        return {
            "title": title,
            "description": description,
            "published_at": published,
        }
