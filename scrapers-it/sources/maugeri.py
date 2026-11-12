"""ICS Maugeri (Istituti Clinici Scientifici Maugeri: riabilitazione, IRCCS, Pavia/Milano/Tradate/...).

Career site SAP SuccessFactors (carriere.icsmaugeri.it), stessa piattaforma di Humanitas: ``/sitemap.xml`` elenca gli URL
``/job/<localita>-<titolo>-<cap>/<id>/``; la scheda ha microdata schema.org (``itemprop``: title, description,
datePosted, validThrough). La citta' sta in ``jobGeoLocation`` ("Pavia, IT, 27100"). robots.txt blocca solo
/applybutton/, /talentcommunity/, /services/ e simili: non toccati. >= 1 s tra le richieste.
Il filtro clinico e i titoli speciali sono quelli di Humanitas (sources/humanitas.py).
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text, norm

from . import _it_priv as P
from .humanitas import _EMOJI_RE, _NOT_CLINICAL, _TITLE_MAP, _meta, _posted, parse_sitemap

SITEMAP = "https://carriere.icsmaugeri.it/sitemap.xml"
COMPANY = "ICS Maugeri"
# Sedi Maugeri che le tabelle generiche non conoscono (citta' normalizzata -> regione).
_SITES = {
    "montescano": "Lombardia", "castel goffredo": "Lombardia", "gattico veruno": "Piemonte", "veruno": "Piemonte",
    "telese terme": "Campania", "telese": "Campania", "cassano delle murge": "Puglia", "genova nervi": "Liguria",
    "camaiore": "Toscana", "lissone": "Lombardia", "tradate": "Lombardia", "lumezzane": "Lombardia",
}


def _place(soup: BeautifulSoup, url: str) -> tuple[str | None, str]:
    geo = soup.select_one(".jobGeoLocation")
    raw = re.sub(r"\s+", " ", geo.get_text(" ") if geo else _meta(soup, "streetAddress")).strip()
    city = raw.split(",")[0].strip() if raw else ""
    if not city:  # "Pavia-Medico-Neurologo-27100" -> prima parola dello slug
        city = re.sub(r"%[0-9A-F]{2}", " ", url.split("/job/")[1].split("/")[0]).split("-")[0]
    city = city.strip() or None
    region = _SITES.get(norm(city or "")) or P.region_label(city, None)
    return city, region


def parse_detail(html: str, url: str, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    title = re.sub(r"\s+", " ", (soup.select_one('[itemprop="title"]') or soup.select_one("h1") or soup).get_text(" ")).strip()
    node = soup.select_one('[itemprop="description"]')
    if not title or len(title) > 150 or node is None:
        skip("no_data")
        return None
    if P.is_talent_pool(title):
        skip("talent_pool")
        return None
    profession = None if _NOT_CLINICAL.search(title) else P.classify(title, _TITLE_MAP)
    if profession is None:
        skip("not_clinical")
        return None
    description = P.clean_text(_EMOJI_RE.sub("", html_to_text(str(node))))
    if len(description) < P.MIN_BODY:
        skip("thin")
        return None
    city, district = _place(soup, url)
    if district == "Italia":
        skip("no_region")
        return None
    contract = guess_contract(title) or guess_contract(description[:600])
    if contract == "Contratto":
        contract = None
    job_id = url.rstrip("/").split("/")[-1]
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
        source=MaugeriScraper.slug,
        source_id=f"maugeri-{job_id}",
        published_at=_posted(_meta(soup, "datePosted")),
    )


class MaugeriScraper(BaseScraper):
    slug = "maugeri"
    name = "ICS Maugeri - Lavora con noi"
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
        self.last_listings_complete = bool(urls) and errors <= max(2, len(urls) // 10)
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
