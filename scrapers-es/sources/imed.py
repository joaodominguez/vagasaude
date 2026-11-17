"""IMED Hospitales (Teamtailor, imedhospitales.teamtailor.com; portal empleo.imedhospitales.com).

robots.txt de Teamtailor solo bloquea /app/, /messages/, /jobs/internal/ y el bot `aihitdata`.
"""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._private_es import fetch_teamtailor_private


class ImedScraper(BaseScraper):
    slug = "imed"
    name = "IMED Hospitales — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_private("https://imedhospitales.teamtailor.com", self.slug, "IMED Hospitales")
        self.last_listings_complete = complete
        return jobs
