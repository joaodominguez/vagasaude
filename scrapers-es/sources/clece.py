"""Clece (SAP SuccessFactors alojado en canaldeempleo.es/CLECE): solo puestos sanitarios / sociosanitarios."""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._sf_es import fetch_sf_es


class CleceScraper(BaseScraper):
    slug = "clece"
    name = "Clece — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_sf_es("https://canaldeempleo.es", self.slug, "Clece", search_prefix="/CLECE")
        self.last_listings_complete = complete
        return jobs
