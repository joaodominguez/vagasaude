"""Clínica Baviera (Teamtailor, empleo.clinicabaviera.com): oftalmología, optometría, enfermería."""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._private_es import fetch_teamtailor_private


class ClinicaBavieraScraper(BaseScraper):
    slug = "clinicabaviera"
    name = "Clínica Baviera — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_private("https://empleo.clinicabaviera.com", self.slug, "Clínica Baviera")
        self.last_listings_complete = complete
        return jobs
