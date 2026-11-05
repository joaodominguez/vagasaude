"""TalentSalud (consultora de selección sanitaria, Teamtailor): ofertas para clínicas y hospitales de toda España."""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._private_es import fetch_teamtailor_private


class TalentSaludScraper(BaseScraper):
    slug = "talentsalud"
    name = "TalentSalud — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_private("https://talentsalud.teamtailor.com", self.slug, "TalentSalud")
        self.last_listings_complete = complete
        return jobs
