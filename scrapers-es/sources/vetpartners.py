"""Vet Partners (Teamtailor, equipo.talentovetpartners.com): veterinarios y auxiliares de clínicas/hospitales veterinarios."""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._private_es import fetch_teamtailor_private


class VetPartnersScraper(BaseScraper):
    slug = "vetpartners"
    name = "Vet Partners — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_private("https://equipo.talentovetpartners.com", self.slug, "Vet Partners")
        self.last_listings_complete = complete
        return jobs
