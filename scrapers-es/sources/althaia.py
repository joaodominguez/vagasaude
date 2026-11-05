"""Fundació Althaia (Manresa): portal Bizneo ext.althaia.cat/jobs (HTML paginado) + ficha de cada oferta."""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import html_to_text

from ._siscat_es import DetailCache, build_job, cached_detail, text_date_to_iso

BASE = "https://ext.althaia.cat"
LIST_URL = f"{BASE}/jobs"
COMPANY = "Fundació Althaia"
MAX_PAGES = 15
_MODALITY = {"presencial", "híbrid", "hibrid", "híbrido", "teletreball", "remot", "remoto", "in situ"}


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for a in soup.select("a.job-card[href]"):
        title = a.select_one(".title")
        spans = [s.get_text(" ", strip=True) for s in a.select(".details span")]
        city = next((s for s in spans if s and s.lower() not in _MODALITY), None)
        rows.append({
            "url": a["href"],
            "title": title.get_text(" ", strip=True) if title else "",
            "city": city,
        })
    return rows


def parse_detail(page: str) -> dict:
    soup = BeautifulSoup(page, "html.parser")
    blocks = [html_to_text(str(div)) for div in soup.select("#job-details .general-content")]
    published = None
    for tag in soup.select("#job-details span"):
        text = tag.get_text(" ", strip=True)
        if text.startswith("Publicada"):
            published = text[len("Publicada"):].strip()
            break
    return {"description": "\n\n".join(b for b in blocks if b), "published": published}


class AlthaiaScraper(BaseScraper):
    slug = "althaia"
    name = "Fundació Althaia — Ofertas"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        cache = DetailCache(self.slug)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        complete = True
        try:
            rows: list[dict] = []
            for page in range(1, MAX_PAGES + 1):
                url = LIST_URL if page == 1 else f"{LIST_URL}?page={page}"
                try:
                    page_rows = parse_listing(client.get_text(url))
                except Exception:  # noqa: BLE001
                    if page == 1:
                        raise
                    complete = False
                    break
                new = [r for r in page_rows if r["url"] not in {x["url"] for x in rows}]
                if not new:
                    break
                rows.extend(new)
            else:
                complete = False
            if not rows:
                raise RuntimeError("listado de Althaia sin ofertas")
            for row in rows:
                source_id = row["url"].rstrip("/").rsplit("/", 1)[-1]
                if source_id in seen:
                    continue
                seen.add(source_id)
                detail = cached_detail(cache, source_id, lambda u=row["url"]: parse_detail(client.get_text(u)))
                if detail is None:
                    complete = False
                    detail = {}
                job = build_job(
                    slug=self.slug,
                    company=COMPANY,
                    title=row["title"],
                    city=row["city"] or "Manresa",
                    description=detail.get("description", ""),
                    source_id=source_id,
                    url=row["url"],
                    published_at=text_date_to_iso(detail.get("published")),
                    sector="concertado",
                )
                if job:
                    jobs.append(job)
        finally:
            client.close()
        cache.save(prune=complete)
        self.last_listings_complete = complete
        return jobs
