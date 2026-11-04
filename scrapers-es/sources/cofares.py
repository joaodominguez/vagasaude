"""Cofares (SAP SuccessFactors, empleo.cofares.es): distribución farmacéutica; solo roles sanitarios (farmacia)."""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._sf_es import fetch_sf_es


class CofaresScraper(BaseScraper):
    slug = "cofares"
    name = "Cofares — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_sf_es("https://empleo.cofares.es", self.slug, "Cofares")
        self.last_listings_complete = complete
        return jobs
