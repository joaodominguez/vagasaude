"""Impress (ortodoncia; Teamtailor, impress.teamtailor.com): solo ofertas de España y roles clínicos.

El board mezcla ~10 países y puestos corporativos (Barcelona HQ). `parse_item` ya descarta las ofertas
que no son de España y `is_health_role` las no sanitarias. La ciudad del ATS es la de la clínica de
referencia: cuando el título lleva otra ciudad ("Auxiliar Dental - Toledo 21 H") se usa la del título.
"""
from __future__ import annotations

import re

from common.models import BaseScraper, JobPayload

from ._es_common import region_from
from ._private_es import fetch_teamtailor_private

_HOURS_RE = re.compile(r"\s*\d+\s*h(?:oras)?\b.*$", re.I)


def city_from_title(title: str) -> str | None:
    """'Ortodoncista - Valladolid - 26h' -> 'Valladolid' (solo si es una ciudad conocida)."""
    for part in title.split(" - ")[1:]:
        candidate = _HOURS_RE.sub("", part).strip()
        if candidate and region_from(candidate, None) != "España":
            return candidate
    return None


class ImpressScraper(BaseScraper):
    slug = "impress"
    name = "Impress — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        jobs, complete = fetch_teamtailor_private("https://impress.teamtailor.com", self.slug, "Impress")
        for job in jobs:
            city = city_from_title(job.title)
            if city and city.lower() != (job.location_concelho or "").lower():
                job.location_concelho = city.title()
                job.location_district = region_from(city, None)
        self.last_listings_complete = complete
        return jobs
