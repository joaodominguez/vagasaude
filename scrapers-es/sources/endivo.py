"""Endivo Consulting (consultora de selección sanitaria, Teamtailor): enfermería y medicina en clínicas y hospitales."""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._private_es import fetch_teamtailor_private


class EndivoScraper(BaseScraper):
    slug = "endivo"
    name = "Endivo Consulting — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_private("https://endivoconsulting.teamtailor.com", self.slug, "Endivo Consulting")
        self.last_listings_complete = complete
        return jobs
