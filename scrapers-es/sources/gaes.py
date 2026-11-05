"""GAES (Amplifon) — audioprotesistas. API pública Oracle HCM Candidate Experience (la misma que usa la web de empleo)."""
from __future__ import annotations

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from ._detail_cache import DetailCache
from ._es_common import es_profession, iso_date
from ._private_es import is_health_role, region_with_fallback

API = "https://efuf.fa.em2.oraclecloud.com/hcmRestApi/resources/latest"
SITE = "CX_1"
SPAIN_LOCATION_ID = "300000000228675"
PAGE = 100
MAX_PAGES = 10
COMPANY = "GAES (Amplifon)"
JOB_URL = "https://careers.amplifon.com/es/sites/CX_1/job/{id}"

LIST_URL = (
    f"{API}/recruitingCEJobRequisitions?onlyData=true"
    "&expand=requisitionList.secondaryLocations,flexFieldsFacet.values"
    f"&finder=findReqs;siteNumber={SITE},"
    "facetsList=LOCATIONS%3BWORK_LOCATIONS%3BWORKPLACE_TYPES%3BTITLES%3BCATEGORIES%3BORGANIZATIONS%3BPOSTING_DATES%3BFLEX_FIELDS,"
    "limit={limit},locationId=" + SPAIN_LOCATION_ID + ",sortBy=POSTING_DATES_DESC{offset}"
)
DETAIL_URL = (
    f"{API}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true"
    '&finder=ById;Id="{id}",siteNumber=' + SITE
)

_CONTRACT = {"permanent contract": "Indefinido", "temporary contract": "Temporal", "fixed-term contract": "Temporal"}


def split_location(primary: str | None) -> tuple[str | None, str | None]:
    """'Elche/Elx, Alicante, Spain' -> (ciudad, provincia); 'Spain' -> (None, None)."""
    parts = [p.strip() for p in (primary or "").split(",") if p.strip() and p.strip().lower() not in ("spain", "españa")]
    if not parts:
        return None, None
    return parts[0], parts[1] if len(parts) > 1 else None


def parse_detail(item: dict) -> dict:
    flex = {(f.get("Prompt") or ""): (f.get("Value") or "") for f in item.get("requisitionFlexFields") or []}
    body = [html_to_text(item.get(k)) for k in ("ExternalDescriptionStr", "ExternalResponsibilitiesStr", "ExternalQualificationsStr")]
    return {
        "description": "\n\n".join(b for b in body if b),
        "contract": flex.get("Contract Type"),
        "schedule": item.get("JobSchedule"),
        "end": item.get("ExternalPostedEndDate"),
    }


class GaesScraper(BaseScraper):
    slug = "gaes"
    name = "GAES (Amplifon) — Empleo"
    last_listings_complete = True

    def _listing(self, client: HttpClient) -> list[dict]:
        reqs: list[dict] = []
        for page in range(MAX_PAGES):
            offset = f",offset={page * PAGE}" if page else ""
            data = client.get_json(LIST_URL.format(limit=PAGE, offset=offset))
            batch = ((data.get("items") or [{}])[0]).get("requisitionList") or []
            reqs.extend(batch)
            if len(batch) < PAGE:
                return reqs
        self.last_listings_complete = False
        return reqs

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        cache = DetailCache(self.slug)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        try:
            reqs = self._listing(client)
            for req in reqs:
                job_id = str(req.get("Id") or "")
                title = (req.get("Title") or "").strip()
                if not job_id or job_id in seen or (req.get("PrimaryLocationCountry") or "ES") != "ES":
                    continue
                if not title or not is_health_role(title):
                    continue
                seen.add(job_id)
                detail = cache.get(job_id)
                if not detail:
                    try:
                        items = client.get_json(DETAIL_URL.format(id=job_id)).get("items") or []
                        detail = parse_detail(items[0]) if items else None
                    except Exception:  # noqa: BLE001
                        detail = None
                    if detail:
                        cache.set(job_id, detail)
                    else:
                        self.last_listings_complete = False
                        detail = {}
                city, province = split_location(req.get("PrimaryLocation"))
                contract = (
                    _CONTRACT.get((detail.get("contract") or "").lower())
                    or guess_contract(title)
                    or guess_contract((detail.get("description") or "")[:1500])
                    or ("Jornada completa" if (detail.get("schedule") or "").lower() == "full time" else None)
                )
                jobs.append(JobPayload(
                    title=title,
                    company=COMPANY,
                    location_district=region_with_fallback(city, province, title=title),
                    location_concelho=city,
                    profession=es_profession(title),
                    specialty=None,
                    sector="privado",
                    contract_type=contract,
                    description=detail.get("description") or title,
                    requirements=None,
                    salary=None,
                    application_url=JOB_URL.format(id=job_id),
                    source=self.slug,
                    source_id=job_id,
                    published_at=iso_date(req.get("PostedDate")),
                    expires_at=iso_date(req.get("PostingEndDate") or detail.get("end")),
                ))
        finally:
            client.close()
        cache.save(prune=self.last_listings_complete)
        return jobs
