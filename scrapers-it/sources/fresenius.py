"""Fresenius Medical Care / NephroCare Italia: centri dialisi.

Stessa piattaforma delle fonti ES/PT: sitemap pubblica per lingua
(``jobs.freseniusmedicalcare.com/sitemap-a4072ddc-it.xml``, indice in ``/sitemap.xml``) con gli URL
``/it/<slug>/job/<id>``; ogni scheda ha un JSON-LD ``JobPosting`` completo (titolo, datePosted,
descrizione). Il sito ``it`` include anche annunci di altri paesi (es. Romania): si tiene solo
``addressCountry`` IT, e solo ruoli clinici (infermieri di dialisi, medici nefrologi, OSS); tecnici di
stampi/manutenzione restano fuori. robots.txt senza regole. >= 1 s tra le richieste.
Nota: ``addressLocality`` e' l'indirizzo amministrativo (Taranto per Castellaneta): la citta' del
centro si legge dal titolo ("... - Castellaneta (TA)") e la regione dalla sigla di provincia.
"""
from __future__ import annotations

import re

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, guess_district, html_to_text

from . import _it_priv as P

SITEMAP = "https://jobs.freseniusmedicalcare.com/sitemap-a4072ddc-it.xml"
COMPANY = "NephroCare – Fresenius Medical Care"
_EMPLOYMENT = {"FULL_TIME": "Full-time", "PART_TIME": "Part-time"}
_NOT_CLINICAL = re.compile(r"manutent|stamp|ingegner|operaio|produzion|commercial|logistic|magazzin|amministrativ", re.I)
_ABBREV = {"Trescore B.": "Trescore Balneario"}


def parse_sitemap(xml: str) -> list[str]:
    out: list[str] = []
    for loc in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml):
        if "/job/" in loc and loc not in out:
            out.append(loc)
    return out


def _location_from_title(title: str) -> tuple[str | None, str | None]:
    """'Infermiere/a di Dialisi NephroCare - Trescore B. (BG)' -> ('Trescore Balneario', 'BG')."""
    m = re.search(r"(?:-|–)\s*([^()\-–]+?)\s*\(([A-Z]{2})\)\s*$", title)
    if not m:
        return None, None
    city = m.group(1).strip()
    return _ABBREV.get(city, city), m.group(2)


def parse_detail(html: str, url: str, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    posting = P.job_posting(html)
    if not posting:
        skip("no_data")
        return None
    title = re.sub(r"\s+", " ", posting.get("title") or "").strip()
    locations = posting.get("jobLocation") or []
    if isinstance(locations, dict):
        locations = [locations]
    address = next(((loc or {}).get("address") or {} for loc in locations), {})
    if not title or not P.is_italy(address.get("addressCountry")) or address.get("addressCountry") in (None, ""):
        skip("not_italy")
        return None
    if P.is_talent_pool(title):
        skip("talent_pool")
        return None
    if _NOT_CLINICAL.search(title):
        skip("not_clinical")
        return None
    profession = P.classify(title)
    if profession is None:
        skip("not_clinical")
        return None
    city, sigla = _location_from_title(title)
    district = guess_district(None, f"({sigla})") if sigla else "Italia"
    if district == "Italia":
        city = city or (address.get("addressLocality") or "").strip().title() or None
        district = P.region_label(city, address.get("addressRegion"))
    if district == "Italia":
        skip("no_region")
        return None
    description = P.clean_text(html_to_text(posting.get("description")))
    if len(description) < P.MIN_BODY:
        skip("thin")
        return None
    types = posting.get("employmentType") or []
    if isinstance(types, str):
        types = [types]
    contract = guess_contract(title) or guess_contract(description[:800])
    if contract in (None, "Contratto"):
        contract = next((_EMPLOYMENT[t] for t in types if t in _EMPLOYMENT), None)
    valid = posting.get("validThrough")
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession=profession,
        specialty="Dialisi",
        sector=P.SECTOR,
        contract_type=contract,
        description=description[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=None,
        application_url=posting.get("url") or url,
        source=FreseniusScraper.slug,
        source_id=f"nephrocare-{url.rstrip('/').split('/')[-1]}",
        published_at=P.iso_datetime(posting.get("datePosted")),
        expires_at=P.iso_datetime(valid)[:10] if valid and P.iso_datetime(valid) else None,
    )


class FreseniusScraper(BaseScraper):
    slug = "fresenius"
    name = "NephroCare / Fresenius Medical Care Italia"
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
        self.last_listings_complete = errors <= max(1, len(urls) // 10)
        self.stats["errors"] = errors
        self.stats["published"] = len(jobs)
        return jobs
