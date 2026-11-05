"""Actual Talent / WINiD (Teamtailor): consultora de selección; solo las ofertas sanitarias (~7 de 100).

El tenant es mayoritariamente industrial/directivo y multi-país; el filtro `is_health_role` y el
filtro de país de `fetch_teamtailor_es` dejan solo puestos sanitarios en España.
"""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._private_es import fetch_teamtailor_private


class WinidScraper(BaseScraper):
    slug = "winid"
    name = "Actual Talent — Empleo sanitario"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_private("https://winid.teamtailor.com", self.slug, "Actual Talent")
        self.last_listings_complete = complete
        return jobs
