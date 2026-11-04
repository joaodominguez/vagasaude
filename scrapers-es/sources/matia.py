"""Fundación Matia (Gipuzkoa; Teamtailor). Entidad sin ánimo de lucro concertada con la Diputación Foral."""
from __future__ import annotations

from common.models import BaseScraper, JobPayload

from ._private_es import fetch_teamtailor_private


class MatiaScraper(BaseScraper):
    slug = "matia"
    name = "Fundación Matia — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        # Todos los centros están en Gipuzkoa/Bizkaia: sin dirección en la oferta -> País Vasco.
        jobs, complete = fetch_teamtailor_private(
            "https://matia.teamtailor.com", self.slug, "Fundación Matia",
            sector="concertado", default_region="País Vasco",
        )
        self.last_listings_complete = complete
        return jobs
