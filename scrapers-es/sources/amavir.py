from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._teamtailor_es import fetch_teamtailor_es


class AmavirScraper(BaseScraper):
    slug = "amavir"
    name = "Amavir — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_es("https://empleo.amavir.es", self.slug, "Amavir")
        self.last_listings_complete = complete
        return jobs
