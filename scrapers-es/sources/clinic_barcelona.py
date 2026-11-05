"""Hospital Clínic de Barcelona: jobs.clinicbarcelona.org es Teamtailor (feed jobs.json).

La página de ofertas de clinicbarcelona.org pagina con ?page=N pero enlaza a este mismo
conjunto (~10 ofertas, la paginación repite la primera página), así que se usa el feed.
"""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._private_es import is_health_role
from ._teamtailor_es import fetch_teamtailor_es

BASE = "https://jobs.clinicbarcelona.org"
COMPANY = "Hospital Clínic de Barcelona"


class ClinicBarcelonaScraper(BaseScraper):
    slug = "clinic_barcelona"
    name = "Hospital Clínic de Barcelona — Ofertas"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_es(BASE, self.slug, COMPANY)
        out = []
        for job in jobs:
            if not is_health_role(job.title):
                continue
            job.sector = "publico"
            job.location_district = "Cataluña"
            job.location_concelho = job.location_concelho or "Barcelona"
            out.append(job)
        self.last_listings_complete = complete
        return out
