"""IVC Evidensia España (Teamtailor ibérico carreras.ivcevidensia.es; solo ofertas en España)."""
from __future__ import annotations

from dataclasses import replace

from common.models import BaseScraper, JobPayload

from ._teamtailor_es import fetch_teamtailor_es


class IvcEvidensiaScraper(BaseScraper):
    slug = "ivc_evidensia"
    name = "IVC Evidensia — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_es(
            "https://carreras.ivcevidensia.es", self.slug, "IVC Evidensia"
        )
        self.last_listings_complete = complete
        # Grupo veterinario: todas las ofertas son de veterinaria.
        return [replace(job, profession="Veterinaria") for job in jobs]
