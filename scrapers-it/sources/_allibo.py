"""Lettore generico Allibo (ATS italiano, ``joblink.allibo.com``): un client = una configurazione.

- Lista: ``/ats<N>/Widget/connector.aspx?DM=<token>&SG=2&FT=<n>&LN=IT`` restituisce JSON
  (``Content.WidgetData.AdsList[]``: Job, Title, DetailLink, ListPlaces con PlaceName/ProvinceCode).
  Il token ``DM`` e' nell'HTML pubblico della pagina carriere del cliente (configurazione, non un segreto).
- Dettaglio: ``/ats<N>/job-offer.aspx?DM=<id>&ID=<n>&LN=IT`` HTML lato server (``main > section``: h1, ``div.style-forced``
  con il testo, ``details.location`` con "Sede: Citta', PR (Italia)").
robots.txt di joblink.allibo.com: ``Allow: /``. >= 1 s tra le richieste. Niente data di pubblicazione nella scheda.
Una sottoclasse per cliente fissa slug, nome, azienda e URL della lista; solo i clienti elencati in sources/__init__.py
sono attivi (HSR / San Raffaele NON e' registrato).
"""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from . import _it_priv as P

_NOT_CLINICAL = re.compile(r"ricercator|\brspp\b|\bhse\b|informatic|ingegner|amministrativ|segretari|contabil|addett", re.I)
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"^terp\b|\bterp\b", "Logopedia e riabilitazione"),
    (r"^educatore professionale", "Servizio sociale"),
    (r"^medico (del lavoro|prelevatore)", "Medicina"),
)


def list_items(data: dict) -> list[dict]:
    if data.get("ReturnCode") != 0:
        raise ValueError(f"Allibo ReturnCode {data.get('ReturnCode')}")
    widget = (data.get("Content") or {}).get("WidgetData") or {}
    if "AdsList" not in widget:
        raise ValueError("Allibo: widget senza AdsList (non e' una lista di annunci)")
    return widget["AdsList"] or []


def parse_detail(html: str, item: dict, cfg: type, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.select_one("main h1")
    box = soup.select_one("main div.style-forced")
    raw_title = re.sub(r"\s+", " ", (h1.get_text(" ") if h1 else item.get("Title") or "")).strip()
    link = item.get("DetailLink") or ""
    ident = (parse_qs(urlparse(link).query).get("ID") or [""])[0]
    if not raw_title or box is None or not ident:
        skip("no_data")
        return None
    if P.is_talent_pool(raw_title):
        skip("talent_pool")
        return None
    title = P.pretty_title(raw_title)
    title = re.sub(r"^Terp$", "TeRP - Tecnico della Riabilitazione Psichiatrica", title)
    profession = None if _NOT_CLINICAL.search(title) else P.classify(title, _TITLE_MAP)
    if profession is None:
        skip("not_clinical")
        return None
    description = P.clean_text(html_to_text(str(box)))
    if len(description) < P.MIN_BODY:
        skip("thin")
        return None
    place = (item.get("ListPlaces") or [{}])[0]
    city_raw = (place.get("PlaceName") or "").split(",")[0].strip()
    sig = place.get("ProvinceCode") or ""
    if not city_raw:  # riserva: "Sede: Citta', PR (Italia)"
        loc = soup.select_one("details.location span")
        m = re.search(r"Sede:\s*([^,(]+),?\s*([A-Z]{2})?", loc.get_text(" ") if loc else "")
        city_raw, sig = (m.group(1).strip(), m.group(2) or "") if m else ("", "")
    city = P.tidy_city(city_raw)
    _, district = P.locate_in_segments([f"{city_raw} ({sig})" if sig else city_raw])
    if district == "Italia":
        skip("no_region")
        return None
    if city and city.lower() not in title.lower():
        title = f"{title} - {city}"
    contract = guess_contract(raw_title) or guess_contract(description[:700])
    if contract == "Contratto":
        contract = None
    return JobPayload(
        title=title,
        company=cfg.company,
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description=description[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=None,
        application_url=link,
        source=cfg.slug,
        source_id=f"{cfg.slug}-{ident}",
        published_at=None,
    )


class AlliboScraper(BaseScraper):
    """Base: le sottoclassi impostano slug, name, company e list_urls."""

    slug: str
    name: str
    company: str
    list_urls: tuple[str, ...] = ()
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        errors = 0
        items: list[dict] = []
        try:
            for url in self.list_urls:
                items += list_items(client.get_json(url))
            self.stats["listed"] = len(items)
            for item in items:
                link = item.get("DetailLink") or ""
                if not link.startswith("https://joblink.allibo.com/"):
                    self.stats["bad_link"] = self.stats.get("bad_link", 0) + 1
                    continue
                try:
                    html = client.get_text(link)
                except Exception:  # noqa: BLE001
                    errors += 1
                    continue
                job = parse_detail(html, item, type(self), self.stats)
                if job and job.source_id not in seen:
                    seen.add(job.source_id)
                    jobs.append(job)
        finally:
            client.close()
        self.last_listings_complete = errors <= max(1, len(items) // 10)
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
