"""Affidea España (Recruitee, affideaspain.recruitee.com): diagnóstico por imagen y consultas médicas."""
from __future__ import annotations

from datetime import timezone, datetime

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import guess_contract, html_to_text

from ._es_common import es_profession, iso_date
from ._private_es import is_health_role, region_with_fallback

API = "https://affideaspain.recruitee.com/api/offers/"
_EMPLOYMENT = {
    "fulltime_permanent": "Indefinido",
    "parttime_permanent": "Indefinido",
    "fulltime_temporary": "Temporal",
    "parttime_temporary": "Temporal",
}
# Recruitee marca la categoría; títulos de especialidad suelta ("Reumatólogo", "Endocrino")
# no los reconoce el normalizador, así que para Affidea basta category=healthcare / depto Medicina.
_HEALTH_DEPARTMENTS = {"medicina", "clinical", "enfermería", "enfermeria", "radiología", "radiologia", "técnicos", "tecnicos"}


def _date(value: str | None) -> str | None:
    # "2025-09-30 11:26:09 UTC"
    if not value:
        return None
    try:
        return datetime.strptime(value.replace(" UTC", ""), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        return iso_date(value)


def parse_offer(offer: dict, slug: str = "affidea") -> JobPayload | None:
    if (offer.get("country_code") or "ES").upper() != "ES" or offer.get("status", "published") != "published":
        return None
    title = (offer.get("title") or "").strip().rstrip(".")
    if not title:
        return None
    dept = (offer.get("department") or "").strip().lower()
    category = offer.get("category_code")
    if not (is_health_role(title) or category == "healthcare" or dept in _HEALTH_DEPARTMENTS):
        return None
    city = (offer.get("city") or "").strip() or None
    region = (offer.get("state_name") or "").strip() or None
    profession = es_profession(title)
    if profession == "Otros" and category == "healthcare" and "medic" in f"{title} {offer.get('description') or ''}"[:400].lower():
        profession = "Medicina"  # "Reumatólogo", "Endocrino"... (ver sugerencia de normalize en el informe)
    description = html_to_text(offer.get("description")) or title
    requirements = html_to_text(offer.get("requirements")) or None
    contract = guess_contract(title) or _EMPLOYMENT.get(offer.get("employment_type_code") or "") or guess_contract(description[:1500])
    return JobPayload(
        title=title,
        company="Affidea",
        location_district=region_with_fallback(city, region, offer.get("postal_code"), title),
        location_concelho=city,
        profession=profession,
        specialty=None,
        sector="privado",
        contract_type=contract,
        description=description,
        requirements=requirements,
        salary=None,
        application_url=offer.get("careers_url") or "",
        source=slug,
        source_id=str(offer.get("id") or offer.get("guid")),
        published_at=_date(offer.get("published_at") or offer.get("created_at")),
    )


class AffideaScraper(BaseScraper):
    slug = "affidea"
    name = "Affidea España — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient()
        try:
            data = client.get_json(API)
        finally:
            client.close()
        jobs, seen = [], set()
        for offer in data.get("offers", []):
            job = parse_offer(offer, self.slug)
            if job and job.application_url and job.source_id not in seen:
                seen.add(job.source_id)
                jobs.append(job)
        return jobs
