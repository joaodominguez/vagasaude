"""AniCura España (Teamtailor empleo.anicura.es): hospitales y clínicas veterinarias."""
from __future__ import annotations

from dataclasses import replace

from common.models import BaseScraper, JobPayload

from ._teamtailor_es import fetch_teamtailor_es


class AnicuraScraper(BaseScraper):
    slug = "anicura"
    name = "AniCura — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_es("https://empleo.anicura.es", self.slug, "AniCura")
        self.last_listings_complete = complete
        # Grupo veterinario: "Medicina interna", "Cirugía"... son puestos de veterinaria.
        return [replace(job, profession="Veterinaria") for job in jobs]
