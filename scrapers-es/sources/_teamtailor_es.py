"""Feed jobs.json de Teamtailor (Amavir, Sanitas...) para España."""
from __future__ import annotations

from common.http import HttpClient
from common.models import JobPayload
from common.normalize import guess_contract, html_to_text

from ._es_common import es_profession, is_clinical, iso_date, region_from

_EMPLOYMENT = {
    "FULL_TIME": "Jornada completa",
    "PART_TIME": "Media jornada",
    "TEMPORARY": "Temporal",
}
MAX_PAGES = 20


def parse_item(item: dict, slug: str, company: str, sector: str = "privado") -> JobPayload | None:
    posting = item.get("_jobposting") or {}
    title = (item.get("title") or posting.get("title") or "").strip()
    if not title or not is_clinical(title):
        return None
    addresses = [(loc or {}).get("address") or {} for loc in posting.get("jobLocation") or []]
    # Solo España (el feed de Sanitas mezcla Portugal); sin país se asume ES.
    es_addresses = [a for a in addresses if (a.get("addressCountry") or "ES").upper() in ("ES", "ESP", "SPAIN", "ESPAÑA")]
    if addresses and not es_addresses:
        return None
    city = region = postal = None
    district = "España"
    for address in es_addresses or [{}]:
        c = (address.get("addressLocality") or "").strip().title() or None
        r = (address.get("addressRegion") or "").strip() or None
        p = address.get("postalCode")
        d = region_from(c, r, p)
        if d != "España" or city is None:
            city, region, postal, district = c, r, p, d
        if d != "España":
            break
    if district == "España":
        # Último recurso: "(Colmenar Viejo, Madrid)" en el título.
        district = region_from(title, None)
    description = html_to_text(posting.get("description") or item.get("content_html"))
    employment = _EMPLOYMENT.get(str(posting.get("employmentType") or "").upper())
    # El texto manda sobre el tipo ATS (CONTRACTOR/FULL_TIME no distinguen indefinido/temporal).
    contract = guess_contract(title) or guess_contract(description[:1500]) or employment
    source_id = str(((posting.get("identifier") or {}).get("value")) or item.get("id"))
    return JobPayload(
        title=title,
        company=company,
        location_district=district,
        location_concelho=city,
        profession=es_profession(title),
        specialty=None,
        sector=sector,
        contract_type=contract,
        description=description or title,
        requirements=None,
        salary=None,
        application_url=item.get("url") or "",
        source=slug,
        source_id=source_id,
        published_at=iso_date(item.get("date_published") or posting.get("datePosted")),
    )


def fetch_teamtailor_es(base_url: str, slug: str, company: str) -> tuple[list[JobPayload], bool]:
    """Devuelve (ofertas, completo). completo=False si la paginación falló a medias."""
    client = HttpClient()
    jobs: list[JobPayload] = []
    seen: set[str] = set()
    url: str | None = f"{base_url.rstrip('/')}/jobs.json"
    complete = True
    pages = 0
    try:
        while url and pages < MAX_PAGES:
            pages += 1
            try:
                data = client.get_json(url)
            except Exception:  # noqa: BLE001
                if pages == 1:
                    raise
                complete = False
                break
            for item in data.get("items", []):
                job = parse_item(item, slug, company)
                if job and job.application_url and job.source_id not in seen:
                    seen.add(job.source_id)
                    jobs.append(job)
            url = data.get("next_url")
        if url:  # cortado por MAX_PAGES
            complete = False
    finally:
        client.close()
    return jobs, complete
