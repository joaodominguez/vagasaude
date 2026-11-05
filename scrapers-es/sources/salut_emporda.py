"""Fundació Salut Empordà (Hospital de Figueres): listado de ofertas + ficha de cada oferta."""
from __future__ import annotations

import html as html_lib
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import html_to_text

from ._siscat_es import DetailCache, build_job, cached_detail

LIST_URL = "https://www.salutemporda.cat/ca/professionals-100/treballa-amb-nosaltres-100/ofertes-de-feina.html"
COMPANY = "Fundació Salut Empordà"
MAX_JOBS = 100


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = urljoin(LIST_URL, a["href"])
        if "/ofertes-de-feina/" not in href or not href.endswith(".html") or href in seen:
            continue
        seen.add(href)
        rows.append({"url": href, "title": re.sub(r"\s+", " ", a.get_text(" ", strip=True)).strip()})
    return rows


def city_from(text: str) -> str:
    t = text.lower()
    if "l'escala" in t or "lescala" in t:
        return "L'Escala"
    return "Figueres"


def parse_detail(page: str) -> dict:
    soup = BeautifulSoup(page, "html.parser")
    body = soup.select_one("#cos_info .text_contingut") or soup.select_one(".text_contingut")
    h1 = soup.find("h1")
    return {
        "h1": h1.get_text(" ", strip=True) if h1 else "",
        "description": html_to_text(str(body)) if body else "",
    }


class SalutEmpordaScraper(BaseScraper):
    slug = "salut_emporda"
    name = "Fundació Salut Empordà — Ofertas"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        cache = DetailCache(self.slug)
        jobs: list[JobPayload] = []
        complete = True
        try:
            rows = parse_listing(client.get_text(LIST_URL))[:MAX_JOBS]
            if not rows:
                raise RuntimeError("listado de Salut Empordà sin ofertas")
            for row in rows:
                source_id = row["url"].rsplit("/", 1)[-1].removesuffix(".html")
                detail = cached_detail(cache, source_id, lambda u=row["url"]: parse_detail(client.get_text(u)))
                if detail is None:
                    complete = False
                    detail = {}
                title = html_lib.unescape(row["title"]) or detail.get("h1", "")
                description = detail.get("description", "")
                job = build_job(
                    slug=self.slug,
                    company=COMPANY,
                    title=title,
                    city=city_from(f"{title} {detail.get('h1', '')}"),
                    description=description,
                    source_id=source_id,
                    url=row["url"],
                )
                if job:
                    jobs.append(job)
        finally:
            client.close()
        cache.save(prune=complete)
        self.last_listings_complete = complete
        return jobs
