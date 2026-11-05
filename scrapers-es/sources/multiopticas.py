"""Multiópticas (Teamtailor empleo.multiopticas.com): solo ópticos-optometristas y audioprotesistas.

El feed mezcla ~70 ofertas: ópticos/as, auxiliares de óptica (comercial, fuera) y puestos
corporativos (fuera). En esta cadena "Óptico/a" a secas es el óptico-optometrista titulado
(profesión sanitaria regulada), pero `is_clinical` solo reconoce "optometrista"/"audioprotesista",
así que aquí se decide el filtro y se reutiliza `parse_item` para el resto de campos.
"""
from __future__ import annotations

import re
from dataclasses import replace

from common.http import HttpClient
from common.models import BaseScraper, JobPayload
from common.normalize import norm

from ._private_es import EXTRA_CITY_REGION
from ._teamtailor_es import MAX_PAGES, parse_item

BASE_URL = "https://empleo.multiopticas.com"
COMPANY = "Multiópticas"
PROFESSION = "Óptica y audiología"

_ROLE_RE = re.compile(r"\boptico\b|optometr|audioprot|audiolog")
_EXCLUDE_RE = re.compile(r"^auxiliar|manager|gerente|responsable|comercial|\berp\b|informatic")


def is_optical_health_role(title: str) -> bool:
    t = norm(title)
    return bool(_ROLE_RE.search(t)) and not _EXCLUDE_RE.search(t)


class MultiopticasScraper(BaseScraper):
    slug = "multiopticas"
    name = "Multiópticas — Empleo"
    last_listings_complete = True

    def fetch(self) -> list[JobPayload]:
        client = HttpClient(min_interval=1.0)
        jobs: list[JobPayload] = []
        seen: set[str] = set()
        url: str | None = f"{BASE_URL}/jobs.json"
        pages = 0
        try:
            while url and pages < MAX_PAGES:
                pages += 1
                try:
                    data = client.get_json(url)
                except Exception:  # noqa: BLE001
                    if pages == 1:
                        raise
                    self.last_listings_complete = False
                    break
                for item in data.get("items", []):
                    title = (item.get("title") or "").strip()
                    if not is_optical_health_role(title):
                        continue
                    # parse_item exige is_clinical(title): se le pasa un título "clínico" y se restaura el real.
                    job = parse_item(dict(item, title=f"Optometrista {title}"), self.slug, COMPANY)
                    if not job or not job.application_url or job.source_id in seen:
                        continue
                    seen.add(job.source_id)
                    district = job.location_district
                    if district == "España":
                        district = EXTRA_CITY_REGION.get(job.location_concelho or "", "España")
                    jobs.append(replace(job, title=title, profession=PROFESSION, location_district=district))
                url = data.get("next_url")
            if url:
                self.last_listings_complete = False
        finally:
            client.close()
        return jobs
