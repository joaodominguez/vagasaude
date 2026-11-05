"""Consorci Sanitari de l'Anoia (Igualada): listado paginado (/page/N) con ficha por oferta (id numérico).

Las ofertas no llevan fecha ni plazo: se mantienen mientras sigan en el listado.
"""
from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import html_to_text

from ._siscat_es import DetailCache, build_job, cached_detail

LIST_URL = "https://www.csa.cat/ca/professionals/treballa-amb-nosaltres/ofertes-de-treball/"
COMPANY = "Consorci Sanitari de l'Anoia"
MAX_PAGES = 10

_ID_RE = re.compile(r"/ofertes-de-treball/(\d+)/")


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for a in soup.select("ul.actualitat-list h2 a[href]"):
        m = _ID_RE.search(a["href"])
        if m:
            rows.append({"id": m.group(1), "title": re.sub(r"\s+", " ", a.get_text(" ", strip=True)),
                         "url": urljoin(LIST_URL, a["href"])})
    return rows


def parse_detail(page: str) -> dict:
    soup = BeautifulSoup(page, "html.parser")
    body = soup.select_one("article .small")
    text = html_to_text(str(body)) if body else ""
    # El correo viene ofuscado ("rrhh(ELIMINAR)@csa.cat"): se deja la web como vía de contacto.
    text = text.replace("(ELIMINAR)", "")
    return {"description": text}


class CsaScraper(BaseScraper):
    slug = "csa"
    name = "Consorci Sanitari de l'Anoia — Ofertas"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        cache = DetailCache(self.slug)
        jobs: list[JobPayload] = []
        complete = True
        try:
            rows: list[dict] = []
            known: set[str] = set()
            for page in range(1, MAX_PAGES + 1):
                url = LIST_URL if page == 1 else f"{LIST_URL}page/{page}"
                try:
                    page_rows = parse_listing(client.get_text(url))
                except Exception:  # noqa: BLE001
                    if page == 1:
                        raise
                    complete = False
                    break
                new = [r for r in page_rows if r["id"] not in known]
                if not new:
                    break
                known.update(r["id"] for r in new)
                rows.extend(new)
            else:
                complete = False
            if not rows:
                raise RuntimeError("listado del CSA sin ofertas")
            for row in rows:
                detail = cached_detail(cache, row["id"], lambda u=row["url"]: parse_detail(client.get_text(u)))
                if detail is None:
                    complete = False
                    detail = {}
                job = build_job(
                    slug=self.slug,
                    company=COMPANY,
                    title=row["title"].capitalize() if row["title"].isupper() else row["title"],
                    city="Igualada",
                    description=detail.get("description", "") or row["title"],
                    source_id=row["id"],
                    url=row["url"],
                )
                if job:
                    jobs.append(job)
        finally:
            client.close()
        cache.save(prune=complete)
        self.last_listings_complete = complete
        return jobs
