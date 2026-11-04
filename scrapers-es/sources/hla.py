"""Grupo Hospitalario HLA (Teamtailor, trabajaconnosotros.grupohla.com)."""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._private_es import fetch_teamtailor_private


class HlaScraper(BaseScraper):
    slug = "hla"
    name = "Grupo HLA — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_private("https://trabajaconnosotros.grupohla.com", self.slug, "Grupo HLA")
        self.last_listings_complete = complete
        return jobs
