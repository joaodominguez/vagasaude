"""Habilita (ospedali, case di cura e poliambulatori: Bergamo/Sarnico/Zingonia, Fara Novarese, Acqui Terme).

Sito WordPress (tema custom): ``/wp-sitemap-posts-posizioni-1.xml`` elenca le schede ``/posizioni/<slug>/`` (~20), con
titolo in ``h1.single-header__title`` e testo in ``.main__content``. robots.txt blocca solo /wp-admin/. Una scheda per annuncio,
>= 1 s tra le richieste. Sede: nome della sede citato nel testo (le schede non hanno un campo luogo).
Solo ruoli clinici; direzione operativa, manutenzione, IT e operations restano fuori.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, norm

from . import _it_priv as P

SITEMAP = "https://habilita.it/wp-sitemap-posts-posizioni-1.xml"
COMPANY = "Habilita"
# Sedi Habilita (nome normalizzato nel testo -> (citta', regione)).
_SITES: tuple[tuple[str, str, str], ...] = (
    ("zingonia", "Zingonia", "Lombardia"),
    ("sarnico", "Sarnico", "Lombardia"),
    ("clusone", "Clusone", "Lombardia"),
    ("osio sotto", "Osio Sotto", "Lombardia"),
    ("bergamo", "Bergamo", "Lombardia"),
    ("fara novarese", "Fara Novarese", "Piemonte"),
    ("acqui terme", "Acqui Terme", "Piemonte"),
)
_NOT_CLINICAL = re.compile(r"direttore operativo|manutenzion|sistemista|\boperations?\b|\bit\b", re.I)


def parse_sitemap(xml: str) -> list[str]:
    out: list[str] = []
    for loc in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml):
        if "/posizioni/" in loc and loc not in out:
            out.append(loc)
    return out


def _place(text: str) -> tuple[str | None, str]:
    key = norm(text)
    best = None
    for needle, city, region in _SITES:
        m = re.search(rf"\b{needle}\b", key)
        if m and (best is None or m.start() < best[0]):
            best = (m.start(), city, region)
    if best:
        return best[1], best[2]
    return P.locate_in_segments([text])


def parse_detail(html: str, url: str, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.select_one("h1.single-header__title") or soup.find("h1")
    box = soup.select_one(".main__content")
    if h1 is None or box is None:
        skip("no_data")
        return None
    raw_title = re.sub(r"\s+", " ", h1.get_text(" ")).strip()
    if P.is_talent_pool(raw_title):
        skip("talent_pool")
        return None
    title = P.pretty_title(raw_title)
    profession = None if _NOT_CLINICAL.search(raw_title) else P.classify(title)
    if profession is None:
        skip("not_clinical")
        return None
    description = P.clean_text(html_to_text(str(box)))
    description = re.sub(r"^[‘’'\"]-?\s*", "", description)  # "'- Ricerchiamo..." residuo Word
    if len(description) < P.MIN_BODY:
        skip("thin")
        return None
    city, district = _place(description)
    if district == "Italia":
        skip("no_region")
        return None
    if city and city.lower() not in title.lower():
        title = f"{title} - {city}"
    contract = guess_contract(raw_title) or guess_contract(description[:700])
    if contract == "Contratto":
        contract = None
    slug = url.rstrip("/").rsplit("/", 1)[-1]
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description=description[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=None,
        application_url=url,
        source=HabilitaScraper.slug,
        source_id=f"habilita-{slug}",
        published_at=None,
    )


class HabilitaScraper(BaseScraper):
    slug = "habilita"
    name = "Habilita - Lavora con noi"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        errors = 0
        urls: list[str] = []
        try:
            urls = parse_sitemap(client.get_text(SITEMAP))
            self.stats["sitemap"] = len(urls)
            for url in urls:
                try:
                    html = client.get_text(url)
                except Exception:  # noqa: BLE001
                    errors += 1
                    continue
                job = parse_detail(html, url, self.stats)
                if job:
                    jobs.append(job)
        finally:
            client.close()
        self.last_listings_complete = bool(urls) and errors <= max(1, len(urls) // 10)
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
