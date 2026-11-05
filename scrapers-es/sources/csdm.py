"""Consorci Sanitari del Maresme: listado de ofertas (solo 'Oberta') + ficha de cada oferta."""
from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import html_to_text

from ._siscat_es import DetailCache, build_job, cached_detail, clean_title, dmy_to_iso, text_date_to_iso

LIST_URL = "https://www.csdm.cat/ca/el-consorci/ofertes-feina/"
COMPANY = "Consorci Sanitari del Maresme"
MAX_JOBS = 100

_ID_RE = re.compile(r"/ofertes-feina/(\d+)/")


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for li in soup.select("li.ofertes__item"):
        a = li.find("a", href=True)
        if not a or not _ID_RE.search(a["href"]):
            continue
        estat = li.select_one(".ofertes__estat")
        if estat is None or "ofertes__estat--0" not in (estat.get("class") or []):
            continue  # Tancada / Adjudicada
        time_el = li.find("time")
        rows.append({
            "id": _ID_RE.search(a["href"]).group(1),
            "title": re.sub(r"\s+", " ", a.get_text(" ", strip=True)),
            "url": urljoin(LIST_URL, a["href"]),
            "deadline": (time_el.get("datetime") or time_el.get_text()) if time_el else None,
        })
    return rows


def parse_detail(page: str) -> dict:
    soup = BeautifulSoup(page, "html.parser")
    info = soup.select_one("dl.oferta-info")
    start = None
    if info:
        m = re.search(r"Inici:\s*([^<\n]+)", info.get_text("\n"))
        start = m.group(1) if m else None
    h1 = soup.find("h1")
    text = []
    if h1 is not None and info is not None:
        for sib in info.find_next_siblings():
            if sib.name in ("p", "ul", "div"):
                text.append(html_to_text(str(sib)))
    return {
        "start": start,
        "description": "\n\n".join(x for x in text if x),
        "pdf": bool(info and info.find("a", href=re.compile(r"\.pdf", re.I))),
    }


class CsdmScraper(BaseScraper):
    slug = "csdm"
    name = "Consorci Sanitari del Maresme — Ofertas"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        cache = DetailCache(self.slug)
        jobs: list[JobPayload] = []
        complete = True
        try:
            html = client.get_text(LIST_URL)
            if "ofertes__item" not in html:
                raise RuntimeError("listado del CSdM sin estructura reconocible")
            rows = parse_listing(html)[:MAX_JOBS]
            for row in rows:
                detail = cached_detail(cache, row["id"], lambda u=row["url"]: parse_detail(client.get_text(u)))
                if detail is None:
                    complete = False
                    detail = {}
                title = clean_title(row["title"])
                description = row["title"]
                if detail.get("description"):
                    description += "\n\n" + detail["description"]
                if detail.get("pdf"):
                    description += f"\n\nLes funcions i requisits es detallen al PDF de l'oferta: {row['url']}"
                job = build_job(
                    slug=self.slug,
                    company=COMPANY,
                    title=title,
                    city="Mataró",
                    description=description,
                    source_id=row["id"],
                    url=row["url"],
                    published_at=text_date_to_iso(detail.get("start"), assume_past_year=False),
                    expires_at=_iso_deadline(row["deadline"])
                    or dmy_to_iso(row["deadline"], end_of_day=True),
                )
                if job:
                    jobs.append(job)
        finally:
            client.close()
        cache.save(prune=complete)
        self.last_listings_complete = complete
        return jobs


def _iso_deadline(value: str | None) -> str | None:
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", value or "")
    return dmy_to_iso(f"{m.group(3)}/{m.group(2)}/{m.group(1)}", end_of_day=True) if m else None
