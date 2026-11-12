"""Affidea Italia: diagnostica per immagini, ambulatori e cure domiciliari (Recruitee).

Un solo pedido: ``https://affideaitaly.recruitee.com/api/offers`` (JSON pubblico con descrizione e requisiti in HTML,
~65 annunci, nessuna paginazione). robots.txt: ``Disallow: /v/`` soltanto; l'API non e' toccata.
Solo ruoli clinici (medici, infermieri, TSRM, tecnici di laboratorio, fisioterapisti, OSS, ...): receptionist, contabilita',
stage amministrativi e commerciali restano fuori. Citta'/regione si leggono dal titolo ("Affidea/CDC Torino", "Modena (MO)"):
il campo ``city`` dell'API e' inaffidabile (annunci multi-sede); ``state_name`` fa da riserva.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from . import _it_priv as P

API = "https://affideaitaly.recruitee.com/api/offers"
COMPANY = "Affidea"
_NOT_CLINICAL = re.compile(r"stage|tirocinio|\bsales\b|specialist\b.*\b(account|tax|fp&a)|accountant|controller", re.I)
_TITLE_MAP: tuple[tuple[str, str], ...] = (
    (r"medico (prelevatore|di presidio)", "Medicina"),
)
_EMPLOYMENT = {
    "fulltime_permanent": "Tempo indeterminato",
    "fulltime_fixed_term": "Tempo determinato",
    "parttime_permanent": "Part-time",
    "parttime_fixed_term": "Part-time",
    "freelance": "Libero professionale",
}


def _published(raw: str | None) -> str | None:
    try:
        return datetime.strptime((raw or "").replace(" UTC", ""), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None


def parse_offer(offer: dict, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    raw_title = re.sub(r"\s+", " ", offer.get("title") or "").strip()
    url = offer.get("careers_url") or offer.get("careers_apply_url") or ""
    if not raw_title or not url or not offer.get("id"):
        skip("no_data")
        return None
    if offer.get("status") not in (None, "published"):
        skip("not_published")
        return None
    if not P.is_italy(offer.get("country_code")):
        skip("not_italy")
        return None
    if P.is_talent_pool(raw_title):
        skip("talent_pool")
        return None
    profession = None if _NOT_CLINICAL.search(raw_title) else P.classify(raw_title, _TITLE_MAP)
    if profession is None:
        skip("not_clinical")
        return None
    body = "\n\n".join(filter(None, (html_to_text(offer.get("description")), html_to_text(offer.get("requirements")))))
    description = P.clean_text(body)
    if len(description) < P.MIN_BODY:
        skip("thin")
        return None
    segments = [s for s in re.split(r"\s*[-\u2013/]\s*", raw_title)[1:] if s.strip()]
    city, district = P.locate_in_segments(segments, offer.get("city"), offer.get("state_name"))
    if district == "Italia":
        skip("no_region")
        return None
    title = re.sub(r"\s*[-–]?\s*ID\s*(?:n\s*[°.º]?)?\s*\d+\s*$", "", raw_title, flags=re.I).strip(" -–")
    title = re.sub(r"\\", "/", title)
    contract = guess_contract(title) or _EMPLOYMENT.get(str(offer.get("employment_type_code") or ""))
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
        source=AffideaScraper.slug,
        source_id=f"affidea-{offer['id']}",
        published_at=_published(offer.get("published_at") or offer.get("created_at")),
    )


class AffideaScraper(BaseScraper):
    slug = "affidea"
    name = "Affidea Italia - Lavora con noi"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        try:
            offers = client.get_json(API).get("offers") or []
            self.stats["feed"] = len(offers)
            self.last_listings_complete = bool(offers)
            for offer in offers:
                job = parse_offer(offer, self.stats)
                if job and job.source_id not in seen:
                    seen.add(job.source_id)
                    jobs.append(job)
        finally:
            client.close()
        self.stats["published"] = len(jobs)
        return jobs
