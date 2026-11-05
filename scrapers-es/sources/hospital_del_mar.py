"""Hospital del Mar / Parc de Salut Mar: oferta pública d'ocupació (fecha + título + ficha con PDF)."""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urljoin, urlparse

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload

from ._siscat_es import build_job, clean_title, text_date_to_iso

LIST_URL = "https://www.hospitaldelmar.cat/ca/professionals/oferta-publica/"
COMPANY = "Hospital del Mar"


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    content = soup.select_one("#content_main") or soup
    rows = []
    date_text = None
    for el in content.find_all(["p", "a"]):
        if el.name == "p" and "data" in (el.get("class") or []):
            date_text = el.get_text(" ", strip=True)
        elif el.name == "a" and (el.get("href") or "").startswith("view.php"):
            qs = parse_qs(urlparse(el["href"]).query)
            rows.append({
                "id": (qs.get("ID") or [""])[0],
                "title": re.sub(r"\s+", " ", el.get_text(" ", strip=True)),
                "date": date_text,
                "url": urljoin(LIST_URL, el["href"]),
            })
    return rows


class HospitalDelMarScraper(BaseScraper):
    slug = "hospital_del_mar"
    name = "Hospital del Mar — Oferta pública"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        try:
            rows = parse_listing(client.get_text(LIST_URL))
            if not rows:
                raise RuntimeError("listado del Hospital del Mar sin ofertas")
            for row in rows:
                if not row["id"] or row["id"] in seen:
                    continue
                seen.add(row["id"])
                title = clean_title(row["title"])
                # La ficha solo enlaza un PDF (funciones, requisitos, competencias): el texto útil es el título.
                description = (
                    f"{row['title']}\n\nEntitat: Hospital del Mar (Consorci Mar Parc de Salut de Barcelona). "
                    "Les funcions, requisits i competències del lloc de treball es detallen al document "
                    f"adjunt a l'oferta: {row['url']}"
                )
                job = build_job(
                    slug=self.slug,
                    company=COMPANY,
                    title=title,
                    city="Barcelona",
                    description=description,
                    source_id=row["id"],
                    url=row["url"],
                    published_at=text_date_to_iso(row["date"], assume_past_year=False),
                    contract_text="",
                )
                if job:
                    jobs.append(job)
        finally:
            client.close()
        return jobs
