"""AniCura Italia: ospedali e cliniche veterinarie (Teamtailor, jobs.anicura.it).

Un solo feed: ``/jobs.json`` (JSON Feed 1.1, ~65 annunci, paginazione assente) con, per ogni
annuncio, ``_jobposting`` (JSON-LD completo: descrizione, indirizzo, regione) e ``date_published``.
robots.txt: ``Disallow`` solo /app/, /messages/ ...; ``Content-Signal: search=yes, ai-train=no``:
i dati sono usati per ricerca/indicizzazione degli annunci, mai per addestrare modelli.
Solo ruoli clinici veterinari (medico veterinario, tecnico veterinario, internship, laboratorio);
receptionist, practice manager, contabilita' e HR restano fuori. Tutto classificato "Veterinaria".
"""
from __future__ import annotations

import re

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from . import _it_priv as P

FEED = "https://jobs.anicura.it/jobs.json"
COMPANY = "AniCura"
_CLINICAL = re.compile(r"veterin|internship|tecnico di laboratorio|biolog", re.I)
_EMPLOYMENT = {"FULL_TIME": "Full-time", "PART_TIME": "Part-time"}


def parse_item(item: dict, stats: dict | None = None) -> JobPayload | None:
    stats = stats if stats is not None else {}

    def skip(reason: str) -> None:
        stats[reason] = stats.get(reason, 0) + 1

    posting = item.get("_jobposting") or {}
    title = re.sub(r"\s+", " ", (item.get("title") or posting.get("title") or "")).strip()
    url = item.get("url") or ""
    if not title or not url:
        skip("no_data")
        return None
    if P.is_talent_pool(title):
        skip("talent_pool")
        return None
    if not _CLINICAL.search(title):
        skip("not_clinical")
        return None
    locations = posting.get("jobLocation") or []
    if isinstance(locations, dict):
        locations = [locations]
    address = next(((loc or {}).get("address") or {} for loc in locations), {})
    if not P.is_italy(address.get("addressCountry")):
        skip("not_italy")
        return None
    city = (address.get("addressLocality") or "").strip() or None
    district = P.region_label(city, address.get("addressRegion"))
    if district == "Italia":
        skip("no_region")
        return None
    description = P.clean_text(html_to_text(posting.get("description") or item.get("content_html")))
    # Prima riga interna dell'ATS: "R-260639 Animal Care Assistant - Cascina (PI) (Open)", idem senza "(Open)".
    description = re.sub(r"^R-\d+\b[^\n]*\n+", "", description).strip()
    if len(description) < P.MIN_BODY:
        skip("thin")
        return None
    contract = guess_contract(title) or guess_contract(description[:800])
    if contract in (None, "Contratto"):
        contract = _EMPLOYMENT.get(str(posting.get("employmentType") or "").upper())
    ident = re.search(r"/jobs/(\d+)", url)
    return JobPayload(
        title=title,
        company=COMPANY,
        location_district=district,
        location_concelho=city,
        profession="Veterinaria",
        specialty=None,
        sector=P.SECTOR,
        contract_type=contract,
        description=description[: P.MAX_DESCRIPTION],
        requirements=None,
        salary=None,
        application_url=url,
        source=AnicuraScraper.slug,
        source_id=f"anicura-{ident.group(1) if ident else item.get('id')}",
        published_at=P.iso_datetime(item.get("date_published") or posting.get("datePosted")),
    )


class AnicuraScraper(BaseScraper):
    slug = "anicura"
    name = "AniCura Italia - Lavora con noi"
    last_listings_complete = True

    def __init__(self) -> None:
        self.stats: dict = {}

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        try:
            data = client.get_json(FEED)
            items = data.get("items") or []
            self.stats["feed"] = len(items)
            # Il feed e' completo se non c'e' una pagina successiva.
            self.last_listings_complete = not data.get("next_url")
            for item in items:
                job = parse_item(item, self.stats)
                if job and job.source_id not in seen:
                    seen.add(job.source_id)
                    jobs.append(job)
        finally:
            client.close()
        self.stats["published"] = len(jobs)
        return jobs
