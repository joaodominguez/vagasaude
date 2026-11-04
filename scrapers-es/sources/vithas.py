"""Vithas (SAP SuccessFactors, empleo.vithas.es)."""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._sf_es import fetch_sf_es


class VithasScraper(BaseScraper):
    slug = "vithas"
    name = "Vithas — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_sf_es("https://empleo.vithas.es", self.slug, "Vithas")
        self.last_listings_complete = complete
        return jobs
