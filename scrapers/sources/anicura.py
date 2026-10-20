from __future__ import annotations

from common.models import BaseScraper, JobPayload
from sources._ats_pt import fetch_teamtailor


class AnicuraScraper(BaseScraper):
    slug = "anicura"
    name = "AniCura"

    def fetch(self) -> list[JobPayload]:
        # Teamtailor de AniCura Portugal: só funções clínicas.
        return fetch_teamtailor(
            "https://anicuraportugal.teamtailor.com/jobs.json",
            slug=self.slug,
            company="AniCura",
        )
