from __future__ import annotations

from common.models import BaseScraper, JobPayload
from sources._ats_pt import fetch_teamtailor


class IvcEvidensiaScraper(BaseScraper):
    slug = "ivc_evidensia"
    name = "IVC Evidensia"

    def fetch(self) -> list[JobPayload]:
        # Feed Teamtailor ibérico (Espanha + Portugal): só PT e funções clínicas.
        return fetch_teamtailor(
            "https://carreras.ivcevidensia.es/jobs.json",
            slug=self.slug,
            company="IVC Evidensia",
        )
